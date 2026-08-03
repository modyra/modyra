/**
 * The relational maths between a theme's colours.
 *
 * A palette is not a list of colours, it is one colour and a set of relationships. Modyra's palette
 * always was: measured in OKLCH, the stock secondary sits at the primary's hue +24°, the tertiary at
 * +96°, and the error at a fixed red with 0.83× the primary's lightness. Those relationships were
 * real but frozen as hex literals, so picking a new brand colour left the rest of the palette where
 * it was — a green brand still got violet chips.
 *
 * ## Two palette engines live here
 *
 * **Modyra's own, in OKLCH** (`derivePalette`, `MDY_PALETTE_MODELS`) and **Material 3's, in HCT**
 * (`deriveHctPalette`, `MDY_HCT_PALETTE_MODEL`). They coexist on purpose and neither is a fallback
 * for the other.
 *
 * The OKLCH engine is the one `modyra-base.css` mirrors, and that is the whole reason it exists in
 * this shape: OKLCH inverts in closed form, so the same arithmetic fits in a stylesheet with no
 * JavaScript on the page and no dependency anywhere. HCT cannot do that. Its tone is CIE L* while
 * CAM16 inverts from its own lightness, so getting a colour out of it needs a numeric solve — a
 * bisection inside a chroma walk — which is fine in Node and impossible in CSS.
 *
 * The HCT engine exists because Material 3 is what a great many themes are already built in. A
 * palette exported from Material Theme Builder is a set of HCT tone stops, and reproducing it means
 * doing Google's arithmetic, not approximating it in a different colour space. Anyone matching an
 * existing M3 theme wants `deriveHctPalette`; anyone theming Modyra wants `derivePalette`.
 *
 * They disagree, substantially, and the test that prints them side by side exists to keep that
 * visible. Two examples from it: seeded with a light yellow, the OKLCH model keeps a light primary
 * (lightness 0.91) while M3 pins every primary to tone 40 and returns a dark olive — M3 *assigns*
 * tone and chroma where Modyra *scales* them, so an M3 palette looks like an M3 palette whatever it
 * was seeded with, and a Modyra palette still looks like the colour you chose. And M3's error is
 * `#ba1a1a` for every source, because its hue, chroma and tone are all absolute, where Modyra's
 * error keeps the red hue but takes its weight from the brand.
 *
 * The `on-` colours differ in kind rather than degree: `onColorFor` measures contrast against black
 * and against white and keeps the winner, while M3 declares that on-primary *is* tone 100 and
 * on-primary-container *is* tone 10 and never computes a ratio. Predictable versus adaptive; the
 * comment on `deriveHctPalette` says what each buys.
 *
 * This module holds the relationships as numbers, and `modyra-base.css` holds the same numbers as
 * custom properties so the browser can do the arithmetic live, with no JavaScript on the page. The
 * two copies are bound together by a test that parses the stylesheet, because two copies of a number
 * is exactly the kind of thing that drifts.
 *
 * OKLCH rather than HSL: HSL's "lightness" is not lightness — `hsl(60 100% 50%)` (yellow) and
 * `hsl(240 100% 50%)` (blue) claim the same 50% while one is blinding and the other nearly black.
 * Rotating hue in HSL therefore changes perceived brightness, so a derived palette comes out uneven.
 * OKLCH is perceptually uniform: rotate the hue and the colour keeps its weight.
 *
 * Everything here is side-effect-free and takes plain sRGB hex in, plain sRGB hex out.
 */

/** A colour in OKLCH: lightness 0–1, chroma 0–~0.4, hue in degrees. */
export interface Oklch {
  readonly l: number;
  readonly c: number;
  readonly h: number;
}

/**
 * How one palette derives from its primary.
 *
 * Hue offsets are degrees added to the primary's hue; chroma and lightness are multipliers on the
 * primary's. Error is the exception and carries an absolute hue: it is the one colour in a palette
 * whose meaning is not decorative, and an error that has gone green because the brand did is no
 * longer an error. It harmonises in weight without leaving red.
 */
export interface MdyPaletteRelation {
  readonly h: number;
  readonly c: number;
  readonly l: number;
  /**
   * Optional absolute chroma floor, applied only when the source has a meaningful hue.
   * Exact and near-neutral colours stay neutral: manufacturing chroma from an undefined hue would
   * turn numerical noise into an arbitrary brand colour.
   */
  readonly minC?: number;
}

export interface MdyPaletteModel {
  readonly secondary: MdyPaletteRelation;
  readonly tertiary: MdyPaletteRelation;
  /** `h` here is absolute, not an offset — see above. */
  readonly error: { readonly h: number; readonly c: number; readonly l: number };
  /**
   * How `modyra-base.css` decides whether an `on-` colour is black or white — **not** how this
   * module decides it.
   *
   * Where black overtakes white has one clean answer in *luminance*: 0.1791, always. A stylesheet
   * cannot get there, because it holds the colour in OKLCH while WCAG wants sRGB luminance, which
   * weights green at 0.72 and blue at 0.07 — a blue and a green of identical OKLCH lightness are
   * nowhere near equally bright. So the stylesheet estimates luminance as
   * `l³ · (1 + chromaWeight · c · cos(h − hueOffset))`: exact for a grey, fitted for the rest.
   *
   * Against 8640 sampled colours that estimate picks the wrong side 142 times and gives up at most
   * 1.09 ratio points. `derivePalette` does not use it — it measures both candidates, which is
   * exact — but the constants live here so the two implementations can be compared, and are: the
   * stylesheet is parsed and checked against these numbers in the test.
   */
  readonly contrastProxy: {
    readonly threshold: number;
    readonly chromaWeight: number;
    readonly hueOffset: number;
  };
  /** How much of the brand's chroma an `on-` colour keeps, so text is tinted rather than clinical. */
  readonly onChroma: number;
}

/**
 * The models a theme can choose between.
 *
 * `brand` is the default and the one every theme gets unless it says otherwise. Its offsets are
 * round numbers — +30° and +90° — deliberately close to, but not identical with, the +24°/+96° the
 * stock palette measures at. The resulting slight shift in the stock colours is a decision, not a
 * regression: a round number that can be reasoned about beats a measurement nobody can derive.
 */
export const MDY_PALETTE_MODELS: Readonly<Record<string, MdyPaletteModel>> = Object.freeze({
  brand: Object.freeze({
    secondary: Object.freeze({ h: 30, c: 1.05, l: 1.03 }),
    tertiary: Object.freeze({ h: 90, c: 0.85, l: 1.15 }),
    error: Object.freeze({ h: 28, c: 0.82, l: 0.83 }),
    contrastProxy: Object.freeze({ threshold: 0.1791, chromaWeight: 0.85, hueOffset: 179 }),
    onChroma: 0.08,
  }),
  /** One hue throughout: the accents separate by weight alone. Safe for any brand colour. */
  monochrome: Object.freeze({
    secondary: Object.freeze({ h: 0, c: 0.7, l: 1.08 }),
    tertiary: Object.freeze({ h: 0, c: 0.45, l: 1.2 }),
    error: Object.freeze({ h: 28, c: 0.82, l: 0.83 }),
    contrastProxy: Object.freeze({ threshold: 0.1791, chromaWeight: 0.85, hueOffset: 179 }),
    onChroma: 0.08,
  }),
  /**
   * A wide tonal ramp on the brand hue: a deep, chromatic secondary and a pale tertiary.
   * Unlike the other models, its chroma floors stop muted but still chromatic brands collapsing
   * into indistinguishable greys. Truly neutral sources remain neutral because their hue is not a
   * meaningful input to amplify.
   */
  tonal: Object.freeze({
    secondary: Object.freeze({ h: 0, c: 1.05, l: 0.52, minC: 0.1 }),
    tertiary: Object.freeze({ h: 0, c: 0.28, l: 1.3, minC: 0.025 }),
    error: Object.freeze({ h: 28, c: 0.82, l: 0.83 }),
    contrastProxy: Object.freeze({ threshold: 0.1791, chromaWeight: 0.85, hueOffset: 179 }),
    onChroma: 0.08,
  }),
  /** The tertiary sits opposite the primary; the secondary stays close to it. */
  complementary: Object.freeze({
    secondary: Object.freeze({ h: 15, c: 1.0, l: 1.05 }),
    tertiary: Object.freeze({ h: 180, c: 0.9, l: 1.1 }),
    error: Object.freeze({ h: 28, c: 0.82, l: 0.83 }),
    contrastProxy: Object.freeze({ threshold: 0.1791, chromaWeight: 0.85, hueOffset: 179 }),
    onChroma: 0.08,
  }),
  /** Three hues evenly around the wheel. */
  triadic: Object.freeze({
    secondary: Object.freeze({ h: 240, c: 0.95, l: 1.05 }),
    tertiary: Object.freeze({ h: 120, c: 0.9, l: 1.1 }),
    error: Object.freeze({ h: 28, c: 0.82, l: 0.83 }),
    contrastProxy: Object.freeze({ threshold: 0.1791, chromaWeight: 0.85, hueOffset: 179 }),
    onChroma: 0.08,
  }),
});

/** The name of a shipped model. */
export type MdyPaletteModelName = keyof typeof MDY_PALETTE_MODELS & string;

// ── sRGB ↔ OKLCH ─────────────────────────────────────────────────────────────
// Björn Ottosson's OKLab matrices. sRGB is gamma-encoded, so every conversion goes through linear
// light first — skipping that step is the classic way to get a palette that is subtly wrong.

const toLinear = (channel: number): number => {
  const v = channel / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
};

const toGamma = (v: number): number => {
  const c = v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
  return Math.round(Math.min(1, Math.max(0, c)) * 255);
};

/** Parse `#rgb` or `#rrggbb` into 0–255 channels. Returns `null` on anything else. */
export function parseHex(hex: string): readonly [number, number, number] | null {
  const value = hex.trim().replace(/^#/, "");
  const full =
    value.length === 3
      ? value
          .split("")
          .map((ch) => ch + ch)
          .join("")
      : value;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ] as const;
}

/** `#rrggbb` for 0–255 channels. */
export function toHex(rgb: readonly [number, number, number]): string {
  return `#${rgb.map((c) => Math.round(c).toString(16).padStart(2, "0")).join("")}`;
}

/** Convert an sRGB hex colour to OKLCH. Returns `null` if the hex is not a colour. */
export function hexToOklch(hex: string): Oklch | null {
  const rgb = parseHex(hex);
  if (!rgb) return null;
  const r = toLinear(rgb[0]);
  const g = toLinear(rgb[1]);
  const b = toLinear(rgb[2]);

  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);

  const okL = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const okA = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const okB = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;

  const chroma = Math.hypot(okA, okB);
  let hue = (Math.atan2(okB, okA) * 180) / Math.PI;
  if (hue < 0) hue += 360;
  return { l: okL, c: chroma, h: hue };
}

/**
 * Convert OKLCH back to an sRGB hex.
 *
 * Out-of-gamut results are clipped per channel rather than gamut-mapped. That matches what the
 * browser does with `oklch()` closely enough for the same numbers to land on the same colour, which
 * is the only property this module needs: the CSS is what paints, this is what checks it.
 */
export function oklchToHex(color: Oklch): string {
  const hueRad = (color.h * Math.PI) / 180;
  const a = color.c * Math.cos(hueRad);
  const b = color.c * Math.sin(hueRad);

  const l = (color.l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (color.l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (color.l - 0.0894841775 * a - 1.291485548 * b) ** 3;

  return toHex([
    toGamma(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    toGamma(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    toGamma(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ]);
}

// ── Contrast ─────────────────────────────────────────────────────────────────

/** WCAG 2.1 relative luminance of an sRGB hex colour. */
export function relativeLuminance(hex: string): number {
  const rgb = parseHex(hex);
  if (!rgb) return 0;
  const [r, g, b] = rgb.map(toLinear) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * WCAG 2.1 contrast ratio between two sRGB hex colours, 1 (identical) to 21 (black on white).
 *
 * This exists because CSS can *produce* a contrasting colour but cannot *check* one: a stylesheet
 * has no way to assert that what it just computed is readable. That assertion lives in the tests,
 * and this is what they call.
 */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const light = Math.max(la, lb);
  const dark = Math.min(la, lb);
  return (light + 0.05) / (dark + 0.05);
}

// ── Derivation ───────────────────────────────────────────────────────────────

/** A palette derived from one colour. */
export interface MdyDerivedPalette {
  readonly primary: string;
  readonly secondary: string;
  readonly tertiary: string;
  readonly error: string;
  readonly onPrimary: string;
  readonly onSecondary: string;
  readonly onTertiary: string;
  readonly onError: string;
}

const clamp01 = (n: number): number => Math.min(1, Math.max(0, n));

const derive = (
  base: Oklch,
  ratio: MdyPaletteRelation,
  absoluteHue: boolean,
): Oklch => {
  const scaledChroma = Math.max(0, base.c * ratio.c);
  // OKLCH hue is undefined at zero chroma. Keep exact and near-neutrals neutral rather than
  // amplifying floating-point noise into an arbitrary tint; a muted chromatic source may use the
  // floor because its hue still carries an intentional identity.
  const chroma = !absoluteHue && ratio.minC !== undefined && base.c >= 0.005
    ? Math.max(scaledChroma, ratio.minC)
    : scaledChroma;
  return {
    l: clamp01(base.l * ratio.l),
    c: chroma,
    h: absoluteHue ? ratio.h : (((base.h + ratio.h) % 360) + 360) % 360,
  };
};

/**
 * The `on-` colour for a background: black or white, carrying a trace of the background's own hue.
 *
 * The same step the stylesheet takes with `clamp(0, (pivot - l) * 100, 1)`, which is how CSS gets a
 * conditional it does not have. Above the pivot the lightness resolves to 0, below it to 1.
 *
 * **Decided on the painted colour, not the requested one.** A rotated hue at full chroma frequently
 * lands outside sRGB, and clipping it back moves its lightness — a tertiary asked for at 0.551 was
 * painted at 0.579, so judging the request handed it white when the thing on screen wanted black
 * (4.09:1 where black gives 5.05:1). The round-trip through hex is what makes the decision about
 * the colour a user will actually see.
 */
const onColorFor = (paintedHex: string, model: MdyPaletteModel): string => {
  const painted = hexToOklch(paintedHex);
  if (!painted) return "#000000";
  const candidate = (l: number): string =>
    oklchToHex({ l, c: painted.c * model.onChroma, h: painted.h });
  const light = candidate(1);
  const dark = candidate(0);
  // Measured, not approximated. A single lightness pivot cannot be right for every hue — solving
  // for where black overtakes white puts the crossover anywhere between 0.508 and 0.590 depending
  // on hue and chroma, so a constant picks the worse side for colours sitting in that band, and in
  // that band the whole margin is about 0.3 of a ratio point. Here there is no reason to guess:
  // compute both and keep the better. `contrastProxy` carries what the stylesheet does instead,
  // for comparison — it has no way to compute a luminance.
  return contrastRatio(paintedHex, light) >= contrastRatio(paintedHex, dark) ? light : dark;
};

/**
 * Derive a whole palette from one colour.
 *
 * Returns `null` when the primary is not a parseable hex, so a caller handling user input gets a
 * value to branch on rather than a palette built from garbage.
 */
export function derivePalette(
  primary: string,
  model: MdyPaletteModel = MDY_PALETTE_MODELS.brand!,
): MdyDerivedPalette | null {
  const base = hexToOklch(primary);
  if (!base) return null;

  const primaryHex = oklchToHex(base);
  const secondary = oklchToHex(derive(base, model.secondary, false));
  const tertiary = oklchToHex(derive(base, model.tertiary, false));
  const error = oklchToHex(derive(base, model.error, true));

  return {
    primary: primaryHex,
    secondary,
    tertiary,
    error,
    onPrimary: onColorFor(primaryHex, model),
    onSecondary: onColorFor(secondary, model),
    onTertiary: onColorFor(tertiary, model),
    onError: onColorFor(error, model),
  };
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// The other palette maths: HCT, the model Material 3 actually uses
//
// Everything above this line is Modyra's own OKLCH derivation. Everything below is Google's, and
// the two are not variations on a theme — they disagree about what a colour *is*.
//
// HCT is CAM16 hue and chroma bolted onto CIE L* for tone. CAM16 is an appearance model: it asks
// what a colour looks like to an observer under stated viewing conditions (a D65 white point, an
// adapting luminance of 11.73, a mid-grey background, average surround), and its numbers move when
// those conditions do. OKLab asks a narrower question — perceptual uniformity of difference — and
// has no viewing conditions at all.
//
// So `hexToHct` and `hexToOklch` are **not interchangeable**. Their hues are different quantities on
// different scales: OKLCH chroma runs 0–0.4, CAM16 chroma runs 0–~120, and even the hue angles do
// not line up, because CAM16 corrects for the Helmholtz–Kohlrausch effect and the Abney effect and
// OKLab does not. Never feed one's numbers to the other's constructor. The test that prints them
// side by side exists to make that concrete rather than to check them against each other.
// ═══════════════════════════════════════════════════════════════════════════════════════════════

/** A colour in HCT: hue in degrees, CAM16 chroma (0–~120), tone as CIE L* (0–100). */
export interface Hct {
  readonly h: number;
  readonly c: number;
  readonly t: number;
}

// ── CIE plumbing ─────────────────────────────────────────────────────────────

const LAB_E = 216 / 24389;
const LAB_KAPPA = 24389 / 27;

/** CIE L* (0–100) for a Y in 0–100. This is HCT's "tone", unchanged from plain CIELAB. */
export function lstarFromY(y: number): number {
  const scaled = y / 100;
  const f = scaled > LAB_E ? Math.cbrt(scaled) : (LAB_KAPPA * scaled + 16) / 116;
  return 116 * f - 16;
}

/** The Y (0–100) of a CIE L*. */
export function yFromLstar(lstar: number): number {
  const ft = (lstar + 16) / 116;
  const ft3 = ft * ft * ft;
  return 100 * (ft3 > LAB_E ? ft3 : (116 * ft - 16) / LAB_KAPPA);
}

const SRGB_TO_XYZ = [
  [0.41233895, 0.35762064, 0.18051042],
  [0.2126, 0.7152, 0.0722],
  [0.01932141, 0.11916382, 0.95034478],
] as const;

const XYZ_TO_SRGB = [
  [3.2413774792388685, -1.5376652402851851, -0.49885366846268053],
  [-0.9691452513005321, 1.8758853451067872, 0.04156585616912061],
  [0.05562093689691305, -0.20395524564742123, 1.0571799111220335],
] as const;

const xyzFromRgb = (rgb: readonly [number, number, number]): [number, number, number] => {
  const lin = rgb.map((c) => toLinear(c) * 100) as [number, number, number];
  return SRGB_TO_XYZ.map((row) => row[0]! * lin[0] + row[1]! * lin[1] + row[2]! * lin[2]) as [
    number,
    number,
    number,
  ];
};

const rgbFromXyz = (xyz: readonly [number, number, number]): [number, number, number] =>
  XYZ_TO_SRGB.map((row) =>
    toGamma((row[0]! * xyz[0] + row[1]! * xyz[1] + row[2]! * xyz[2]) / 100),
  ) as [number, number, number];

// ── CAM16 under Material's default viewing conditions ────────────────────────
// Computed once, because they depend only on the illuminant and the assumed surround. The constants
// are M3's own defaults: D65, background L* 50, average surround, illuminant not discounted.

const VIEWING = (() => {
  const white: [number, number, number] = [95.047, 100.0, 108.883];
  const adaptingLuminance = (200 / Math.PI) * (yFromLstar(50) / 100);
  const backgroundLstar = 50;
  const surround = 2;

  const rW = 0.401288 * white[0] + 0.650173 * white[1] - 0.051461 * white[2];
  const gW = -0.250268 * white[0] + 1.204414 * white[1] + 0.045854 * white[2];
  const bW = -0.002079 * white[0] + 0.048952 * white[1] + 0.953127 * white[2];

  const f = 0.8 + surround / 10;
  const c = f >= 0.9 ? 0.59 + (0.69 - 0.59) * ((f - 0.9) * 10) : 0.525 + (0.59 - 0.525) * ((f - 0.8) * 10);
  const nc = f;
  const d = Math.min(
    1,
    Math.max(0, f * (1 - (1 / 3.6) * Math.exp((-adaptingLuminance - 42) / 92))),
  );
  const rgbD: [number, number, number] = [
    d * (100 / rW) + 1 - d,
    d * (100 / gW) + 1 - d,
    d * (100 / bW) + 1 - d,
  ];

  const k = 1 / (5 * adaptingLuminance + 1);
  const k4 = k * k * k * k;
  const fl = k4 * adaptingLuminance + 0.1 * (1 - k4) * (1 - k4) * Math.cbrt(5 * adaptingLuminance);
  const n = yFromLstar(backgroundLstar) / white[1];
  const z = 1.48 + Math.sqrt(n);
  const nbb = 0.725 / Math.pow(n, 0.2);

  const adapt = (channel: number, scale: number): number => {
    const af = Math.pow((fl * scale * channel) / 100, 0.42);
    return (400 * af) / (af + 27.13);
  };
  const aw = (2 * adapt(rW, rgbD[0]) + adapt(gW, rgbD[1]) + 0.05 * adapt(bW, rgbD[2])) * nbb;

  return { rgbD, fl, n, z, nbb, ncb: nbb, c, nc, aw };
})();

const signum = (n: number): number => (n < 0 ? -1 : n > 0 ? 1 : 0);

/** CAM16 hue and chroma of an XYZ colour, under Material's default viewing conditions. */
const cam16FromXyz = (xyz: readonly [number, number, number]): { h: number; c: number } => {
  const [x, y, z] = xyz;
  const rC = 0.401288 * x + 0.650173 * y - 0.051461 * z;
  const gC = -0.250268 * x + 1.204414 * y + 0.045854 * z;
  const bC = -0.002079 * x + 0.048952 * y + 0.953127 * z;

  const cone = (value: number, scale: number): number => {
    const scaled = value * scale;
    const af = Math.pow((VIEWING.fl * Math.abs(scaled)) / 100, 0.42);
    return (signum(scaled) * 400 * af) / (af + 27.13);
  };
  const rA = cone(rC, VIEWING.rgbD[0]);
  const gA = cone(gC, VIEWING.rgbD[1]);
  const bA = cone(bC, VIEWING.rgbD[2]);

  const a = (11 * rA - 12 * gA + bA) / 11;
  const b = (rA + gA - 2 * bA) / 9;
  const u = (20 * rA + 20 * gA + 21 * bA) / 20;
  const p2 = (40 * rA + 20 * gA + bA) / 20;

  let hue = (Math.atan2(b, a) * 180) / Math.PI;
  if (hue < 0) hue += 360;
  else if (hue >= 360) hue -= 360;

  const ac = p2 * VIEWING.nbb;
  const j = 100 * Math.pow(ac / VIEWING.aw, VIEWING.c * VIEWING.z);
  const huePrime = hue < 20.14 ? hue + 360 : hue;
  const eHue = 0.25 * (Math.cos((huePrime * Math.PI) / 180 + 2) + 3.8);
  const p1 = ((50000 / 13) * eHue * VIEWING.nc * VIEWING.ncb) / (u + 0.305);
  const t = p1 * Math.hypot(a, b);
  const alpha = Math.pow(t, 0.9) * Math.pow(1.64 - Math.pow(0.29, VIEWING.n), 0.73);

  return { h: hue, c: alpha * Math.sqrt(j / 100) };
};

/** The XYZ of a CAM16 lightness/chroma/hue. CAM16 inverts analytically; HCT does not (see below). */
const xyzFromCam16 = (j: number, chroma: number, hue: number): [number, number, number] => {
  const alpha = chroma === 0 || j === 0 ? 0 : chroma / Math.sqrt(j / 100);
  const t = Math.pow(alpha / Math.pow(1.64 - Math.pow(0.29, VIEWING.n), 0.73), 1 / 0.9);
  const hRad = (hue * Math.PI) / 180;
  const eHue = 0.25 * (Math.cos(hRad + 2) + 3.8);
  const ac = VIEWING.aw * Math.pow(j / 100, 1 / (VIEWING.c * VIEWING.z));
  const p1 = eHue * (50000 / 13) * VIEWING.nc * VIEWING.ncb;
  const p2 = ac / VIEWING.nbb;

  const hSin = Math.sin(hRad);
  const hCos = Math.cos(hRad);
  const gamma = (23 * (p2 + 0.305) * t) / (23 * p1 + 11 * t * hCos + 108 * t * hSin);
  const a = gamma * hCos;
  const b = gamma * hSin;

  const rA = (460 * p2 + 451 * a + 288 * b) / 1403;
  const gA = (460 * p2 - 891 * a - 261 * b) / 1403;
  const bA = (460 * p2 - 220 * a - 6300 * b) / 1403;

  const uncone = (value: number, scale: number): number => {
    const base = Math.max(0, (27.13 * Math.abs(value)) / (400 - Math.abs(value)));
    return (signum(value) * (100 / VIEWING.fl) * Math.pow(base, 1 / 0.42)) / scale;
  };
  const rF = uncone(rA, VIEWING.rgbD[0]);
  const gF = uncone(gA, VIEWING.rgbD[1]);
  const bF = uncone(bA, VIEWING.rgbD[2]);

  return [
    1.86206786 * rF - 1.01125463 * gF + 0.14918677 * bF,
    0.38752654 * rF + 0.62144744 * gF - 0.00897398 * bF,
    -0.0158415 * rF - 0.03412294 * gF + 1.04996444 * bF,
  ];
};

/** The HCT of an sRGB hex colour. Returns `null` if the hex is not a colour. */
export function hexToHct(hex: string): Hct | null {
  const rgb = parseHex(hex);
  if (!rgb) return null;
  const xyz = xyzFromRgb(rgb);
  const { h, c } = cam16FromXyz(xyz);
  return { h, c, t: lstarFromY(xyz[1]!) };
}

const inGamut = (xyz: readonly [number, number, number]): boolean => {
  const linear = XYZ_TO_SRGB.map(
    (row) => (row[0]! * xyz[0] + row[1]! * xyz[1] + row[2]! * xyz[2]) / 100,
  );
  return linear.every((v) => v >= -0.0001 && v <= 1.0001);
};

/**
 * The sRGB hex of an HCT colour, with chroma reduced until the colour fits in sRGB.
 *
 * HCT does not invert in closed form the way CAM16 does, because tone is L* — a property of Y — while
 * CAM16 inverts from *its own* lightness J. So this solves in two nested steps: bisect J until the
 * resulting Y matches the tone asked for, then walk the chroma down until the result is a colour sRGB
 * can actually display. Most hues simply cannot hold chroma 84 at tone 40; asking for it and taking
 * what fits is what Material does too.
 */
export function hctToHex(hct: Hct): string {
  const tone = Math.min(100, Math.max(0, hct.t));
  const targetY = yFromLstar(tone);
  // Tone 0 and 100 are black and white whatever the hue claims.
  if (tone <= 0) return "#000000";
  if (tone >= 100) return "#ffffff";

  const solveForChroma = (chroma: number): [number, number, number] | null => {
    if (chroma <= 0) {
      const grey = toGamma(targetY / 100);
      return [grey, grey, grey];
    }
    // Y rises monotonically with J for a fixed hue and chroma, so bisection is safe.
    let low = 0.0001;
    let high = 100;
    let xyz: [number, number, number] = [0, 0, 0];
    for (let i = 0; i < 40; i++) {
      const mid = (low + high) / 2;
      xyz = xyzFromCam16(mid, chroma, hct.h);
      if (!Number.isFinite(xyz[1]!)) return null;
      if (xyz[1]! < targetY) low = mid;
      else high = mid;
    }
    if (Math.abs(xyz[1]! - targetY) > 0.5) return null;
    return inGamut(xyz) ? xyz : null;
  };

  for (let chroma = hct.c; chroma >= 0; chroma -= 0.5) {
    const xyz = solveForChroma(Math.max(0, chroma));
    if (xyz) return toHex(rgbFromXyz(xyz));
  }
  const grey = toGamma(targetY / 100);
  return toHex([grey, grey, grey]);
}

/**
 * Material 3's derivation, as constants.
 *
 * Same shape of idea as `MdyPaletteModel` and different in every particular. Chroma here is
 * **assigned**, not multiplied: M3 does not scale the source's saturation, it replaces it, so every
 * palette built from any brand colour has the same chromatic weight. That is the point — it is what
 * makes a Material theme look like a Material theme whatever colour it was seeded with, and it is
 * also why a muted brand colour comes back more saturated than it went in (`max(chroma, 48)`).
 *
 * Modyra's own model multiplies instead, so a quiet brand stays quiet. Neither is more correct;
 * they want different things.
 */
export interface MdyHctPaletteModel {
  /** Hue offset in degrees from the source, and the chroma the role is assigned. */
  readonly primary: { readonly hueShift: number; readonly chroma: number; readonly atLeastSource: boolean };
  readonly secondary: { readonly hueShift: number; readonly chroma: number };
  readonly tertiary: { readonly hueShift: number; readonly chroma: number };
  readonly neutral: { readonly hueShift: number; readonly chroma: number };
  readonly neutralVariant: { readonly hueShift: number; readonly chroma: number };
  /** Absolute hue, like the OKLCH model's error — the red band, whatever the brand is. */
  readonly error: { readonly hue: number; readonly chroma: number };
  /** The tones each role is read at. M3 fixes these; it does not measure contrast. */
  readonly tones: {
    readonly role: number;
    readonly on: number;
    readonly container: number;
    readonly onContainer: number;
  };
}

export const MDY_HCT_PALETTE_MODEL: MdyHctPaletteModel = Object.freeze({
  primary: Object.freeze({ hueShift: 0, chroma: 48, atLeastSource: true }),
  secondary: Object.freeze({ hueShift: 0, chroma: 16 }),
  tertiary: Object.freeze({ hueShift: 60, chroma: 24 }),
  neutral: Object.freeze({ hueShift: 0, chroma: 4 }),
  neutralVariant: Object.freeze({ hueShift: 0, chroma: 8 }),
  error: Object.freeze({ hue: 25, chroma: 84 }),
  tones: Object.freeze({ role: 40, on: 100, container: 90, onContainer: 10 }),
});

/**
 * Derive a palette the way Material 3 does.
 *
 * Same contract as `derivePalette`: sRGB hex in, sRGB hex out, `null` when the input is not a colour.
 * Everything else about it is different.
 *
 * **The `on-` colours are tone stops, not contrast measurements.** `onColorFor` computes the ratio
 * against black and against white and keeps whichever wins; M3 declares that on-primary *is* tone
 * 100 and on-primary-container *is* tone 10, and never looks at a contrast ratio at run time. The
 * guarantee comes from the tone distance instead — a role at tone 40 under text at tone 100 is far
 * enough apart to pass, by construction, for every hue. It is the more predictable of the two
 * approaches and the less adaptive: give M3 a role at an unusual tone and the pairing does not
 * follow, where the measuring version would.
 */
export function deriveHctPalette(
  primary: string,
  model: MdyHctPaletteModel = MDY_HCT_PALETTE_MODEL,
): MdyDerivedPalette | null {
  const source = hexToHct(primary);
  if (!source) return null;

  const { role, on } = model.tones;
  const at = (hue: number, chroma: number, tone: number): string =>
    hctToHex({ h: ((hue % 360) + 360) % 360, c: chroma, t: tone });

  const primaryChroma = model.primary.atLeastSource
    ? Math.max(source.c, model.primary.chroma)
    : model.primary.chroma;

  return {
    primary: at(source.h + model.primary.hueShift, primaryChroma, role),
    secondary: at(source.h + model.secondary.hueShift, model.secondary.chroma, role),
    tertiary: at(source.h + model.tertiary.hueShift, model.tertiary.chroma, role),
    error: at(model.error.hue, model.error.chroma, role),
    onPrimary: at(source.h + model.primary.hueShift, primaryChroma, on),
    onSecondary: at(source.h + model.secondary.hueShift, model.secondary.chroma, on),
    onTertiary: at(source.h + model.tertiary.hueShift, model.tertiary.chroma, on),
    onError: at(model.error.hue, model.error.chroma, on),
  };
}
