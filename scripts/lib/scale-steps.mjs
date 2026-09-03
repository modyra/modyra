/**
 * The scale's step names, read from the sheet that declares them.
 *
 * A consumer builds a theme by **setting** these, which is the opposite of reading them: nothing in
 * this repository has to consume `--mdy-space-7` for it to be surface, because the consumer is the
 * one who writes it. Two tools need that fact and used to hold it separately — the release differ
 * treats a step's disappearance as breaking, while the documentation audit, asking only who *reads*
 * a property, filed the same names under "no reader here". Both readings were right about what they
 * measured and the pair was silent about the disagreement, which is how seven settable properties
 * came within a commit of being deleted as dead.
 *
 * So the declaration lives here and both read it. The names come from the sheet rather than a list,
 * so a step added or renamed is covered the day it lands.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SHEET = join(ROOT, "packages/styles/src/modyra-scale.css");

/**
 * Every custom property `modyra-scale.css` declares, sorted.
 *
 * Declarations only: a `var(--mdy-…)` reading a step is a use, not a definition, and counting it
 * would make the answer depend on which rules happen to consume which step.
 */
export function scaleStepNames() {
  const sheet = readFileSync(SHEET, "utf8");
  return [...new Set([...sheet.matchAll(/^\s*(--mdy-[a-z0-9-]+)\s*:/gm)].map((m) => m[1]))].sort();
}
