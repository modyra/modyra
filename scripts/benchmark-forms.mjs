/**
 * What a large form costs, measured rather than guessed.
 *
 * Milestone E's first deliverable, and it lands with **no budgets at all** on purpose: the roadmap
 * is explicit that a threshold picked before a baseline exists is a number someone invented. This
 * reports; a later batch sets budgets as multiples of what it reports, with the reasoning written
 * down.
 *
 * Run against `@modyra/plain` because it is the framework-free renderer: what it costs is the
 * engine plus the DOM, with no framework scheduler in between deciding when work happens. A number
 * measured through Angular's change detection would be a number about Angular.
 *
 * ## What is trustworthy here, and what is not
 *
 * **Node counts and leak counts are exact.** They are facts about a DOM tree and do not vary between
 * runs; they are also the metrics that actually predict how a form behaves at scale.
 *
 * **Timings are indicative only.** This runs in jsdom, which has no layout, no paint and no
 * compositor, so a millisecond here is not a millisecond in a browser. They are reported with their
 * spread across runs precisely so nobody reads a single figure as a fact — the roadmap's own warning
 * is that one number from one run is an anecdote.
 *
 * **Memory, input latency and listener counts are deliberately absent.** jsdom exposes no listener
 * registry and no honest memory or latency figure, and a fabricated number is worse than a missing
 * one. Post-unmount DOM stands in for the leak question it can answer.
 *
 *   node scripts/benchmark-forms.mjs [--runs 5] [--sizes 100,500,1000] [--check]
 *
 * `--check` compares against `packages/plain/metrics/form-scale-budget.json` and exits non-zero on a
 * breach. Only the exact figures are gated there, and that file says why.
 */
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const at = args.indexOf(name);
  return at === -1 ? fallback : args[at + 1];
};
const RUNS = Number(flag("--runs", "5"));
const SIZES = String(flag("--sizes", "100,500,1000")).split(",").map(Number);
const CHECK = args.includes("--check");
const BUDGET_PATH = new URL("../packages/plain/metrics/form-scale-budget.json", import.meta.url);

/** The kinds a generated form cycles through, so the mix is not all text fields. */
const KINDS = [
  "text", "email", "number", "checkbox", "toggle", "select", "textarea",
  "radio", "segmented", "datepicker", "timepicker", "slider", "colors",
];
const NEEDS_OPTIONS = new Set(["select", "radio", "segmented", "multiselect"]);

function generateFields(count) {
  return Array.from({ length: count }, (_, index) => {
    const kind = KINDS[index % KINDS.length];
    return {
      name: `f${index}`,
      kind,
      label: `Field ${index}`,
      ...(NEEDS_OPTIONS.has(kind)
        ? { options: [{ value: "a", label: "A" }, { value: "b", label: "B" }] }
        : {}),
    };
  });
}

/** A value each generated kind accepts, so a bulk update measures the accepting path. */
function acceptedValueFor(kind) {
  switch (kind) {
    case "number": case "slider": return 7;
    case "checkbox": case "toggle": return true;
    case "select": case "radio": case "segmented": return "a";
    case "datepicker": return "2026-07-15";
    case "timepicker": return "10:30";
    case "colors": return "#336699";
    default: return "x";
  }
}

/** A fresh document per run: a leaked node from a previous run would be counted as this one's. */
function freshDom() {
  const dom = new JSDOM("<!doctype html><html><body></body></html>");
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Event = dom.window.Event;
  globalThis.KeyboardEvent = dom.window.KeyboardEvent;
  globalThis.MouseEvent = dom.window.MouseEvent;
  return dom;
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

/** Every field handle under a node, whatever shape the schema gave it. */
function allHandles(node) {
  if (!node || typeof node !== "object") return [];
  if (typeof node.set === "function") return [node];
  return Object.keys(node)
    .filter((key) => !key.startsWith("_"))
    .flatMap((key) => allHandles(node[key]));
}

/** The first field handle in a form, whatever shape the schema gave it. */
function firstHandle(form) {
  return allHandles(form)[0] ?? null;
}

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
};
const spread = (values) => Math.max(...values) - Math.min(...values);

async function measure(size, mountMdyForm) {
  const mountMs = [];
  const updateMs = [];
  let nodes = 0;
  let leakedAfterUnmount = 0;

  for (let run = 0; run < RUNS; run++) {
    freshDom();
    const host = document.createElement("div");
    document.body.append(host);
    const fields = generateFields(size);

    const t0 = performance.now();
    const mounted = mountMdyForm(host, fields, { submitLabel: null });
    await settle();
    mountMs.push(performance.now() - t0);

    // Exact, and the number that predicts behaviour at scale: how much DOM a *closed* form is.
    nodes = host.querySelectorAll("*").length;

    // Reached by walking the form rather than assuming its shape: the accessor differs between a
    // flat schema and a grouped one, and a benchmark that throws on the shape measures nothing.
    const handle = firstHandle(mounted.form);
    const t1 = performance.now();
    handle?.set("changed");
    await settle();
    updateMs.push(performance.now() - t1);

    mounted.dispose();
    host.remove();
    await settle();
    // After unmount nothing may remain — including an overlay lifted out of the form's own subtree,
    // which is exactly what a `host.innerHTML` check would miss.
    leakedAfterUnmount = document.body.querySelectorAll("*").length;
  }

  return {
    size,
    nodesPerField: +(nodes / size).toFixed(1),
    nodes,
    mountMs: +median(mountMs).toFixed(1),
    mountSpreadMs: +spread(mountMs).toFixed(1),
    updateMs: +median(updateMs).toFixed(2),
    updateSpreadMs: +spread(updateMs).toFixed(2),
    leakedAfterUnmount,
  };
}

/**
 * What an overlay costs to open, and what setting every field at once costs.
 *
 * Both are per-form rather than per-size questions, so they are measured once at the largest size:
 * an overlay that opens slower because the form around it is larger is the finding worth having.
 */
async function measureInteractions(size, mountMdyForm) {
  freshDom();
  const host = document.createElement("div");
  document.body.append(host);
  const mounted = mountMdyForm(host, generateFields(size), { submitLabel: null });
  await settle();

  // The select's popup is portalled, so it is found through `aria-controls` rather than under the
  // widget: a query inside the field's own subtree would report an overlay that opened as missing.
  const trigger = host.querySelector(".mdy-select__trigger");
  const t0 = performance.now();
  trigger?.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  await settle();
  const overlayOpenMs = performance.now() - t0;
  const popupId = trigger?.getAttribute("aria-controls");
  const overlayOpened = Boolean(popupId && document.getElementById(popupId));

  // Every field gets a value its kind will actually accept: a bulk update written with a rejected
  // value measures the rejection path, and the engine may not even schedule work for it.
  const fields = generateFields(size);
  const handles = fields.map((field) => [field, firstHandle({ f: mounted.form.f[field.name] })]);
  const t1 = performance.now();
  for (const [field, handle] of handles) handle?.set(acceptedValueFor(field.kind));
  await settle();
  const bulkUpdateMs = performance.now() - t1;

  mounted.dispose();
  host.remove();
  return { overlayOpenMs, overlayOpened, bulkUpdateMs, fieldsSet: handles.length };
}

/**
 * What a form-level validator over every field costs when one field changes.
 *
 * Measured on the engine rather than through a renderer, because `mountMdyForm` exposes no way to
 * attach one — the dynamic field list carries per-field validators only. That is a gap in the mount
 * surface, not in the engine, and it is why this figure is engine-only.
 */
async function measureCrossField(size, core) {
  const paths = Array.from({ length: size }, (_, index) => `f${index}`);
  const schema = Object.fromEntries(paths.map((name) => [name, core.field("", [])]));
  const form = core.createForm(schema, {
    validators: [core.crossField(paths, (value) => (value.f0 === "bad" ? "no" : null))],
  });
  const t0 = performance.now();
  form.f.f0.set("bad");
  await settle();
  const ms = performance.now() - t0;
  const attributed = form.f.f0.errors?.().length ?? 0;
  form.deactivate?.();
  return { ms, attributed };
}

/** Repeated mount/unmount, which is where a leak shows and a single teardown does not. */
async function measureChurn(size, mountMdyForm, cycles = 20) {
  freshDom();
  const fields = generateFields(size);
  for (let cycle = 0; cycle < cycles; cycle++) {
    const host = document.createElement("div");
    document.body.append(host);
    const mounted = mountMdyForm(host, fields, { submitLabel: null });
    await settle();
    mounted.dispose();
    host.remove();
    await settle();
  }
  return { cycles, leftInBody: document.body.querySelectorAll("*").length };
}

async function main() {
  freshDom();
  const { mountMdyForm } = await import("../packages/plain/dist/index.js");
  const core = await import("../packages/core/dist/index.js");

  const rows = [];
  for (const size of SIZES) rows.push(await measure(size, mountMdyForm));
  const churn = await measureChurn(Math.min(...SIZES), mountMdyForm);
  const largest = Math.max(...SIZES);
  const interactions = await measureInteractions(largest, mountMdyForm);
  const cross = await measureCrossField(largest, core);

  console.log(`\nForm scale — @modyra/plain, ${RUNS} runs per size, medians\n`);
  console.log("  fields   nodes  nodes/field   mount ms (spread)   update ms (spread)   left after unmount");
  for (const r of rows) {
    console.log(
      `  ${String(r.size).padStart(6)}  ${String(r.nodes).padStart(6)}  ${String(r.nodesPerField).padStart(11)}` +
      `   ${String(r.mountMs).padStart(8)} (${r.mountSpreadMs})` +
      `   ${String(r.updateMs).padStart(9)} (${r.updateSpreadMs})` +
      `   ${String(r.leakedAfterUnmount).padStart(18)}`,
    );
  }
  console.log(`\n  churn: ${churn.cycles} mount/unmount cycles of ${Math.min(...SIZES)} fields`);
  console.log(`         nodes left in <body>: ${churn.leftInBody}`);

  console.log(`\n  at ${largest} fields:`);
  console.log(`    overlay open (select):   ${interactions.overlayOpenMs.toFixed(2)} ms`
    + `  ${interactions.overlayOpened ? "" : "  ** the popup did not appear — figure is meaningless **"}`);
  console.log(`    bulk update, all fields: ${interactions.bulkUpdateMs.toFixed(1)} ms`
    + ` (${interactions.fieldsSet} fields)`);
  console.log(`    cross-field over all:    ${cross.ms.toFixed(2)} ms`
    + `  ${cross.attributed > 0 ? "(error attributed)" : "** no error attributed — figure is meaningless **"}`);
  console.log(`
  Node and leak counts are exact. Timings are jsdom, which has no layout or paint — they are
  comparable between runs of this script and mean nothing next to a browser profile. Memory, input
  latency and listener counts are omitted rather than fabricated: jsdom answers none of them.

  Cross-field is measured on the engine, not through a renderer: mountMdyForm exposes no way to
  attach a form-level validator.
`);

  const leaking = rows.some((r) => r.leakedAfterUnmount > 0) || churn.leftInBody > 0;
  if (leaking) {
    console.log("  NOTE: DOM remained after unmount. That is a leak, not a budget, and it is a defect.\n");
  }

  // Without `--check` this reports and exits 0 whatever it measures, so it stays usable as an
  // exploratory run. The gate is opt-in because the timings it prints are not gateable.
  if (!CHECK) return;

  const budget = JSON.parse(readFileSync(BUDGET_PATH, "utf8"));
  const breaches = [];
  const gate = (name, actual) => {
    const limit = budget.gated[name];
    if (actual > limit.max) breaches.push({ metric: name, actual, budget: limit.max, why: limit.why });
  };
  for (const row of rows) {
    gate("nodesPerField", row.nodesPerField);
    gate("leakedAfterUnmount", row.leakedAfterUnmount);
  }
  gate("churnLeftInBody", churn.leftInBody);

  console.log(JSON.stringify({
    status: breaches.length ? "FORM SCALE BUDGET BLOCKED" : "FORM SCALE BUDGET CLEAN",
    baselineCommit: budget.baselineCommit,
    breaches,
  }, null, 2));
  if (breaches.length) process.exitCode = 1;
}

await main();
