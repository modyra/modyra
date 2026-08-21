/**
 * Refuses to serve a browser host older than the packages it is built from.
 *
 * The host under `.tmp-browser` is a bundle, and the static server hands it out exactly as it found
 * it. Nothing in the serving path consults the sources, so a host built before a fix under test is
 * served without complaint and the suite reports on code that is no longer in the repository.
 *
 * Both directions of that are wrong and neither announces itself:
 *
 * - a spec written for the fix fails, and reads as a defect in the fix;
 * - a spec covering the fixed behaviour passes against the *old* bundle, and reads as verification.
 *
 * The second is the dangerous one, because a green is not investigated. So the check runs before the
 * server does, and a stale host is a hard failure with the command that repairs it, rather than a
 * result anyone has to think about.
 *
 * Freshness only — whether the bundle is *correct* is the suite's business. This asks the single
 * question the suite structurally cannot: is what is being served built from what is in the tree.
 *
 * @source-inspection — **when** a package's source was last written is a fact about the source and
 * nowhere else. No published entry point carries its own build time, and none should: a bundle that
 * could report its own staleness would already have solved the problem. So this reads mtimes under
 * every package's own `src` and reads nothing in them — it never opens a file, only asks the filesystem when
 * each was touched. That is the narrowest form of the exemption this suite allows, and it is the
 * reason the exemption exists rather than a use of it for convenience.
 */
import { readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

/**
 * The newest mtime under a directory tree.
 *
 * The same walk lives in `scripts/newest-under.mjs`, which the Angular demo's guard imports. This copy
 * is deliberate: `battle-tests/` may not import from outside itself — `black-box-audit.mjs` enforces
 * it, and it enforced it against this file — because a suite that reaches into repo tooling can pass
 * by agreeing with it rather than with the published packages. Twenty lines of `readdir` is the
 * cheaper side of that trade.
 *
 * Asking a *directory's* own mtime instead is the trap both copies exist to close: it records when an
 * entry was added or removed, not when the files beneath it were written, so a rebuild that overwrites
 * in place leaves it untouched and a fresh build reads as stale.
 */
function newestUnder(directory, extensions) {
  let newest = 0;
  let entries;
  try {
    entries = readdirSync(directory, { withFileTypes: true });
  } catch {
    return 0;
  }
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      newest = Math.max(newest, newestUnder(path, extensions));
      continue;
    }
    if (!extensions.some((extension) => entry.name.endsWith(extension))) continue;
    newest = Math.max(newest, statSync(path).mtimeMs);
  }
  return newest;
}

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const HOST = join(ROOT, "battle-tests/.tmp-browser");

/**
 * The packages whose source the hosts bundle, and the artefact each is bundled from.
 *
 * Most go straight into the host: the host is rebuilt from their `src` every run, so the host's own
 * mtime answers for them. `angular` does not. It is bundled from `dist/fesm2022`, which ng-packagr
 * writes on its own schedule and which the browser tier's build script never produces — so its chain
 * is `src → dist → host`, and a run that rebuilds the host while `dist` stays behind wears a stale
 * adapter under a fresh page.
 *
 * Both links are checked for it. Checking only `src` against the host makes the guard *look* like it
 * covers Angular while passing exactly the case it exists to catch, because rebuilding the host is
 * what every run does anyway.
 */
const SOURCES = [
  { name: "core" },
  { name: "widgets" },
  { name: "styles" },
  { name: "plain" },
  { name: "lit" },
  { name: "angular", via: "dist" },
];

const SOURCE_KINDS = [".ts", ".mjs", ".js", ".css"];
const BUILT_KINDS = [".js", ".mjs", ".css", ".html"];

const builtAt = newestUnder(HOST, BUILT_KINDS);

// No host at all is not staleness, and saying "stale" would send the reader looking for the wrong
// thing. The build step that follows creates it; let that speak, or let the server fail on an empty
// directory, either of which names the real situation.
if (builtAt === 0) process.exit(0);

const stale = [];
for (const { name, via } of SOURCES) {
  const sourceAt = newestUnder(join(ROOT, "packages", name, "src"), SOURCE_KINDS);
  if (sourceAt === 0) continue;

  // The artefact the host actually bundles. Where a package has an intermediate build, that build is
  // what must be newer than the source; the host being newer than both says nothing about it.
  const bundledAt = via === undefined ? builtAt : newestUnder(join(ROOT, "packages", name, via), BUILT_KINDS);
  if (via !== undefined && bundledAt === 0) {
    stale.push({ name, behindBy: 0, why: `has no ${via}/ to bundle` });
    continue;
  }
  if (sourceAt > bundledAt) {
    stale.push({
      name,
      behindBy: Math.round((sourceAt - bundledAt) / 1000),
      why: via === undefined ? undefined : `${via}/ is older than src/`,
    });
  }
}

if (stale.length === 0) process.exit(0);

// With the date omitted, "12:49" against yesterday's "23:09" reads as newer to a person and to a
// string sort. The comparison is on milliseconds; the message says which day it is talking about.
const when = (ms) => new Date(ms).toISOString().replace("T", " ").slice(0, 19);
process.stderr.write(
  `\nThe browser host is older than the code it is built from, so the suite would report on a\n` +
    `bundle that is not what is in the tree — a passing spec would prove nothing.\n\n` +
    `  host built   ${when(builtAt)}\n` +
    stale
      .map(({ name, behindBy, why }) =>
        `  @modyra/${name}`.padEnd(24) + (why === undefined ? `changed ${behindBy}s later` : `${why}, by ${behindBy}s`) + "\n")
      .join("") +
    `\nRebuild it, then run the suite again:\n\n  npm run battle:browser\n\n` +
    `(that script builds the host first; \`npx playwright test\` on its own does not)\n\n`,
);
process.exit(1);
