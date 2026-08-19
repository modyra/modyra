#!/usr/bin/env node
/**
 * Holds `spec/*.schema.json` to what the parser actually accepts.
 *
 * The schema is the only diagnostic a consumer authoring a contract as JSON gets for free: an editor
 * reads `$schema` and underlines without any extension installed. That makes it worth having and
 * dangerous when stale — a schema that rejects a valid document teaches the author to distrust it,
 * and one that accepts an invalid document teaches them to trust it too far.
 *
 * Three things are compared, each a way the schema has drifted before:
 *   1. the kinds it lists against the parser's — a missing kind rejects a form that renders;
 *   2. the slots it declares against the document type's — with `additionalProperties: false`, an
 *      undeclared slot rejects every document that uses it;
 *   3. every fixture in the shared corpus, whose kinds and slots must be ones the schema knows.
 *
 * What is deliberately not checked: whether the schema accepts each fixture in full. That needs a
 * JSON Schema validator, which is a dependency this repository does not carry. The boundary the
 * schema cannot cross is stated instead, because it is a property of JSON Schema rather than of this
 * schema: a cross-reference — a layout slot naming a field that does not exist, a duplicate name, a
 * validation reading an undeclared path — is invisible to it and belongs to the parser. See ADR 0024.
 *
 * Usage:
 *   node scripts/audit-contract-schema.mjs          # report
 *   node scripts/audit-contract-schema.mjs --check  # exit 1 on defects
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import Ajv from "ajv/dist/2020.js";
import { MDY_DYNAMIC_FIELD_KINDS, MDY_DYNAMIC_MEMBERS, parseDynamicForm } from "../packages/core/dist/dynamic-config.js";

const ROOT = resolve(import.meta.dirname, "..");
const CORPUS = join(ROOT, "spec/fixtures/dynamic-form");
const CHECK = process.argv.includes("--check");

const readJson = (path) => JSON.parse(readFileSync(join(ROOT, path), "utf8"));

/** The schemas under audit, and the document version each one describes. */
const SCHEMAS = [
  { path: "spec/dynamic-form-v2.schema.json", version: 2 },
  { path: "spec/dynamic-form-v3.schema.json", version: 3 },
  { path: "spec/dynamic-form-v4.schema.json", version: 4 },
];

/**
 * The slots a document of each version carries, read from the types rather than restated here.
 *
 * Every version extends the one before it — `…V3` is `Omit<…V2, "version">`, `…V4` is `Omit<…V3,
 * "version">` plus its own members — so a version's slots are its own declaration plus everything
 * below it. Reading them from the declarations means a slot added to the contract shows up as a
 * schema defect on the next run instead of the next bug report: `requiresContext` arrived with v4
 * and no gate knew about it.
 */
const documentSlots = (version) => {
  // Read from wherever the document's modules put it: which file holds the declaration is an
  // internal arrangement, and a gate that pins one is a gate that breaks on a rename.
  const dir = join(ROOT, "packages/core/src/dynamic");
  const sources = readdirSync(dir)
    .filter((name) => name.endsWith(".ts"))
    .map((name) => readFileSync(join(dir, name), "utf8"));
  const slots = new Set();
  for (let each = 2; each <= version; each += 1) {
    const pattern = new RegExp(`export interface MdyDynamicFormConfigV${each}[^{]*\\{([\\s\\S]*?)\\n\\}`);
    const block = sources.map((source) => pattern.exec(source)).find(Boolean);
    if (!block) throw new Error(`MdyDynamicFormConfigV${each} is no longer declared where this audit reads it`);
    for (const match of block[1].matchAll(/^\s*readonly (\w+)\??:/gm)) slots.add(match[1]);
  }
  return [...slots];
};

const findings = [];
const note = (schema, detail) => findings.push(`${schema}: ${detail}`);

/**
 * Where each slot's members are written in a published schema.
 *
 * A layout node is two shapes under one `oneOf`, so the section and the row are read by their index
 * — which is why the path is a list rather than a name.
 */
const MEMBER_SLOTS = [
  ["field", ["$defs", "field"]],
  ["validators", ["$defs", "validators"]],
  ["option", ["$defs", "option"]],
  ["rule", ["$defs", "rule"]],
  ["validation", ["$defs", "validation"]],
  ["layoutSection", ["$defs", "layout", "oneOf", 0]],
  ["layoutColumns", ["$defs", "layout", "oneOf", 1]],
  ["layoutSlot", ["$defs", "slot"]],
];

/** Slots that arrived with contract v3, so a v2 schema is right not to have them. */
const SINCE_V3 = new Set(["layoutSlot"]);

/** The member names a schema declares at `path`, or null when it declares nothing there. */
const memberNamesAt = (schema, path) => {
  let node = schema;
  for (const step of path) {
    if (node === undefined || node === null) return null;
    node = node[step];
  }
  const properties = node?.properties;
  return properties ? Object.keys(properties) : null;
};

const kindsOf = (schema) => schema?.$defs?.field?.properties?.kind?.enum ?? [];
const slotsOf = (schema) => Object.keys(schema?.properties ?? {});

for (const { path: schemaPath, version } of SCHEMAS) {
  const path = schemaPath;
  const schema = readJson(path);

  if (schema.properties?.version?.const !== version) {
    note(path, `declares version ${JSON.stringify(schema.properties?.version?.const)}, expected ${version}`);
  }

  const declared = kindsOf(schema);
  const missing = MDY_DYNAMIC_FIELD_KINDS.filter((kind) => !declared.includes(kind));
  const unknown = declared.filter((kind) => !MDY_DYNAMIC_FIELD_KINDS.includes(kind));
  if (missing.length > 0) note(path, `does not list kind(s) the parser accepts: ${missing.join(", ")}`);
  if (unknown.length > 0) note(path, `lists kind(s) the parser rejects: ${unknown.join(", ")}`);

  // The members of every slot, against the list the parser reports an undeclared member from. The
  // two are one contract read twice: a member in the schema and not in the parser's list is one the
  // parser reports for a document the editor accepted, and a member in the list and not in the
  // schema is one the editor underlines in a document the parser reads.
  for (const [slot, path] of MEMBER_SLOTS) {
    // A slot the version predates is not a slot it omits: placement — the `slot` shape and a
    // section's `at` — arrived with v3, and v2 documents are read by a v2 schema.
    if (SINCE_V3.has(slot) && version < 3) continue;
    const declared = memberNamesAt(schema, path);
    if (declared === null) {
      note(schemaPath, `does not declare ${slot} where this audit reads it (${path.join("/")})`);
      continue;
    }
    const known = MDY_DYNAMIC_MEMBERS[slot]
      .filter((member) => !(version < 3 && slot === "layoutSection" && member === "at"));
    const missing = known.filter((member) => !declared.includes(member));
    const extra = declared.filter((member) => !known.includes(member));
    if (missing.length > 0) note(schemaPath, `${slot} omits member(s) the parser reads: ${missing.join(", ")}`);
    if (extra.length > 0) note(schemaPath, `${slot} declares member(s) the parser reports as unknown: ${extra.join(", ")}`);
  }

  // Only a closed object can reject a slot for being absent from the list.
  if (schema.additionalProperties === false) {
    const absent = documentSlots(version).filter((slot) => !slotsOf(schema).includes(slot));
    if (absent.length > 0) {
      note(path, `is closed and does not declare slot(s) the document carries: ${absent.join(", ")}`);
    }
  }
}

/** Every fixture, checked against the schema for its own version. */
const byVersion = new Map(SCHEMAS.map(({ path, version }) => [version, readJson(path)]));
let fixtureCount = 0;

/**
 * One compiled validator per schema. `strict: false` because the schemas are written for editors
 * first: a `description` beside a `$ref` is what a reader hovers, and ajv's strict mode rejects
 * spellings that every editor accepts.
 */
const ajv = new Ajv({ strict: false, allErrors: true });
const validators = new Map([...byVersion.values()].map((schema) => [schema, ajv.compile(schema)]));

/** Fixtures the schema passes and the parser refuses — the boundary, not a defect. */
const boundary = [];

for (const version of readdirSync(CORPUS)) {
  const schema = byVersion.get(Number(version.replace("v", "")));
  if (!schema) {
    findings.push(`spec/fixtures/dynamic-form/${version}: no schema describes this version`);
    continue;
  }

  for (const file of readdirSync(join(CORPUS, version))) {
    fixtureCount += 1;
    const where = `spec/fixtures/dynamic-form/${version}/${file}`;
    const document = readJson(join("spec/fixtures/dynamic-form", version, file));

    for (const slot of Object.keys(document)) {
      if (schema.additionalProperties === false && !slotsOf(schema).includes(slot)) {
        findings.push(`${where}: uses slot "${slot}", which its schema is closed against`);
      }
    }

    // The two verdicts, each from the thing entitled to give it.
    const validate = validators.get(schema);
    const schemaAccepts = validate(document);
    const parserFindings = parseDynamicForm(document).diagnostics;

    if (parserFindings.length === 0 && !schemaAccepts) {
      // The schema is describing a document the parser renders. This is the direction that has been
      // wrong every time: three of the v2 schema's defects presented exactly here.
      const why = (validate.errors ?? [])
        .map((error) => `${error.instancePath || "/"} ${error.message}`)
        .slice(0, 3)
        .join("; ");
      findings.push(`${where}: the parser accepts it and its schema rejects it — ${why}`);
    }

    if (parserFindings.length > 0 && schemaAccepts) {
      // Expected, and worth printing rather than passing over: it is the boundary the schema cannot
      // cross, and seeing it named is what stops a green schema being read as a valid document.
      boundary.push(`${where}: ${parserFindings.map((d) => d.code).join(", ")}`);
    }
  }
}

console.log("# Contract schema audit\n");
console.log(`Schemas: ${SCHEMAS.map((s) => s.path).join(", ")}`);
console.log(`Fixtures checked: ${fixtureCount}`);
console.log(`Kinds the parser accepts: ${MDY_DYNAMIC_FIELD_KINDS.length}`);
console.log(`Document slots read from the type: ${documentSlots(Math.max(...SCHEMAS.map(({ version }) => version))).join(", ")}\n`);

console.log("Cross-reference findings are the parser's, not the schema's: a slot naming an absent");
console.log("field, a duplicate name and a validation on an undeclared path pass any JSON Schema.");
if (boundary.length === 0) {
  console.log("No fixture exercises that boundary, so nothing here demonstrates it.\n");
} else {
  console.log(`Schema accepts, parser refuses — ${boundary.length} fixture(s):\n`);
  for (const entry of boundary) console.log(`  · ${entry}`);
  console.log();
}

if (findings.length === 0) {
  console.log("CONTRACT SCHEMA CLEAN");
} else {
  console.log(`Defects: ${findings.length}\n`);
  for (const finding of findings) console.log(`  - ${finding}`);
  if (CHECK) process.exit(1);
}
