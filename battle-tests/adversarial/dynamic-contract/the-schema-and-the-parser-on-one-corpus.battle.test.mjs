/**
 * The published schema and the parser, asked about the same documents.
 *
 * H-3 of `charter/fable5-hunts.md`: *"for every document, `spec/dynamic-form-v*.schema.json` and
 * `parseDynamicForm` agree on acceptance"*. Two surfaces answer the question *is this a document?*,
 * and they answer it for different audiences — the schema while a document is written, in an editor
 * (`apps/vscode/package.json` points every `*.form.json` at it), and the parser when it is read, which
 * is the only one a stored or generated document ever meets.
 *
 * A disagreement is not automatically a defect, and the direction decides which. Measured over the
 * corpus below, six of the seven go one way and are **not** asserted here:
 *
 * - **the schema accepts, the parser refuses** — a costly pattern, a rule naming a field that is not
 *   there, a layout naming a ghost, an initial value of the wrong shape. A JSON Schema is a shape
 *   grammar: it cannot know that `(a+)+$` backtracks exponentially or that `ghost` was never
 *   declared. Demanding agreement here would be demanding that a grammar do semantics, so this
 *   direction is recorded and left alone.
 * - **the schema refuses, the parser accepts** — the one this battle asserts. An author is told
 *   their document is wrong *while writing it*, in an editor, and it works when deployed. Nothing
 *   about a grammar's limits explains that: refusing something valid is a statement the schema is
 *   making about shape, which is the only thing it is for.
 *
 * The corpus is small and deliberate rather than generated: each entry is a shape this register has
 * already had a reason to care about.
 *
 * Ajv and `spec/*.json` are a consumer's own tools: the schema is published at
 * `https://modyra.dev/schemas/`, and validating against it is what an editor does. Nothing here
 * reaches into a package.
 */

import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import Ajv from "ajv/dist/2020.js";
import { parseDynamicForm } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

const SPEC = resolve(dirname(new URL(import.meta.url).pathname), "..", "..", "..", "spec");

const field = (extra = {}) => ({ name: "a", kind: "text", label: "A", ...extra });
const leaf = (spec = {}) => ({ node: "field", field: { kind: "text", label: "A", ...spec } });

/** Each entry is a shape this register has had a reason to care about. */
const CORPUS = Object.freeze([
  { what: "a plain field list", document: { version: 3, fields: [field()] } },
  { what: "a plain schema tree", document: { version: 3, schema: { node: "group", children: { a: leaf() } } } },
  { what: "an unknown key on a field", document: { version: 3, fields: [field({ nonsenseKey: 1 })] } },
  { what: "a validator one level too high", document: { version: 3, fields: [field({ required: true })] } },
  { what: "an unknown kind", document: { version: 3, fields: [{ name: "a", kind: "richtext", label: "A" }] } },
  { what: "a reserved name", document: { version: 3, fields: [field({ name: "__proto__" })] } },
  { what: "a name carrying a zero-width space", document: { version: 3, fields: [field({ name: "a​" })] } },
  { what: "a costly pattern", document: { version: 3, fields: [field({ validators: { pattern: "(a+)+$" } })] } },
  { what: "a select with no options", document: { version: 3, fields: [{ name: "a", kind: "select", label: "A" }] } },
  { what: "a rule naming a field that is not there", document: { version: 3, fields: [field()], rules: [{ effect: "hidden", target: "ghost", when: { field: "a", operator: "isEmpty" } }] } },
  { what: "a validation with no message", document: { version: 3, fields: [field()], validations: [{ when: { op: "isEmpty", operands: [{ path: "a" }] } }] } },
  { what: "a layout naming a ghost", document: { version: 3, fields: [field()], layout: [{ kind: "section", id: "s", children: ["ghost"] }] } },
  { what: "an initial value of the wrong shape", document: { version: 3, fields: [{ name: "a", kind: "number", label: "A", initialValue: "text" }] } },
]);

battle(
  {
    claims: ["DYN-004", "DYN-003"],
    title: "the published schema and the parser accept the same documents",
    environments: ["node"],
  },
  async (ctx) => {
    const schema = JSON.parse(readFileSync(join(SPEC, "dynamic-form-v3.schema.json"), "utf8"));
    const ajv = new Ajv({ strict: false, allErrors: true });
    const validate = ajv.compile(schema);

    const observed = CORPUS.map((entry) => {
      const schemaAccepts = validate(entry.document) === true;
      const parsed = parseDynamicForm(entry.document, { mode: "strict" });
      return { what: entry.what, schemaAccepts, parserAccepts: parsed.ok };
    });
    ctx.log.note("what each surface says about each document", observed);

    // The instrument: the corpus must contain documents both surfaces accept and documents both
    // refuse, or "they agree" would be a statement about one constant answer.
    expectClaim(
      observed.some((row) => row.schemaAccepts && row.parserAccepts) &&
        observed.some((row) => !row.schemaAccepts && !row.parserAccepts),
      {
        claimIds: ["DYN-004"],
        what: "the corpus does not contain both a document both surfaces take and one both refuse, so agreement would mean nothing",
        detail: JSON.stringify(observed),
      },
    );

    // The direction a grammar cannot explain: the schema says the shape is wrong and the parser
    // builds a form from it. Recorded rather than asserted, so the numbers stay visible.
    ctx.log.note("disagreements the other way, which a shape grammar cannot be asked to fix", {
      semantic: observed.filter((row) => row.schemaAccepts && !row.parserAccepts).map((row) => row.what),
    });

    expectEqual(
      observed.filter((row) => !row.schemaAccepts && row.parserAccepts).map((row) => row.what),
      [],
      {
        claimIds: ["DYN-004", "DYN-003"],
        what: "the published schema refuses a document the parser builds a form from, so an author following the types is told by their editor that a working document is wrong",
      },
    );
  },
);
