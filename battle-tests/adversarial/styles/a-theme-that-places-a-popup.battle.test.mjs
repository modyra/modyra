/**
 * A rule the stylesheet states in words, and nothing enforced.
 *
 * `modyra.css` says it where the overlay coordinates are declared:
 *
 *   > Coordinates come from `anchorOverlay` in @modyra/widgets, which every adapter applies as
 *   > `--mdy-overlay-*`. Docked popups fall back to sitting under their anchor. **A theme must never
 *   > set these**: positioning an overlay is structure, and a theme that did it would be deciding
 *   > whether a popup lands on its control.
 *
 * That is a prohibition with a violation condition, which makes it something a test can hold rather
 * than something a reviewer has to remember. A theme that set `--mdy-overlay-left` would move every
 * popup in that theme away from the control that opened it, and nothing would say so — the anchoring
 * arithmetic would still be right, and the popup would still be somewhere.
 *
 * Read from the **sources** rather than the built sheets. Each theme's dist file is a bundle carrying
 * the base and foundation layers inside it, so every built sheet mentions these properties whether or
 * not its own layer sets one. The question is about a theme's own rules.
 */

import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { MDY_CSS_PROPERTIES } from "@modyra/widgets";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

const HERE = dirname(new URL(import.meta.url).pathname);
const STYLE_SOURCES = resolve(HERE, "..", "..", "..", "packages", "styles", "src");

/** The two layers whose job is structure, and which therefore may set the coordinates. */
const STRUCTURAL = Object.freeze(["modyra-base.css", "modyra.css"]);

/** The geometry an adapter computes: where a popup goes, not what it looks like. */
const GEOMETRY = Object.freeze(["top", "bottom", "left", "right", "width", "transform"]);

battle(
  {
    claims: ["UI-001"],
    title: "no theme decides where a popup lands",
    environments: ["node"],
  },
  async (ctx) => {
    const properties = GEOMETRY.map((name) => MDY_CSS_PROPERTIES.overlay[name]).filter(Boolean);

    // The control: the vocabulary still names the coordinates this battle is about. A renamed
    // property would leave the search below matching nothing and passing for that reason.
    expectEqual(properties.length, GEOMETRY.length, {
      claimIds: ["UI-001"],
      what: "the overlay vocabulary no longer names the coordinates this battle searches for",
      detail: () => JSON.stringify(MDY_CSS_PROPERTIES.overlay),
    });

    const sheets = readdirSync(STYLE_SOURCES).filter((name) => name.endsWith(".css"));
    const setters = new Map();
    for (const sheet of sheets) {
      const css = readFileSync(join(STYLE_SOURCES, sheet), "utf8");
      const set = properties.filter((property) => new RegExp(`${property}\\s*:`).test(css));
      if (set.length > 0) setters.set(sheet, set);
    }
    ctx.log.note("which sources place an overlay", { setters: Object.fromEntries(setters) });

    // The second control: the structural layers do set them. If nothing set them anywhere, the search
    // would be looking for a string that never appears and every theme would pass vacuously.
    expectClaim(STRUCTURAL.some((sheet) => setters.has(sheet)), {
      claimIds: ["UI-001"],
      what: "no sheet at all places an overlay, so this battle is not measuring the prohibition",
      detail: () => JSON.stringify([...setters.keys()]),
    });

    const themes = [...setters.keys()].filter((sheet) => !STRUCTURAL.includes(sheet));
    expectEqual(themes, [], {
      claimIds: ["UI-001"],
      what: "a theme sets an overlay coordinate, which decides where a popup lands rather than what it looks like",
      detail: () => JSON.stringify(Object.fromEntries(themes.map((sheet) => [sheet, setters.get(sheet)]))),
    });
  },
);
