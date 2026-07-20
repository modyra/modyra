import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const angularPackagePath = "packages/angular/dist/package.json";
const angularPackage = JSON.parse(readFileSync(angularPackagePath, "utf8"));
const expectedVersion = angularPackage.version;

const currentAngularVersion = readPublishedVersion("@modyra/angular");
if (currentAngularVersion === expectedVersion) {
  console.log(`Skipping @modyra/angular@${expectedVersion} (already published)`);
} else {
  if (currentAngularVersion !== null) {
    throw new Error(
      `@modyra/angular published as ${currentAngularVersion}, expected ${expectedVersion}`,
    );
  }

  const publishArgs = ["publish", "--access", "public"];
  if (shouldUseProvenance()) {
    publishArgs.push("--provenance");
  }

  runNpm(publishArgs, "packages/angular/dist");
}

const packages = [
  "@modyra/core",
  "@modyra/widgets",
  "@modyra/zod",
  "@modyra/vue",
  "@modyra/react",
  "@modyra/lit",
  "@modyra/styles",
  "@modyra/angular",
];

for (const packageName of packages) {
  const publishedVersion = execFileSync(
    "npm",
    ["view", packageName, "version"],
    { encoding: "utf8" },
  ).trim();
  if (publishedVersion !== expectedVersion) {
    throw new Error(
      `${packageName} published as ${publishedVersion}, expected ${expectedVersion}`,
    );
  }
}

console.log(`Angular published and all packages resolve to ${expectedVersion}`);

function readPublishedVersion(packageName) {
  try {
    return execFileSync("npm", ["view", packageName, "version"], {
      encoding: "utf8" },
    ).trim();
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