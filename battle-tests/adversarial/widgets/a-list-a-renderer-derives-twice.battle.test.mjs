/**
 * A renderer draws the narrowed list the controller offers; it does not derive one of its own.
 *
 * The controller answers `filteredOptions` — the option list after `state().query` has narrowed it.
 * A renderer that calls `filterOptionsByQuery` builds a second answer to that question, and the two
 * come apart on one input shape: a value the field holds that the options do not carry, plus a host
 * `filterFn` that rejects it. The widening then runs on both sides of the filter — the renderer
 * widens its copy, the filter removes what it widened, the controller is handed a list that again
 * lacks a held value and widens a second time. With no filter the two agree, which is why nothing
 * caught it: the disagreement needs the filter to exist.
 *
 * Two live defects were found under this shape and repaired: a search box that narrowed nothing
 * because the panel drew the whole list, and a cursor walking the unnarrowed list while the panel
 * drew the narrowed one — so the assistive name announced an option that was not on screen.
 *
 * **The rule expires with its record.** Its justification is ADR 0196, and this reads that record
 * rather than restating it: if the decision is superseded, or stops describing the held value and
 * the filter, this fails instead of going on enforcing a rule nobody stands behind any more. An
 * exemption read from a record expires by itself; so should a prohibition.
 *
 * @source-inspection — whether a renderer *derives* a list is a fact about its source. Both
 * derivations answer identically for every input but one, so a rendered page cannot be asked which
 * one produced it, and a suite that only exercised the agreeing shapes would report the duplication
 * as absent.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import assert from "node:assert/strict";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

/** The renderer packages. A package that gains one is covered the day it lands. */
const RENDERERS = readdirSync(join(root, "packages"))
  .map((name) => join("packages", name, "src"))
  .filter((dir) => {
    try { return statSync(join(root, dir)).isDirectory(); } catch { return false; }
  })
  .filter((dir) => !dir.startsWith("packages/widgets") && !dir.startsWith("packages/core"));

/** The door a renderer must not reach for, because the controller already answered with it. */
const DOOR = "filterOptionsByQuery";

const RECORD = "docs/architecture/0196-a-filter-says-what-may-be-added.md";

/**
 * Renderers that still derive their own list, with the reason they are still here.
 *
 * Recorded rather than excluded: it prints, it cannot grow, and it fails when one is repaired and
 * left on the list. Select carries the same pair as multiselect and has not been moved yet.
 */
const RECORDED = new Set([
  "packages/angular/src/lib/renderers/select/select-renderer.component.ts",
  "packages/lit/src/components/select-field.ts",
]);

const strip = (source) =>
  source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");

function filesNaming(door) {
  const found = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) { walk(path); continue; }
      if (!/\.ts$/.test(entry) || /\.spec\.ts$/.test(entry)) continue;
      // Comments removed: the door named in a doc block explaining why a renderer does *not* call it
      // would report the renderer as calling it.
      if (strip(readFileSync(path, "utf8")).includes(door)) found.push(relative(root, path));
    }
  };
  for (const dir of RENDERERS) walk(join(root, dir));
  return found;
}

test("the record this rule stands on is still standing", () => {
  const record = readFileSync(join(root, RECORD), "utf8");
  assert.match(record, /^Status:\s*Accepted\s*$/m,
    `${RECORD} is no longer Accepted, so this prohibition has no decision behind it`);
  assert.ok(/filterFn/.test(record) && /holds/.test(record),
    `${RECORD} no longer describes a held value and a host filter, which is the shape this guards`);
});

test("no renderer derives the narrowed list a controller already answers", () => {
  assert.ok(RENDERERS.length >= 3, `only ${RENDERERS.length} renderer package(s) found — the reader, not the code`);
  const naming = filesNaming(DOOR);
  const appeared = naming.filter((file) => !RECORDED.has(file)).sort();
  assert.deepEqual(appeared, [],
    `these renderers build their own answer to a question the controller answers: ${appeared.join(", ")}`);
});

test("a renderer that stopped deriving is taken off the list", () => {
  const naming = new Set(filesNaming(DOOR));
  const cleared = [...RECORDED].filter((file) => !naming.has(file)).sort();
  assert.deepEqual(cleared, [],
    `recorded as still deriving and no longer does — prune it: ${cleared.join(", ")}`);
});
