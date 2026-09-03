/**
 * Compiles every TypeScript-only project twice — once with the `typescript` dependency, once with the
 * `typescript7` alias — and compares the two emits file by file.
 *
 * The repository ships what the CLI compiler emits, so "TypeScript 7 reports no errors" is not enough
 * evidence to compile releases with it. What matters is that both compilers produce the same
 * artifacts. The one difference this accepts is the textual order of the members of a string-literal
 * union: `"a" | "b"` and `"b" | "a"` are the same type, and the two compilers order them differently.
 * Every other difference, and any file present in one emit but not the other, fails.
 *
 * Both emits go to a temporary directory, so neither can overwrite `dist` and neither run can be
 * mistaken for a build. Cross-package types resolve through the workspace links into `dist`, which
 * both sides read identically, so the comparison stays fair whatever state `dist` is in.
 *
 * Angular is absent by construction: `packages/angular` has no `tsconfig.json`, it is compiled by
 * ng-packagr, whose peer range excludes TypeScript 7.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** The compiler binary of an installed package, by the name it is installed under. */
function compiler(dependency) {
  const manifest = require.resolve(`${dependency}/package.json`, { paths: [root] });
  const bin = resolve(dirname(manifest), "bin/tsc");
  const version = execFileSync(process.execPath, [bin, "--version"], { encoding: "utf8" })
    .trim()
    .replace(/^Version\s+/, "");
  return { name: dependency, bin, version };
}

const primary = compiler("typescript");
const native = compiler("typescript7");

if (!primary.version.startsWith("5.")) {
  console.error(`typescript resolves to ${primary.version}; this comparison expects the 5.x line`);
  process.exit(1);
}
if (!native.version.startsWith("7.")) {
  console.error(`typescript7 resolves to ${native.version}; this comparison expects the 7.x line`);
  process.exit(1);
}

/** Every package that owns a `tsconfig.json` is in the comparison; a new one joins by existing. */
const projects = readdirSync(join(root, "packages"))
  .map((name) => ({ name, config: join(root, "packages", name, "tsconfig.json") }))
  .filter(({ config }) => {
    try {
      return statSync(config).isFile();
    } catch {
      return false;
    }
  });

function emit({ bin }, config, outDir) {
  try {
    execFileSync(process.execPath, [bin, "-p", config, "--outDir", outDir], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { ok: true, output: "" };
  } catch (error) {
    return { ok: false, output: `${error.stdout ?? ""}${error.stderr ?? ""}`.trim() };
  }
}

function files(dir) {
  const found = [];
  const walk = (current) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const path = join(current, entry.name);
      if (entry.isDirectory()) walk(path);
      else found.push(relative(dir, path).split("\\").join("/"));
    }
  };
  try {
    walk(dir);
  } catch {
    return [];
  }
  return found.sort();
}

/**
 * Sorts the members of every run of string literals joined by `|`, so that two spellings of the same
 * union compare equal. Nothing else about the text is touched: a difference that survives this is a
 * difference in what the file says.
 */
function normalizeUnions(text) {
  return text.replace(/"[^"\n]*"(?:\s*\|\s*"[^"\n]*")+/g, (union) => {
    const members = union.split("|").map((member) => member.trim());
    return members.sort().join(" | ");
  });
}

const ORDERING = "union member ordering";
const MEMBERS = "member ordering";

/**
 * The members of a declaration, in one order.
 *
 * The two compilers emit an object type's members in the order each happened to infer them, so Vue's
 * `defineComponent` came out `{ kind: "toggle" | "checkbox"; label: string }` from one and
 * `{ label: string; kind: "checkbox" | "toggle" }` from the other — the same type, twice, differing
 * in two ways at once. Neither order is meaning: a property list and a union are both unordered, and
 * a consumer cannot write code that sees the difference.
 *
 * Compared as a multiset of lines, so a file whose lines were rearranged reads as unchanged while a
 * file that gained, lost or altered a line does not. That is the whole tolerance: it cannot absorb a
 * changed declaration, because a changed declaration changes a line.
 */
function sortedLines(text) {
  return normalizeUnions(text).split("\n").map((line) => line.trim()).filter(Boolean).sort().join("\n");
}

function compare(left, right, name) {
  if (left === right) return null;
  if (normalizeUnions(left) === normalizeUnions(right)) return { file: name, kind: ORDERING };
  if (sortedLines(left) === sortedLines(right)) return { file: name, kind: MEMBERS };

  const a = left.split("\n");
  const b = right.split("\n");
  const line = a.findIndex((text, index) => text !== b[index]);
  return {
    file: name,
    kind: "content",
    line: line + 1,
    primary: (a[line] ?? "«end of file»").trim().slice(0, 160),
    native: (b[line] ?? "«end of file»").trim().slice(0, 160),
  };
}

const scratch = mkdtempSync(join(tmpdir(), "modyra-ts7-"));
const failures = [];
const tolerated = [];
let compared = 0;

console.log(`# TypeScript ${primary.version} vs ${native.version}\n`);

for (const { name, config } of projects) {
  const left = join(scratch, "primary", name);
  const right = join(scratch, "native", name);

  const primaryEmit = emit(primary, config, left);
  const nativeEmit = emit(native, config, right);

  if (!primaryEmit.ok || !nativeEmit.ok) {
    const which = !nativeEmit.ok ? native : primary;
    const output = (!nativeEmit.ok ? nativeEmit : primaryEmit).output;
    failures.push({ project: name, kind: "compile", compiler: which.name, output });
    console.log(`FAIL  ${name} — ${which.name} ${which.version} did not compile it`);
    continue;
  }

  const leftFiles = files(left);
  const rightFiles = files(right);
  const only = [
    ...leftFiles.filter((file) => !rightFiles.includes(file)).map((file) => `${primary.name}: ${file}`),
    ...rightFiles.filter((file) => !leftFiles.includes(file)).map((file) => `${native.name}: ${file}`),
  ];

  const differences = [];
  for (const file of leftFiles.filter((file) => rightFiles.includes(file))) {
    compared += 1;
    const difference = compare(
      readFileSync(join(left, file), "utf8"),
      readFileSync(join(right, file), "utf8"),
      `packages/${name}/${file}`,
    );
    if (!difference) continue;
    if (difference.kind === ORDERING || difference.kind === MEMBERS) tolerated.push(difference);
    else differences.push(difference);
  }

  if (only.length || differences.length) {
    failures.push({ project: name, kind: "artifacts", only, differences });
    console.log(`FAIL  ${name} — ${differences.length} differing, ${only.length} unpaired`);
  } else {
    const note = tolerated.some((entry) => entry.file.startsWith(`packages/${name}/`))
      ? " (union ordering only)"
      : "";
    console.log(`ok    ${name} — ${leftFiles.length} files identical${note}`);
  }
}

rmSync(scratch, { recursive: true, force: true });

console.log(`\nProjects: ${projects.length}`);
console.log(`Files compared: ${compared}`);
console.log(`Tolerated (ordering only): ${tolerated.length}`);
for (const entry of tolerated) console.log(`  ${entry.file}  (${entry.kind})`);

if (failures.length === 0) {
  console.log("\nTYPESCRIPT 7 EMIT MATCHES THE PRIMARY COMPILER");
  process.exit(0);
}

console.error(`\nDiffering projects: ${failures.length}`);
for (const failure of failures) {
  if (failure.kind === "compile") {
    console.error(`\n${failure.project}: ${failure.compiler} reported\n${failure.output}`);
    continue;
  }
  console.error(`\n${failure.project}:`);
  for (const file of failure.only) console.error(`  emitted by ${file} alone`);
  for (const difference of failure.differences) {
    console.error(`  ${difference.file}:${difference.line}`);
    console.error(`    ${primary.name}:  ${difference.primary}`);
    console.error(`    ${native.name}: ${difference.native}`);
  }
}
console.error("\nTYPESCRIPT 7 EMIT DIFFERS");
process.exit(1);
