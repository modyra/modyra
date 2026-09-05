/**
 * Generates each renderer's conformance manifest from what its own conformance fixture does, and
 * with `--check` fails when a committed manifest no longer matches the renderer.
 *
 * The manifest is what a host reads instead of diffing thousands of lines of DOM between releases:
 * which kinds this renderer draws, which contract version it implements, and which features it
 * really has. Every field is measured. A field that cannot be measured from here says so and names
 * where its evidence lives — a manifest that guesses is worse than no manifest, because a host
 * cannot tell a guess from a measurement once it is written down.
 *
 * Renderers are observed one child process each; see `support/observe-renderer.mjs` for why.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { MDY_WIDGET_CONTRACT_VERSION, MDY_WIDGET_KINDS } from "../packages/widgets/dist/index.js";

const root = resolve(new URL("..", import.meta.url).pathname);
const check = process.argv.includes("--check");

/**
 * Renderers this harness can drive.
 *
 * A renderer is here when it has a Node-drivable conformance fixture. One whose suite needs its
 * framework's own test runner is absent rather than guessed at, and `notObserved` below records
 * that so its silence is not read as "no kinds".
 */
const OBSERVED = [
  { name: "plain", package: "@modyra/plain", manifest: "packages/plain/conformance-manifest.json" },
  { name: "lit", package: "@modyra/lit", manifest: "packages/lit/conformance-manifest.json" },
  { name: "vue", package: "@modyra/vue", manifest: "packages/vue/conformance-manifest.json" },
];

/** What each field means, kept beside the data so a reader of the JSON is not guessing. */
const UNMEASURED_HERE = {
  rtl: {
    supported: null,
    observedBy: null,
    evidence:
      "not measurable in this harness: RTL is a layout property and jsdom has no layout. "
      + "The evidence is the browser suite in e2e/rtl.spec.ts.",
  },
};

/**
 * What a renderer wrote to `stderr` while being observed, kept rather than let through.
 *
 * The child's `stderr` used to be inherited, so an exception thrown while drawing a kind printed
 * itself on the way past and this script went on to say `unchanged` and exit 0. That is the worst
 * shape a gate can have: it saw the defect and reported success, so the only eye left was CI —
 * `InvalidCharacterError` from a `classList` token with spaces went out that way and came back
 * twelve minutes later as a red build.
 *
 * A manifest produced while the renderer was throwing is not evidence about the renderer. So
 * anything on `stderr` is a finding, named with the renderer that produced it, and the run fails.
 */
const complaints = [];

const results = [];
for (const renderer of OBSERVED) {
  const run = spawnSync(
    process.execPath,
    [resolve(root, "scripts/support/observe-renderer.mjs"), renderer.name],
    { cwd: root, encoding: "utf8", maxBuffer: 8 * 1024 * 1024 },
  );
  if (run.status !== 0) {
    complaints.push({ renderer: renderer.name, text: (run.stderr ?? "").trim() || `exited ${run.status}` });
    continue;
  }
  const said = (run.stderr ?? "").trim();
  if (said !== "") complaints.push({ renderer: renderer.name, text: said });
  const observation = JSON.parse(run.stdout);

  const drawn = Object.entries(observation.kinds).filter(([, k]) => k.rendered).map(([kind]) => kind);
  const manifest = {
    renderer: observation.renderer,
    contractVersion: String(MDY_WIDGET_CONTRACT_VERSION),
    generatedBy: "scripts/conformance-manifest.mjs — do not edit by hand",
    supportedKinds: drawn,
    unsupportedKinds: MDY_WIDGET_KINDS.filter((kind) => !drawn.includes(kind)),
    supportedFeatures: { ...observation.features, ...UNMEASURED_HERE },
    overlayStrategy: Object.fromEntries(
      Object.entries(observation.kinds)
        .filter(([, k]) => k.overlay)
        .map(([kind, k]) => [kind, k.overlay]),
    ),
  };

  results.push({ renderer, manifest });
}

/**
 * Every published adapter this harness does not produce a manifest for, why, and the check that
 * fails when the why stops being true.
 *
 * Two different reasons, and the difference matters to anyone reading the list. Angular renders and
 * is checked — just not from here. Some adapters draw nothing at all, so there is no manifest to
 * produce: a conformance manifest reports which kinds an adapter *draws*, and they draw none.
 * Listing them with the same silence as Angular would read as "not measured yet".
 *
 * **Each reason carries a `stillTrue`, because this list rotted.** It said of React and Vue
 * "headless: renders no markup" long after both had started drawing — Vue eleven components, React
 * five — so the two adapters moving fastest were the two excused, by a sentence that argued its case
 * and was therefore read as a verification already done. A reason that merely names an absence goes
 * quiet when the absence ends; a reason that can fail says so on the next run.
 */
const notObserved = {
  "@modyra/angular": {
    reason: "renders, and is checked — but its conformance suite runs under Jest with Angular's TestBed, which this harness does not drive",
    stillTrue: () => !existsSync(resolve(root, "packages/angular/test/support/state-fixture.mjs")),
    fails: "@modyra/angular now has a state fixture in this harness's shape — drive it from here instead",
  },
  "@modyra/react": {
    reason: "draws, but has no `test/support/state-fixture.mjs` — the fixture this harness mounts a renderer through, and the same one its own conformance suite uses",
    stillTrue: () => !existsSync(resolve(root, "packages/react/test/support/state-fixture.mjs")),
    fails: "@modyra/react now has a state fixture — add it to OBSERVED in observe-renderer.mjs",
  },
  "@modyra/solid": {
    reason: "headless: renders no markup, so there are no kinds to report",
    stillTrue: () => declaresNoFieldComponent("solid"),
    fails: "@modyra/solid exports components now, so it is no longer headless",
  },
  "@modyra/preact": {
    reason: "headless: renders no markup, so there are no kinds to report",
    stillTrue: () => declaresNoFieldComponent("preact"),
    fails: "@modyra/preact exports components now, so it is no longer headless",
  },
  "@modyra/svelte": {
    reason: "headless: renders no markup, so there are no kinds to report",
    stillTrue: () => declaresNoFieldComponent("svelte"),
    fails: "@modyra/svelte exports components now, so it is no longer headless",
  },
};

/**
 * Whether a component-style adapter publishes no component that draws a field.
 *
 * **Its subject is stated because it does not generalise.** Vue, React, Solid, Preact and Svelte draw
 * by exporting components, so "declares no `Mdy…Field`" is the same sentence as "draws nothing" for
 * them. It is *not* for Lit, which draws through registered custom elements, nor for Plain, which
 * writes DOM directly — both answer "declares no component" while drawing all seventeen kinds. This
 * must never be used to excuse those two, and it is not: they are observed.
 *
 * Two earlier versions of this were wrong, and the second is why the subject is written down. The
 * first read `dist/index.d.ts` alone and called Vue, React and Lit headless — all three reach their
 * components through `export *`, so the entry names none. The second read every declaration and was
 * right about the five component-style adapters and wrong about the other two, which is the shape of
 * a check that has quietly assumed one family is every family.
 *
 * A declaration, never a mention: a name in a comment or a re-export path is not a component.
 */
function declaresNoFieldComponent(pkg) {
  const dist = resolve(root, `packages/${pkg}/dist`);
  if (!existsSync(dist)) return false;
  const declares = /(?:declare (?:const|function|class)|export declare (?:const|function|class))\s+Mdy[A-Za-z]*Field\b/;
  const walk = (at) => {
    for (const entry of readdirSync(at, { withFileTypes: true })) {
      if (entry.name === "node_modules") continue;
      const path = join(at, entry.name);
      if (entry.isDirectory()) { if (walk(path)) return true; continue; }
      if (!entry.name.endsWith(".d.ts")) continue;
      if (declares.test(readFileSync(path, "utf8").replace(/\/\*[\s\S]*?\*\//g, " "))) return true;
    }
    return false;
  };
  // Never built is not "draws nothing": answering yes would excuse a package on the strength of a
  // missing file, which is how an exemption outlives the thing it describes.
  return !walk(dist);
}

const rotted = Object.entries(notObserved).filter(([, entry]) => !entry.stillTrue());

let drift = false;

for (const { renderer, manifest } of results) {
  const path = resolve(root, renderer.manifest);
  const next = `${JSON.stringify(manifest, null, 2)}\n`;
  let current = null;
  try {
    current = readFileSync(path, "utf8");
  } catch {
    current = null;
  }

  if (check) {
    if (current !== next) {
      drift = true;
      console.error(`DRIFT ${renderer.manifest} — the renderer no longer matches its committed manifest.`);
      console.error(current === null ? "  (no manifest committed)" : diffLines(current, next));
    }
    continue;
  }

  if (current !== next) writeFileSync(path, next);
  console.log(`${current === next ? "unchanged" : "written  "} ${renderer.manifest}`);
}

/** The first few lines that differ, which is enough to see what moved. */
function diffLines(before, after) {
  const a = before.split("\n");
  const b = after.split("\n");
  const lines = [];
  for (let i = 0; i < Math.max(a.length, b.length) && lines.length < 12; i += 1) {
    if (a[i] !== b[i]) lines.push(`  - ${a[i] ?? "(end)"}\n  + ${b[i] ?? "(end)"}`);
  }
  return lines.join("\n");
}

console.log(`\ncontract version ${MDY_WIDGET_CONTRACT_VERSION} · ${results.length} renderer(s) observed`);
for (const [pkg, entry] of Object.entries(notObserved)) console.log(`  not observed: ${pkg} — ${entry.reason}`);

// An exemption whose reason has stopped being true excuses the thing it no longer describes, and it
// does so while looking like a decision somebody checked. Reported before the manifests, because a
// renderer excused by a dead reason is a renderer nothing in this run measured.
if (rotted.length > 0) {
  console.error(`\nAN EXEMPTION OUTLIVED ITS REASON — ${rotted.length}\n`);
  for (const [pkg, entry] of rotted) {
    console.error(`  ${pkg}`);
    console.error(`    written here: ${entry.reason}`);
    console.error(`    but now:      ${entry.fails}`);
  }
  console.error(
    "\n  Change the reason to the true one, or stop excusing the adapter. A reason that argues its"
    + "\n  case reads as a verification somebody did, which is why a stale one is worse than silence.",
  );
  process.exit(1);
}

// Said before the verdict, because it decides what the verdict is worth: every line below was
// produced while a manifest was being built from the renderer that printed it.
if (complaints.length > 0) {
  console.error(`\nA RENDERER COMPLAINED WHILE BEING OBSERVED — ${complaints.length}\n`);
  for (const { renderer, text } of complaints) {
    console.error(`  ${renderer}:`);
    for (const line of text.split("\n")) console.error(`    ${line}`);
  }
  console.error(
    "\n  A manifest built while the renderer was throwing describes what survived the throw, not"
    + "\n  what the renderer draws. Fix the complaint, then run this again.",
  );
  process.exit(1);
}

if (check && drift) {
  console.error("\nCONFORMANCE MANIFEST DRIFT — run `npm run docs:conformance-manifest` and commit the result.");
  process.exit(1);
}
if (check) console.log("\nCONFORMANCE MANIFESTS CURRENT");
