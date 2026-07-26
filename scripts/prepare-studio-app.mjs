/** Builds Studio and copies its browser assets into the Astro public tree. */
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

execFileSync(npmCommand, ["run", "build:studio"], { cwd: root, stdio: "inherit" });
execFileSync(process.execPath, [join(root, "scripts/copy-studio-app.mjs")], {
  cwd: root,
  stdio: "inherit",
});
