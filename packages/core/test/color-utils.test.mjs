/**
 * The relational maths behind a palette (`@modyra/core/color-utils`).
 *
 * The interesting assertions here are not "does the arithmetic run" but the two properties the
 * whole design rests on: a palette *follows* its primary, and an `on-` colour is *readable* against
 * the colour it is named for. The second is the one CSS cannot check for itself.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  MDY_PALETTE_MODELS,
  contrastRatio,
  derivePalette,
  hexToOklch,
  oklchToHex,
  parseHex,
  relativeLuminance,
} from "../dist/color-utils.js";

// A spread chosen to break things: saturated, dark, very light, and near-neutral. The light one is
// what the old fixed `color-mix(primary, white 95%)` could not serve at all.
const PRIMARIES = ["#7067FF", "#0A7D2B", "#FFE066", "#18181B", "#B3261E", "#00A5B5"];

test("hex parsing accepts the two shorthands and rejects the rest", () => {
  assert.deepEqual(parseHex("#7067FF"), [0x70, 0x67, 0xff]);
  assert.deepEqual(parseHex("7067FF"), [0x70, 0x67, 0xff]);
  assert.deepEqual(parseHex("#abc"), [0xaa, 0xbb, 0xcc]);
  assert.equal(parseHex("#12345"), null);
  assert.equal(parseHex("rebeccapurple"), null);
  assert.equal(parseHex(""), null);
});

test("a colour survives the trip to OKLCH and back", () => {
  for (const hex of PRIMARIES) {
    const round = oklchToHex(hexToOklch(hex));
    const [r, g, b] = parseHex(round);
    const [sr, sg, sb] = parseHex(hex);
    // Two gamma conversions and a cube root: within one 8-bit step per channel is exact enough.
    for (const [a, e] of [
      [r, sr],
      [g, sg],
      [b, sb],
    ]) {
      assert.ok(Math.abs(a - e) <= 1, `${hex} -> ${round}: channel drifted by ${Math.abs(a - e)}`);
    }
  }
});

test("the stock palette is what the primary's hue says it is", () => {
  // brand: secondary at +30°, tertiary at +90°, error pinned to red.
  const base = hexToOklch("#7067FF");
  const palette = derivePalette("#7067FF", MDY_PALETTE_MODELS.brand);
  const secondary = hexToOklch(palette.secondary);
  const tertiary = hexToOklch(palette.tertiary);
  const error = hexToOklch(palette.error);

  const offset = (h) => (((h - base.h) % 360) + 360) % 360;
  assert.ok(Math.abs(offset(secondary.h) - 30) < 2, `secondary at +${offset(secondary.h)}°`);
  assert.ok(Math.abs(offset(tertiary.h) - 90) < 2, `tertiary at +${offset(tertiary.h)}°`);
  // Error does not rotate with the brand: it is the one colour whose meaning is not decorative.
  assert.ok(Math.abs(error.h - 28) < 3, `error hue ${error.h}, expected ~28`);
});

test("every model moves the palette when the primary moves", () => {
  for (const [name, model] of Object.entries(MDY_PALETTE_MODELS)) {
    const a = derivePalette("#7067FF", model);
    const b = derivePalette("#0A7D2B", model);
    assert.notEqual(a.secondary, b.secondary, `${name}: secondary must follow the primary`);
    assert.notEqual(a.tertiary, b.tertiary, `${name}: tertiary must follow the primary`);
    // Error keeps its hue but not its weight, so it moves too — just never out of red.
    assert.notEqual(a.error, b.error, `${name}: error must harmonise with the primary`);
    for (const hex of [b.error, a.error]) {
      const { h } = hexToOklch(hex);
      assert.ok(Math.abs(h - 28) < 6, `${name}: error drifted to hue ${h}`);
    }
  }
});

test("monochrome keeps one hue, triadic and complementary do not", () => {
  const mono = derivePalette("#7067FF", MDY_PALETTE_MODELS.monochrome);
  const base = hexToOklch("#7067FF");
  for (const key of ["secondary", "tertiary"]) {
    assert.ok(
      Math.abs(hexToOklch(mono[key]).h - base.h) < 2,
      `monochrome ${key} left the hue: ${hexToOklch(mono[key]).h} vs ${base.h}`,
    );
  }
  const tri = derivePalette("#7067FF", MDY_PALETTE_MODELS.triadic);
  const comp = derivePalette("#7067FF", MDY_PALETTE_MODELS.complementary);
  const off = (hex) => (((hexToOklch(hex).h - base.h) % 360) + 360) % 360;
  // Measured through the hex, which is where gamut clipping happens: a rotated hue at full chroma
  // often lands outside sRGB, and clipping a channel moves the hue a few degrees. The browser
  // clips the same way, so this is the hue that actually gets painted rather than the one asked
  // for — worth asserting the real one, with room for the clip.
  assert.ok(Math.abs(off(tri.tertiary) - 120) < 8, `triadic tertiary at +${off(tri.tertiary)}°`);
  assert.ok(Math.abs(off(comp.tertiary) - 180) < 8, `complementary tertiary at +${off(comp.tertiary)}°`);
});

test("contrast ratio matches the WCAG anchors", () => {
  assert.ok(Math.abs(contrastRatio("#000000", "#ffffff") - 21) < 0.01);
  assert.equal(contrastRatio("#7067FF", "#7067FF"), 1);
  // Symmetric, whichever way round it is asked.
  assert.equal(contrastRatio("#000000", "#7067FF"), contrastRatio("#7067FF", "#000000"));
  assert.ok(relativeLuminance("#ffffff") > relativeLuminance("#7067FF"));
});

test("every on- colour is readable against the colour it is named for", () => {
  // The property the old palette did not have: `on-primary` was 95% white whatever the primary was,
  // so a light brand colour meant white text on a light background. AA for body text is 4.5:1.
  for (const [name, model] of Object.entries(MDY_PALETTE_MODELS)) {
    for (const primary of PRIMARIES) {
      const p = derivePalette(primary, model);
      for (const [bg, fg] of [
        ["primary", "onPrimary"],
        ["secondary", "onSecondary"],
        ["tertiary", "onTertiary"],
        ["error", "onError"],
      ]) {
        const ratio = contrastRatio(p[bg], p[fg]);
        assert.ok(
          ratio >= 4.5,
          `${name}/${primary}: ${fg} on ${bg} is ${ratio.toFixed(2)}:1 (${p[fg]} on ${p[bg]})`,
        );
      }
    }
  }
});

test("an on- colour is always the better of black and white, never merely the plausible one", () => {
  // The property that makes AA reachable at all. Colours whose lightness sits in the 0.508–0.590
  // band where the crossover lives have only ~4.6:1 available whichever way they go, so picking the
  // worse side puts them under AA — which is what a constant pivot did to five pairs in this very
  // sample before the choice was measured.
  for (const [name, model] of Object.entries(MDY_PALETTE_MODELS)) {
    for (const primary of PRIMARIES) {
      const p = derivePalette(primary, model);
      for (const [bg, fg] of [
        ["primary", "onPrimary"],
        ["secondary", "onSecondary"],
        ["tertiary", "onTertiary"],
        ["error", "onError"],
      ]) {
        const chosen = contrastRatio(p[bg], p[fg]);
        const best = Math.max(contrastRatio(p[bg], "#ffffff"), contrastRatio(p[bg], "#000000"));
        // The tint costs a little, so the chosen colour trails pure black/white slightly; what it
        // must never do is land on the wrong side, which shows up as a gap far larger than the tint.
        assert.ok(
          chosen >= best - 0.25,
          `${name}/${primary}: ${fg} gives ${chosen.toFixed(2)}:1 where ${best.toFixed(2)}:1 was available`,
        );
      }
    }
  }
});

test("the stylesheet and this module hold the same numbers", () => {
  // Two copies of a number is exactly what drifts. `modyra-base.css` does the arithmetic live in
  // the browser and this module does it in Node; if someone retunes one, this fails rather than the
  // two of them quietly disagreeing about what `triadic` means.
  const css = readFileSync(
    new URL("../../styles/src/modyra-base.css", import.meta.url),
    "utf8",
  );
  const block = (selector) => {
    const at = css.indexOf(selector);
    assert.ok(at > -1, `${selector} is gone from modyra-base.css`);
    return css.slice(at, css.indexOf("}", at));
  };
  const numberIn = (text, name) => {
    const m = new RegExp(`--mdy-palette-${name}:\\s*([-\\d.]+)`).exec(text);
    assert.ok(m, `--mdy-palette-${name} is not declared where it was`);
    return Number(m[1]);
  };

  // `brand` is the default and lives on :root; the others are attribute-selected.
  const where = {
    brand: block(":root {\n    /* Hue offsets"),
    monochrome: block('[data-mdy-palette="monochrome"]'),
    complementary: block('[data-mdy-palette="complementary"]'),
    triadic: block('[data-mdy-palette="triadic"]'),
  };

  for (const [name, model] of Object.entries(MDY_PALETTE_MODELS)) {
    for (const role of ["secondary", "tertiary"]) {
      for (const [axis, key] of [
        ["h", "h"],
        ["c", "c"],
        ["l", "l"],
      ]) {
        assert.equal(
          numberIn(where[name], `${role}-${axis}`),
          model[role][key],
          `${name}: ${role}-${axis} differs between the stylesheet and MDY_PALETTE_MODELS`,
        );
      }
    }
  }

  // Error and the contrast proxy are shared by every model, so they are declared once on :root.
  const root = where.brand;
  const brand = MDY_PALETTE_MODELS.brand;
  assert.equal(numberIn(root, "error-h"), brand.error.h);
  assert.equal(numberIn(root, "error-c"), brand.error.c);
  assert.equal(numberIn(root, "error-l"), brand.error.l);
  assert.equal(numberIn(root, "contrast-threshold"), brand.contrastProxy.threshold);
  assert.equal(numberIn(root, "luma-chroma-weight"), brand.contrastProxy.chromaWeight);
  assert.equal(numberIn(root, "luma-hue-offset"), brand.contrastProxy.hueOffset);
  assert.equal(numberIn(root, "on-chroma"), brand.onChroma);
});

test("a primary that is not a colour yields no palette", () => {
  assert.equal(derivePalette("not a colour"), null);
  assert.equal(derivePalette(""), null);
});
