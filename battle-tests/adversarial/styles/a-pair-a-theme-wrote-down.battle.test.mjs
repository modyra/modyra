/**
 * The pairs a theme states outright, held to the threshold an auditor applies.
 *
 * `MDY_ON_COLOR_FLOOR` is 3.5 and it decides **which** colour an `on-` token takes: light text on a
 * saturated background reads better than the ratio says, and choosing by ratio alone puts dark text
 * on a saturated mid tone. `DESIGN.md` is explicit that this is not an exemption — *"The floor chooses
 * which colour; AA is what a pairing must reach… A derived `on-` colour that clears 3.5:1 has
 * satisfied the rule for choosing it and has not been excused from AA."*
 *
 * A derived pair is checked where it lands: the browser tier renders every kind and runs an auditor
 * over it, and that is what caught the default primary at 4.09. A pair a theme file **writes down**
 * is checked nowhere — a literal `--mdy-sys-color-on-primary` beside a literal
 * `--mdy-sys-color-primary` never passes through the pivot, so nothing derives it and nothing audits
 * it unless that theme happens to be the one a browser spec mounted.
 *
 * There is one such pair today and it is deliberate: `modyra-salience.theme.css` keeps `#7067ff` as
 * its primary with `#000000` on it — 5.07, and it passes. It is also a trap with a name: the default
 * seed moved to `#6458EF` for exactly this reason, and **black on `#6458EF` is 3.28**. A theme that
 * inherited the new seed while keeping its literal black would go from passing to failing with
 * nothing to notice it, because no auditor mounts salience.
 *
 * So this reads every theme this repository ships, takes the pairs it states as literals, and holds
 * them to 4.5. It covers one pair today and every future one for free — which is the only reason it
 * is worth a file: a theme that hardcodes a pairing is a theme that opted out of the pivot, and the
 * threshold is what is left.
 *
 * Green when every literal pair a shipped theme declares clears AA for normal text.
 *
 * @source-inspection — a theme's stylesheet **is** the thing under test, and the pair it states is a
 * literal in that file. There is no published door that hands back "the colours this theme wrote
 * down": the compiler derives them, and a derived pair is the case this one is not about. The ratio
 * itself is the package's own, resolved through its `exports` map.
 */

import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

const HERE = dirname(new URL(import.meta.url).pathname);
const REPO = resolve(HERE, "..", "..", "..");
const THEMES = join(REPO, "packages", "styles", "src");

/**
 * The package's own ratio, reached through its manifest rather than by name.
 *
 * `@modyra/styles` is not linked at the repository root, so a bare specifier resolves nowhere from
 * here — the same gap the documentation sweep found. Its published entry point is read from its own
 * `exports` map, which is the door a consumer resolves through; writing the luminance formula out
 * here instead would measure this file's arithmetic rather than the library's.
 */
const stylesEntry = () => {
  const manifest = JSON.parse(readFileSync(join(REPO, "packages", "styles", "package.json"), "utf8"));
  const entry = manifest.exports?.["."];
  const file = typeof entry === "string" ? entry : entry?.default ?? entry?.import ?? manifest.main;
  return pathToFileURL(join(REPO, "packages", "styles", file)).href;
};

/** WCAG AA for normal text. Large text and non-text contrast are 3:1 and are not what a label is. */
const AA = 4.5;

/** The roles a theme states a text colour for, each beside the surface it sits on. */
const PAIRS = ["primary", "secondary", "tertiary", "error", "surface", "background"];

const literal = (css, token) =>
  new RegExp(`--mdy-sys-color-${token}:\\s*(#[0-9a-fA-F]{3,8})`).exec(css)?.[1] ?? null;

battle(
  {
    claims: ["A11Y-003"],
    title: "a pair a theme writes down clears AA",
    environments: ["node"],
  },
  async (ctx) => {
    const { contrastRatio } = await import(stylesEntry());
    const files = readdirSync(THEMES).filter((name) => name.endsWith(".theme.css"));
    const below = [];
    let checked = 0;

    for (const file of files) {
      const css = readFileSync(join(THEMES, file), "utf8");
      for (const role of PAIRS) {
        const background = literal(css, role);
        const text = literal(css, `on-${role}`);
        if (background === null || text === null) continue;
        checked += 1;
        const ratio = contrastRatio(text, background);
        ctx.log.note("a pair a theme states outright", { file, role, background, text, ratio: Number(ratio.toFixed(2)) });
        if (ratio < AA) below.push(`${file} ${role}: ${text} on ${background} is ${ratio.toFixed(2)}`);
      }
    }

    // The control: there is a literal pair to check. The day every theme derives all of them this
    // battle has nothing to say, and saying nothing must not read as saying yes.
    expectClaim(checked > 0, {
      claimIds: ["A11Y-003"],
      what: "no shipped theme states a pair as literals, so this battle checked nothing",
      detail: `${files.length} theme file(s)`,
    });

    expectEqual(below, [], {
      claimIds: ["A11Y-003"],
      what: "a theme states a text colour on a background it cannot be read on",
    });
  },
);
