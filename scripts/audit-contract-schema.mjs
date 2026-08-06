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
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { MDY_DYNAMIC_FIELD_KINDS } from "../packages/core/dist/dynamic-config.js";

const ROOT = resolve(import.meta.dirname, "..");
const CORPUS = join(ROOT, "spec/fixtures/dynamic-form");
const CHECK = process.argv.includes("--check");

const readJson = (path) => JSON.parse(readFileSync(join(ROOT, path), "utf8"));

/** The schemas under audit, and the document version each one describes. */
const SCHEMAS = [
  { path: "spec/dynamic-form-v2.schema.json", version: 2 },
  { path: "spec/dynamic-form-v3.schema.json", version: 3 },
];

/**
 * The slots a document carries, read from the type rather than restated here.
 *
 * `MdyDynamicFormConfigV3` is `Omit<…V2, "version">`, so v2's members are the list for both, and
 * reading them from the declaration means a slot added to the contract shows up as a schema defect
 * on the next run instead of the next bug report.
 */
const documentSlots = () => {
  const source = readFileSync(join(ROOT, "packages/core/src/dynamic-config.ts"), "utf8");
  const block = /export interface MdyDynamicFormConfigV2 \{([\s\S]*?)\n\}/.exec(source);
  if (!block) throw new Error("MdyDynamicFormConfigV2 is no longer declared where this audit reads it");
  return [...block[1].matchAll(/^\s*readonly (\w+)\??:/gm)].map((match) => match[1]);
};

const findings = [];
const note = (schema, detail) => findings.push(`${schema}: ${detail}`);

const kindsOf = (schema) => schema?.$defs?.field?.properties?.kind?.enum ?? [];
const slotsOf = (schema) => Object.keys(schema?.properties ?? {});

for (const { path, version } of SCHEMAS) {
  const schema = readJson(path);

  if (schema.properties?.version?.const !== version) {
    note(path, `declares version ${JSON.stringify(schema.properties?.version?.const)}, expected ${version}`);
  }

  const declared = kindsOf(schema);
  const missing = MDY_DYNAMIC_FIELD_KINDS.filter((kind) => !declared.includes(kind));
  const unknown = declared.filter((kind) => !MDY_DYNAMIC_FIELD_KINDS.includes(kind));
  if (missing.length > 0) note(path, `does not list kind(s) the parser accepts: ${missing.join(", ")}`);
  if (unknown.length > 0) note(path, `lists kind(s) the parser rejects: ${unknown.join(", ")}`);

  // Only a closed object can reject a slot for being absent from the list.
  if (schema.additionalProperties === false) {
    const absent = documentSlots().filter((slot) => !slotsOf(schema).includes(slot));
    if (absent.length > 0) {
      note(path, `is closed and does not declare slot(s) the document carries: ${absent.join(", ")}`);
    }
  }
}

/** Every fixture, checked against the schema for its own version. */
const byVersion = new Map(SCHEMAS.map(({ path, version }) => [version, readJson(path)]));
let fixtureCount = 0;

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

    const declared = kindsOf(schema);
    const used = new Set();
    const walk = (value) => {
      if (Array.isArray(value)) return value.forEach(walk);
      if (value === null || typeof value !== "object") return;
      if (typeof value.kind === "string" && typeof value.name === "string") used.add(value.kind);
      Object.values(value).forEach(walk);
    };
    walk(document);

    for (const kind of used) {
      if (!declared.includes(kind)) findings.push(`${where}: uses kind "${kind}", which its schema does not list`);
    }

    // A layout child is a name, a slot, or a whole nested node. Asking the fixtures which of those
    // they use, rather than asserting a list here, keeps the audit from being a second description
    // of the layout: the corpus says what a real document contains and the schema has to admit it.
    const childShapes = new Set();
    const walkLayout = (nodes) => {
      for (const node of nodes ?? []) {
        if (node === null || typeof node !== "object") continue;
        const children = node.kind === "columns" ? (node.columns ?? []).flat() : (node.children ?? []);
        for (const child of children) {
          childShapes.add(typeof child === "string" ? "string" : "object");
          if (child !== null && typeof child === "object") walkLayout([child]);
        }
      }
    };
    walkLayout(document.layout);

    const admits = schema.$defs?.layout?.oneOf?.some((variant) => {
      const items = variant.properties?.children?.items ?? variant.properties?.columns?.items?.items;
      return items !== undefined && items.type !== "string";
    });
    if (childShapes.has("object") && !admits) {
      findings.push(`${where}: places a slot or a nested node in a layout, which its schema admits only as a name`);
    }
  }
}

console.log("# Contract schema audit\n");
console.log(`Schemas: ${SCHEMAS.map((s) => s.path).join(", ")}`);
console.log(`Fixtures checked: ${fixtureCount}`);
console.log(`Kinds the parser accepts: ${MDY_DYNAMIC_FIELD_KINDS.length}`);
console.log(`Document slots read from the type: ${documentSlots().join(", ")}\n`);

console.log("Cross-reference findings are the parser's, not the schema's: a slot naming an absent");
console.log("field, a duplicate name and a validation on an undeclared path pass any JSON Schema.\n");

if (findings.length === 0) {
  console.log("CONTRACT SCHEMA CLEAN");
} else {
  console.log(`Defects: ${findings.length}\n`);
  for (const finding of findings) console.log(`  - ${finding}`);
  if (CHECK) process.exit(1);
}
