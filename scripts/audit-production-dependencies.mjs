#!/usr/bin/env node
/**
 * The production dependency audit, with "no vulnerabilities" and "could not ask" told apart.
 *
 * `pnpm audit --prod` answers a question about this repository and reports a failure to reach
 * `registry.npmjs.org` through the same exit code. A lost packet then reads as a security finding:
 * main goes red, and whoever reads the verdict concludes the tree is broken and stops pushing for a
 * defect that does not exist. That happened, and the reader lost ten minutes to it.
 *
 * A transport error and a security outcome are different facts. `--json` separates them at the
 * source — a failure to ask comes back as `{ "error": { … } }`, a verdict as an advisory report —
 * so this reads which one arrived and says so in those words.
 *
 * What it does **not** do is decide that an unanswered question is a pass. It exits 0 only when the
 * registry answered and had nothing to report. Where no verdict was obtained the exit code is
 * chosen by the caller: `--required` for a boundary that must not proceed unaudited, and the
 * default for a gate where blocking every push on the availability of a third party costs more than
 * it protects. Neither is silent.
 *
 * Usage:
 *   node scripts/audit-production-dependencies.mjs              # no verdict -> exit 0, announced
 *   node scripts/audit-production-dependencies.mjs --required   # no verdict -> exit 1
 */
import { spawnSync } from "node:child_process";

/**
 * The verdict, decided from what came back rather than from an exit code.
 *
 * Separated from the fetch so both answers can be exercised without a network: the branch that
 * matters is the one that only appears when the registry is unreachable, and a check that cannot be
 * shown taking that branch has not been tested where it counts.
 *
 * @param {string} raw stdout from `pnpm audit --prod --json`
 * @param {string} stderr
 * @param {boolean} required whether an unanswered question should stop the caller
 * @returns {{ code: number, lines: string[], verdict: "clean" | "advisories" | "none" }}
 */
export function decide(raw, stderr, required) {
  let payload;
  try { payload = JSON.parse(String(raw).trim()); } catch { payload = null; }

  const noVerdict = (why) => ({
    verdict: "none",
    code: required ? 1 : 0,
    lines: [
      "PRODUCTION AUDIT — NO VERDICT",
      `  ${why}`,
      "  Nothing is known about the dependencies from this run — neither that they are clean",
      "  nor that they are not. This is a failure to obtain a finding, not a finding.",
      ...String(stderr ?? "").trim().split("\n").filter(Boolean).slice(-2).map((l) => `  ${l}`),
    ],
  });

  if (payload === null) return noVerdict("`pnpm audit --prod --json` produced nothing this could read.");
  if (payload.error !== undefined) {
    return noVerdict(`The registry could not be asked: ${payload.error.message ?? "unknown"}`
      + `${payload.error.code === undefined ? "" : ` (code ${payload.error.code})`}`);
  }

  const advisories = Object.values(payload.advisories ?? {});
  const counted = Object.values(payload.metadata?.vulnerabilities ?? {})
    .reduce((sum, n) => sum + (Number(n) || 0), 0);
  const total = advisories.length > 0 ? advisories.length : counted;

  if (total === 0) {
    return { verdict: "clean", code: 0, lines: ["PRODUCTION AUDIT CLEAN — the registry answered and reported nothing."] };
  }
  return {
    verdict: "advisories",
    code: 1,
    lines: [
      `PRODUCTION AUDIT — ${total} advisory(ies) against production dependencies`,
      ...advisories.slice(0, 20).map((a) => `  ${a.severity ?? "?"}  ${a.module_name ?? a.name ?? "?"}  ${a.title ?? ""}`),
    ],
  };
}

// Run only when invoked directly, so the decision above can be exercised by a test.
if (process.argv[1] !== undefined && import.meta.url.endsWith(process.argv[1].split("/").pop())) {
  const required = process.argv.includes("--required");
  const run = spawnSync("pnpm", ["audit", "--prod", "--json"], { encoding: "utf8" });
  const { code, lines } = decide(run.stdout, run.stderr, required);
  for (const line of lines) (code === 0 ? console.log : console.error)(line);
  process.exit(code);
}
