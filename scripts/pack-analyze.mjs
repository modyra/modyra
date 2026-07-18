/**
 * Reports the uncompressed sizes of the shipped JS/CSS/type files in the
 * packed @modyra/angular tarball. Uses `npm pack --json` instead of parsing
 * `tar tvf` output, whose column layout differs between GNU and BSD tar.
 */
import { execFileSync } from "node:child_process";
import { rmSync } from "node:fs";

const cwd = "packages/angular/dist";
const [report] = JSON.parse(
  execFileSync("npm", ["pack", "--json"], { cwd, encoding: "utf8" }),
);

const SHIPPED = /^(?:package\/)?(?:fesm2022\/.*\.mjs|styles\/.*\.css|types\/.*\.d\.ts)$/;

console.log(report.filename);
console.log("=== Uncompressed JS/CSS/TS ===");
let total = 0;
for (const file of report.files.filter((f) => SHIPPED.test(f.path))) {
  console.log(`${file.path} ${(file.size / 1024).toFixed(1)}KB`);
  total += file.size;
}
console.log(`TOTAL: ${(total / 1024).toFixed(1)}KB`);
console.log("=== Tarball size ===");
console.log(`${(report.size / 1024).toFixed(1)}KB compressed, ${(report.unpackedSize / 1024).toFixed(1)}KB unpacked`);

rmSync(`${cwd}/${report.filename}`);
