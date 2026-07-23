import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const stageMode = process.argv.includes("--stage");

const packages = [
  { name: "@modyra/core", dir: "packages/core" },
  { name: "@modyra/widgets", dir: "packages/widgets" },
  { name: "@modyra/zod", dir: "packages/zod" },
  { name: "@modyra/standard-schema", dir: "packages/standard-schema" },
  { name: "@modyra/vue", dir: "packages/vue" },
  { name: "@modyra/react", dir: "packages/react" },
  { name: "@modyra/lit", dir: "packages/lit" },
  { name: "@modyra/styles", dir: "packages/styles" },
  // Added 2026-07-23: this list predated these three adapters, so the
  // v0.4.0 release bumped their package.json (fixed changesets group)
  // without ever actually publishing them — found via `npm view
  // @modyra/solid version` returning 404 after the release ran clean.
  { name: "@modyra/solid", dir: "packages/solid" },
  { name: "@modyra/preact", dir: "packages/preact" },
  { name: "@modyra/svelte", dir: "packages/svelte" },
];

for (const pkg of packages) {
  const expectedVersion = readPackageVersion(`${pkg.dir}/package.json`);
  const publishedVersion = await readPublishedVersion(pkg.name);
  if (publishedVersion === expectedVersion) {
    console.log(`Skipping ${pkg.name}@${expectedVersion} (already published)`);
    continue;
  }

  const publishArgs = stageMode ? ["stage", "publish"] : ["publish"];
  if (pkg.name !== "@modyra/styles") {
    publishArgs.push("--access", "public");
  }
  if (shouldUseProvenance()) {
    publishArgs.push("--provenance");
  }
  await publishPackage(pkg.name, pkg.dir, publishArgs, expectedVersion);
}

if (!stageMode) {
  for (const pkg of packages) {
    const expectedVersion = readPackageVersion(`${pkg.dir}/package.json`);
    const publishedVersion = await waitForPublishedVersion(pkg.name, expectedVersion);
    if (publishedVersion !== expectedVersion) {
      throw new Error(
        `${pkg.name} published as ${publishedVersion ?? "missing"}, expected ${expectedVersion}`,
      );
    }
  }
}

console.log(
  `Workspace packages ${stageMode ? "staged" : "published"} coherently`,
);

function readPackageVersion(packageJsonPath) {
  return JSON.parse(readFileSync(packageJsonPath, "utf8")).version;
}

async function readPublishedVersion(packageName) {
  const response = await fetch(
    `https://registry.npmjs.org/${encodeURIComponent(packageName)}`,
  );
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`Failed to read ${packageName} from npm: ${response.status}`);
  }
  const metadata = await response.json();
  return metadata["dist-tags"]?.latest ?? null;
}

async function waitForPublishedVersion(packageName, expectedVersion) {
  const maxAttempts = 12;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const publishedVersion = await readPublishedVersion(packageName);
    if (publishedVersion === expectedVersion) {
      return publishedVersion;
    }
    if (publishedVersion !== null) {
      return publishedVersion;
    }
    if (attempt < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
  return null;
}

async function publishPackage(packageName, cwd, args, expectedVersion) {
  try {
    execFileSync("npm", args, {
      cwd,
      stdio: "inherit",
    });
  } catch (error) {
    const message = String(error.stderr ?? error.message ?? "");
    if (message.includes("You cannot publish over the previously published versions")) {
      const publishedVersion = await waitForPublishedVersion(packageName, expectedVersion);
      if (publishedVersion === expectedVersion) {
        console.log(`Skipping ${packageName}@${expectedVersion} (already published during retry)`);
        return;
      }
    }
    throw error;
  }
}

function shouldUseProvenance() {
  const value = process.env.NPM_CONFIG_PROVENANCE;
  if (value === undefined) return false;
  return value !== "false" && value !== "0";
}