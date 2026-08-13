import assert from "node:assert/strict";
import { test } from "node:test";
import { contrastRatio, hexToOklch, parseHex } from "../dist/color-utils.js";
import {
  compileMdyTheme,
  deltaEOK,
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
