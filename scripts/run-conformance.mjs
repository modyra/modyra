#!/usr/bin/env node
/**
 * The conformance kit, run over every configuration that exists.
 *
 * The command used to name three configurations in a string and chain angular's own script after
 * them. That is a roster: a renderer publishing a configuration tomorrow is not judged until someone
 * remembers to edit the line — and four renderers are arriving. `@modyra/vue` already proved the
 * shape of the failure from the other side: it carried a configuration nothing ran, and the gate
 * that watches for checks nobody runs could not see it, because a configuration is not a script.
 *
 * So the list is the filesystem: every `packages/*\/conformance.config.mjs` is driven, in a fixed
 * order, and a package that gains one is judged the day it lands.
 *
 * Usage:
 *   node scripts/run-conformance.mjs            # every configuration
 *   node scripts/run-conformance.mjs angular    # one package, by directory name
 */
import { spawnSync } from "node:child_process";
import { conformanceConfigs, ROOT } from "./lib/script-graph.mjs";
import { join } from "node:path";

const only = process.argv.slice(2).filter((arg) => !arg.startsWith("-"));
const configs = conformanceConfigs()
  .filter((path) => only.length === 0 || only.includes(path.split("/")[1]));

if (configs.length === 0) {
  // An empty run is not a pass. A filter that matches nothing, or a repository that has lost every
  // configuration, both arrive here — and both would otherwise exit 0 having judged nothing.
  console.error(only.length > 0
    ? `No conformance configuration for: ${only.join(", ")}`
    : "No conformance configuration found at all — nothing was judged.");
  process.exit(1);
}

const failed = [];
for (const config of configs) {
  const pkg = config.split("/")[1];
  const run = spawnSync(process.execPath,
    [join(ROOT, "packages/widgets/bin/modyra-conformance.mjs"), config],
    { cwd: ROOT, stdio: "inherit" });
  if (run.status !== 0) failed.push(pkg);
}

console.log(`\nConformance run over ${configs.length} configuration(s): `
  + `${configs.map((c) => c.split("/")[1]).join(", ")}`);
if (failed.length > 0) {
  console.error(`NOT CONFORMANT — ${failed.join(", ")}`);
  process.exit(1);
}
