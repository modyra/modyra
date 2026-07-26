/** Collects TypeScript library and package declarations for browser-side type checking. */
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const dir = fileURLToPath(new URL(".", import.meta.url));
const repoRoot = join(dir, "../..");

// Computed once with `ts.createProgram(["a.ts"], { target: ES2022, lib: ["lib.es2022.d.ts"] })`
// and reading back `program.getSourceFiles()` for every "typescript/lib/" entry — the exact
// transitive closure this compilerOptions.lib combination needs, not a hand-guessed list.
const LIB_FILES = [
  "lib.es5.d.ts", "lib.es2015.d.ts", "lib.es2016.d.ts", "lib.es2017.d.ts", "lib.es2018.d.ts",
  "lib.es2019.d.ts", "lib.es2020.d.ts", "lib.es2021.d.ts", "lib.es2022.d.ts",
  "lib.es2015.core.d.ts", "lib.es2015.collection.d.ts", "lib.es2015.generator.d.ts",
  "lib.es2015.iterable.d.ts", "lib.es2015.promise.d.ts", "lib.es2015.proxy.d.ts",
  "lib.es2015.reflect.d.ts", "lib.es2015.symbol.d.ts", "lib.es2015.symbol.wellknown.d.ts",
  "lib.es2016.array.include.d.ts", "lib.es2016.intl.d.ts",
  "lib.es2017.arraybuffer.d.ts", "lib.es2017.date.d.ts", "lib.es2017.object.d.ts",
  "lib.es2017.sharedmemory.d.ts", "lib.es2017.string.d.ts", "lib.es2017.intl.d.ts",
  "lib.es2017.typedarrays.d.ts",
  "lib.es2018.asyncgenerator.d.ts", "lib.es2018.asynciterable.d.ts", "lib.es2018.intl.d.ts",
  "lib.es2018.promise.d.ts", "lib.es2018.regexp.d.ts",
  "lib.es2019.array.d.ts", "lib.es2019.object.d.ts", "lib.es2019.string.d.ts",
  "lib.es2019.symbol.d.ts", "lib.es2019.intl.d.ts",
  "lib.es2020.bigint.d.ts", "lib.es2020.date.d.ts", "lib.es2020.promise.d.ts",
  "lib.es2020.sharedmemory.d.ts", "lib.es2020.string.d.ts", "lib.es2020.symbol.wellknown.d.ts",
  "lib.es2020.intl.d.ts", "lib.es2020.number.d.ts",
  "lib.es2021.promise.d.ts", "lib.es2021.string.d.ts", "lib.es2021.weakref.d.ts",
  "lib.es2021.intl.d.ts",
  "lib.es2022.array.d.ts", "lib.es2022.error.d.ts", "lib.es2022.intl.d.ts",
  "lib.es2022.object.d.ts", "lib.es2022.string.d.ts", "lib.es2022.regexp.d.ts",
  "lib.decorators.d.ts", "lib.decorators.legacy.d.ts",
];

function readDtsTree(sourceDir) {
  const out = {};
  function walk(current) {
    for (const entry of readdirSync(current)) {
      const full = join(current, entry);
      if (statSync(full).isDirectory()) { walk(full); continue; }
      if (!entry.endsWith(".d.ts")) continue;
      out[relative(sourceDir, full).split("\\").join("/")] = readFileSync(full, "utf8");
    }
  }
  walk(sourceDir);
  return out;
}

const libDir = join(repoRoot, "node_modules/typescript/lib");
const assets = {};
const pendingLibs = [...LIB_FILES];
const seenLibs = new Set();
while (pendingLibs.length > 0) {
  const name = pendingLibs.pop();
  if (!name || seenLibs.has(name)) continue;
  seenLibs.add(name);
  const content = readFileSync(join(libDir, name), "utf8");
  assets[`/lib/${name}`] = content;
  for (const match of content.matchAll(/<reference\s+lib=["']([^"']+)["']/g)) {
    pendingLibs.push(`lib.${match[1].toLowerCase()}.d.ts`);
  }
}

// Each vendored package degrades gracefully, not the whole build: if
// packages/react hasn't been built yet (build:studio alone doesn't build
// it — only build:packages does), React-target artifacts just fall back
// to syntax-only checking (typecheck-host.ts's supportsSemanticCheck()
// looks at what's actually in this map, not a fixed expectation) instead
// of failing the app build.
function vendorDts(name, sourceDir) {
  if (!existsSync(sourceDir)) {
    const message = `[generate-typecheck-assets] ${sourceDir} not built yet — cannot vendor ${name}`;
    if (process.env.CI) throw new Error(message);
    console.warn(`${message}; its targets use syntax-only checking in this local build`);
    return;
  }
  for (const [relPath, content] of Object.entries(readDtsTree(sourceDir))) {
    assets[`/vendor/${name}/${relPath}`] = content;
  }
}
vendorDts("core", join(repoRoot, "packages/core/dist"));
vendorDts("react", join(repoRoot, "packages/react/dist"));

const outFile = join(dir, ".generated/typecheck-assets.json");
mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(outFile, JSON.stringify(assets));
console.log(`[generate-typecheck-assets] wrote ${Object.keys(assets).length} files to ${relative(repoRoot, outFile)}`);
