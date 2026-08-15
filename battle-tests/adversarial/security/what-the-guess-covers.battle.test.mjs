/**
 * The names a panel masks when nobody said to.
 *
 * `isSensitivePath(path, declared)` answers with the declaration when there is one and falls back to
 * a guess about the name when there is not. `devtools-masking` pins the first half — a declaration
 * wins in both directions, including over the guess's own stated false positive — and says of the
 * second, in its own words, that it "may be widened or narrowed at any time and nobody would notice".
 *
 * This is that. Not a claim that the guess should match more: it is a fallback and its docblock says
 * so, and the mechanism a consumer is meant to use is the declaration. It is a record of what the
 * guess covers today, so that widening or narrowing it is a change somebody makes on purpose and a
 * reader can see.
 *
 * The unmatched half is listed as deliberately as the matched one, because that is where the cost of
 * a silent narrowing would land: a name nobody thought to declare, that used to be caught.
 */

import { isSensitivePath } from "@modyra/core/devtools";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

/** Names the guess answers for today, matched and not. */
const CORPUS = Object.freeze([
  // Matched.
  ["password", true], ["Password", true], ["userPassword", true], ["passwd", true],
  ["secret", true], ["clientSecret", true], ["token", true], ["refreshToken", true],
  ["card", true], ["cardNumber", true], ["cvv", true], ["ssn", true], ["iban", true],
  // Matched, and the guess's own stated false positive: a style, not a secret.
  ["cardStyle", true], ["discardNote", true],
  // Not matched. Each is a name a real form carries, and each is why the declaration exists.
  ["pw", false], ["pwd", false], ["pin", false], ["apiKey", false], ["api_key", false],
  ["authorization", false], ["sessionId", false], ["passport", false],
  ["accountNumber", false], ["sortCode", false], ["routingNumber", false],
  ["securityCode", false], ["taxId", false], ["notes", false], ["email", false],
]);

battle(
  {
    claims: ["SEC-002"],
    title: "the guess covers the names it covers, and no others",
    environments: ["node"],
  },
  async (ctx) => {
    const wrong = [];
    for (const [path, guessed] of CORPUS) {
      const answer = isSensitivePath(path);
      if (answer !== guessed) wrong.push({ path, expected: guessed, answered: answer });
    }
    ctx.log.note("what the guess says about each name", {
      matched: CORPUS.filter(([, m]) => m).length,
      unmatched: CORPUS.filter(([, m]) => !m).length,
      wrong,
    });

    // The control: the corpus has both kinds in it, so agreement is about membership rather than a
    // guess that answers the same way to everything.
    expectClaim(CORPUS.some(([, m]) => m) && CORPUS.some(([, m]) => !m), {
      claimIds: ["SEC-002"],
      what: "the corpus is one-sided, so it cannot show the edge of the guess",
    });

    expectEqual(wrong, [], {
      claimIds: ["SEC-002"],
      what: "the guess's membership has changed — a name it used to mask, or one it did not, has moved",
    });

    // And the declaration still wins over whichever side a name falls on, which is the half that
    // matters and the half a consumer controls.
    for (const [path] of CORPUS.slice(0, 6)) {
      expectClaim(isSensitivePath(path, true) === true && isSensitivePath(path, false) === false, {
        claimIds: ["SEC-002"],
        what: `a declaration stopped deciding for ${JSON.stringify(path)}`,
      });
    }
  },
);
