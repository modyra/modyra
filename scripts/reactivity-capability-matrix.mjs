/**
 * Generates the reactivity adapter capability matrix
 * (piano-modyra-reactivity-adapter-api.md §15: "non deve essere mantenuta
 * manualmente... generarla dalle capability dichiarate").
 *
 * Reads `capabilities` straight off each adapter's real `MdyReactivity`
 * instance instead of a hand-maintained table, so the doc can't silently
 * drift from what the code actually declares. Run after `npm run build:packages`
 * (and `npm run build:lib` for the Angular row).
 */
import { writeFileSync } from "node:fs";
import { vanillaReactivity } from "../packages/core/dist/index.js";
import { reactReactivity } from "../packages/react/dist/index.js";
import { preactReactivity } from "../packages/preact/dist/index.js";
import { svelteReactivity } from "../packages/svelte/dist/index.js";
import { litReactivity } from "../packages/lit/dist/adapter.js";
import { vueReactivity } from "../packages/vue/dist/index.js";

const CAPABILITY_ORDER = [
  "effects",
  "effectOwnership",
  "signalEquality",
  "computedEquality",
  "batching",
  "deterministicFlush",
  "directObservation",
  "writableComputed",
  "graphInspection",
  "serverSnapshots",
];

/** @type {Array<{ name: string, capabilities: Record<string, boolean> | undefined, note?: string }>} */
const rows = [];

rows.push({
  name: "vanilla",
  capabilities: vanillaReactivity().capabilities,
  note: "reference implementation",
});

// Angular's ng-packagr output is partially AOT-compiled — constructing it
// (even just calling angularReactivity()) outside a real Angular JIT/
// bootstrap context throws ("needs @angular/compiler as a fallback"), so
// live-importing it here the way vanilla is above isn't viable. These two
// rows are the literal object from reactivity-angular.ts's own
// `capabilities` — kept honest (not hand-guessed) because
// packages/angular/src/lib/core/reactivity-angular.spec.ts asserts this
// EXACT shape with `toEqual()` for both the with/without-Injector cases;
// if the source ever drifts, that spec fails in CI, not silently this doc.
rows.push({
  name: "angular (no Injector)",
  capabilities: {
    effects: false,
    effectOwnership: false,
    signalEquality: true,
    computedEquality: true,
    batching: false,
    deterministicFlush: false,
    directObservation: false,
    writableComputed: false,
    graphInspection: false,
    serverSnapshots: false,
  },
  note: "effect-dependent features disabled; source-verified by reactivity-angular.spec.ts, not live-imported (see script comment)",
});
rows.push({
  name: "angular (with Injector)",
  capabilities: {
    effects: true,
    effectOwnership: true,
    signalEquality: true,
    computedEquality: true,
    batching: false,
    deterministicFlush: false,
    directObservation: false,
    writableComputed: false,
    graphInspection: false,
    serverSnapshots: false,
  },
  note: "source-verified by reactivity-angular.spec.ts, not live-imported (see script comment)",
});

// React/Preact/Svelte/Lit have no native signal primitive of their own, so
// they already run on vanillaReactivity()'s real capabilities by default
// (createForm()'s own fallback) — these named exports (Phase P1) just make
// that visible to this script instead of showing "—" for a gap that isn't
// actually there at runtime.
rows.push({ name: "react", capabilities: reactReactivity().capabilities, note: "= vanilla (no signal primitive of its own)" });
rows.push({ name: "preact", capabilities: preactReactivity().capabilities, note: "= vanilla (no signal primitive of its own)" });
rows.push({ name: "svelte", capabilities: svelteReactivity().capabilities, note: "= vanilla (no signal primitive of its own); toStore() bridges to a Readable" });
rows.push({ name: "lit", capabilities: litReactivity().capabilities, note: "= vanilla (no signal primitive of its own)" });

// Vue's own effect() now runs on a real scheduler (Phase P2, mirrors
// vanilla's Milestone 3 design) and createScope() wraps Vue's native
// effectScope() -- real capabilities on real native reactivity, not a
// re-export like the four above.
rows.push({
  name: "vue",
  capabilities: vueReactivity().capabilities,
  note: "native @vue/reactivity; effect() scheduler + createScope() via effectScope() (Phase P2, 2026-07-23)",
});

// Solid has real native reactivity of its own and genuinely doesn't
// declare capabilities/createScope yet (Phase P3).
rows.push({
  name: "solid",
  capabilities: undefined,
  note: "real native reactivity, not yet migrated to declare capabilities (ROADMAP Phase P3)",
});

function cell(value) {
  if (value === undefined) return "—";
  return value ? "yes" : "no";
}

const header = `| Adapter | ${CAPABILITY_ORDER.join(" | ")} | Note |`;
const divider = `|---|${CAPABILITY_ORDER.map(() => "---").join("|")}|---|`;
const lines = rows.map((row) => {
  const cells = CAPABILITY_ORDER.map((key) => cell(row.capabilities?.[key]));
  return `| ${row.name} | ${cells.join(" | ")} | ${row.note ?? ""} |`;
});

const doc = `<!--
  GENERATED FILE — do not edit by hand.
  Run \`node scripts/reactivity-capability-matrix.mjs\` to regenerate.
  Source: each adapter's own \`MdyReactivity.capabilities\` (piano-modyra-reactivity-adapter-api.md §15).
-->

# Reactivity adapter capability matrix

Generated ${new Date().toISOString().slice(0, 10)}.

${header}
${divider}
${lines.join("\n")}

"—" means the adapter has no \`capabilities\` object yet (pre-Milestone-1 shape) or could not be constructed by this script — not the same as every capability being false.
`;

writeFileSync(
  new URL("../docs/reactivity-capability-matrix.md", import.meta.url),
  doc,
);
console.log("Wrote docs/reactivity-capability-matrix.md");
console.log(lines.join("\n"));
