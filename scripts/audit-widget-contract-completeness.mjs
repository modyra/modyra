import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
const root = resolve(new URL("..", import.meta.url).pathname);
const matrix = JSON.parse(readFileSync(resolve(root, "packages/widgets/contract-baseline/widget-completeness.json"), "utf8"));
/**
 * The definitions, wherever they live.
 *
 * They were in `catalog.ts` with the builder and four side tables; the file is a barrel now and the
 * data is in `catalog/contracts.ts`. Reading both means this check follows a move instead of
 * reporting one as seventeen missing definitions.
 */
const catalog = ["packages/widgets/src/catalog.ts", "packages/widgets/src/catalog/contracts.ts", "packages/widgets/src/catalog/define.ts"]
  .map((path) => { try { return readFileSync(resolve(root, path), "utf8"); } catch { return ""; } })
  .join("\n");
const controller = readFileSync(resolve(root, "packages/widgets/src/catalog-controller.ts"), "utf8");
const failures = [];
for (const [kind, evidence] of Object.entries(matrix.widgets)) {
  if (!catalog.includes(`${kind}: define("${kind}"`)) failures.push(`${kind}: definition export missing`);
  if (!catalog.replace(/\s/g, "").includes(JSON.stringify(evidence.parts))) failures.push(`${kind}: evidence parts differ from catalog anatomy`);
  if (!controller.includes(`export function ${evidence.controllerExport}`)) failures.push(`${kind}: controller export missing`);
  for (const key of ["angularRenderer", "controllerTest", "contractTest"]) if (!existsSync(resolve(root, evidence[key]))) failures.push(`${kind}: missing ${key} ${evidence[key]}`);
  const angular = readFileSync(resolve(root, evidence.angularRenderer), "utf8");
  if (!angular.includes(`MDY_WIDGET_CONTRACTS.${kind}`) && !(["email","password"].includes(kind) && angular.includes("MDY_WIDGET_CONTRACTS.text"))) failures.push(`${kind}: Angular definition not consumed`);
  if (!angular.includes(evidence.angularRootBinding)) failures.push(`${kind}: Angular root classes are not contract-bound`);
}
if (failures.length) { console.error(failures.join("\n")); process.exit(1); }
console.log(`Evidence verified: ${Object.keys(matrix.widgets).length} definitions, runtime controllers, anatomies, tests and Angular root consumers.`);
