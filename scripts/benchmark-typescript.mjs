/**
 * Measures how long each project takes to compile with the primary TypeScript dependency and with
 * the `typescript7` alias, and writes the result as data plus a self-contained page.
 *
 * Both compilers emit to a temporary directory, so a measurement can never be mistaken for a build
 * and neither run leaves the tree in the other's state. Each project is compiled `--runs` times per
 * compiler and reported by median, because the first run of either compiler pays for a cold file
 * cache that has nothing to do with the compiler.
 *
 * A timing is only meaningful next to the machine that produced it, so the machine, the toolchain
 * versions and the commit are recorded in the output and shown on the page.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { readdirSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { arch, cpus, platform, release, tmpdir, totalmem, type as osType } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const runsArgument = process.argv.find((argument) => argument.startsWith("--runs="));
const RUNS = Number(runsArgument?.slice("--runs=".length) ?? 5);

function compiler(dependency) {
  const manifest = require.resolve(`${dependency}/package.json`, { paths: [root] });
  const bin = resolve(dirname(manifest), "bin/tsc");
  const version = execFileSync(process.execPath, [bin, "--version"], { encoding: "utf8" })
    .trim()
    .replace(/^Version\s+/, "");
  return { dependency, bin, version };
}

const primary = compiler("typescript");
const native = compiler("typescript7");

const projects = readdirSync(join(root, "packages"))
  .map((name) => ({ name, config: join(root, "packages", name, "tsconfig.json") }))
  .filter(({ config }) => {
    try {
      return statSync(config).isFile();
    } catch {
      return false;
    }
  });

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

function time({ bin }, config, outDir) {
  const started = process.hrtime.bigint();
  execFileSync(process.execPath, [bin, "-p", config, "--outDir", outDir], {
    cwd: root,
    stdio: ["ignore", "pipe", "pipe"],
  });
  return Number(process.hrtime.bigint() - started) / 1e6;
}

function commandOrNull(command, args) {
  try {
    return execFileSync(command, args, { encoding: "utf8" }).trim();
  } catch {
    return null;
  }
}

const machine = {
  cpu: cpus()[0]?.model ?? "unknown",
  cores: cpus().length,
  memoryGB: Math.round(totalmem() / 1024 ** 3),
  architecture: arch(),
  os:
    platform() === "darwin"
      ? `macOS ${commandOrNull("sw_vers", ["-productVersion"]) ?? release()}`
      : `${osType()} ${release()}`,
  kernel: release(),
  node: process.version,
  pnpm: commandOrNull("pnpm", ["--version"]),
};

const scratch = mkdtempSync(join(tmpdir(), "modyra-tsbench-"));
const measurements = [];

process.stdout.write(`Compiling ${projects.length} projects ${RUNS}× with each compiler\n\n`);

for (const { name, config } of projects) {
  const samples = { primary: [], native: [] };
  for (let run = 0; run < RUNS; run += 1) {
    samples.primary.push(time(primary, config, join(scratch, `primary-${run}`, name)));
    samples.native.push(time(native, config, join(scratch, `native-${run}`, name)));
  }

  const entry = {
    project: name,
    primary: Math.round(median(samples.primary)),
    native: Math.round(median(samples.native)),
    primaryBest: Math.round(Math.min(...samples.primary)),
    nativeBest: Math.round(Math.min(...samples.native)),
  };
  entry.speedup = Number((entry.primary / entry.native).toFixed(2));
  measurements.push(entry);
  process.stdout.write(
    `${name.padEnd(22)} ${String(entry.primary).padStart(6)} ms  →  ${String(entry.native).padStart(5)} ms   ${entry.speedup}×\n`,
  );
}

rmSync(scratch, { recursive: true, force: true });

const totals = {
  primary: measurements.reduce((sum, entry) => sum + entry.primary, 0),
  native: measurements.reduce((sum, entry) => sum + entry.native, 0),
};
totals.speedup = Number((totals.primary / totals.native).toFixed(2));

const report = {
  measuredAt: new Date().toISOString(),
  commit: commandOrNull("git", ["rev-parse", "--short", "HEAD"]),
  runs: RUNS,
  statistic: "median",
  compilers: { primary: primary.version, native: native.version },
  machine,
  totals,
  projects: measurements,
};

const outputDir = join(root, "benchmarks");
mkdirSync(outputDir, { recursive: true });
writeFileSync(join(outputDir, "typescript-compilers.json"), `${JSON.stringify(report, null, 2)}\n`);
writeFileSync(join(outputDir, "typescript-compilers.html"), page(report));

process.stdout.write(
  `\nTotal ${totals.primary} ms → ${totals.native} ms (${totals.speedup}× faster)\n` +
    `benchmarks/typescript-compilers.html written\n`,
);

// ─── Page ────────────────────────────────────────────────────────────────────
//
// Rendered as static SVG rather than drawn by a script in the browser: the page is opened straight
// from the repository, and a chart that needs JavaScript to exist cannot be diffed in review.

function escape(text) {
  return String(text).replace(/[&<>"]/g, (character) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[character],
  );
}

function comparisonChart(entries) {
  const rowHeight = 38;
  const barHeight = 13;
  const labelWidth = 168;
  const valueWidth = 92;
  const width = 900;
  const plotWidth = width - labelWidth - valueWidth;
  const height = entries.length * rowHeight + 34;
  const slowest = Math.max(...entries.map((entry) => entry.primary));
  const scale = (value) => Math.max(2, (value / slowest) * plotWidth);

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((fraction) => {
    const x = labelWidth + fraction * plotWidth;
    const value = Math.round(fraction * slowest);
    return `<line x1="${x}" y1="24" x2="${x}" y2="${height - 8}" class="grid" />
      <text x="${x}" y="16" class="tick">${value}</text>`;
  });

  const rows = entries.map((entry, index) => {
    const top = 30 + index * rowHeight;
    const primaryWidth = scale(entry.primary);
    const nativeWidth = scale(entry.native);
    return `<g class="row">
      <title>${escape(entry.project)}: TypeScript ${escape(report.compilers.primary)} ${entry.primary} ms, TypeScript ${escape(report.compilers.native)} ${entry.native} ms</title>
      <rect x="0" y="${top - 6}" width="${width}" height="${rowHeight - 2}" class="row-hit" />
      <text x="${labelWidth - 12}" y="${top + 13}" class="row-label">${escape(entry.project)}</text>
      <rect x="${labelWidth}" y="${top}" width="${primaryWidth}" height="${barHeight}" rx="4" class="bar-primary" />
      <rect x="${labelWidth}" y="${top + barHeight + 2}" width="${nativeWidth}" height="${barHeight}" rx="4" class="bar-native" />
      <text x="${labelWidth + Math.max(primaryWidth, nativeWidth) + 10}" y="${top + barHeight + 4}" class="row-value">${entry.speedup}×</text>
    </g>`;
  });

  return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Compile time per project, TypeScript ${escape(report.compilers.primary)} against ${escape(report.compilers.native)}, milliseconds, lower is better">
    ${ticks.join("\n")}
    ${rows.join("\n")}
  </svg>`;
}

function page(data) {
  const ordered = [...data.projects].sort((a, b) => b.primary - a.primary);
  const saved = data.totals.primary - data.totals.native;

  const machineRows = [
    ["Processor", `${data.machine.cpu} — ${data.machine.cores} cores`],
    ["Memory", `${data.machine.memoryGB} GB`],
    ["Architecture", data.machine.architecture],
    ["Operating system", data.machine.os],
    ["Kernel", data.machine.kernel],
    ["Node", data.machine.node],
    ["pnpm", data.machine.pnpm ?? "—"],
  ]
    .map(([label, value]) => `<tr><th scope="row">${escape(label)}</th><td>${escape(value)}</td></tr>`)
    .join("\n");

  const dataRows = ordered
    .map(
      (entry) => `<tr>
        <th scope="row">${escape(entry.project)}</th>
        <td>${entry.primary}</td>
        <td>${entry.native}</td>
        <td>${entry.speedup}×</td>
      </tr>`,
    )
    .join("\n");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>TypeScript ${escape(data.compilers.primary)} vs ${escape(data.compilers.native)} — Modyra compile times</title>
<style>
  :root {
    color-scheme: light;
    --surface: #fcfcfb;
    --surface-raised: #ffffff;
    --border: #e3e2dd;
    --text-primary: #0b0b0b;
    --text-secondary: #52514e;
    --text-muted: #6f6e6a;
    --series-primary: #2a78d6;
    --series-native: #eb6834;
    --grid: #eceae4;
  }
  @media (prefers-color-scheme: dark) {
    :root:where(:not([data-theme="light"])) {
      color-scheme: dark;
      --surface: #1a1a19;
      --surface-raised: #232322;
      --border: #35342f;
      --text-primary: #ffffff;
      --text-secondary: #c3c2b7;
      --text-muted: #97968d;
      --series-primary: #3987e5;
      --series-native: #d95926;
      --grid: #2c2b27;
    }
  }
  :root[data-theme="dark"] {
    color-scheme: dark;
    --surface: #1a1a19;
    --surface-raised: #232322;
    --border: #35342f;
    --text-primary: #ffffff;
    --text-secondary: #c3c2b7;
    --text-muted: #97968d;
    --series-primary: #3987e5;
    --series-native: #d95926;
    --grid: #2c2b27;
  }

  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 3rem 1.5rem 5rem;
    background: var(--surface);
    color: var(--text-primary);
    font: 16px/1.6 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  }
  main { max-width: 62rem; margin: 0 auto; }
  h1 { font-size: 1.9rem; line-height: 1.2; margin: 0 0 .5rem; letter-spacing: -.02em; }
  h2 { font-size: 1.15rem; margin: 3rem 0 .35rem; letter-spacing: -.01em; }
  p { color: var(--text-secondary); margin: .35rem 0 0; max-width: 46rem; }
  .lede { font-size: 1.05rem; }

  .hero { display: flex; flex-wrap: wrap; gap: 1rem; margin: 2rem 0 0; }
  .stat {
    flex: 1 1 12rem; padding: 1.1rem 1.25rem;
    background: var(--surface-raised); border: 1px solid var(--border); border-radius: 12px;
  }
  .stat .value { font-size: 2rem; font-weight: 620; letter-spacing: -.03em; display: block; }
  .stat .label { color: var(--text-muted); font-size: .82rem; text-transform: uppercase; letter-spacing: .07em; }
  .stat .note { color: var(--text-secondary); font-size: .9rem; }

  .legend { display: flex; gap: 1.25rem; margin: 1.5rem 0 .5rem; font-size: .9rem; color: var(--text-secondary); }
  .legend span { display: inline-flex; align-items: center; gap: .45rem; }
  .swatch { width: 12px; height: 12px; border-radius: 3px; display: inline-block; }
  .swatch.primary { background: var(--series-primary); }
  .swatch.native { background: var(--series-native); }

  .figure { overflow-x: auto; margin-top: .75rem; }
  svg { display: block; width: 100%; min-width: 40rem; height: auto; }
  .grid { stroke: var(--grid); stroke-width: 1; }
  .tick { fill: var(--text-muted); font-size: 11px; text-anchor: middle; }
  .row-label { fill: var(--text-secondary); font-size: 13px; text-anchor: end; }
  .row-value { fill: var(--text-muted); font-size: 12px; }
  .bar-primary { fill: var(--series-primary); }
  .bar-native { fill: var(--series-native); }
  .row-hit { fill: transparent; }
  .row:hover .row-hit { fill: color-mix(in oklab, var(--text-primary) 5%, transparent); }

  table { border-collapse: collapse; width: 100%; margin-top: .75rem; font-size: .93rem; }
  caption { text-align: left; color: var(--text-muted); font-size: .85rem; padding-bottom: .5rem; }
  th, td { text-align: left; padding: .5rem .75rem; border-bottom: 1px solid var(--border); }
  td { font-variant-numeric: tabular-nums; color: var(--text-secondary); }
  thead th { color: var(--text-muted); font-weight: 560; font-size: .82rem; text-transform: uppercase; letter-spacing: .06em; }
  tbody th { font-weight: 500; color: var(--text-primary); }
  .numeric { text-align: right; }
  footer { margin-top: 3.5rem; color: var(--text-muted); font-size: .85rem; }
  code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: .92em; }
</style>
</head>
<body>
<main>
  <h1>TypeScript ${escape(data.compilers.primary)} vs ${escape(data.compilers.native)}</h1>
  <p class="lede">Every Modyra project that owns a <code>tsconfig.json</code>, compiled by both
  compilers from the same sources into a temporary directory. Median of ${data.runs} runs each.</p>

  <div class="hero">
    <div class="stat">
      <span class="label">TypeScript ${escape(data.compilers.primary)}</span>
      <span class="value">${(data.totals.primary / 1000).toFixed(1)}s</span>
      <span class="note">all ${data.projects.length} projects</span>
    </div>
    <div class="stat">
      <span class="label">TypeScript ${escape(data.compilers.native)}</span>
      <span class="value">${(data.totals.native / 1000).toFixed(1)}s</span>
      <span class="note">${(saved / 1000).toFixed(1)}s less</span>
    </div>
    <div class="stat">
      <span class="label">Speed-up</span>
      <span class="value">${data.totals.speedup}×</span>
      <span class="note">whole workspace</span>
    </div>
  </div>

  <h2>Compile time per project</h2>
  <p>Milliseconds, lower is better. Projects ordered by their TypeScript ${escape(data.compilers.primary)}
  time; the number at the right of each pair is that project's speed-up.</p>
  <div class="legend">
    <span><i class="swatch primary"></i> TypeScript ${escape(data.compilers.primary)}</span>
    <span><i class="swatch native"></i> TypeScript ${escape(data.compilers.native)}</span>
  </div>
  <div class="figure">${comparisonChart(ordered)}</div>

  <h2>The machine</h2>
  <p>A compile time means nothing without the machine that produced it.</p>
  <table>
    <tbody>${machineRows}</tbody>
  </table>

  <h2>The measurements</h2>
  <table>
    <caption>Median of ${data.runs} runs per project per compiler, in milliseconds.</caption>
    <thead>
      <tr><th scope="col">Project</th><th scope="col">${escape(data.compilers.primary)}</th><th scope="col">${escape(data.compilers.native)}</th><th scope="col">Speed-up</th></tr>
    </thead>
    <tbody>${dataRows}</tbody>
  </table>

  <h2>Method</h2>
  <p>Each project is compiled ${data.runs} times with each compiler, alternating between them, and
  reported by median so a cold file cache on the first run does not decide the result. Both compilers
  write to a temporary directory, never to <code>dist</code>, and read the same workspace
  declarations. The Angular package is absent: it is compiled by ng-packagr, whose peer range stops
  below TypeScript 7.</p>
  <p>Regenerate with <code>npm run benchmark:typescript</code>. The raw numbers are in
  <code>benchmarks/typescript-compilers.json</code>.</p>

  <footer>
    Measured ${escape(data.measuredAt)}${data.commit ? ` at commit <code>${escape(data.commit)}</code>` : ""}.
    Equivalence of the two emits is checked separately by <code>npm run test:typescript7</code>.
  </footer>
</main>
</body>
</html>
`;
}
