/**
 * The function that writes the stylesheet, reached without the one that builds the theme.
 *
 * `compileMdyTheme` validates what it is handed. `serializeMdyThemeCss` is the function that actually
 * writes the text, it is exported beside the compiler, and its argument is a plain frozen object:
 * `MdyResolvedTheme` has `name`, `seed`, `model`, `selector`, `light`, `dark`, `metrics`. A caller
 * holding tokens of their own builds one and hands it straight to the writer.
 *
 * A guard placed where an object is **constructed** guards a convention. A type cannot enforce
 * provenance at runtime, so the only door that has to hold is the one where the text is produced.
 *
 * Three fields interpolate, and two of them are not the selector:
 *
 *     selector  "</style><script>alert(1)</script>"   leaves the <style> block
 *     seed      a comment-closer, then the same markup     leaves the CSS comment it is written into
 *     model     the same                                   the same
 *
 * A comment-closer ends a comment the way `}` ends a rule, and what follows is CSS — then markup. The seed
 * and the model are written into the sheet's header comment, which is why they are interpolations and
 * not only labels.
 *
 * `seed` and `model` are held to **what they are** — a hex colour, a name the palette registry knows —
 * rather than to characters they must not contain. That is what the compiler already guarantees, and a
 * blacklist there would accept values the rest of the module cannot use anyway.
 *
 * Green when the writer refuses every field that reaches the sheet, and still writes a theme the
 * compiler produced. Both halves, because refusing everything satisfies the first alone.
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

/** Each field the writer interpolates, with a value that leaves the construct it is written into. */
const ESCAPES = Object.freeze([
  ["selector", "</style><script>alert(1)</script>"],
  ["selector", "x</style><img src=y onerror=alert(1)>"],
  ["seed", "*/</style><script>x</script>/*"],
  ["model", "*/</style><script>x</script>/*"],
  ["name", "*/</style><script>x</script>/*"],
]);

battle(
  {
    claims: ["SEC-003"],
    title: "the sheet is guarded where it is written, not only where it is built",
    environments: ["node"],
  },
  async (ctx) => {
    const { compileMdyTheme, serializeMdyThemeCss } = await styles();
    const compiled = compileMdyTheme({ name: "t", seed: "#3366ff", selector: ":root" });

    // The control, and the half a blanket refusal would break: a theme the compiler produced still
    // writes a sheet. Without it the assertion below is satisfied by a writer that refuses everything.
    let written = null;
    try { written = serializeMdyThemeCss(compiled); } catch (error) { written = { refused: String(error.message).slice(0, 70) }; }
    expectClaim(typeof written === "string" && written.length > 500, {
      claimIds: ["SEC-003"],
      what: "a compiled theme no longer serialises, so nothing below is about hostile input",
      detail: JSON.stringify(written).slice(0, 140),
    });

    // A resolved theme is a plain object. Nothing at runtime says where it came from, which is the
    // whole reason the writer has to ask rather than trust the type.
    const reached = [];
    for (const [member, payload] of ESCAPES) {
      const handBuilt = { ...compiled, [member]: payload };
      let outcome;
      try { outcome = { css: serializeMdyThemeCss(handBuilt) }; }
      catch (error) { outcome = { refused: String(error.message).slice(0, 70) }; }
      ctx.log.note("a field the writer interpolates", { member, refused: outcome.refused ?? null });
      if (outcome.css !== undefined && outcome.css.includes(payload)) reached.push(`${member}: ${payload}`);
    }

    expectEqual(reached, [], {
      claimIds: ["SEC-003"],
      what: "a hand-built theme carried its payload into the sheet, so the guard is on the door a caller may walk past",
    });

    // And the other direction on the two fields held to what they are rather than to what they lack:
    // an ordinary seed and an ordinary selector must still be written.
    const ordinary = [];
    for (const [member, value] of [["selector", ".a > .b:not(.c)"], ["seed", "#7067ff"], ["name", "brand"]]) {
      try { serializeMdyThemeCss({ ...compiled, [member]: value }); }
      catch (error) { ordinary.push(`${member}=${value}: ${String(error.message).slice(0, 50)}`); }
    }
    expectEqual(ordinary, [], {
      claimIds: ["SEC-003"],
      what: "the writer refuses a value a theme is ordinarily written with",
    });
  },
);
