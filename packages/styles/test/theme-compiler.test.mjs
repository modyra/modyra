import assert from "node:assert/strict";
import { test } from "node:test";
import { contrastRatio, hexToOklch, parseHex } from "../dist/color-utils.js";
import {
  compileMdyTheme,
  deltaEOK,
  MDY_SRGB_EPSILON,
  isInSrgb,
  maxSrgbChroma,
  oklchToLinearRgb,
  serializeMdyThemeCss,
} from "../dist/theme-compiler.js";

test("maxSrgbChroma finds an in-gamut boundary", () => {
  for (const l of [0.2, 0.5, 0.8]) for (const h of [0, 60, 120, 180, 240, 300]) {
    const c = maxSrgbChroma(l, h);
    assert.ok(isInSrgb(oklchToLinearRgb({ l, c, h })));
    assert.ok(!isInSrgb(oklchToLinearRgb({ l, c: c + 0.002, h })));
  }
});

test("salience compiles complete and different light and dark themes", () => {
  const theme = compileMdyTheme({ name: "acme", seed: "#7067ff" });
  for (const mode of ["light", "dark"]) {
    for (const role of ["primary", "secondary", "tertiary", "error", "surface", "background", "outline"]) {
      assert.ok(parseHex(theme[mode][role]), `${mode}/${role}`);
    }
    for (const [bg, fg] of [["primary", "onPrimary"], ["secondary", "onSecondary"], ["tertiary", "onTertiary"], ["error", "onError"]]) {
      assert.ok(contrastRatio(theme[mode][bg], theme[mode][fg]) >= 4.5, `${mode}: ${fg} on ${bg}`);
    }
  }
  assert.notEqual(theme.light.primary, theme.dark.primary);
  assert.notEqual(theme.light.secondary, theme.dark.secondary);
  assert.ok(theme.metrics.light.primarySecondaryDeltaE >= 0.18);
  assert.ok(theme.metrics.dark.primarySecondaryDeltaE >= 0.16);
});

test("compiled CSS covers system preference and explicit mode overrides", () => {
  const theme = compileMdyTheme({ name: "acme", seed: "#7067ff" });
  const css = serializeMdyThemeCss(theme);
  assert.match(css, /@layer mdy\.themes/);
  assert.match(css, /@media \(prefers-color-scheme: dark\)/);
  assert.match(css, /\[data-mdy-theme="acme"\]\[data-mdy-mode="dark"\]/);
  assert.match(css, /\[data-mdy-theme="acme"\]\[data-mdy-mode="light"\]/);
  assert.match(css, /--mdy-sys-color-surface-container-highest:/);
  assert.match(css, /--mdy-sys-color-on-tertiary-container:/);
});

test("compiler is deterministic across representative seeds", () => {
  for (const seed of ["#7067ff", "#0a7d2b", "#ffe066", "#18181b", "#796f86"]) {
    const a = compileMdyTheme({ name: "sample", seed });
    const b = compileMdyTheme({ name: "sample", seed });
    assert.deepEqual(a, b);
    const p = hexToOklch(a.light.primary);
    const s = hexToOklch(a.light.secondary);
    assert.ok(deltaEOK(p, s) >= 0.18);
  }
});

test("a selector stays in the position it is written into", () => {
  // The selector is interpolated into a rule six times. Left unchecked, one closing brace ends the
  // rule and everything after it is a stylesheet the theme's author never wrote — persistent CSS
  // injection wherever a theme is compiled from someone else's data, which is what the public
  // subpath exists for.
  const hostile = [
    "} body { display:none } .x {",
    ".a; color:red",
    "@media print",
    ".a /* x */ .b",
    ".a */ .b",
  ];
  for (const selector of hostile) {
    assert.throws(
      () => compileMdyTheme({ name: "t", seed: "#3366cc", selector }),
      /Invalid theme selector/,
      `accepted ${JSON.stringify(selector)}`,
    );
  }
});

test("every shape a real selector takes still compiles", () => {
  // A guard that refuses what it was meant to protect is the usual way of breaking it: none of these
  // needs a brace, a semicolon, an at-sign or a comment.
  const real = ['.acme', '#app', ':root', '[data-tenant="acme"]', '.a, .b > .c', 'html.dark .acme'];
  for (const selector of real) {
    const css = serializeMdyThemeCss(compileMdyTheme({ name: "t", seed: "#3366cc", selector }));
    assert.ok(css.includes(selector), `${selector} did not reach the stylesheet`);
  }
});

test("an unknown model is named, not left to fail as a missing property", () => {
  assert.throws(
    () => compileMdyTheme({ name: "t", seed: "#3366cc", model: "nope" }),
    (error) =>
      error instanceof Error &&
      /Unknown theme model: nope/.test(error.message) &&
      /salience/.test(error.message),
    "an unknown model arrived as a TypeError three calls away",
  );
});

test("every corner of sRGB is judged to be inside sRGB", () => {
  // The predicate is asked after a round trip through Oklch, so its tolerance exists to absorb that
  // transform's error — and it was smaller than the error: pure green and pure yellow overshoot by
  // 1.00e-7 and 1.30e-7 against a tolerance of 1e-7. A palette derived from such a seed emitted a
  // `primary` this package's own predicate rejects.
  const corners = ["#000000", "#ff0000", "#00ff00", "#0000ff", "#ffff00", "#ff00ff", "#00ffff", "#ffffff"];
  for (const hex of corners) {
    assert.ok(isInSrgb(oklchToLinearRgb(hexToOklch(hex))), `${hex} was judged outside sRGB`);
  }
});

test("the tolerance is larger than the error it exists to absorb", () => {
  // The premise of the constant, measured rather than trusted. A change to the transform's
  // coefficients fails here — saying the tolerance needs revisiting — instead of putting a corner of
  // sRGB back outside it.
  const overshootOf = (hex) => {
    const { r, g, b } = oklchToLinearRgb(hexToOklch(hex));
    return Math.max(0, -r, -g, -b, r - 1, g - 1, b - 1);
  };
  let worst = 0;
  for (let r = 0; r <= 255; r += 17) {
    for (let g = 0; g <= 255; g += 17) {
      for (let b = 0; b <= 255; b += 17) {
        const hex = `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
        worst = Math.max(worst, overshootOf(hex));
      }
    }
  }
  assert.ok(worst < MDY_SRGB_EPSILON, `an in-gamut colour overshoots by ${worst}, past the ${MDY_SRGB_EPSILON} tolerance`);
  // …and the tolerance is not so wide that it stops meaning anything: it must still be the smaller
  // number, or it is measuring nothing.
  assert.ok(MDY_SRGB_EPSILON < 1e-4, "the tolerance grew past the point of describing a round trip");
});

test("a colour genuinely outside the gamut is still refused", () => {
  // The other side of widening: a chroma past the boundary overshoots by orders of magnitude more
  // than the transform's error, and must still be refused.
  for (const [l, h] of [[0.6, 30], [0.75, 100], [0.5, 250]]) {
    const edge = maxSrgbChroma(l, h);
    assert.ok(isInSrgb(oklchToLinearRgb({ l, c: edge, h })), "the boundary itself was refused");
    assert.ok(!isInSrgb(oklchToLinearRgb({ l, c: edge + 0.002, h })), "a colour past the boundary was admitted");
  }
});
