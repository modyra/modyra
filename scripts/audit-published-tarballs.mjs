#!/usr/bin/env node
/**
 * What we publish, installed the way a consumer installs it.
 *
 * Every other check in this repository runs against source, or against `dist` reached by a workspace
 * path. Neither applies the resolution rules a real installer does, and the two things that break in
 * that gap — exports maps and generated declarations — fail at the consumer rather than here.
 *
 * So this packs the tarballs, installs them into a project that has never seen this repository, and
 * uses every entry point the manifests declare.
 *
 *   node scripts/audit-published-tarballs.mjs
 *
 * ## Why it counts what it exercised
 *
 * A packaging check that passes because it silently skipped is the easy failure here: a glob that
 * matches nothing, a swallowed resolution error, a type-check over zero files. So the number of
 * entry points reached is asserted against the number the manifests declare, and a mismatch fails
 * even when nothing else did.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const ROOT = resolve(new URL("..", import.meta.url).pathname);
const PACKAGES = ["core", "widgets"];

const run = (command, args, cwd, quiet = true) =>
  execFileSync(command, args, { cwd, encoding: "utf8", stdio: quiet ? "pipe" : "inherit" });

const failures = [];
const fail = (what) => failures.push(what);

const work = mkdtempSync(join(tmpdir(), "modyra-tarball-"));
const consumer = join(work, "consumer");
mkdirSync(consumer, { recursive: true });

try {
  // ── Pack, exactly as a release would ──────────────────────────────────────
  const tarballs = [];
  const manifests = {};
  for (const name of PACKAGES) {
    const dir = join(ROOT, "packages", name);
    manifests[name] = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
    const out = run("npm", ["pack", "--pack-destination", work], dir).trim().split("\n").pop();
    tarballs.push(join(work, out));
  }

  // ── A project that has never seen this repository ─────────────────────────
  //
  // No workspace field, no inherited `node_modules`, and the tarballs named by path so npm resolves
  // them as a registry install would rather than by linking the source directory.
  writeFileSync(join(consumer, "package.json"), JSON.stringify({
    name: "modyra-tarball-consumer",
    private: true,
    type: "module",
    dependencies: Object.fromEntries(PACKAGES.map((name, i) => [`@modyra/${name}`, `file:${tarballs[i]}`])),
  }, null, 2));

  run("npm", ["install", "--no-audit", "--no-fund", "--loglevel=error"], consumer);

  // ── Every entry point the manifests declare ───────────────────────────────
  const entries = [];
  for (const name of PACKAGES) {
    for (const [subpath, target] of Object.entries(manifests[name].exports ?? {})) {
      entries.push({ specifier: `@modyra/${name}${subpath.replace(/^\./, "")}`, target, name });
    }
  }

  const imports = entries
    .map((entry, i) => `import * as e${i} from ${JSON.stringify(entry.specifier)};`)
    .join("\n");
  const checks = entries
    .map((entry, i) => `  { specifier: ${JSON.stringify(entry.specifier)}, module: e${i} },`)
    .join("\n");

  writeFileSync(join(consumer, "use-everything.mjs"), `${imports}

const used = [
${checks}
];

for (const { specifier, module } of used) {
  if (module === undefined || module === null) {
    console.log(\`RESOLVED_EMPTY \${specifier}\`);
  }
}
console.log(\`EXERCISED \${used.length}\`);
`);

  let runtime;
  try {
    runtime = run("node", ["use-everything.mjs"], consumer);
  } catch (error) {
    fail(`the consumer could not import every entry point:\n${String(error.stderr || error.message).trim()}`);
    runtime = "";
  }

  const exercised = Number(/EXERCISED (\d+)/.exec(runtime)?.[1] ?? 0);
  if (exercised !== entries.length) {
    fail(`exercised ${exercised} entry points, the manifests declare ${entries.length}`);
  }

  // ── The surface itself, against what was published before ────────────────
  //
  // Counting what this run exercised catches a silent skip *within* a run and nothing else: delete
  // an entry from a manifest and both sides shrink together, so the audit reports success on a
  // package that just withdrew something a consumer imports. Measured — that is exactly what it did.
  //
  // The baseline is the missing half. An entry point is public surface, and public surface outside
  // the widget catalogue is precisely what `contract-diff` cannot see.
  const baselinePath = join(ROOT, "packages/widgets/contract-baseline/entry-points.json");
  const current = Object.fromEntries(PACKAGES.map((name) =>
    [`@modyra/${name}`, Object.keys(manifests[name].exports ?? {}).sort()]));

  if (process.argv.includes("--write")) {
    writeFileSync(baselinePath, `${JSON.stringify(current, null, 2)}\n`);
    console.log(`Entry-point baseline written: ${baselinePath}`);
  } else if (!existsSync(baselinePath)) {
    fail(`no entry-point baseline at ${baselinePath} — run with --write to record the current surface`);
  } else {
    const baseline = JSON.parse(readFileSync(baselinePath, "utf8"));
    for (const [pkg, was] of Object.entries(baseline)) {
      const now = current[pkg] ?? [];
      for (const gone of was.filter((entry) => !now.includes(entry))) {
        fail(`${pkg} no longer exports "${gone}" — withdrawing an entry point is a major change`);
      }
      for (const added of now.filter((entry) => !was.includes(entry))) {
        console.log(`  + ${pkg} exports "${added}" (new since the baseline; accept with --write)`);
      }
    }
    for (const pkg of Object.keys(current).filter((name) => !(name in baseline))) {
      console.log(`  + ${pkg} is new since the baseline (accept with --write)`);
    }
  }
  for (const line of runtime.split("\n").filter((l) => l.startsWith("RESOLVED_EMPTY"))) {
    fail(line);
  }

  // ── The declarations, compiled the way a consumer compiles them ───────────
  //
  // `--strict`, because a `.d.ts` that only holds under this repository's own settings is the defect
  // this step exists to find.
  const typeUses = entries
    .map((entry, i) => `import * as t${i} from ${JSON.stringify(entry.specifier)};\nvoid t${i};`)
    .join("\n");
  writeFileSync(join(consumer, "types.ts"), `${typeUses}\n`);
  writeFileSync(join(consumer, "tsconfig.json"), JSON.stringify({
    compilerOptions: {
      strict: true, noEmit: true, module: "esnext", target: "es2022",
      moduleResolution: "bundler", skipLibCheck: false, types: [],
    },
    files: ["types.ts"],
  }, null, 2));

  // TypeScript installed into the consumer, the way a consumer has it, rather than borrowed from the
  // workspace — a compiler resolved through this repository would bring this repository's settings
  // with it, which is exactly what this check is trying not to do.
  const tsVersion = readFileSync(join(ROOT, "package.json"), "utf8").match(/"typescript":\s*"[~^]?([\d.]+)"/)?.[1] ?? "5.9.3";
  run("npm", ["install", "--no-audit", "--no-fund", "--loglevel=error", "--save-dev", `typescript@${tsVersion}`], consumer);

  try {
    run(join(consumer, "node_modules", ".bin", "tsc"), ["-p", "tsconfig.json"], consumer);
  } catch (error) {
    const output = String(error.stdout || error.stderr || "").trim();
    fail(`the shipped declarations do not type-check in a clean consumer:\n${output.split("\n").slice(0, 12).join("\n")}`);
  }

  // ── The published CLI, resolved as a sibling of itself ────────────────────
  const binName = Object.keys(manifests.widgets.bin ?? {})[0];
  if (!binName) {
    fail("@modyra/widgets no longer declares a bin — the conformance kit is what it is for");
  } else {
    const binPath = join(consumer, "node_modules", ".bin", binName);
    if (!existsSync(binPath)) {
      fail(`${binName} was not installed into the consumer's .bin`);
    } else {
      try {
        run("node", [binPath], consumer);
        fail(`${binName} exited 0 with no config — it should refuse and say how to call it`);
      } catch (error) {
        const said = String(error.stdout || error.stderr || "");
        if (!/usage:/i.test(said)) {
          fail(`${binName} failed without saying how to call it: ${said.trim().split("\n")[0]}`);
        }
      }
    }
  }

  console.log(`\nEntry points exercised: ${exercised} of ${entries.length}`);
  console.log(`  @modyra/core:    ${Object.keys(manifests.core.exports ?? {}).length}`);
  console.log(`  @modyra/widgets: ${Object.keys(manifests.widgets.exports ?? {}).length}`);
} finally {
  rmSync(work, { recursive: true, force: true });
}

if (failures.length > 0) {
  console.error(`\nPUBLISHED TARBALLS: ${failures.length} problem(s)\n`);
  for (const problem of failures) console.error(`- ${problem}\n`);
  process.exit(1);
}
console.log("\nPUBLISHED TARBALLS CLEAN — a clean consumer can import, type-check and run what we ship.");
