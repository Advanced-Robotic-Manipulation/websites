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
There is no build step. No remote publication has been performed.

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
- Contact explorer: **offline teacher reruns**, not online student predictions.
  The public NPZ archives contain predictions, targets, and recorded camera
  frames. The explorer shows the three saved future horizons, two fingers,
  contact mask, and normal-force change. It is not an accuracy benchmark.
- Force charts show published means and standard deviations, not invented raw
  distributions. Missing data remain missing. Wilson intervals are descriptive.
- Teacher/student model observations and the tactile-assisted executor are
  explicitly distinguished throughout the report.

`assets/provenance.json` records pinned HF revisions, episode identifiers, source
URLs, and derived-asset checksums. Source archives are linked from the figures.
`setup.webp` and `architecture.webp` are WebP conversions of the supplied paper
figures. PDF and figure provenance is the same manuscript, not generated art.

## Regenerate archived media

Use Python 3.12 with `numpy`, `Pillow`, `requests`, and `zarr<3`, plus `ffmpeg`:

```sh
python scripts/prepare_media.py
```

The script downloads only selected public streams and arrays at pinned commits.
Raw inputs are cached under the operating system temporary directory, outside
the repository. Browser assets are written to `assets/`. The generated MP4s
are about 1–1.5 MB each. The report is approximately 11 MB including the PDF;
videos load on demand and contact arrays load near the explorer.

## Files

- `index.html`: report prose, accessible structure, resource and source links.
- `styles.css`: editorial layout, typography, responsive design.
- `data.js`, `charts.js`: manuscript data and responsive SVG plots.
- `explorer.js`: archived contact-field visualization with shared scales.
- `app.js`: figure controls, lazy loading, navigation, playback, citation copy.
- `DESIGN.md`: accepted visual direction and implementation decisions.

Research archive media are CC BY 4.0; consult the linked dataset cards. Citation
is a manuscript entry, without an invented publication venue or arXiv ID.
