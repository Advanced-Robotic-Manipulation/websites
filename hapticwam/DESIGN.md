# HapticWAM technical report

## Current design (v2)

A monospace, dot-drawn technical report in the style of ascii.rest: one typeface (Geist Mono), `[bracket]` text links that invert on hover, flat wells instead of cards, dotted rules, a sticky index (a sticky section strip on phones) and a dark/light toggle that follows the system setting. Series colors (student/intact/left fingertip teal, zero contact/right fingertip orange) were checked for color-vision separation and contrast on both surfaces.

The opening is a live view: the recorded student rollout (scene camera, both fingertip deformation maps, fingertip force strip) redrawn as a dot matrix. It responds to the pointer like tactile gel, scrubs by dragging the force strip, and switches between tasks. Placement and intervention charts show one dot per trial with Wilson intervals. All content and numbers are unchanged from the manuscript revision of 20 September 2026; nothing is synthetic apart from the pointer response.

Layout holds from 320 px phones to wide desktops; the hero uses a tall dot layout below 560 px. Reduced-motion and data-saver settings stop autoplay. The previous editorial design (warm off-white, serif headings, SVG charts) remains in the git history.

## Previous design (v1)

Accepted direction: a restrained, scientific, continuous technical report, with
interactive figures supporting the argument. References: Agent as Policy for
evidence navigation, Physical Intelligence pi07 for editorial rhythm, Flow
Reversal Steering for explanatory interaction, Claw for episode navigation.

The report is in English, matching the manuscript. Warm off-white (#f7f6f2),
graphite (#242824), teal (#27695f) for the student/prediction, rust (#aa643e)
for measured contact. Serif display headings, system sans-serif reading text,
monospace labels. Reading column 720px, figures 1120px. No gradients, image
tints, decorative badges, or marketing claims. Scientific photos stay unaltered.

Opening copy: HapticWAM; Distilling imagined touch into a world–action model;
manuscript authors and institution; Paper / Code / Dataset / Models.
Navigation: Overview, Method, Contact, Experiments, Resources.

Sections: opening recorded student demonstrations; introduction to contact;
teacher/student diagram and training; contact prediction explorer; physical
evaluation with task selector and Wilson intervals; contact intervention;
force summaries; limitations; resources and citation.

Interactive controls must select actual archived data. The prediction explorer
uses explicitly identified offline teacher reruns, not deployment-time student
predictions. Main-table counts come from the 20 September manuscript. No
synthetic distributions or invented traces. Videos come from the archived rig
episodes, with model identity taken from the result CSV rather than filenames.

Implementation: static HTML/CSS and focused ES modules, deployable on GitHub
Pages without a backend or build tool. Local optimized media, source manifest,
reproducible preparation script. Responsive single-column continuation; no
autoplay required, reduced-motion support, keyboard and screen-reader labels.

The written direction above is the design specification; the implementation is
reviewed directly in the browser against it.
