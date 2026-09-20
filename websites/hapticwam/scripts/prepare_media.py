"""Build browser assets from pinned public HapticWAM research archives.

Requires numpy, Pillow, requests, zarr<3 and ffmpeg. Does not run a model.
"""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import csv
import hashlib
import io
import json
import subprocess
import tempfile

import numpy as np
from PIL import Image
import requests
import zarr
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets"
CACHE = Path(tempfile.gettempdir()) / "hapticwam-web-media"
RESULT_REV = "34d04a1f6f6ee91910e68cdf7ca44de998ff31ad"
RIG_REV = "fedce3c41d122b9f2cba6584e7aecce68a365a23"
RESULT = f"https://huggingface.co/datasets/armteam/hapticwam-results/resolve/{RESULT_REV}/repo_docs_results/rig_0916/"
RIG = f"https://huggingface.co/datasets/armteam/hapticwam-rig-episodes/resolve/{RIG_REV}/"
EPISODES = {
    "waffles": "ep_student_waffles_1789500023_000",
    "carton": "ep_student_Carton_1789499088_000",
    "egg": "ep_student_egg_1789511366_000",
}


def download(url, dest):
    dest = Path(dest)
    if not dest.exists():
        session = requests.Session()
        session.mount("https://", HTTPAdapter(max_retries=Retry(total=4, backoff_factor=1, status_forcelist=[429, 500, 502, 503, 504])))
        r = session.get(url, timeout=90)
        r.raise_for_status()
        dest.parent.mkdir(parents=True, exist_ok=True)
        temporary = dest.with_name(dest.name + ".partial")
        temporary.write_bytes(r.content)
        temporary.replace(dest)
    return dest


def episode_video(item):
    task, episode = item
    prefix = f"20260915_experiment/{episode}/camera_scene_color.zarr"
    url = f"https://huggingface.co/api/datasets/armteam/hapticwam-rig-episodes/tree/{RIG_REV}/{prefix}?recursive=true&limit=1000"
    r = requests.get(url, timeout=60)
    r.raise_for_status()
    files = [v["path"] for v in r.json() if v["type"] == "file"]
    with ThreadPoolExecutor(max_workers=6) as pool:
        list(pool.map(lambda p: download(RIG + p, CACHE / p), files))
    group = zarr.open(str(CACHE / prefix), mode="r")
    ts = np.asarray(group["ts"])
    data = group["data"][:]
    duration = float(ts[-1] - ts[0])
    # Resample using actual camera timestamps, rather than assuming a frame rate.
    fps = 15
    times = np.arange(0, duration, 1 / fps) + ts[0]
    indices = np.clip(np.searchsorted(ts, times), 0, len(ts) - 1)
    previous = np.maximum(indices - 1, 0)
    indices = np.where(abs(ts[previous] - times) < abs(ts[indices] - times), previous, indices)
    frames = CACHE / f"frames-{task}"
    frames.mkdir(exist_ok=True)
    for i, idx in enumerate(indices):
        (frames / f"{i:05d}.jpg").write_bytes(data[idx])
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-framerate", str(fps),
                    "-i", str(frames / "%05d.jpg"), "-c:v", "libx264", "-crf", "25",
                    "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(OUT / f"{task}.mp4")], check=True)
    Image.open(io.BytesIO(data[len(data)//3])).save(OUT / f"{task}-poster.webp", quality=85)
    meta = json.loads(download(RIG + f"20260915_experiment/{episode}/meta.json", CACHE / episode / "meta.json").read_text())
    assert "label:stu_simft_001000" in meta["tags"]
    return {"task": task, "episode": episode, "duration": duration, "fps": fps,
            "model": "Student · stu_simft_001000", "source": RIG + f"20260915_experiment/{episode}/meta.json",
            "video": f"assets/{task}.mp4", "poster": f"assets/{task}-poster.webp",
            "outcome": "Placed (operator verdict)", "seed": 101}


def prediction(task, stem):
    filename = f"wm_sensor_pred/{stem}_arrays.npz"
    source = download(RESULT + filename, CACHE / (stem + ".npz"))
    z = np.load(source, allow_pickle=False)
    facts = json.loads(str(z["facts"]))
    for i, frame in enumerate(z["real_frames"]):
        Image.fromarray(frame).save(OUT / f"{task}-contact-{i}.webp", quality=85)
    fields = {}
    for kind in ["pred", "obs"]:
        for key in ["mask", "d_fz", "wrench", "event", "slip"]:
            fields[f"{kind}_{key}"] = np.round(z[f"{kind}_{key}"].astype(float), 7).tolist()
    return {"task": task, "episode": facts["episode_name"], "checkpoint": facts["checkpoint"],
            "route": facts["route"], "source": RESULT + filename,
            "nfe": facts["nfe"], "seed": facts["seed"], "dt": facts["latent_dt_s"],
            "preClose": facts["pre_close_s"], "shape": facts["cpk_shape"],
            "frameOffsets": z["real_frame_dt"].tolist(), "events": facts["events_ontology"], **fields}


def main():
    OUT.mkdir(exist_ok=True)
    CACHE.mkdir(exist_ok=True)
    with ThreadPoolExecutor(max_workers=3) as pool:
        videos = list(pool.map(episode_video, EPISODES.items()))
    predictions = [prediction("waffles", "wm_sensor_pred_waffles_cell2_preclose"),
                   prediction("carton", "wm_sensor_pred_carton_001")]
    (OUT / "predictions.json").write_text(json.dumps(predictions, separators=(",", ":")))
    (OUT / "episodes.json").write_text(json.dumps(videos, indent=2))
    for name in ["per_take_final.csv", "per_take_egg.csv"]:
        download(RESULT + name, OUT / name)
    manifest = {"resultRevision": RESULT_REV, "rigRevision": RIG_REV, "episodes": videos,
                "predictions": [{k: p[k] for k in ["task", "episode", "checkpoint", "source", "route"]} for p in predictions],
                "license": "Research archive media: CC BY 4.0; see linked dataset cards.",
                "files": {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(OUT.iterdir()) if p.is_file() and p.name != "provenance.json"}}
    (OUT / "provenance.json").write_text(json.dumps(manifest, indent=2))
    print(json.dumps(videos, indent=2))


if __name__ == "__main__":
    main()
