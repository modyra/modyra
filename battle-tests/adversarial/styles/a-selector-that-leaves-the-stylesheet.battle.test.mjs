/**
 * A theme's selector, and the block the stylesheet is written into.
 *
 * `compileMdyTheme` guards all three strings a caller hands it. Two of the guards refuse anything
 * that is not what they are for; the third is narrower, and says so where it is written:
 *
 *     const SELECTOR_ESCAPES = /[{};@]|\\/\\*|\\*\\//;
 *
 *   This keeps interpolated text inside its position. It does not decide **which** selectors a theme
 *   should accept: a caller compiling themes from someone else's data still owns that question.
 *
 * The guard is about escaping a CSS **rule**. `</style>` contains none of `{ } ; @` and no comment
 * marker, so it passes — and `serializeMdyThemeCss` writes it into the sheet verbatim:
 *
 *     seed      "</style><script>alert(1)</script>"   refused
 *     name      "</style><script>alert(1)</script>"   refused
 *     selector  "</style><script>alert(1)</script>"   accepted, and in the css character for character
 *
 * A stylesheet is written into a `<style>` block, and `</style>` ends that block wherever it appears —
 * inside a string, inside a comment, inside a selector. Everything after it is markup. So a theme
 * compiled from a value somebody else chose carries a way out of the sheet.
 *
 * **What this is and is not.** Nothing in this repository feeds it: Studio does not call
 * `compileMdyTheme`, and `studio-model` has no theme selector — measured, not assumed. The value comes
 * from whoever writes the build. It becomes a way in only where an application compiles a theme per
 * tenant, per brand, per anything a customer names — which is exactly what a theme compiler exists
 * for, and is why the guard being *about CSS* rather than *about the sheet's container* is worth
 * saying out loud rather than leaving to the caller who did not read that comment.
 *
 * The repair is one character. `<` is not valid anywhere in a CSS selector — it was proposed as a
 * combinator and dropped — so refusing it costs nothing and closes the exit. `>` must stay: `.a > .b`
 * is an ordinary child combinator.
 *
 * Green when a selector cannot carry the sheet's own closing tag.
 */

import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

const HERE = dirname(new URL(import.meta.url).pathname);
const REPO = resolve(HERE, "..", "..", "..");

/** `@modyra/styles` is not linked at the repository root; its entry comes from its own exports map. */
async function styles() {
  const at = join(REPO, "packages", "styles");
  const manifest = JSON.parse(readFileSync(join(at, "package.json"), "utf8"));
  const entry = manifest.exports?.["."];
  const file = typeof entry === "string" ? entry : entry?.default ?? entry?.import ?? manifest.main;
  return import(pathToFileURL(join(at, file)).href);
}

/** Each one leaves a `<style>` block; none carries a character the CSS-rule guard looks for. */
const ESCAPES = Object.freeze([
  "</style>",
  "</style><script>alert(1)</script>",
  "x</style><img src=y onerror=alert(1)>",
  "</STYLE >",
]);

/** Selectors a theme legitimately scopes itself with, which the repair must keep taking. */
const LEGITIMATE = Object.freeze([
  ":root",
  ".theme-dark",
  '[data-theme="brand"]',
  ".a > .b",
  ":root:not([data-theme='light'])",
  "html.dark, body.dark",
]);

battle(
  {
    claims: ["SEC-003"],
    title: "a theme's selector cannot close the sheet it is written into",
    environments: ["node"],
  },
  async (ctx) => {
    const { compileMdyTheme, serializeMdyThemeCss } = await styles();

    const compiled = (definition) => {
      try { return { css: serializeMdyThemeCss(compileMdyTheme(definition)) }; }
      catch (error) { return { refused: String(error.message).slice(0, 60) }; }
    };

    // The control: an ordinary theme compiles and produces a sheet. Without it a repair that refused
    // everything would satisfy the assertion below by making the compiler useless.
    const ordinary = compiled({ name: "t", seed: "#3366ff", selector: ":root" });
    expectClaim(typeof ordinary.css === "string" && ordinary.css.length > 500, {
      claimIds: ["SEC-003"],
      what: "an ordinary theme no longer compiles, so nothing below is about hostile input",
      detail: JSON.stringify(ordinary).slice(0, 120),
    });

    const kept = [];
    for (const selector of ESCAPES) {
      const seen = compiled({ name: "t", seed: "#3366ff", selector });
      ctx.log.note("a selector that leaves the block", { selector, refused: seen.refused ?? null });
      if (seen.css !== undefined && seen.css.includes(selector)) kept.push(selector);
    }

    expectEqual(kept, [], {
      claimIds: ["SEC-003"],
      what: "a selector carrying the stylesheet's own closing tag reached the sheet, so a theme compiled from someone else's value is a way out of it",
    });

    // And the other direction: the selectors a theme is actually written with must survive. A guard
    // that refused `>` would close the exit and take the child combinator with it.
    const broken = LEGITIMATE.filter((selector) => compiled({ name: "t", seed: "#3366ff", selector }).refused !== undefined);
    expectEqual(broken, [], {
      claimIds: ["SEC-003"],
      what: "the compiler refuses a selector a theme is ordinarily scoped with",
    });
  },
);
