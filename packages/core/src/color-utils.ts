/**
 * The relational maths between a theme's colours.
 *
 * A palette is not a list of colours, it is one colour and a set of relationships. Modyra's palette
 * always was: measured in OKLCH, the stock secondary sits at the primary's hue +24°, the tertiary at
 * +96°, and the error at a fixed red with 0.83× the primary's lightness. Those relationships were
 * real but frozen as hex literals, so picking a new brand colour left the rest of the palette where
 * it was — a green brand still got violet chips.
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
export interface MdyPaletteModel {
  readonly secondary: { readonly h: number; readonly c: number; readonly l: number };
  readonly tertiary: { readonly h: number; readonly c: number; readonly l: number };
  /** `h` here is absolute, not an offset — see above. */
  readonly error: { readonly h: number; readonly c: number; readonly l: number };
  /**
   * Where an `on-` colour flips from white to black: lighter than this takes dark text, darker
   * takes light text.
   *
   * The value is measured, not chosen. Sweeping hue and chroma and solving for where the WCAG ratio
   * against black overtakes the ratio against white puts the crossover between **0.508 and 0.590**
   * OKLCH lightness, mean 0.562 — so 0.56 puts every colour on the better side of the two. It is
   * worth being exact about: at 0.62 an indigo of lightness 0.607 was handed white text at 4.09:1,
   * under AA, when the black it should have had gives 5.07:1.
   *
   * The margin is genuinely thin at mid lightness — a colour sitting exactly on the crossover can
   * reach only ~4.58:1 whichever way it goes, which is AA and no more. That is a property of black
   * and white text on mid-tone backgrounds, not something a different pivot could fix.
   */
  readonly contrastPivot: number;
  /** How much of the brand's chroma an `on-` colour keeps, so text is tinted rather than clinical. */
  readonly onChroma: number;
}

/**
 * The models a theme can choose between.
 *
 * `brand` is the default and the one every theme gets unless it says otherwise. Its offsets are
 * round numbers — +30° and +90° — deliberately close to, but not identical with, the +24°/+96° the
 * stock palette measured at before this existed. The stock colours therefore shift slightly, and
 * that shift is a decision rather than a regression.
 */
export const MDY_PALETTE_MODELS: Readonly<Record<string, MdyPaletteModel>> = Object.freeze({
  brand: Object.freeze({
    secondary: Object.freeze({ h: 30, c: 1.05, l: 1.03 }),
    tertiary: Object.freeze({ h: 90, c: 0.85, l: 1.15 }),
    error: Object.freeze({ h: 28, c: 0.82, l: 0.83 }),
    contrastPivot: 0.56,
    onChroma: 0.08,
  }),
  /** One hue throughout: the accents separate by weight alone. Safe for any brand colour. */
  monochrome: Object.freeze({
    secondary: Object.freeze({ h: 0, c: 0.7, l: 1.08 }),
    tertiary: Object.freeze({ h: 0, c: 0.45, l: 1.2 }),
    error: Object.freeze({ h: 28, c: 0.82, l: 0.83 }),
    contrastPivot: 0.56,
    onChroma: 0.08,
  }),
  /** The tertiary sits opposite the primary; the secondary stays close to it. */
  complementary: Object.freeze({
    secondary: Object.freeze({ h: 15, c: 1.0, l: 1.05 }),
    tertiary: Object.freeze({ h: 180, c: 0.9, l: 1.1 }),
    error: Object.freeze({ h: 28, c: 0.82, l: 0.83 }),
    contrastPivot: 0.56,
    onChroma: 0.08,
  }),
  /** Three hues evenly around the wheel. */
  triadic: Object.freeze({
    secondary: Object.freeze({ h: 240, c: 0.95, l: 1.05 }),
    tertiary: Object.freeze({ h: 120, c: 0.9, l: 1.1 }),
    error: Object.freeze({ h: 28, c: 0.82, l: 0.83 }),
    contrastPivot: 0.56,
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
  ratio: { readonly h: number; readonly c: number; readonly l: number },
  absoluteHue: boolean,
): Oklch => ({
  l: clamp01(base.l * ratio.l),
  c: Math.max(0, base.c * ratio.c),
  h: absoluteHue ? ratio.h : (((base.h + ratio.h) % 360) + 360) % 360,
});

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
  // compute both and keep the better. `contrastPivot` remains the model's approximation of exactly
  // this rule, for the stylesheet, which cannot compute a luminance.
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
