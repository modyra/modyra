import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const packages = [
  { name: "@modyra/core", dir: "packages/core" },
  { name: "@modyra/widgets", dir: "packages/widgets" },
  { name: "@modyra/zod", dir: "packages/zod" },
  { name: "@modyra/vue", dir: "packages/vue" },
  { name: "@modyra/react", dir: "packages/react" },
  { name: "@modyra/lit", dir: "packages/lit" },
  { name: "@modyra/styles", dir: "packages/styles" },
];

for (const pkg of packages) {
  const expectedVersion = readPackageVersion(`${pkg.dir}/package.json`);
  const publishedVersion = readPublishedVersion(pkg.name);
  if (publishedVersion === expectedVersion) {
    console.log(`Skipping ${pkg.name}@${expectedVersion} (already published)`);
    continue;
  }
  if (publishedVersion !== null) {
    throw new Error(
      `${pkg.name} published as ${publishedVersion}, expected ${expectedVersion}`,
    );
  }

  const publishArgs = ["publish"];
  if (pkg.name !== "@modyra/styles") {
    publishArgs.push("--access", "public");
  }
  if (shouldUseProvenance()) {
    publishArgs.push("--provenance");
  }
  runNpm(publishArgs, pkg.dir);
}

for (const pkg of packages) {
  const expectedVersion = readPackageVersion(`${pkg.dir}/package.json`);
  const publishedVersion = readPublishedVersion(pkg.name);
  if (publishedVersion !== expectedVersion) {
    throw new Error(
      `${pkg.name} published as ${publishedVersion ?? "missing"}, expected ${expectedVersion}`,
    );
  }
}

console.log("Workspace packages published coherently");

function readPackageVersion(packageJsonPath) {
  return JSON.parse(readFileSync(packageJsonPath, "utf8")).version;
}

function readPublishedVersion(packageName) {
  try {
    return execFileSync("npm", ["view", packageName, "version"], {
      encoding: "utf8",
    }).trim();
  } catch (error) {
    if (String(error.stderr ?? "").includes("E404")) {
      return null;
    }
    throw error;
  }
}

function runNpm(args, cwd) {
  execFileSync("npm", args, {
    cwd,
    stdio: "inherit",
  });
}

function shouldUseProvenance() {
  const value = process.env.NPM_CONFIG_PROVENANCE;
  if (value === undefined) return false;
  return value !== "false" && value !== "0";
}