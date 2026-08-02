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
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
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

const results = [];
for (const renderer of OBSERVED) {
  const stdout = execFileSync(
    process.execPath,
    [resolve(root, "scripts/support/observe-renderer.mjs"), renderer.name],
    { cwd: root, encoding: "utf8", maxBuffer: 8 * 1024 * 1024 },
  );
  const observation = JSON.parse(stdout);

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

const notObserved = {
  "@modyra/angular": "its conformance suite runs under Jest with Angular's TestBed, which this harness does not drive",
};

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
for (const [pkg, reason] of Object.entries(notObserved)) console.log(`  not observed: ${pkg} — ${reason}`);

if (check && drift) {
  console.error("\nCONFORMANCE MANIFEST DRIFT — run `npm run docs:conformance-manifest` and commit the result.");
  process.exit(1);
}
if (check) console.log("\nCONFORMANCE MANIFESTS CURRENT");
