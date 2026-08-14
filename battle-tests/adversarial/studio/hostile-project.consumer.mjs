/**
 * Runs inside a packed consumer, not in the suite.
 *
 * The battle beside this file packs the Studio targets with `pnpm pack`, installs them into a
 * temporary package and executes this script there, so what is measured is what a consumer
 * installing the published tarballs would get. It is a separate file rather than a string in the
 * battle because the payloads are made of quotes, backticks and `${`, and nesting them inside a
 * template literal is how a probe ends up testing its own escaping.
 *
 * Three oracles, none of which is a search for dangerous-looking text — the payload is *supposed* to
 * appear in the output, as data:
 *
 *   - **it still parses.** Every payload here closes the literal a generator is most likely to put
 *     it in, so one that escaped leaves a module that no longer parses. A file that never parsed —
 *     a stubs module carrying type annotations — is compared against its own benign twin instead of
 *     to an expectation of parsing.
 *   - **JSON is still JSON, and reads back exactly.** A contract whose label comes back byte for
 *     byte is one where the payload stayed a string.
 *   - **every name derived from it is a name.** A display name becomes an identifier, and the only
 *     safe way to do that is to produce something the language accepts; each is checked by asking
 *     the parser rather than a keyword list.
 *
 * A first version compared the two outputs structurally and called every difference suspicious. It
 * was wrong about all of them: the generators derive identifiers from display names, so the outputs
 * differ for the reason they are supposed to.
 */

import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { createBlankProject } from "@modyra/studio-model";
import { createAngularTarget } from "@modyra/studio-target-angular";
import { createJsonTarget } from "@modyra/studio-target-json";
import { createReactTarget } from "@modyra/studio-target-react";

const QUOTE = String.fromCharCode(34);
const TICK = String.fromCharCode(96);
const BACKSLASH = String.fromCharCode(92);

/** Each payload is a way out of the literal a generator is most likely to put it in. */
const PAYLOADS = {
  doubleQuote: QUOTE + "; process.exit(1); //",
  singleQuote: "'; process.exit(1); //",
  template: TICK + "${process.env.SECRET}" + TICK,
  comment: "*/ process.exit(1); /*",
  backslash: BACKSLASH + BACKSLASH + QUOTE + "; process.exit(1); //",
  newline: "a" + String.fromCharCode(10) + "process.exit(1);",
};

/**
 * One blank project, cloned per payload.
 *
 * `createBlankProject` draws a fresh id every call, and two generations that differ in their id
 * differ in every file — which would make the comparison below fail for a reason that has nothing
 * to do with the payload. The self-check at the end is what proves it does not.
 */
const BASE = createBlankProject("unused");

/** A project carrying one payload in every slot that reaches a generator. */
function projectWith(payload) {
  const project = structuredClone(BASE);
  project.name = payload;
  project.schema.children.push({
    node: "field",
    id: "nd-1",
    name: "note",
    label: payload,
    description: payload,
    fieldKind: "text",
    valueType: "string",
    initialValue: payload,
    validators: [],
  });
  project.implementations = { i1: { id: "impl-0001", displayName: payload, role: "validator" } };
  return project;
}

/** Whether a file of generated code still parses as a module. */
function parses(content, name) {
  const scratch = join(process.cwd(), `check-${name}.mjs`);
  writeFileSync(scratch, content, "utf8");
  try {
    execFileSync(process.execPath, ["--check", scratch], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

/** Whether a JSON artefact is still JSON and still holds the exact string that went in. */
function readsBack(content, payload) {
  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch {
    return false;
  }
  const seen = [parsed];
  while (seen.length > 0) {
    const node = seen.pop();
    if (node === payload) return true;
    if (node !== null && typeof node === "object") seen.push(...Object.values(node));
  }
  return false;
}

const rows = [];
let index = 0;

// The oracle's own control: two harmless generations of the same project collapse to the same
// shape. If this is ever false the comparison below is measuring the generator's ids, not its
// escaping, and every row it produces is noise.
const selfCheck = [];
for (const target of [createJsonTarget(), createReactTarget(), createAngularTarget()]) {
  const left = await target.generate(projectWith("harmless"));
  const right = await target.generate(projectWith("harmless"));
  for (const [at, file] of (left.files ?? []).entries()) {
    selfCheck.push({ target: target.id, path: file.path, stable: file.content === (right.files ?? [])[at]?.content });
  }
}

for (const [name, payload] of Object.entries(PAYLOADS)) {
  for (const target of [createJsonTarget(), createReactTarget(), createAngularTarget()]) {
    // The same target with a harmless project, so a file that never parsed is not read as a break.
    const benign = await target.generate(projectWith("harmless"));
    const hostile = await target.generate(projectWith(payload));

    for (const file of hostile.files ?? []) {
      const clean = (benign.files ?? []).find((each) => each.path === file.path);
      const isJson = file.path.endsWith(".json");
      index += 1;

      // Every spelling the payload can appear in — as written, and JS/JSON-escaped — collapses to
      // one placeholder, so what is compared is the shape of the file rather than its data.
      const placeholder = "\u0000PAYLOAD\u0000";
      const collapse = (content, text) =>
        content.split(text).join(placeholder).split(JSON.stringify(text).slice(1, -1)).join(placeholder);

      rows.push({
        payload: name,
        target: target.id,
        path: file.path,
        parsesClean: isJson ? null : parses(clean?.content ?? "", `clean${index}`),
        parsesHostile: isJson ? null : parses(file.content, `hostile${index}`),
        jsonReadsBack: isJson ? readsBack(file.content, payload) : null,
        identifiers: [...file.content.matchAll(/export function ([^(\s]+)/g)].map((match) => match[1]),
      });
    }
  }
}

// Every identifier any target derived, asked of the parser.
const declarable = {};
for (const row of rows) {
  for (const name of row.identifiers) {
    if (name in declarable) continue;
    const scratch = join(process.cwd(), `id-${Buffer.from(name).toString("hex").slice(0, 40)}.mjs`);
    writeFileSync(scratch, `export function ${name}() {}\n`, "utf8");
    try {
      execFileSync(process.execPath, ["--check", scratch], { stdio: "ignore" });
      declarable[name] = true;
    } catch {
      declarable[name] = false;
    }
  }
}

console.log(JSON.stringify({ selfCheck, rows, declarable }));
