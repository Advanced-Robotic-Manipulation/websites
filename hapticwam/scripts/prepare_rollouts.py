"""Synchronized recorded camera/tactile rollouts, pinned HF inputs; no model inference."""
from concurrent.futures import ThreadPoolExecutor
import csv
import io
import json
import subprocess

import numpy as np
from PIL import Image
import requests
import zarr

from prepare_media import CACHE, OUT, RIG, RIG_REV, download

PAIRS = {
    'waffles': ['ep_student_waffles_1789500023_000', 'ep_teacher_waffles_1789500996_000'],
    'carton': ['ep_student_Carton_1789499088_000', 'ep_teacher_Carton_1789502351_008'],
    'egg': ['ep_student_egg_1789511438_001', 'ep_teacher_egg_1789512434_001'],
}
STREAMS = ['camera_scene_color', 'tactile_left_fields_ds', 'tactile_right_fields_ds', 'tactile_left_wrench', 'tactile_right_wrench']
# Canonical recorded stack: deformation xy, depth, shear xy, distributed force xyz.
DEPTH_CHANNEL = 2
COLOR_STOPS = np.array([[68, 1, 84], [59, 82, 139], [33, 145, 140], [94, 201, 98], [253, 231, 37]], dtype=float)


def field_range(episode):
    """Download the actual recorded fields and inspect their full range, not images."""
    prefix = f'20260915_experiment/{episode}'
    response = requests.get(f'https://huggingface.co/api/datasets/armteam/hapticwam-rig-episodes/tree/{RIG_REV}/{prefix}?recursive=true&limit=1000', timeout=60)
    response.raise_for_status()
    assert 'rel="next"' not in response.headers.get('Link', '')
    paths = [x['path'] for x in response.json() if x['type'] == 'file' and any('/' + s + '.zarr/' in x['path'] for s in STREAMS[1:3])]
    with ThreadPoolExecutor(max_workers=6) as pool:
        list(pool.map(lambda p: download(RIG + p, CACHE / p), paths))
    maximum = 0.
    for s in STREAMS[1:3]:
        a = zarr.open(str(CACHE / prefix / (s + '.zarr')), mode='r')['data'][:, :, :, DEPTH_CHANNEL].astype(float)
        assert np.isfinite(a).all()
        maximum = max(maximum, float(np.abs(a).max()))
    print('Depth range', episode, maximum, flush=True)
    return maximum


def depth_heatmap(values, maximum):
    t = np.clip(np.abs(values.astype(float)) / maximum, 0, 1) * (len(COLOR_STOPS) - 1)
    lo = np.minimum(t.astype(int), len(COLOR_STOPS) - 2)
    fraction = (t - lo)[..., None]
    rgb = np.rint(COLOR_STOPS[lo] * (1 - fraction) + COLOR_STOPS[lo + 1] * fraction).astype(np.uint8)
    return Image.fromarray(rgb).resize((320, 240), Image.Resampling.NEAREST)


def nearest(ts, times):
    right = np.clip(np.searchsorted(ts, times), 0, len(ts) - 1)
    left = np.maximum(right - 1, 0)
    return np.where(abs(ts[left] - times) < abs(ts[right] - times), left, right)


def build(task, model, episode, verdicts, maximum):
    prefix = f'20260915_experiment/{episode}'
    url = f'https://huggingface.co/api/datasets/armteam/hapticwam-rig-episodes/tree/{RIG_REV}/{prefix}?recursive=true&limit=1000'
    response = requests.get(url, timeout=60); response.raise_for_status()
    assert 'rel="next"' not in response.headers.get('Link', ''), 'Handle pagination before exporting'
    paths = [x['path'] for x in response.json() if x['type'] == 'file' and any('/' + s + '.zarr/' in x['path'] for s in STREAMS)]
    with ThreadPoolExecutor(max_workers=6) as pool:
        list(pool.map(lambda p: download(RIG + p, CACHE / p), paths))
    meta = json.loads(download(RIG + prefix + '/meta.json', CACHE / prefix / 'meta.json').read_text())
    label = 'label:stu_simft_001000' if model == 'student' else 'label:v6_simft2k'
    assert label in meta['tags'], (episode, meta['tags'])
    seed = int(next(tag.split(':', 1)[1] for tag in meta['tags'] if tag.startswith('seed:')))
    assert seed == int(verdicts[episode]['cell'])
    assert verdicts[episode]['arm'] == label.removeprefix('label:')
    assert verdicts[episode]['operator_placed'] == 'True'
    groups = {s: zarr.open(str(CACHE / prefix / (s + '.zarr')), mode='r') for s in STREAMS}
    ts = {s: np.asarray(g['ts']) for s, g in groups.items()}
    for t in ts.values():
        assert len(t) > 1 and np.isfinite(t).all() and np.all(np.diff(t) > 0)
    start = max(t[0] for t in ts.values()); end = min(t[-1] for t in ts.values())
    fps = 15; times = np.arange(start, end, 1 / fps)
    data = {s: groups[s]['data'][:] for s in STREAMS[:3]}
    indices = {s: nearest(ts[s], times) for s in STREAMS[:3]}
    # Episode-specific filenames prevent a cached old clip being paired with new traces.
    stem = f'rollout-heatmap-{task}-{model}-{episode.rsplit("_", 2)[1]}'
    dest = OUT / f'{stem}.mp4'
    command = ['ffmpeg', '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', '960x480', '-r', str(fps), '-i', '-', '-an', '-c:v', 'libx264', '-crf', '22', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', str(dest)]
    process = subprocess.Popen(command, stdin=subprocess.PIPE)
    for i in range(len(times)):
        canvas = Image.new('RGB', (960, 480), 'white')
        scene = Image.open(io.BytesIO(data[STREAMS[0]][indices[STREAMS[0]][i]])).convert('RGB').resize((640, 480))
        canvas.paste(scene, (0, 0))
        for k, side in enumerate(['left', 'right']):
            key = f'tactile_{side}_fields_ds'
            pad = depth_heatmap(data[key][indices[key][i], :, :, DEPTH_CHANNEL], maximum)
            canvas.paste(pad, (640, 240 * k))
        if i == 0:
            canvas.save(OUT / f'{stem}.webp', quality=90)
        process.stdin.write(canvas.tobytes())
    process.stdin.close(); assert process.wait() == 0
    force = {}
    for side in ['left', 'right']:
        key = f'tactile_{side}_wrench'; values = np.asarray(groups[key]['data'])[:, 2]
        select = (ts[key] >= start) & (ts[key] <= end)
        assert np.isfinite(values[select]).all()
        force[side] = np.round(np.column_stack((ts[key][select] - start, values[select])), 5).tolist()
    entry = {'task': task, 'model': model, 'episode': episode, 'seed': seed,
             'video': 'assets/' + dest.name, 'poster': f'assets/{stem}.webp',
             'duration': float(times[-1] - start), 'fps': fps, 'masterStart': float(start),
             'source': RIG + prefix + '/meta.json', 'revision': RIG_REV, 'label': label,
             'outcome': 'Placed' if verdicts[episode]['operator_placed'] == 'True' else 'Not placed',
             'force': force, 'forceUnit': 'N', 'forceSignal': 'Signed Fz, recorded tactile wrench component 2; no baseline subtraction or smoothing',
             'heatmap': {'signal': 'Absolute recorded depth field', 'channel': DEPTH_CHANNEL, 'shape': [72, 96], 'unit': 'native sensor units', 'scale': [0, maximum], 'colorStops': COLOR_STOPS.astype(int).tolist(), 'sourceStreams': STREAMS[1:3]},
             'maxImageOffsetMs': {s: round(float(np.max(abs(ts[s][indices[s]] - times))) * 1000, 1) for s in STREAMS[:3]},
             'streamMedianStepMs': {s: round(float(np.median(np.diff(t))) * 1000, 1) for s, t in ts.items()}}
    print(task, model, round(entry['duration'], 2), entry['maxImageOffsetMs'], flush=True)
    return entry


def main():
    verdicts = {}
    for name in ['per_take_final.csv', 'per_take_egg.csv']:
        verdicts.update({r['episode']: r for r in csv.DictReader((OUT / name).open())})
    jobs = [(task, model, episode) for task, pair in PAIRS.items() for model, episode in zip(['student', 'teacher'], pair)]
    with ThreadPoolExecutor(max_workers=2) as pool:
        ranges = dict(zip([e for _, _, e in jobs], pool.map(field_range, [e for _, _, e in jobs])))
    # A shared full-range scale per task preserves teacher/student comparison.
    # Round upward; never clip values or rescale per frame or fingertip.
    # Preserve the established task scales; expand only if a new recording requires it.
    scales = {'waffles': .4, 'carton': .4, 'egg': 1.0}
    maxima = {task: max(scales[task], float(np.ceil(max(ranges[e] for e in pair) * 10) / 10)) for task, pair in PAIRS.items()}
    old_path = OUT / 'rollouts.json'
    previous = json.loads(old_path.read_text())['episodes'] if old_path.exists() else []
    def export(args):
        task, model, episode = args
        existing = next((e for e in previous if e['episode'] == episode and e['revision'] == RIG_REV
                         and e['heatmap']['scale'] == [0, maxima[task]]
                         and (OUT.parent / e['video']).exists() and (OUT.parent / e['poster']).exists()), None)
        return existing if existing else build(*args, verdicts, maxima[task])
    with ThreadPoolExecutor(max_workers=2) as pool:
        entries = list(pool.map(export, jobs))
    manifest = {'revision': RIG_REV, 'selection': 'Selected successful executions, visually reviewed for clear grasp, transport and placement. Seeds may differ between teacher and student. Illustrative examples; aggregate results use the full evaluation.',
                'synchronization': 'Common MasterClock overlap; camera and recorded depth fields nearest-neighbor resampled to 15 fps. No temporal interpolation. Force samples retain their recorded timestamps.',
                'forceUnitsSource': 'configs/hardware.nuc.yaml: tactile.force_unit_to_N = 1.0; driver exports [Fx,Fy,Fz,Tx,Ty,Tz]. No independent calibration accuracy claim.',
                'episodes': entries}
    (OUT / 'rollouts.json').write_text(json.dumps(manifest, separators=(',', ':')))


if __name__ == '__main__':
    main()
