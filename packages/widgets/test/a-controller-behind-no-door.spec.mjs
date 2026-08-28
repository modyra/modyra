/**
 * Every controller this package builds is one a renderer can import.
 *
 * Three were written, tested, and behind no door. `createSelectFieldController`,
 * `createColorsFieldController` and `createFileFieldController` lived in `src/field/`, their types
 * were published, and the functions that build them were not — so a consumer could name the type and
 * had no way to make one. No renderer adopted them because no renderer could.
 *
 * Nothing said so. Their own suites imported them by deep path into `dist`, which passes and makes
 * them read as exercised; `coverage-and-demo` counted them asserted; `audit-public-doors` guards the
 * opposite mistake, a name reachable from two subpaths, not a name reachable from none. And the
 * adoption audit reported "none offered" — correctly, and therefore silently.
 *
 * The file that declares one of them opens by saying it exists to close a split between two idioms.
 * It is the clearest case of the shape this repository already names: *a rule that is declared,
 * correct, and wired to nothing.*
 */
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { test } from "node:test";
import * as published from "../dist/index.js";

const FIELD = new URL("../src/field/", import.meta.url);

/** What a controller module is called, so the check finds the next one without being told. */
const CONTROLLER_MODULE = /^([a-z-]+)-field-controller\.ts$/;

test("every field controller module is reachable from the package's door", () => {
  const behindNoDoor = [];
  for (const entry of readdirSync(FIELD)) {
    const match = CONTROLLER_MODULE.exec(entry);
    if (match === null) continue;
    // `some-kind-field-controller.ts` builds `createSomeKindFieldController`. The convention is the
    // package's own and holds for all ten; a module that breaks it fails here, which is the right
    // answer — a builder nobody can guess the name of is a builder nobody imports.
    const kind = match[1].replace(/-(.)/g, (_, c) => c.toUpperCase());
    const builder = `create${kind[0].toUpperCase()}${kind.slice(1)}FieldController`;
    if (typeof published[builder] !== "function") behindNoDoor.push(`${entry} → ${builder}`);
  }
  assert.deepEqual(behindNoDoor, [],
    "a controller is built in this package and cannot be imported from it. Its types may still be "
    + "published, which is worse than neither: a consumer can name the thing and cannot make one");
});

test("the check would notice a controller that stopped being exported", () => {
  // The premise. A check that found nothing because it was looking in the wrong place would pass
  // exactly as loudly, and this file exists because three modules did precisely that for months.
  const modules = readdirSync(FIELD).filter((entry) => CONTROLLER_MODULE.test(entry));
  assert.ok(modules.length >= 10,
    `only ${modules.length} controller modules found in src/field — the pattern above has stopped matching`);
  const builders = Object.keys(published).filter((name) => /^create\w+FieldController$/.test(name));
  assert.equal(builders.length, modules.length,
    `${modules.length} controller modules and ${builders.length} exported builders — the two must agree`);
});
