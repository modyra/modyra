---
"@modyra/core": minor
---

A second palette engine: Material 3's HCT, alongside Modyra's OKLCH

`deriveHctPalette` reproduces Google's algorithm — CAM16 hue and chroma over CIE L* tone — next to
the existing OKLCH derivation. Nothing about the OKLCH functions changed; this is an addition.

**Implemented from scratch rather than depended on.** No new dependency: CAM16 under Material's own
default viewing conditions (D65, adapting luminance 11.73, background L* 50, average surround,
illuminant not discounted), the sRGB↔XYZ matrices, and an HCT solver.

The solver is the part worth knowing about. CAM16 inverts analytically, but **HCT does not**,
because its tone is CIE L* — a property of Y — while CAM16 inverts from its own lightness J. So
`hctToHex` bisects J until the resulting Y matches the tone asked for, then walks chroma down until
the colour fits in sRGB. Most hues cannot hold chroma 84 at tone 40; asking and taking what fits is
what Material does too. This is also exactly why the OKLCH engine, not this one, is the one
`modyra-base.css` mirrors: OKLCH inverts in closed form and therefore fits in a stylesheet, and a
bisection does not.

Checked against the values Google publishes for the `#6750A4` baseline rather than against itself:
source HCT comes out hue 298.98, chroma 47.86, tone 40.08 where M3 documents ~299/48/40; **primary
`#6750a4` and secondary `#625b71` are exact**, tertiary is `#7e5260` against `#7d5260`, and the
primary palette's tone stops give `#22005d` and `#e9ddff` against M3's `#21005d` and `#eaddff` — one
unit of 255 in each. Error comes out `#ba1a1a`, which is what hue 25 / chroma 84 / tone 40 actually
produces; the older `#B3261E` predates that palette being generated.

**`on-` colours are tone stops, not measurements.** M3 declares that on-primary *is* tone 100 and
on-primary-container *is* tone 10, and never computes a contrast ratio at run time — the guarantee
comes from tone distance instead. Modyra's `onColorFor` measures both candidates and keeps the
winner. Predictable versus adaptive, and the module says so where it matters.

**HCT numbers are not OKLCH numbers.** CAM16 is an appearance model with stated viewing conditions
and corrections for the Helmholtz–Kohlrausch and Abney effects; OKLab has neither. Their hue angles
are different quantities and their chroma scales differ by two orders of magnitude (0–0.4 against
0–120). Never pass one's output to the other's constructor.

A test prints both engines side by side for four sources, because the difference is the point rather
than a defect. It shows M3 *assigning* tone and chroma where Modyra *scales* them: seeded with a
light yellow, the OKLCH model keeps a light primary at lightness 0.91 while M3 pins it to tone 40 and
returns a dark olive; M3's error is `#ba1a1a` for every source, while Modyra's keeps the red hue and
takes its weight from the brand. An M3 palette looks like an M3 palette whatever seeded it, and a
Modyra palette still looks like the colour you chose.

Use `deriveHctPalette` to match a theme exported from Material Theme Builder; use `derivePalette` to
theme Modyra.
