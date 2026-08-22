/**
 * Two shapes that cost this suite more than any assertion in it.
 *
 * **An action on something that may not be there.** `locator.click()` on an element that never
 * appears does not fail; it waits out the test's whole budget and reports a timeout. In a spec whose
 * budget is 180 seconds that is three minutes spent to learn that a field was absent — and the
 * failure reads as the page hanging rather than as the finding it is. Two such tests cost six
 * minutes between them before they were guarded, and take 0.9 seconds each now.
 *
 * **An action whose failure is swallowed.** `.click().catch(() => undefined)` costs no time and
 * costs something worse: the next assertion measures a page the action never changed, and reports
 * whatever it finds as the product's behaviour. One fixture pressed a row's own button instead of
 * the form's submit, swallowed the mismatch, and reported an empty payload as the form losing every
 * row.
 *
 * Neither is always wrong. A second click on a button the first one disabled is a legitimate
 * swallow — the refusal *is* the test. So this does not forbid them; it records how many exist and
 * fails when the number grows, which keeps the cost from regrowing quietly while leaving every
 * deliberate case where it is.
 *
 * Rewrite the inventory with `--accept`, and only when the new entries are deliberate.
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const SPECS = join(HERE, "..", "browser");
const INVENTORY = join(HERE, "..", "reports", "unguarded-actions.json");

/** An action taken on a locator that was never asserted to exist. */
const POSITIONAL = /\.(?:first|last|nth\([^)]*\))\(\)\s*\.\s*(?:click|focus|fill|press|hover|tap)\(/g;
/** An action whose failure is discarded. */
const SWALLOWED = /\.(?:click|focus|fill|press|hover|tap)\([^;]*?\)\s*\.\s*catch\(/g;

const count = (text, pattern) => (text.match(pattern) ?? []).length;

const found = {};
for (const name of readdirSync(SPECS)) {
  if (!name.endsWith(".spec.ts")) continue;
  // Throwaway probes, by the convention this tree already uses: a `zz-` file is written to answer
  // one question and deleted in the same hour, often by whoever is mid-investigation. Counting them
  // makes this refuse a run because somebody else is working — which is how a gate stops being read.
  if (name.startsWith("zz-")) continue;
  const text = readFileSync(join(SPECS, name), "utf8");
  // A line that is a comment is describing the shape, not using it — this file's own prose would
  // otherwise count itself.
  const code = text.split("\n").filter((line) => !/^\s*(\*|\/\/)/.test(line)).join("\n");
  const positional = count(code, POSITIONAL);
  const swallowed = count(code, SWALLOWED);
  if (positional + swallowed > 0) found[name] = { positional, swallowed };
}

const total = Object.values(found).reduce((sum, each) => sum + each.positional + each.swallowed, 0);

if (process.argv.includes("--accept")) {
  writeFileSync(INVENTORY, `${JSON.stringify({
    note: "Actions taken without asserting the target exists, and actions whose failure is discarded. "
      + "An unguarded action on an absent element waits out the test's whole budget; a swallowed one "
      + "lets the next assertion measure a page it never changed. Both are sometimes deliberate. This "
      + "records how many there are so the number cannot grow unnoticed.",
    recordedAt: new Date().toISOString(),
    total,
    files: found,
  }, null, 2)}\n`);
  console.log(`unguarded actions: recorded ${total} in ${Object.keys(found).length} spec(s)`);
  process.exit(0);
}

if (!existsSync(INVENTORY)) {
  console.error(`unguarded actions: no inventory at ${INVENTORY}. Write one with --accept.`);
  process.exit(1);
}

const baseline = JSON.parse(readFileSync(INVENTORY, "utf8"));
const grown = Object.entries(found).filter(([name, now]) => {
  const before = baseline.files[name] ?? { positional: 0, swallowed: 0 };
  return now.positional > before.positional || now.swallowed > before.swallowed;
});

console.log(`unguarded actions: ${total} (recorded ${baseline.total})`);
if (grown.length === 0) {
  if (total < baseline.total) console.log(`  ${baseline.total - total} fewer than recorded — rewrite with --accept`);
  process.exit(0);
}

for (const [name, now] of grown) {
  const before = baseline.files[name] ?? { positional: 0, swallowed: 0 };
  console.error(`  ${name}: positional ${before.positional}→${now.positional}, swallowed ${before.swallowed}→${now.swallowed}`);
}
console.error(
  "\nAssert the target exists before acting on it — `await expect(locator).toHaveCount(1)` fails in "
  + "seconds with a sentence where a bare click waits out the budget and reports a timeout. If the "
  + "failure is what the test is about, say so in a comment and record it with --accept.",
);
process.exit(1);
