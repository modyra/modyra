import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const stageMode = process.argv.includes("--stage");

const angularPackagePath = "packages/angular/dist/package.json";
const angularPackage = JSON.parse(readFileSync(angularPackagePath, "utf8"));
const expectedVersion = angularPackage.version;

const currentAngularVersion = await readPublishedVersion("@modyra/angular");
if (currentAngularVersion === expectedVersion) {
  console.log(`Skipping @modyra/angular@${expectedVersion} (already published)`);
} else {
  const publishArgs = stageMode
    ? ["stage", "publish", "--access", "public"]
    : ["publish", "--access", "public"];
  if (shouldUseProvenance()) {
    publishArgs.push("--provenance");
  }

  await publishAngular(publishArgs, expectedVersion);
}

const packages = [
  "@modyra/core",
  "@modyra/widgets",
  "@modyra/zod",
  "@modyra/standard-schema",
  "@modyra/vue",
  "@modyra/react",
  "@modyra/lit",
  "@modyra/styles",
  "@modyra/angular",
];

if (!stageMode) {
  for (const packageName of packages) {
    const publishedVersion = await waitForPublishedVersion(packageName, expectedVersion);
    if (publishedVersion !== expectedVersion) {
      throw new Error(
        `${packageName} published as ${publishedVersion}, expected ${expectedVersion}`,
      );
    }
  }
}

console.log(
  `Angular ${stageMode ? "staged" : "published"} and all packages resolve to ${expectedVersion}`,
);

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

async function publishAngular(args, expectedVersion) {
  try {
    execFileSync("npm", args, {
      cwd: "packages/angular/dist",
      stdio: "inherit",
    });
  } catch (error) {
    const message = String(error.stderr ?? error.message ?? "");
    if (message.includes("You cannot publish over the previously published versions")) {
      const publishedVersion = await waitForPublishedVersion("@modyra/angular", expectedVersion);
      if (publishedVersion === expectedVersion) {
        console.log(`Skipping @modyra/angular@${expectedVersion} (already published during retry)`);
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