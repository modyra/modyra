#!/usr/bin/env node
/**
 * A kind that commits live has nothing to confirm.
 *
 * `MDY_VALUE_CONTRACTS` says, per kind, when the field's value changes: `"live"` means every
 * interaction writes through, `"confirm"` means interaction edits a draft and an explicit
 * confirmation commits it. The vocabulary is applied deliberately — the timepicker confirms, the
 * pickers do not — and it is the answer to a question a renderer must not re-decide.
 *
 * Two renderers had re-decided it. A `variant: "modal"` held the value behind a Confirm button and
 * all three drew Cancel/Apply, for two kinds whose contract says `live`; the anatomy even declared
 * an `actions` part for them, so the contract contradicted itself in writing. Nothing measured it,
 * because nothing had ever asked the two halves the same question.
 *
 * So: a kind declared `live` may not declare a confirmation part, and no renderer may draw the
 * classes of one for it. The check reads both from the source of truth rather than from a list kept
 * here, so a kind that changes its commit mode moves this check with it.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const ROOT = resolve(new URL("..", import.meta.url).pathname);
const { MDY_VALUE_CONTRACTS } = await import(new URL("../packages/core/dist/index.js", import.meta.url).href);
const { MDY_WIDGET_CONTRACTS, MDY_WIDGET_KINDS } = await import(
  new URL("../packages/widgets/dist/index.js", import.meta.url).href
);

/** Parts that only mean something where a value waits for a confirmation. */
const CONFIRMATION_PARTS = ["actions", "action"];

const failures = [];
const liveKinds = [];
for (const kind of MDY_WIDGET_KINDS) {
  const commit = MDY_VALUE_CONTRACTS[kind]?.commit;
  if (commit !== "live") continue;
  liveKinds.push(kind);
  for (const part of CONFIRMATION_PARTS) {
    if (MDY_WIDGET_CONTRACTS[kind].parts[part]) {
      failures.push(`${kind}: declares the "${part}" part, but its value commits live`);
    }
  }
}

/**
 * The classes a confirmation is drawn with, taken from the kinds that legitimately confirm. A
 * renderer painting one of these inside a live kind's popup is the same defect one level down.
 */
const confirmationClasses = new Set();
for (const kind of MDY_WIDGET_KINDS) {
  if (MDY_VALUE_CONTRACTS[kind]?.commit !== "confirm") continue;
  for (const part of CONFIRMATION_PARTS) {
    for (const cls of MDY_WIDGET_CONTRACTS[kind].parts[part]?.classes ?? []) confirmationClasses.add(cls);
  }
}

const RENDERERS = ["packages/plain/src", "packages/lit/src", "packages/angular/src/lib/renderers"];
const SOURCE = /\.ts$/;
const files = [];
const walk = (dir) => {
  for (const entry of readdirSync(dir)) {
    if (entry === "dist" || entry === "node_modules") continue;
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) walk(path);
    else if (SOURCE.test(entry) && !entry.endsWith(".spec.ts")) files.push(path);
  }
};
for (const root of RENDERERS) walk(resolve(ROOT, root));

// A file draws a confirmation for a live kind when it names both. Crude on purpose: the aim is to
// notice, and a renderer that legitimately draws one for the timepicker names the timepicker.
for (const file of files) {
  const source = readFileSync(file, "utf8");
  const drawn = [...confirmationClasses].filter((cls) => source.includes(cls));
  if (drawn.length === 0) continue;
  // The kind has to be *named* — quoted, or reached through the catalogue — not merely appear
  // inside a class name. `mdy-timepicker-action-btn` contains "timepicker" and says nothing about
  // which widget the file draws; a substring match let a live kind borrow the affordance by
  // spelling it.
  const namesKind = (kind) =>
    new RegExp(`["'\`]${kind}["'\`]|MDY_WIDGET_CONTRACTS\\.${kind}\\b`).test(source);
  const confirms = MDY_WIDGET_KINDS.some(
    (kind) => MDY_VALUE_CONTRACTS[kind]?.commit === "confirm" && namesKind(kind),
  );
  if (confirms) continue;
  const live = liveKinds.filter(namesKind);
  if (live.length === 0) continue;
  failures.push(
    `${relative(ROOT, file)}: draws ${drawn.join(", ")} for ${live.join("/")}, whose value commits live`,
  );
}

console.log(`Kinds committing live: ${liveKinds.length} · confirmation classes: ${confirmationClasses.size}`);
if (failures.length > 0) {
  console.error("\nA LIVE KIND OFFERS A CONFIRMATION");
  for (const failure of failures) console.error(`- ${failure}`);
  console.error(
    "\nWhat a field commits, and when, is `MDY_VALUE_CONTRACTS`'. Either the kind confirms and says so,\n" +
      "or the affordance goes.",
  );
  process.exit(1);
}
console.log("NO LIVE KIND OFFERS A CONFIRMATION");
