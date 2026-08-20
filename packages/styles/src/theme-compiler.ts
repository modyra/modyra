/**
 * Build-time compiler for Modyra perceptual themes.
 *
 * Live palette models remain in modyra-base.css. Perceptual models solve against the output gamut,
 * so they compile to complete light and dark `--mdy-sys-color-*` token sets in `mdy.themes`.
 */
import {
  contrastRatio,
  hexToOklch,
  oklchToHex,
  parseHex,
  toHex,
  type Oklch,
} from "./color-utils.js";

export type MdyThemeMode = "light" | "dark";

export interface MdyPerceptualRelation {
  readonly l: number;
  readonly salience: number;
  readonly minDeltaE: number;
}

export interface MdyPerceptualPaletteModel {
  readonly light: {
    readonly primary: MdyPerceptualRelation;
    readonly secondary: MdyPerceptualRelation;
    readonly tertiary: MdyPerceptualRelation;
    readonly error: MdyPerceptualRelation;
  };
  readonly dark: {
    readonly primary: MdyPerceptualRelation;
    readonly secondary: MdyPerceptualRelation;
    readonly tertiary: MdyPerceptualRelation;
    readonly error: MdyPerceptualRelation;
  };
  readonly errorHue: number;
}

/**
 * Same-hue identity expressed as a fraction of the available sRGB gamut, not as an angle scheme.
 * Light and dark are solved separately: dark mode is not a lifted copy of the light palette.
 */
export const MDY_PERCEPTUAL_PALETTE_MODELS = Object.freeze({
  salience: Object.freeze({
    light: Object.freeze({
      primary: Object.freeze({ l: -1, salience: -1, minDeltaE: 0 }),
      secondary: Object.freeze({ l: 0.38, salience: 0.78, minDeltaE: 0.18 }),
      tertiary: Object.freeze({ l: 0.9, salience: 0.22, minDeltaE: 0.12 }),
      error: Object.freeze({ l: 0.52, salience: 0.72, minDeltaE: 0.16 }),
    }),
    dark: Object.freeze({
      primary: Object.freeze({ l: 0.78, salience: 0.72, minDeltaE: 0 }),
      secondary: Object.freeze({ l: 0.48, salience: 0.76, minDeltaE: 0.16 }),
      tertiary: Object.freeze({ l: 0.34, salience: 0.3, minDeltaE: 0.14 }),
      error: Object.freeze({ l: 0.72, salience: 0.68, minDeltaE: 0.16 }),
    }),
    errorHue: 28,
  }),
} satisfies Readonly<Record<string, MdyPerceptualPaletteModel>>);

export type MdyPerceptualPaletteModelName = keyof typeof MDY_PERCEPTUAL_PALETTE_MODELS;

export interface MdyThemeDefinition {
  readonly name: string;
  readonly seed: string;
  readonly model?: MdyPerceptualPaletteModelName;
  readonly selector?: string;
}

export interface MdyResolvedTheme {
  readonly name: string;
  readonly seed: string;
  readonly model: MdyPerceptualPaletteModelName;
  readonly selector: string;
  readonly light: Readonly<Record<string, string>>;
  readonly dark: Readonly<Record<string, string>>;
  readonly metrics: {
    readonly light: Readonly<Record<string, number>>;
    readonly dark: Readonly<Record<string, number>>;
  };
}

interface LinearRgb {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

const clamp01 = (n: number): number => Math.min(1, Math.max(0, n));
const hue = (h: number): number => ((h % 360) + 360) % 360;

/** OKLCH to unclipped linear sRGB. Unlike oklchToHex, this exposes gamut overflow. */
export function oklchToLinearRgb(color: Oklch): LinearRgb {
  const h = (color.h * Math.PI) / 180;
  const a = color.c * Math.cos(h);
  const b = color.c * Math.sin(h);
  const l = (color.l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (color.l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (color.l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return {
    r: 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    g: -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    b: -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  };
}

/**
 * How far outside `[0, 1]` a channel may land and still be called displayable.
 *
 * It exists to absorb the error of the round trip through Oklch, and it was **smaller than that
 * error**: the worst case over the sRGB cube is `1.303e-7`, at `#ffff00`, and the tolerance was
 * `1e-7`. So two of the eight corners of sRGB — pure green and pure yellow — were judged to be
 * outside sRGB, and a palette derived from such a seed emitted a `primary` this package's own
 * predicate rejects.
 *
 * Derived rather than picked, in both directions:
 *
 * - **large enough**: the measured worst-case overshoot for a colour that *is* in gamut is
 *   `1.303e-7` over a 4096-colour grid plus the eight corners, so this leaves roughly seven times
 *   that as headroom. `#ffffff` clearing the old threshold by a factor of one and a half was luck
 *   rather than a margin — nothing about white at `6.95e-8` is safer in principle than green at
 *   `1.00e-7`.
 * - **small enough**: a colour one part in a million of chroma beyond the true gamut boundary
 *   overshoots by `7e-7` to `2e-6`, so this admits at most about `1.5e-6` of chroma past the edge.
 *   Chroma runs to `0.45`; that is three orders of magnitude below anything a consumer could act on
 *   and below what the boundary search itself resolves.
 *
 * `theme-compiler.spec.mjs` measures the first of those and fails if it ever exceeds this, so the
 * premise is checked rather than trusted: a change to the transform's coefficients says so here
 * instead of putting a corner of sRGB back outside it.
 */
export const MDY_SRGB_EPSILON = 1e-6;

export function isInSrgb(rgb: LinearRgb, epsilon = MDY_SRGB_EPSILON): boolean {
  return [rgb.r, rgb.g, rgb.b].every((v) => v >= -epsilon && v <= 1 + epsilon);
}

/** Maximum chroma displayable in sRGB at one OKLCH lightness and hue. */
export function maxSrgbChroma(l: number, h: number): number {
  let low = 0;
  let high = 0.45;
  for (let i = 0; i < 26; i++) {
    const mid = (low + high) / 2;
    if (isInSrgb(oklchToLinearRgb({ l: clamp01(l), c: mid, h: hue(h) }))) low = mid;
    else high = mid;
  }
  return low;
}

export function deltaEOK(left: Oklch, right: Oklch): number {
  const a = (left.h * Math.PI) / 180;
  const b = (right.h * Math.PI) / 180;
  return Math.hypot(
    left.l - right.l,
    left.c * Math.cos(a) - right.c * Math.cos(b),
    left.c * Math.sin(a) - right.c * Math.sin(b),
  );
}

const bySalience = (h: number, relation: MdyPerceptualRelation): Oklch => ({
  l: clamp01(relation.l),
  h: hue(h),
  c: maxSrgbChroma(relation.l, h) * clamp01(relation.salience),
});

/**
 * Keep the requested salience and hue, then move lightness only as far as needed to satisfy the
 * perceptual distance. This matters for a yellow seed already near the tertiary's preferred L and
 * for middle-light greens near the secondary stop.
 */
const bySalienceAtDistance = (
  reference: Oklch,
  h: number,
  relation: MdyPerceptualRelation,
): Oklch => {
  const preferred = bySalience(h, relation);
  if (deltaEOK(reference, preferred) >= relation.minDeltaE) return preferred;

  let best: Oklch | null = null;
  let bestShift = Number.POSITIVE_INFINITY;
  for (let step = 0; step <= 200; step++) {
    const l = step / 200;
    const candidate = bySalience(h, { ...relation, l });
    if (deltaEOK(reference, candidate) < relation.minDeltaE) continue;
    const shift = Math.abs(l - relation.l);
    if (shift < bestShift) {
      best = candidate;
      bestShift = shift;
    }
  }
  if (!best) throw new Error(`Cannot satisfy minDeltaE ${relation.minDeltaE}`);
  return best;
};

const rgbMix = (foreground: string, background: string, backgroundWeight: number): string => {
  const a = parseHex(foreground);
  const b = parseHex(background);
  if (!a || !b) throw new Error("Cannot mix an invalid colour");
  const w = clamp01(backgroundWeight);
  return toHex(a.map((v, i) => Math.round(v * (1 - w) + b[i]! * w)) as [number, number, number]);
};

const onColor = (background: string): string =>
  contrastRatio(background, "#ffffff") >= contrastRatio(background, "#000000")
    ? "#ffffff"
    : "#000000";

const roleMetrics = (primary: string, secondary: string, tertiary: string) => {
  const p = hexToOklch(primary)!;
  const s = hexToOklch(secondary)!;
  const t = hexToOklch(tertiary)!;
  return Object.freeze({
    primarySecondaryDeltaE: deltaEOK(p, s),
    primaryTertiaryDeltaE: deltaEOK(p, t),
    secondaryTertiaryDeltaE: deltaEOK(s, t),
  });
};

const resolveMode = (
  source: Oklch,
  model: MdyPerceptualPaletteModel,
  mode: MdyThemeMode,
): Readonly<Record<string, string>> => {
  const spec = model[mode];
  const primaryColor = mode === "light"
    ? source
    : bySalience(source.h, spec.primary);
  const primary = oklchToHex(primaryColor);
  const secondaryColor = bySalienceAtDistance(primaryColor, source.h, spec.secondary);
  const tertiaryColor = bySalienceAtDistance(primaryColor, source.h, spec.tertiary);
  const errorColor = bySalienceAtDistance(primaryColor, model.errorHue, spec.error);

  const secondary = oklchToHex(secondaryColor);
  const tertiary = oklchToHex(tertiaryColor);
  const error = oklchToHex(errorColor);
  const cloud = "#f8fafc";
  const night = "#0e0f16";
  const slate = "#94a3b8";

  if (mode === "light") {
    return Object.freeze({
      primary,
      onPrimary: onColor(primary),
      primaryContainer: rgbMix(primary, cloud, 0.85),
      onPrimaryContainer: rgbMix(primary, night, 0.8),
      secondary,
      onSecondary: onColor(secondary),
      secondaryContainer: rgbMix(secondary, cloud, 0.8),
      onSecondaryContainer: rgbMix(secondary, night, 0.8),
      tertiary,
      onTertiary: onColor(tertiary),
      tertiaryContainer: rgbMix(tertiary, cloud, 0.95),
      onTertiaryContainer: rgbMix(tertiary, night, 0.8),
      error,
      onError: onColor(error),
      errorContainer: rgbMix(error, cloud, 0.85),
      onErrorContainer: rgbMix(error, night, 0.8),
      surface: rgbMix(primary, cloud, 0.96),
      onSurface: rgbMix(primary, night, 0.8),
      surfaceVariant: rgbMix(primary, rgbMix(cloud, slate, 0.18), 0.8),
      onSurfaceVariant: rgbMix(primary, rgbMix(night, slate, 0.45), 0.6),
      surfaceContainerLowest: cloud,
      surfaceContainerLow: rgbMix(primary, cloud, 0.96),
      surfaceContainer: rgbMix(primary, cloud, 0.92),
      surfaceContainerHigh: rgbMix(primary, cloud, 0.88),
      surfaceContainerHighest: rgbMix(primary, cloud, 0.8),
      background: rgbMix(primary, cloud, 0.98),
      onBackground: rgbMix(primary, night, 0.8),
      outline: rgbMix(primary, slate, 0.6),
      outlineVariant: rgbMix(primary, rgbMix(slate, cloud, 0.45), 0.8),
      inverseSurface: rgbMix(primary, night, 0.8),
      inverseOnSurface: rgbMix(primary, cloud, 0.8),
      inversePrimary: rgbMix(primary, cloud, 0.6),
      scrim: rgbMix(primary, night, 0.9),
      shadow: rgbMix(primary, night, 0.8),
    });
  }

  return Object.freeze({
    primary,
    onPrimary: onColor(primary),
    primaryContainer: rgbMix(primary, night, 0.6),
    onPrimaryContainer: rgbMix(primary, cloud, 0.6),
    secondary,
    onSecondary: onColor(secondary),
    secondaryContainer: rgbMix(secondary, night, 0.8),
    onSecondaryContainer: rgbMix(secondary, cloud, 0.6),
    tertiary,
    onTertiary: onColor(tertiary),
    tertiaryContainer: rgbMix(tertiary, night, 0.9),
    onTertiaryContainer: rgbMix(tertiary, cloud, 0.6),
    error,
    onError: onColor(error),
    errorContainer: rgbMix(error, night, 0.7),
    onErrorContainer: rgbMix(error, cloud, 0.6),
    surface: rgbMix(primary, night, 0.85),
    onSurface: rgbMix(primary, cloud, 0.8),
    surfaceVariant: rgbMix(primary, rgbMix(night, slate, 0.35), 0.6),
    onSurfaceVariant: rgbMix(primary, cloud, 0.6),
    surfaceContainerLowest: night,
    surfaceContainerLow: rgbMix(primary, night, 0.88),
    surfaceContainer: rgbMix(primary, night, 0.8),
    surfaceContainerHigh: rgbMix(primary, night, 0.7),
    surfaceContainerHighest: rgbMix(primary, night, 0.58),
    background: rgbMix(primary, night, 0.95),
    onBackground: rgbMix(primary, cloud, 0.8),
    outline: rgbMix(primary, slate, 0.4),
    outlineVariant: rgbMix(primary, rgbMix(night, slate, 0.35), 0.6),
    inverseSurface: rgbMix(primary, cloud, 0.6),
    inverseOnSurface: rgbMix(primary, night, 0.6),
    inversePrimary: rgbMix(primary, cloud, 0.4),
    scrim: "#000000",
    shadow: "#000000",
  });
};

/**
 * What a selector may not contain, because it is interpolated into a rule.
 *
 * A selector is written into the stylesheet at the position a selector occupies, so it has to stay
 * there: `}` closes the rule and everything after it becomes a declaration nobody wrote, and `@`,
 * `;` and a comment sequence each open a way out of the same kind. A real selector needs none of
 * them — `.acme`, `#app`, `:root`, `[data-tenant="acme"]`, a comma-separated list and every
 * combinator pass unchanged.
 *
 * `<` is here for the other container. A stylesheet is often written inside a `<style>` block, and
 * `</style>` ends that block wherever it appears — inside a string, inside a comment, inside a
 * selector — so everything after it is markup rather than CSS. None of the characters above appear
 * in it, and no valid selector contains `<`: it was proposed as a combinator and abandoned. `>` is
 * not refused and must not be, because `.a > .b` is the ordinary child combinator.
 *
 * Two escapes, two questions. This keeps interpolated text inside its position **and** inside the
 * sheet it is written into. It does not decide *which* selectors a theme should accept: a caller
 * compiling themes from someone else's data still owns that question.
 */
const SELECTOR_ESCAPES = /[{};@<]|\/\*|\*\//;

export function compileMdyTheme(definition: MdyThemeDefinition): MdyResolvedTheme {
  const source = hexToOklch(definition.seed);
  if (!source) throw new Error(`Invalid theme seed: ${definition.seed}`);
  if (!/^[a-z][a-z0-9-]*$/i.test(definition.name)) {
    throw new Error(`Invalid theme name: ${definition.name}`);
  }
  const modelName = definition.model ?? "salience";
  const model = MDY_PERCEPTUAL_PALETTE_MODELS[modelName];
  if (!model) {
    // Named rather than left to fail further down: the registry is here, so the message can say what
    // there is instead of arriving as a missing property three calls away.
    throw new Error(
      `Unknown theme model: ${String(modelName)}. Available: ${Object.keys(MDY_PERCEPTUAL_PALETTE_MODELS).join(", ")}.`,
    );
  }
  if (definition.selector !== undefined && SELECTOR_ESCAPES.test(definition.selector)) {
    throw new Error(
      `Invalid theme selector: ${definition.selector}. A selector is written into a rule, so it ` +
        `cannot contain "{", "}", ";", "@" or a comment — each of those ends the rule and turns the ` +
        `rest into a stylesheet of its own. "<" is refused for the same reason one level out: a ` +
        `sheet written into a <style> block ends at "</style>", wherever that appears. The child ` +
        `combinator ">" is fine.`,
    );
  }
  const selector = definition.selector ?? `[data-mdy-theme="${definition.name}"]`;
  const light = resolveMode(source, model, "light");
  const dark = resolveMode(source, model, "dark");
  return Object.freeze({
    name: definition.name,
    seed: oklchToHex(source),
    model: modelName,
    selector,
    light,
    dark,
    metrics: Object.freeze({
      light: roleMetrics(light.primary!, light.secondary!, light.tertiary!),
      dark: roleMetrics(dark.primary!, dark.secondary!, dark.tertiary!),
    }),
  });
}

const kebab = (name: string): string => name.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
const declarations = (tokens: Readonly<Record<string, string>>, indent: string): string =>
  Object.entries(tokens)
    .map(([name, value]) => `${indent}--mdy-sys-color-${kebab(name)}: ${value};`)
    .join("\n");

export function serializeMdyThemeCss(theme: MdyResolvedTheme): string {
  return `/* Generated by @modyra/theme-compiler. Do not edit.\n * Seed: ${theme.seed}\n * Model: ${theme.model}\n * Includes independently solved light and dark system token sets.\n */\n@layer mdy.themes {\n  ${theme.selector} {\n${declarations(theme.light, "    ")}\n  }\n\n  @media (prefers-color-scheme: dark) {\n    ${theme.selector}:not([data-mdy-mode="light"]),\n    ${theme.selector}[data-mdy-mode="dark"] {\n${declarations(theme.dark, "      ")}\n    }\n  }\n\n  ${theme.selector}[data-mdy-mode="dark"] {\n${declarations(theme.dark, "    ")}\n  }\n\n  ${theme.selector}[data-mdy-mode="light"] {\n${declarations(theme.light, "    ")}\n  }\n}\n`;
}
