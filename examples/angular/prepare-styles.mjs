/**
 * The Angular builder requires asset/style paths to live inside the
 * workspace root (this directory). The theme CSS is built at the repo root
 * (packages/styles/dist), so copy it next to the app before build/serve —
 * the runtime theme switcher fetches /styles/*.css from there.
 */
import { cpSync, rmSync } from "node:fs";

const from = new URL("../../packages/styles/dist", import.meta.url);
const to = new URL("./.styles", import.meta.url);

rmSync(to, { recursive: true, force: true });
cpSync(from, to, { recursive: true });
console.log("styles copied → examples/angular/.styles");
