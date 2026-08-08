import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const rehearsal = process.argv.includes("--dry-run");

const angularPackagePath = "packages/angular/dist/package.json";
const angularPackage = JSON.parse(readFileSync(angularPackagePath, "utf8"));
const expectedVersion = angularPackage.version;

const currentAngularVersion = await readPublishedVersion("@modyra/angular");
if (currentAngularVersion === expectedVersion) {
  console.log(`Skipping @modyra/angular@${expectedVersion} (already published)`);
} else {
  // Staged like every other package: uploaded with its provenance, made public by a maintainer.
  const publishArgs = rehearsal
    ? ["publish", "--dry-run", "--access", "public"]
    : ["stage", "publish", "--access", "public"];
  if (shouldUseProvenance()) {
    publishArgs.push("--provenance");
  }

  await publishAngular(publishArgs, expectedVersion);
}

// Every workspace package carries its own version, so the invariant is per package:
// each one reaches the version its manifest declares. publish-workspace.mjs asserts that
// for the packages it owns; this script owns @modyra/angular, whose version lives in the
// ng-packagr output rather than in a source manifest.
if (!rehearsal && currentAngularVersion !== expectedVersion) {
  // Listing needs its own credential; where it is unavailable, the staged publish's exit code above
  // is the evidence.
  try {
    const staged = execFileSync("npm", ["stage", "list", "--json"], { encoding: "utf8" });
    if (!staged.includes(`"${expectedVersion}"`)) {
      throw new Error(`@modyra/angular@${expectedVersion} is not in the staging area`);
    }
  } catch (error) {
    if (String(error.message ?? "").includes("is not in the staging area")) throw error;
    console.log("Staging area not readable from here — relying on the exit code of the staged publish");
  }
}

console.log(
  `Angular ${rehearsal ? "rehearsed" : "staged"} at ${expectedVersion}`,
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
