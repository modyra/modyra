/**
 * A key the contract does not have, at every place the contract says so.
 *
 * `spec/dynamic-form-v3.schema.json` marks sixteen object kinds `"additionalProperties": false` — the
 * root envelope, a field node, a group node, an array node, `validators`, an `option`, a `rule` and
 * its `when`, both shapes of layout node, a `slot`, a `placement`. Each of those is a statement that
 * a document carrying anything else is not a document.
 *
 * The parser enforces one of them. Swept across every published fixture, injecting one unknown key at
 * a time at every position a closed definition describes, it notices three injections out of
 * eighty-seven, and all three are the same definition — `placementAt`, the per-breakpoint object.
 * Everywhere else the key is taken and nothing is said.
 *
 * Those three are what make this measurable rather than a guess about what the parser is for: the
 * parser does refuse an unknown key where it has been told to, so the silence elsewhere is a gap
 * rather than a policy of tolerating extra data.
 *
 * The corpus is the published fixtures rather than documents this battle invents, and the closed set
 * is read from the published schema rather than copied, so both sides of the comparison are the
 * project's own and a definition opened or closed later moves the sweep without anyone editing it.
 */

import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { parseDynamicForm } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

const HERE = dirname(new URL(import.meta.url).pathname);
const SPEC = resolve(HERE, "..", "..", "..", "spec");

/** Every object kind the published schema closes, with the keys it allows. */
function closedDefinitions() {
  const schema = JSON.parse(readFileSync(join(SPEC, "dynamic-form-v3.schema.json"), "utf8"));
  const found = [];
  const walk = (node, path) => {
    if (node === null || typeof node !== "object") return;
    if (node.additionalProperties === false && node.properties) {
      found.push({
        name: path === "" ? "(root)" : path,
        allows: new Set(Object.keys(node.properties)),
        requires: node.required ?? [],
      });
    }
    for (const [key, value] of Object.entries(node)) walk(value, path === "" ? key : `${path}.${key}`);
  };
  walk(schema, "");
  return found;
}

/** Which closed definition, if any, describes this object. */
function definitionFor(object, definitions) {
  const keys = Object.keys(object);
  return definitions.find((definition) =>
    definition.requires.every((key) => keys.includes(key))
    && keys.every((key) => definition.allows.has(key))) ?? null;
}

/** Every position in a document that a closed definition describes. */
function closedPositions(node, definitions, path = "", found = []) {
  if (Array.isArray(node)) {
    node.forEach((item, index) => closedPositions(item, definitions, `${path}[${index}]`, found));
  } else if (node !== null && typeof node === "object") {
    const definition = definitionFor(node, definitions);
    if (definition !== null) found.push({ path, definition: definition.name });
    for (const [key, value] of Object.entries(node)) {
      closedPositions(value, definitions, path === "" ? key : `${path}.${key}`, found);
    }
  }
  return found;
}

/** The same document with one key the contract does not have, at `path`. */
function withAnExtraKeyAt(document, path) {
  const copy = structuredClone(document);
  let node = copy;
  for (const part of path.split(/\.|(?=\[)/).filter(Boolean)) {
    node = part.startsWith("[") ? node[Number(part.slice(1, -1))] : node[part];
  }
  node.wormhole = 1;
  return copy;
}

/** Every fixture the project publishes, whatever it was written to demonstrate. */
function publishedFixtures() {
  const root = join(SPEC, "fixtures", "dynamic-form");
  return readdirSync(root).flatMap((version) =>
    readdirSync(join(root, version)).map((file) => ({
      name: `${version}/${file}`,
      document: JSON.parse(readFileSync(join(root, version, file), "utf8")),
    })));
}

battle(
  {
    claims: ["DYN-001", "DYN-003"],
    title: "a key the contract does not have is one the parser says something about",
    environments: ["node"],
  },
  async (ctx) => {
    const definitions = closedDefinitions();
    const fixtures = publishedFixtures();

    // The premise: both sides of the comparison exist. A schema that closed nothing, or a corpus
    // that had emptied, would leave this green having swept nothing.
    expectClaim(definitions.length >= 8 && fixtures.length >= 4, {
      claimIds: ["DYN-001"],
      what: "the schema closes almost nothing or the fixture corpus is nearly empty, so this sweep measures nothing",
      detail: JSON.stringify({ definitions: definitions.length, fixtures: fixtures.length }),
    });

    const silent = [];
    const noticed = [];
    for (const fixture of fixtures) {
      const before = parseDynamicForm(fixture.document);
      const saidBefore = (before.diagnostics ?? []).length;

      for (const { path, definition } of closedPositions(fixture.document, definitions)) {
        const parsed = parseDynamicForm(withAnExtraKeyAt(fixture.document, path));
        const saidAfter = (parsed.diagnostics ?? []).length;
        const where = `${fixture.name} ${path === "" ? "(root)" : path} [${definition}]`;
        if (saidAfter > saidBefore || (before.ok && !parsed.ok)) noticed.push(where);
        else silent.push({ where, definition });
      }
    }

    const byDefinition = {};
    for (const each of silent) byDefinition[each.definition] = (byDefinition[each.definition] ?? 0) + 1;
    ctx.log.note("an unknown key at every closed position", {
      swept: silent.length + noticed.length,
      noticed: noticed.length,
      silent: silent.length,
      byDefinition,
    });

    // The control: the parser does refuse an unknown key somewhere, so silence elsewhere is a gap
    // rather than a contract that tolerates extra data by design.
    expectClaim(noticed.length > 0, {
      claimIds: ["DYN-003"],
      what: "the parser noticed an unknown key nowhere at all, which makes this a question about the contract's intent rather than a defect this battle can show",
      detail: JSON.stringify({ swept: silent.length + noticed.length }),
    });

    expectEqual(silent.map((each) => each.where), [], {
      claimIds: ["DYN-001", "DYN-003"],
      what: "a document carried a key the published schema forbids, at a place the schema closes, and the parser said nothing",
    });
  },
);
