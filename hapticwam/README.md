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
https://advanced-robotic-manipulation.github.io/websites/hapticwam/,
in the `Advanced-Robotic-Manipulation/websites` repository, branch `main`,
directory `hapticwam/`. The previous nested URL redirects to this address.

## Scientific sources

- Text and aggregate numbers: the manuscript sources, revision 3 of
  20 September 2026. `assets/hapticwam.pdf` is the compiled manuscript. `assets/results.csv` exposes the exact counts
  and force summaries. `data.js` holds the same values for charts.
- Videos: seed 101 of the deployed student (`stu_simft_001000`), one per task.
  Episode identity is checked against `meta.json`, rather than inferred from
  filenames (which also use `ep_student` for some baseline recordings).
  Timestamped camera streams are resampled to 15 fps with nearest-frame matching,
  preserving real-time duration. No interpolated frames or generated imagery.
- Figure 4: six **recorded rollouts**, selected successful student and teacher
  executions. Waffles use seed 101 for both models; carton uses student seed 101
  and teacher seed 109; egg uses seed 102 for both models. Selection is for clear
  grasp, transport, and placement; aggregate results still use the full evaluation.
  A single composite video keeps
  camera and both recorded tactile deformation heatmaps synchronized. Heatmaps
  use absolute depth (channel 2 of each 72×96×8 fields_ds stream), with one fixed
  native-unit scale per task (0–0.4 waffles; 0–0.5 carton; 0–1.5 egg), shared across teacher,
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
icons are local SVG paths. The manuscript is available both as a local PDF and
at `https://arxiv.org/abs/2609.23888`.

The current `icons-v2.svg` uses Hugging Face's official full-color logo from
`https://huggingface.co/front/assets/huggingface_logo-noborder.svg`; GitHub and
arXiv marks are from Simple Icons.

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
metadata includes the published arXiv identifier, `2609.23888`.
