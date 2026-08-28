/**
 * Every claim a test says it attacks is a claim that exists.
 *
 * A spec names the claims it is aimed at, and two things read that line: a person deciding what a
 * red means, and the ranker that repairs in severity order. Both treat an id they do not recognise
 * the way they treat one they do — the ranker takes the severities it can resolve and drops the
 * rest, so a spec citing one live id and one dangling id ranks by the live one and looks complete.
 *
 * A citation nobody registered is worth less than no citation at all: an absent line is visible, and
 * the ranker already refuses to record a red that carries none. A dangling one is an assertion about
 * what the suite covers that nothing behind it supports.
 *
 * @source-inspection — it reads the suite's own files, which is the population it is about. It loads
 * no package.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { expectClaim, expectEqual } from "../../harness/assertions.mjs";
import { battle } from "../../harness/battle.mjs";
import { MDY_BATTLE_CLAIMS } from "../../models/claims.mjs";

const SUITE = new URL("../..", import.meta.url).pathname.replace(/\/$/, "");
/** Where a claim is cited. `models` is where they are declared, so it is not a citation. */
const CITING = ["adversarial", "browser", "generative", "harness"];
/**
 * Where a file *cites* a claim, as opposed to where a claim-shaped string happens to appear.
 *
 * A test may carry an invented id as data — a fixture that feeds the registry a name it will not
 * find, a made-up code in a sample document. Reading every claim-shaped string calls those citations
 * and reports the suite's own fixtures as holes, which is the reading that would make this check
 * noise. A citation is declared: the header line a spec writes, or the `claims`/`claimIds` a battle
 * and an assertion pass.
 */
const CITATIONS = [
  /Claims under attack:([^\n]*)/g,
  /\bclaims:\s*\[([^\]]*)\]/g,
  /\bclaimIds:\s*\[([^\]]*)\]/g,
];
const CLAIM_SHAPED = /\b[A-Z0-9]{2,4}-\d{3}\b/g;

const cited = (source) => {
  const ids = [];
  for (const pattern of CITATIONS) {
    for (const [, body] of source.matchAll(pattern)) ids.push(...(body.match(CLAIM_SHAPED) ?? []));
  }
  return ids;
};

const filesUnder = (dir, out = []) => {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) filesUnder(path, out);
    else if (/\.(mjs|ts)$/.test(entry)) out.push(path);
  }
  return out;
};

battle(
  {
    claims: ["DOC-001"],
    title: "a claim nobody registered",
    environments: ["node"],
  },
  async (ctx) => {
    const registered = new Set(MDY_BATTLE_CLAIMS.map((one) => one.id));

    const dangling = new Map();
    let citations = 0;
    for (const dir of CITING) {
      for (const file of filesUnder(join(SUITE, dir))) {
        for (const id of cited(readFileSync(file, "utf8"))) {
          citations += 1;
          if (registered.has(id)) continue;
          const where = dangling.get(id) ?? [];
          where.push(file.slice(SUITE.length + 1));
          dangling.set(id, where);
        }
      }
    }

    ctx.log.note("what was read", { registered: registered.size, citations });

    // A run that found no citation at all agrees with a suite that cites nothing wrong.
    expectClaim(registered.size > 20 && citations > 50, {
      claimIds: ["DOC-001"],
      what: "almost nothing was read, so this compared almost nothing",
      detail: `${registered.size} claims registered, ${citations} citations found`,
    });

    expectEqual(
      Object.fromEntries([...dangling].map(([id, where]) => [id, where.sort()])),
      {},
      {
        claimIds: ["DOC-001"],
        what: "a test names a claim the registry does not have",
        detail: "The ranker resolves the ids it knows and drops the rest, so a spec citing one live "
          + "id and one dangling id ranks by the live one and reads as covered. Either the claim "
          + "belongs in the registry, or the citation belongs to a claim already in it.",
      },
    );
  },
);
