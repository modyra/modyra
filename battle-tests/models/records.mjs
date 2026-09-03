/**
 * Reading a decision record from a test that leans on it.
 *
 * Two guards already bind to a record: one reads an exemption from ADR 0195, another takes its whole
 * prohibition from ADR 0196 so the rule expires when the decision does. Both spelled the status
 * check themselves, as `/^Status:\s*Accepted\s*$/m`, and that spelling is wrong in a way neither
 * author saw until a record was amended.
 *
 * **An amendment keeps a decision alive; that regex reads it as retirement.** `CLAUDE.md` says a
 * record that still holds but has grown is amended in place and marked as an amendment — so
 * `Status: Accepted — amended 2026-09-03, see Consequences` is a *standing* decision, and both guards
 * would have failed on it exactly as they fail on `Superseded by ADR 9999`. A test that punishes the
 * correct way of keeping a record current teaches people to leave records stale.
 *
 * So the reading lives here once: standing means Accepted, whether or not an amendment follows, and
 * retired means anything else — said in one place so the next binding costs a call rather than a
 * regex somebody has to get right again.
 */
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const RECORDS = join(ROOT, "docs/architecture");

/** The record whose number this is, by its number alone: a record's title can be edited, its number cannot. */
export function recordNamed(number) {
  const padded = String(number).padStart(4, "0");
  const file = readdirSync(RECORDS).find((name) => name.startsWith(`${padded}-`));
  if (file === undefined) return null;
  return { file: join("docs/architecture", file), text: readFileSync(join(RECORDS, file), "utf8") };
}

/** The status line's own words, or null where the record states none in the shape the template sets. */
export function statusOf(text) {
  return text.match(/^Status:[ \t]*(.+?)[ \t]*$/m)?.[1] ?? null;
}

/**
 * Whether the decision still stands.
 *
 * Accepted, with or without an amendment trailing it. Superseded, Rejected, Proposed and anything
 * else are not standing — a guard leaning on one of those is enforcing a rule nobody holds.
 */
export function isStanding(status) {
  return status !== null && /^Accepted\b/.test(status);
}

/**
 * A record a guard may lean on: it exists, it stands, and it still says what the guard needs.
 *
 * `mentions` is what the guard's own reason depends on — the call it exempts, the shape it forbids.
 * When the record stops saying those, the guard has lost its argument and should fail rather than go
 * on enforcing; that is the whole point of reading the record instead of restating it.
 */
export function leaningOn(number, { mentions = [] } = {}) {
  const record = recordNamed(number);
  if (record === null) return { ok: false, why: `ADR ${number} is not in docs/architecture` };
  const status = statusOf(record.text);
  if (!isStanding(status)) {
    return { ok: false, why: `${record.file} is "${status ?? "(no status)"}", so this rule has no decision behind it` };
  }
  const missing = mentions.filter((phrase) => !record.text.includes(phrase));
  if (missing.length > 0) {
    return { ok: false, why: `${record.file} no longer mentions ${missing.map((m) => JSON.stringify(m)).join(", ")}, which is what this rule leans on` };
  }
  return { ok: true, file: record.file, status };
}
