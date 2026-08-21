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
 */
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { newestUnder } from "../../scripts/newest-under.mjs";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const HOST = join(ROOT, "battle-tests/.tmp-browser");

/** The packages whose source the host bundles. Widgets and core reach it through plain and lit. */
const SOURCES = ["core", "widgets", "styles", "plain", "lit"];

const SOURCE_KINDS = [".ts", ".mjs", ".js", ".css"];
const BUILT_KINDS = [".js", ".mjs", ".css", ".html"];

const builtAt = newestUnder(HOST, BUILT_KINDS);

// No host at all is not staleness, and saying "stale" would send the reader looking for the wrong
// thing. The build step that follows creates it; let that speak, or let the server fail on an empty
// directory, either of which names the real situation.
if (builtAt === 0) process.exit(0);

const stale = [];
for (const name of SOURCES) {
  const sourceAt = newestUnder(join(ROOT, "packages", name, "src"), SOURCE_KINDS);
  if (sourceAt === 0) continue;
  if (sourceAt > builtAt) stale.push({ name, behindBy: Math.round((sourceAt - builtAt) / 1000) });
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
      .map(({ name, behindBy }) => `  @modyra/${name}`.padEnd(24) + `changed ${behindBy}s later\n`)
      .join("") +
    `\nRebuild it, then run the suite again:\n\n  npm run battle:browser\n\n` +
    `(that script builds the host first; \`npx playwright test\` on its own does not)\n\n`,
);
process.exit(1);
