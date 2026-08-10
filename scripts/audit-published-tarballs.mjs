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
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const ROOT = resolve(new URL("..", import.meta.url).pathname);
/**
 * What a release publishes, in the directory `npm pack` has to run in.
 *
 * `@modyra/angular` is packed from its ng-packagr output, exactly as `scripts/publish-angular.mjs`
 * publishes it — and it is the reason this list stopped being two names. Built by a different
 * pipeline from every other package, it shipped declarations importing a path that only exists
 * inside this repository, through five releases, because the check that installs what a consumer
 * installs was never given it.
 */
const PACKAGES = [
  { name: "core", dir: "packages/core" },
  { name: "widgets", dir: "packages/widgets" },
  { name: "styles", dir: "packages/styles" },
  { name: "zod", dir: "packages/zod" },
  { name: "standard-schema", dir: "packages/standard-schema" },
  { name: "eslint-plugin", dir: "packages/eslint-plugin" },
  { name: "plain", dir: "packages/plain" },
  { name: "lit", dir: "packages/lit" },
  { name: "react", dir: "packages/react" },
  { name: "vue", dir: "packages/vue" },
  { name: "solid", dir: "packages/solid" },
  { name: "preact", dir: "packages/preact" },
  { name: "svelte", dir: "packages/svelte" },
  { name: "angular", dir: "packages/angular/dist" },
];

/**
 * The list is authoritative for order; the workspace is authoritative for membership.
 *
 * A hand-written list silently stops covering what is published the moment a package is added, and
 * this check would go on passing over the packages it still knows — which is how it came to cover
 * two of thirteen.
 */
function assertListCoversEveryPublishablePackage() {
  const publishable = readdirSync(join(ROOT, "packages"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) => {
      try {
        const manifest = JSON.parse(
          readFileSync(join(ROOT, "packages", entry.name, "package.json"), "utf8"),
        );
        // `packages/angular` is private in source and published from its build output; the list
        // carries it under that directory.
        if (manifest.private === true && entry.name !== "angular") return [];
        return [entry.name];
      } catch {
        return [];
      }
    });

  const listed = new Set(PACKAGES.map((pkg) => pkg.name));
  const missing = publishable.filter((name) => !listed.has(name));
  const stale = [...listed].filter((name) => !publishable.includes(name));
  if (missing.length > 0) fail(`published but never installed here: ${missing.join(", ")}`);
  if (stale.length > 0) fail(`listed but not published: ${stale.join(", ")}`);
}

/** What a consumer has to install alongside the tarballs. `@modyra/*` peers arrive as tarballs. */
function peerDependenciesOf(manifests) {
  const peers = {};
  for (const manifest of Object.values(manifests)) {
    for (const [name, range] of Object.entries(manifest.peerDependencies ?? {})) {
      if (!name.startsWith("@modyra/")) peers[name] = range;
    }
  }
  // A partially compiled Angular library is linked by the consumer's build, and outside a build the
  // only way to load one is to give it the compiler it says it needs. It is the harness's tool, not
  // a dependency of what we publish.
  if (peers["@angular/core"]) peers["@angular/compiler"] = peers["@angular/core"];
  return peers;
}

/**
 * The file an export condition points at, and whether reaching it means importing it.
 *
 * A stylesheet is a published entry point like any other — a consumer resolves `@modyra/styles/…`
 * and gets a path — but it is resolved by a bundler, not by `import`. Asserting the file arrived is
 * the whole of what can be checked from Node, and skipping it silently is what this audit refuses.
 */
const targetOf = (target) =>
  typeof target === "string" ? target : (target.import ?? target.default ?? target.types ?? "");
const isAsset = (target) => /\.(css|json)$/.test(targetOf(target));

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
  /** The packages this run actually packed — a missing build is reported, not carried forward. */
  const packed = [];
  assertListCoversEveryPublishablePackage();

  for (const { name, dir: relative } of PACKAGES) {
    const dir = join(ROOT, relative);
    if (!existsSync(join(dir, "package.json"))) {
      fail(`nothing to pack in ${relative} — build the packages before auditing what they publish`);
      continue;
    }
    manifests[name] = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
    const out = run("npm", ["pack", "--pack-destination", work], dir).trim().split("\n").pop();
    tarballs.push(join(work, out));
    packed.push({ name, dir: relative });
  }

  // ── A project that has never seen this repository ─────────────────────────
  //
  // No workspace field, no inherited `node_modules`, and the tarballs named by path so npm resolves
  // them as a registry install would rather than by linking the source directory.
  writeFileSync(join(consumer, "package.json"), JSON.stringify({
    name: "modyra-tarball-consumer",
    private: true,
    type: "module",
    dependencies: {
      ...Object.fromEntries(packed.map(({ name }, i) => [`@modyra/${name}`, `file:${tarballs[i]}`])),
      // Optional peers included: this consumer uses every entry point, and an entry point that
      // imports a peer at module scope needs it however the manifest marks it.
      ...peerDependenciesOf(manifests),
    },
  }, null, 2));

  run("npm", ["install", "--no-audit", "--no-fund", "--loglevel=error"], consumer);

  // ── Every entry point the manifests declare ───────────────────────────────
  const entries = [];
  for (const { name } of packed) {
    for (const [subpath, target] of Object.entries(manifests[name].exports ?? {})) {
      entries.push({ specifier: `@modyra/${name}${subpath.replace(/^\./, "")}`, target, name });
    }
  }

  const imported = entries.filter((entry) => !isAsset(entry.target));
  const assets = entries.filter((entry) => isAsset(entry.target));

  const imports = imported
    .map((entry, i) => `import * as e${i} from ${JSON.stringify(entry.specifier)};`)
    .join("\n");
  const checks = imported
    .map((entry, i) => `  { specifier: ${JSON.stringify(entry.specifier)}, module: e${i} },`)
    .join("\n");

  // `@angular/compiler` first: the linker step a real build performs has not run here.
  const angularJit = imported.some((entry) => entry.name === "angular")
    ? 'import "@angular/compiler";\n'
    : "";

  writeFileSync(join(consumer, "use-everything.mjs"), `${angularJit}${imports}

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

  let exercised = Number(/EXERCISED (\d+)/.exec(runtime)?.[1] ?? 0);
  for (const entry of assets) {
    const file = join(consumer, "node_modules", `@modyra/${entry.name}`, targetOf(entry.target));
    if (existsSync(file)) exercised += 1;
    else fail(`${entry.specifier} is exported but ${targetOf(entry.target)} is not in the tarball`);
  }
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
  const current = Object.fromEntries(packed.map(({ name }) =>
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
  const typeUses = imported
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

  // ── No declaration may name a path from inside this repository ───────────
  //
  // The type-check above fails on such a path too, as "cannot find module". This says which defect
  // it is, and reaches declarations no entry point pulls in.
  const declarations = [];
  const collect = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) collect(path);
      else if (entry.name.endsWith(".d.ts")) declarations.push(path);
    }
  };
  for (const { name } of packed) {
    const installed = join(consumer, "node_modules", "@modyra", name);
    if (existsSync(installed)) collect(installed);
  }
  for (const path of declarations) {
    const root = join(consumer, "node_modules", "@modyra");
    const specifiers = [...readFileSync(path, "utf8").matchAll(/from ["']([^"']+)["']/g)].map((m) => m[1]);
    const escaping = specifiers.filter((specifier) => {
      // A bare specifier is resolved by the installer and covered by the type-check; only a path
      // can name a location, and only one that leaves the installed package names ours.
      if (specifier.startsWith(".")) return !resolve(path, "..", specifier).startsWith(root);
      return /^(\/|[A-Za-z]:[\\/])/.test(specifier) || /^packages\//.test(specifier);
    });
    if (escaping.length > 0) {
      fail(`${path.slice(path.indexOf("node_modules"))} imports a path that exists only in this repository: ${[...new Set(escaping)].join(", ")}`);
    }
  }

  // ── The published CLI, resolved as a sibling of itself ────────────────────
  const binName = Object.keys(manifests.widgets?.bin ?? {})[0];
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
  for (const { name } of packed) {
    const count = Object.keys(manifests[name].exports ?? {}).length;
    console.log(`  @modyra/${name}:`.padEnd(28) + count);
  }
} finally {
  rmSync(work, { recursive: true, force: true });
}

if (failures.length > 0) {
  console.error(`\nPUBLISHED TARBALLS: ${failures.length} problem(s)\n`);
  for (const problem of failures) console.error(`- ${problem}\n`);
  process.exit(1);
}
console.log("\nPUBLISHED TARBALLS CLEAN — a clean consumer can import, type-check and run what we ship.");
