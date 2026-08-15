/**
 * The version an author is told to write, and the schemas that underline it.
 *
 * A document arrives as JSON from somewhere that is not the application, and the published schema is
 * the only diagnostic its author gets for free: an editor reads `$schema` and underlines, with no
 * extension installed and nothing run. That is what makes a gap here expensive rather than cosmetic —
 * a schema that rejects a valid document teaches the author to distrust it, and after that it stops
 * being a diagnostic at all.
 *
 * The parser accepts three envelope versions and a bare field array. `spec/` publishes a schema for
 * two of them. The version with no schema is the one the guide's own prompt instructs a model to
 * emit, so the recommended path is the one that gets underlined.
 *
 * Both sides are measured rather than listed: the accepted versions come from probing the parser, and
 * the schemas from reading `spec/`. Publishing a schema turns this green; so does the parser
 * narrowing what it takes. Widening either one widens the battle.
 */

import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import Ajv from "ajv/dist/2020.js";
import { parseDynamicForm } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

const HERE = dirname(new URL(import.meta.url).pathname);
const REPO = resolve(HERE, "..", "..", "..");

/** A document with nothing wrong with it but its version number. */
const minimal = (version) => ({ version, fields: [{ name: "email", kind: "email", label: "Email" }] });

/** Every version the parser takes, found by asking it rather than by naming them here. */
function versionsTheParserAccepts(limit = 8) {
  const accepted = [];
  for (let version = 1; version <= limit; version += 1) {
    if (parseDynamicForm(minimal(version), { mode: "strict" }).ok) accepted.push(version);
  }
  return accepted;
}

/** Every schema `spec/` publishes, compiled, keyed by the version it declares. */
function publishedSchemas() {
  const ajv = new Ajv({ strict: false, allErrors: true });
  const compiled = new Map();
  for (const file of readdirSync(REPO.concat("/spec")).filter((each) => each.endsWith(".schema.json"))) {
    const schema = JSON.parse(readFileSync(join(REPO, "spec", file), "utf8"));
    const declared = schema.properties?.version?.const;
    if (typeof declared === "number") compiled.set(declared, { file, validate: ajv.compile(schema) });
  }
  return compiled;
}

battle(
  {
    claims: ["DYN-001", "DYN-003"],
    title: "every envelope version the parser accepts has a schema that accepts it",
    environments: ["node"],
  },
  async (ctx) => {
    const accepted = versionsTheParserAccepts();
    const schemas = publishedSchemas();
    ctx.log.note("what each artefact knows", {
      parser: accepted,
      published: [...schemas.keys()].sort((a, b) => a - b),
    });

    // The control: the probe found something and the schemas compiled, so a mismatch below is a
    // mismatch rather than one side having failed to load.
    expectClaim(accepted.length > 0 && schemas.size > 0, {
      claimIds: ["DYN-001"],
      what: "either the parser accepted no version at all or no schema was published",
      detail: JSON.stringify({ accepted, published: [...schemas.keys()] }),
    });

    const unpublished = accepted.filter((version) => !schemas.has(version));
    const rejected = accepted.filter((version) => {
      const schema = schemas.get(version);
      return schema !== undefined && !schema.validate(minimal(version));
    });

    expectEqual(unpublished, [], {
      claimIds: ["DYN-003"],
      what: "the parser accepts an envelope version no published schema describes, so an author writing it is underlined by their editor",
      detail: `versions with no schema: ${JSON.stringify(unpublished)}`,
    });

    expectEqual(rejected, [], {
      claimIds: ["DYN-003"],
      what: "a published schema refuses a minimal document of the very version it declares",
      detail: JSON.stringify(rejected),
    });
  },
);

battle(
  {
    claims: ["DYN-001", "DYN-003"],
    title: "the shape the guide asks a model for is one the published schemas accept",
    environments: ["node"],
  },
  async (ctx) => {
    // The two shapes the guide names in its prompt: the versioned envelope it tells the model to
    // emit, and the bare array it says is accepted. Both are documents an author gets back from a
    // model and pastes into a file with `$schema` at the top.
    const shapes = [
      ["the envelope the prompt asks for", minimal(1)],
      ["the bare field array", [{ name: "email", kind: "email", label: "Email" }]],
    ];
    const schemas = publishedSchemas();

    for (const [what, document] of shapes) {
      const parsed = parseDynamicForm(document, { mode: "strict" });
      const accepting = [...schemas.entries()]
        .filter(([, schema]) => schema.validate(document))
        .map(([version]) => version);
      ctx.log.note("a shape the guide names", { what, parses: parsed.ok, acceptedBy: accepting });

      // The control: the parser takes it, which is what makes it a shape an author would write.
      expectClaim(parsed.ok && parsed.fields.length === 1, {
        claimIds: ["DYN-001"],
        what: `the parser refused ${what}, so this battle is about a shape nobody can use anyway`,
        detail: JSON.stringify(parsed.diagnostics),
      });

      expectClaim(accepting.length > 0, {
        claimIds: ["DYN-003"],
        what: `${what} parses, and every published schema underlines it as wrong`,
        detail: `schemas checked: ${[...schemas.values()].map((each) => each.file).join(", ")}`,
      });
    }
  },
);
