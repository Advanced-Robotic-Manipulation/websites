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
    'carton': ['ep_student_Carton_1789499088_000', 'ep_teacher_Carton_1789501995_000'],
    'egg': ['ep_student_egg_1789511366_000', 'ep_teacher_egg_1789512403_000'],
}
STREAMS = ['camera_scene_color', 'tactile_left_infer_img', 'tactile_right_infer_img', 'tactile_left_wrench', 'tactile_right_wrench']


def nearest(ts, times):
    right = np.clip(np.searchsorted(ts, times), 0, len(ts) - 1)
    left = np.maximum(right - 1, 0)
    return np.where(abs(ts[left] - times) < abs(ts[right] - times), left, right)


def build(task, model, episode, verdicts):
    prefix = f'20260915_experiment/{episode}'
    url = f'https://huggingface.co/api/datasets/armteam/hapticwam-rig-episodes/tree/{RIG_REV}/{prefix}?recursive=true&limit=1000'
    response = requests.get(url, timeout=60); response.raise_for_status()
    assert 'rel="next"' not in response.headers.get('Link', ''), 'Handle pagination before exporting'
    paths = [x['path'] for x in response.json() if x['type'] == 'file' and any('/' + s + '.zarr/' in x['path'] for s in STREAMS)]
    with ThreadPoolExecutor(max_workers=6) as pool:
        list(pool.map(lambda p: download(RIG + p, CACHE / p), paths))
    meta = json.loads(download(RIG + prefix + '/meta.json', CACHE / prefix / 'meta.json').read_text())
    label = 'label:stu_simft_001000' if model == 'student' else 'label:v6_simft2k'
    assert label in meta['tags'] and 'seed:101' in meta['tags'], (episode, meta['tags'])
    groups = {s: zarr.open(str(CACHE / prefix / (s + '.zarr')), mode='r') for s in STREAMS}
    ts = {s: np.asarray(g['ts']) for s, g in groups.items()}
    for t in ts.values():
        assert len(t) > 1 and np.isfinite(t).all() and np.all(np.diff(t) > 0)
    start = max(t[0] for t in ts.values()); end = min(t[-1] for t in ts.values())
    fps = 15; times = np.arange(start, end, 1 / fps)
    data = {s: groups[s]['data'][:] for s in STREAMS[:3]}
    indices = {s: nearest(ts[s], times) for s in STREAMS[:3]}
    dest = OUT / f'rollout-{task}-{model}.mp4'
    command = ['ffmpeg', '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', '960x480', '-r', str(fps), '-i', '-', '-an', '-c:v', 'libx264', '-crf', '22', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', str(dest)]
    process = subprocess.Popen(command, stdin=subprocess.PIPE)
    for i in range(len(times)):
        canvas = Image.new('RGB', (960, 480), 'white')
        scene = Image.open(io.BytesIO(data[STREAMS[0]][indices[STREAMS[0]][i]])).convert('RGB').resize((640, 480))
        canvas.paste(scene, (0, 0))
        for k, side in enumerate(['left', 'right']):
            key = f'tactile_{side}_infer_img'
            pad = Image.fromarray(data[key][indices[key][i]]).convert('RGB').resize((320, 240))
            canvas.paste(pad, (640, 240 * k))
        if i == 0:
            canvas.save(OUT / f'rollout-{task}-{model}.webp', quality=90)
        process.stdin.write(canvas.tobytes())
    process.stdin.close(); assert process.wait() == 0
    force = {}
    for side in ['left', 'right']:
        key = f'tactile_{side}_wrench'; values = np.asarray(groups[key]['data'])[:, 2]
        select = (ts[key] >= start) & (ts[key] <= end)
        assert np.isfinite(values[select]).all()
        force[side] = np.round(np.column_stack((ts[key][select] - start, values[select])), 5).tolist()
    entry = {'task': task, 'model': model, 'episode': episode, 'seed': 101,
             'video': 'assets/' + dest.name, 'poster': f'assets/rollout-{task}-{model}.webp',
             'duration': float(times[-1] - start), 'fps': fps, 'masterStart': float(start),
             'source': RIG + prefix + '/meta.json', 'revision': RIG_REV, 'label': label,
             'outcome': 'Placed' if verdicts[episode]['operator_placed'] == 'True' else 'Not placed',
             'force': force, 'forceUnit': 'N', 'forceSignal': 'Signed Fz, recorded tactile wrench component 2; no baseline subtraction or smoothing',
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
        entries = list(pool.map(lambda args: build(*args, verdicts), jobs))
    manifest = {'revision': RIG_REV, 'selection': 'Seed 101 for each task and model; not selected for successful outcome.',
                'synchronization': 'Common MasterClock overlap; images nearest-neighbor resampled to 15 fps. No frame interpolation. Force samples retain their recorded timestamps.',
                'forceUnitsSource': 'configs/hardware.nuc.yaml: tactile.force_unit_to_N = 1.0; driver exports [Fx,Fy,Fz,Tx,Ty,Tz]. No independent calibration accuracy claim.',
                'episodes': entries}
    (OUT / 'rollouts.json').write_text(json.dumps(manifest, separators=(',', ':')))


if __name__ == '__main__':
    main()
