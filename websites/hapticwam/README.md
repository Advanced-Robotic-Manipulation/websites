# HapticWAM technical report website

A static, English-language research report with locally hosted real-robot video,
interactive scientific figures, and an offline contact-prediction explorer.
No npm dependencies, backend, external fonts, or runtime Hugging Face requests.

## Preview

```sh
cd websites/hapticwam
npm run dev
```

Open http://localhost:4173. `python3 -m http.server 4173` is equivalent.
Serve the directory over HTTP; ES modules and the JSON explorer do not work
reliably when opening `index.html` as a `file://` URL.

## Verify

```sh
npm run check
```

Also exercise the three videos, teacher/student switch, all chart task switches,
contact episode/channel/fingertip/horizon controls, and citation copy in a browser.

## Deploy

Publish the **contents** of this directory to any static host or GitHub Pages.
All internal paths are relative, so deployment under a project subpath works.
There is no build step. The live deployment is
https://advanced-robotic-manipulation.github.io/websites/websites/hapticwam/,
in the `Advanced-Robotic-Manipulation/websites` repository, branch `main`.

## Scientific sources

- Text and aggregate numbers: `papers/icra_tactile_wm/source/`, the supplied
  Konstantin 3 revision of 20 September 2026. `assets/hapticwam.pdf` is its
  compiled nine-page manuscript. `assets/results.csv` exposes the exact counts
  and force summaries. `data.js` holds the same values for charts.
- Videos: seed 101 of the deployed student (`stu_simft_001000`), one per task.
  Episode identity is checked against `meta.json`, rather than inferred from
  filenames (which also use `ep_student` for some baseline recordings).
  Timestamped camera streams are resampled to 15 fps with nearest-frame matching,
  preserving real-time duration. No interpolated frames or generated imagery.
- Figure 4: six **recorded rollouts**, student and teacher for each task at seed
  101, including unsuccessful teacher trials. A single composite video keeps
  camera and both recorded tactile deformation heatmaps synchronized. Heatmaps
  use absolute depth (channel 2 of each 72×96×8 fields_ds stream), with one fixed
  native-unit scale per task (0–0.4 waffles/carton; 0–1 egg), shared across teacher,
  student and both fingers, no per-frame contrast
  normalization. They are not pressure in newtons. Recorded signed
  fingertip Fz traces use original timestamps and a shared force axis per task.
  Tactile images are not predictions, nor student-model inputs. The previous
  offline contact-prediction assets remain archived but are no longer displayed.
- Force charts show published means and standard deviations, not invented raw
  distributions. Missing data remain missing. Wilson intervals are descriptive.
- Teacher/student model observations and the tactile-assisted executor are
  explicitly distinguished throughout the report.

`assets/provenance.json` records pinned HF revisions, episode identifiers, source
URLs, and derived-asset checksums. Source archives are linked from the figures.
`setup.webp` and `architecture.webp` are WebP conversions of the supplied paper
figures. `framework-overview.png` and `framework-internals.png` are byte-for-byte
original manuscript figures displayed inline in the Method section, with an
accessible zoom viewer and original-resolution download links. The compact
teacher/student schematic is a secondary, expandable comparison. The prose
describes tokenization, the codec, attention masking, ACC gates, and HID losses.
PDF and figure provenance is the same manuscript, not generated art.

The inline internals figure now uses the author-supplied `IMG_2636.png`, stored
unchanged as `framework-internals-2636.png`; the earlier manuscript figure is
retained. Its hash and origin are in `assets/provenance.json`. The supplied
figure's trainable-module flame markers are preserved as part of the image.
Website link decorations use SVG icons, not emoji/text arrows. GitHub and
Hugging Face marks in `assets/icons.svg` are from Simple Icons (CC0); utility
icons are local SVG paths. The manuscript links to a local PDF, so it uses a
document icon rather than implying an arXiv publication that is not linked.

The current `icons-v2.svg` uses Hugging Face's official full-color logo from
`https://huggingface.co/front/assets/huggingface_logo-noborder.svg`; GitHub and
arXiv marks are from Simple Icons. The arXiv entry is explicitly disabled and
labelled “Coming soon” until a manuscript URL is available.

## Regenerate archived media

Use Python 3.12 with `numpy`, `Pillow`, `requests`, and `zarr<3`, plus `ffmpeg`:

```sh
python scripts/prepare_media.py
python scripts/prepare_rollouts.py
```

The script downloads only selected public streams and arrays at pinned commits.
Raw inputs are cached under the operating system temporary directory, outside
the repository. Browser assets are written to `assets/`. The generated MP4s
for the opening demos are about 1–1.5 MB each. Figure 4 adds six composite clips,
roughly 0.8–4.5 MB each; only the selected clip is loaded. Its provenance,
synchronization offsets and un-smoothed force traces are in `assets/rollouts.json`.
The camera is about 15 Hz, tactile fields and wrench about 8 Hz;
15 fps playback repeats the nearest recorded tactile field, not synthetic frames.

## Files

- `index.html`: report prose, accessible structure, resource and source links.
- `styles.css`: editorial layout, typography, responsive design.
- `data.js`, `charts.js`: manuscript data and responsive SVG plots.
- `rollout.js`: synchronized recorded-video playback, force plots and seeking.
- `explorer.js`: previous contact-field viewer, retained but no longer imported.
- `diagram-viewer.js`: original architecture figures, zoom, and modal focus handling.
- `app.js`: figure controls, lazy loading, navigation, playback, citation copy.
- `DESIGN.md`: accepted visual direction and implementation decisions.

Research archive media are CC BY 4.0; consult the linked dataset cards. Citation
is a manuscript entry, without an invented publication venue or arXiv ID.
