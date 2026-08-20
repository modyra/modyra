/**
 * What a control promises will open, and where each renderer gets the answer.
 *
 * `aria-haspopup` is a promise to whoever cannot see the page: it names the kind of thing that will
 * appear. `MDY_POPUP_OPENERS` now carries `promises` for every overlay kind, and
 * `projectOverlayOpenerA11y` emits it — one source, derived from the anatomy the catalogue already
 * declares.
 *
 * Nineteen places set the attribute across the three renderers this repository ships. **One reads
 * the contract:**
 *
 *     lit/components/select-field.ts:395   aria-haspopup=${trigger.attributes["aria-haspopup"]}
 *
 * The rest write a literal, and literals drift the moment nobody compares them:
 *
 *     plain    daterange "grid"        colors "listbox"
 *     lit      multiselect "listbox"   daterange "grid"    dropdown "listbox"
 *              colors "dialog" and "listbox"               timepicker "dialog"
 *              datepicker "dialog"   ← the contract and plain both say "grid"
 *     angular  timepicker "dialog" ×2    datepicker "dialog" ×2 …
 *
 * The datepicker line is what a drifting literal looks like from the inside: two renderers of one
 * contract, promising two different things about the same widget, and nothing in the repository
 * compares them. A person on a screen reader is told to expect a dialog in one and a grid in the
 * other.
 *
 * **This is a structural check, not a rendered one.** The browser tier can only compare the promise
 * against what opens on the page it mounted; it cannot see that eight other files hold their own
 * copy of the answer waiting to diverge. Reading the sources is the only way to ask "does this come
 * from the contract", which is the property — the rendered agreement is the symptom.
 *
 * Green when every renderer takes the promise from the projection. `select-field.ts` is the model and
 * it is one expression long.
 *
 * @source-inspection — a renderer's own source is the thing under test: the question is where a value
 * comes from, and a built bundle no longer says.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

const HERE = dirname(new URL(import.meta.url).pathname);
const REPO = resolve(HERE, "..", "..", "..");
const RENDERERS = ["plain", "lit", "angular"];

/** Every source file under a package, so a renderer that moves its files is still read. */
function sourcesUnder(directory) {
  const found = [];
  const walk = (at) => {
    for (const entry of readdirSync(at, { withFileTypes: true })) {
      if (entry.name === "node_modules") continue;
      const path = join(at, entry.name);
      if (entry.isDirectory()) { walk(path); continue; }
      if (/\.(ts|mjs|js)$/.test(path) && !/\.(test|spec)\./.test(path)) found.push(path);
    }
  };
  walk(directory);
  return found;
}

/**
 * A literal is a quoted word, however the renderer's template spells the quoting.
 *
 * Three spellings across three renderers: `setAttribute("aria-haspopup", "grid")`,
 * `aria-haspopup="listbox"`, and Angular's `[attr.aria-haspopup]="'dialog'"`, where the value is
 * quoted twice. Anything that is not a quoted word is an expression, and an expression may be reading
 * the contract — which is what this battle is asking for.
 */
const LITERAL = /aria-haspopup["'\]]*\s*(?:=|,)\s*["'`]+\s*([a-z]+)\s*["'`]+/i;

battle(
  {
    claims: ["UI-010", "A11Y-004"],
    title: "a renderer takes its popup promise from the contract",
    environments: ["node"],
  },
  async (ctx) => {
    const written = [];
    let sawTheAttribute = 0;

    for (const name of RENDERERS) {
      const root = join(REPO, "packages", name, "src");
      let files;
      try { files = statSync(root).isDirectory() ? sourcesUnder(root) : []; } catch { continue; }
      for (const file of files) {
        const source = readFileSync(file, "utf8");
        for (const line of source.split("\n")) {
          if (!line.includes("aria-haspopup")) continue;
          sawTheAttribute += 1;
          const literal = LITERAL.exec(line);
          if (literal !== null) written.push(`${name}: ${file.slice(REPO.length + 1)} promises ${JSON.stringify(literal[1])}`);
        }
      }
    }

    ctx.log.note("where the promise is set", { places: sawTheAttribute, literals: written.length });

    // The control: the attribute is set somewhere. A rename would otherwise empty this battle and
    // read as every renderer behaving.
    expectClaim(sawTheAttribute >= 5, {
      claimIds: ["UI-010"],
      what: "almost nothing sets aria-haspopup, so this battle read the wrong thing",
      detail: `${sawTheAttribute} place(s)`,
    });

    expectEqual(written.sort(), [], {
      claimIds: ["UI-010", "A11Y-004"],
      what: "a renderer writes its own answer to what its popup is, instead of taking the contract's",
    });
  },
);
