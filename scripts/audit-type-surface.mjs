#!/usr/bin/env node
/**
 * The exported type surface of the 1.0 packages, snapshotted so a change to it is a diff.
 *
 *   node scripts/audit-type-surface.mjs           # compare against the baseline
 *   node scripts/audit-type-surface.mjs --write   # accept the current surface
 *
 * `contract-diff` snapshots the widget *catalogue* — parts, relations, states, capabilities. It has
 * never seen a TypeScript type, so every public interface in `@modyra/core` and `@modyra/widgets`
 * has been outside classification: adding a required field to one, or removing a member, reported
 * `patch` because the differ had nothing to compare. That is finding **K**, and it has been hit four
 * times: a projection's shape, an added root export, a form-contract field, and a reactivity field
 * that four adapters implement.
 *
 * This reads the *generated* declarations rather than the source, because what a consumer sees is
 * what was emitted — a type that is internal in the source and exported in `dist` is exactly the
 * kind of thing nobody notices until it cannot be changed.
 *
 * What it records per exported interface or type alias is its member names, sorted, and whether each
 * is optional. Not the member *types*: a widening from `string` to `string | number` is a real
 * change this cannot see, and pretending otherwise would be worse than saying so.
 */
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, resolve, relative } from "node:path";
import ts from "typescript";

const ROOT = resolve(new URL("..", import.meta.url).pathname);
const BASELINE = resolve(ROOT, "packages/widgets/contract-baseline/type-surface.json");
/**
 * Every emitted declaration, not the entry points.
 *
 * Reading `index.d.ts` alone captured 38 shapes and missed `MdyFormError` entirely — it is declared
 * in `types.d.ts` and only *re-exported* from the entry, so nothing was there to read. A check that
 * covers a fraction of what it claims is worse than none, because the number it prints looks like
 * coverage.
 */
const PACKAGE_DIRS = ["packages/core/dist", "packages/widgets/dist"];

function declarationFiles(dir) {
  const out = [];
  const walk = (current) => {
    for (const entry of readdirSync(current)) {
      const full = join(current, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (full.endsWith(".d.ts")) out.push(full);
    }
  };
  walk(dir);
  return out;
}

const ENTRIES = PACKAGE_DIRS.flatMap((dir) => {
  const full = resolve(ROOT, dir);
  if (!existsSync(full)) {
    console.error(`Missing ${dir} — build the packages first.`);
    process.exit(2);
  }
  return declarationFiles(full).map((file) => relative(ROOT, file));
});

/** Every member a consumer can read off a type, with whether they may omit it. */
function membersOf(node) {
  const members = [];
  for (const member of node.members ?? []) {
    const name = member.name && ts.isIdentifier(member.name)
      ? member.name.text
      : member.name?.getText?.();
    if (!name) continue;
    members.push(`${name}${member.questionToken ? "?" : ""}`);
  }
  return members.sort();
}

/**
 * The literal members of a union alias, sorted. A union that is not made of literals — a union of
 * object types, or an alias of another type entirely — records `["(opaque)"]`: enough for the alias
 * being withdrawn to fail, and no claim about what is inside it.
 */
function unionMembersOf(type) {
  // A union narrowed to one member stops being a union node. Recording it as a single literal keeps
  // the last step of a narrowing readable as what it is, rather than as the alias going opaque.
  if (ts.isLiteralTypeNode(type)) return [type.literal.getText?.() ?? String(type.literal.text)];
  if (!ts.isUnionTypeNode(type)) return ["(opaque)"];
  const members = [];
  for (const member of type.types) {
    if (!ts.isLiteralTypeNode(member)) return ["(opaque)"];
    members.push(member.literal.getText?.() ?? String(member.literal.text));
  }
  return members.sort();
}

const surface = {};
for (const entry of ENTRIES) {
  const file = resolve(ROOT, entry);
  if (!existsSync(file)) {
    console.error(`Missing ${entry} — build the packages first.`);
    process.exit(2);
  }
  const source = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
  const visit = (node) => {
    const exported = node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
    if (exported && ts.isInterfaceDeclaration(node)) {
      surface[node.name.text] = membersOf(node);
    } else if (exported && ts.isTypeAliasDeclaration(node) && ts.isTypeLiteralNode(node.type)) {
      surface[node.name.text] = membersOf(node.type);
    } else if (exported && ts.isTypeAliasDeclaration(node)) {
      // A union of literals is a public surface a consumer switches on, and withdrawing one of its
      // members — or the alias itself — is exactly as breaking as removing an interface member.
      // Reading only interfaces and type literals left every such union outside classification,
      // which is finding K's shape one level down: the audit reported a number that looked like
      // coverage. Anything that is not a union of literals is recorded as present but opaque, so
      // its disappearance is still caught while its contents make no claim.
      surface[node.name.text] = unionMembersOf(node.type);
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(source, visit);
}

const names = Object.keys(surface).sort();
const current = Object.fromEntries(names.map((name) => [name, surface[name]]));

if (process.argv.includes("--write")) {
  writeFileSync(BASELINE, `${JSON.stringify(current, null, 2)}\n`);
  console.log(`Type surface written: ${relative(ROOT, BASELINE)} — ${names.length} exported shapes.`);
  process.exit(0);
}

if (!existsSync(BASELINE)) {
  console.error(`No baseline at ${relative(ROOT, BASELINE)} — run with --write to record it.`);
  process.exit(1);
}

const baseline = JSON.parse(readFileSync(BASELINE, "utf8"));
const changes = [];

for (const name of Object.keys(baseline)) {
  if (!(name in current)) {
    changes.push(["major", `${name} is no longer exported`]);
    continue;
  }
  const was = new Set(baseline[name]);
  const now = new Set(current[name]);
  for (const member of baseline[name]) {
    if (now.has(member)) continue;
    // An optional member that became required, and a member that disappeared, are different losses.
    const base = member.replace(/\?$/, "");
    if (now.has(base)) changes.push(["major", `${name}.${base} is now required`]);
    else if (now.has(`${base}?`)) changes.push(["minor", `${name}.${base} is now optional`]);
    else changes.push(["major", `${name}.${base} was removed`]);
  }
  for (const member of current[name]) {
    if (was.has(member)) continue;
    const base = member.replace(/\?$/, "");
    if (was.has(base) || was.has(`${base}?`)) continue;
    changes.push([member.endsWith("?") ? "minor" : "major", `${name}.${base} was added${member.endsWith("?") ? " (optional)" : " (required)"}`]);
  }
}
for (const name of Object.keys(current)) {
  if (!(name in baseline)) changes.push(["minor", `${name} is newly exported`]);
}

console.log(`Exported shapes compared: ${names.length}`);
if (changes.length === 0) {
  console.log("TYPE SURFACE UNCHANGED");
  process.exit(0);
}

const major = changes.filter(([level]) => level === "major");
for (const [level, what] of changes) console.log(`  ${what}  [${level}]`);
console.log(`\nclassification: ${major.length > 0 ? "major" : "minor"}`);
console.log("TYPE SURFACE MOVED — review the classification above, then accept it with --write.");
process.exit(1);
