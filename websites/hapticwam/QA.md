# Browser verification — 20 September 2026

Reference: accepted written direction in DESIGN.md and the inspected Agent as
Policy, pi07, FRS, and Claw pages. Built-in image generation was unavailable;
there is no generated mockup to claim as a pixel-perfect reference.

The T3 collaborative browser returned an explicit unavailable-host error from
both status and open. Verification used the agent-browser Chromium fallback.
Reference screenshots and rendered report screenshots were inspected with
view_image at desktop and mobile sizes.

| Comparison point | Render evidence / outcome |
| --- | --- |
| Editorial structure | Continuous technical prose in a 760px column; wide numbered figures support the argument. Explorer remains one figure. |
| Typography | Serif title/section headings, sans-serif prose, small monospace scientific labels; checked at 1440×1000 and 390×844. |
| Palette | Warm off-white, graphite, restrained teal and rust; no gradients, image tints, decorative badges, or generated scientific imagery. |
| Opening content | Name, scientific subtitle, explanation, six authors, institution, and four research links match DESIGN.md. No additional hero metrics. |
| Media | All three locally served recorded student videos reach readyState 4, report ~40-second durations, play, and advance their time. |
| Responsive charts | Initial desktop SVG scaling made mobile labels too small. Fixed with separate narrow viewBoxes and stacked model labels; visually rechecked. |
| Contact explorer | Camera frames and fields load; changing episode, horizon, finger, and channel selects the corresponding saved data. Sources retain pinned commits. |
| Architecture | Teacher/student toggles change fingertip-input state, reactive-branch description, latent-frame count, and trainable-parameter count. |
| Scientific results | All four task/pooled states verified: 19/20, 17/20, 5/10, 41/50. Egg Wilson interval is 23.7–76.3%. No-force-sample entry stays missing. |
| Mobile layout | No document overflow at 390px or 320px. The exact-count table scrolls within its own container. |

The browser reported no new JavaScript errors after clearing the log and
reloading the local report. Citation copy has a selection fallback when the
browser denies clipboard access; the fallback was exercised here.

`npm run check` passed: local resources, anchor uniqueness, summary counts,
Wilson interval, missing force data, media existence, and contact-array shape.

Intentional boundaries: 2D archived contact-field explorer, not a 3D digital
twin; no live model inference; no fabricated per-trial data or synthetic force
distributions. No public deployment was performed. The implemented page was
verified against the accepted scientific-report direction, with the above
documented adaptation to available research assets.

## Architecture detail revision

The Method section now includes both unmodified manuscript PNGs as prominent
inline figures (3a framework, 3b internals), followed by detailed explanations
of tokenization, joint readouts, attention masking, ACC, and HID losses. SHA-256
checks in the verification script protect the original images. The previous
compact comparison is secondary and expandable. The modal viewer was checked
at desktop and mobile sizes: original image loads, 200% zoom changes display
width, Escape closes, and keyboard focus returns to the initiating button.
