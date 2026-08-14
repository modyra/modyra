/**
 * The half of a regular expression a document cannot reach.
 *
 * A pattern is refused on structure: nested unbounded repetition, and repeated alternatives whose
 * branches can match the same character. Deciding whether two branches overlap means deciding what
 * each branch matches, and that depends on flags. `i` makes `[a-z]` and `[A-Z]` overlap; `s` makes
 * `.` match a newline, which is exactly the pair the disjointness check relies on staying apart; `u`
 * changes what a class escape means.
 *
 * So the check is only sound while a document cannot set flags. It cannot: the Dynamic Form Contract
 * carries `pattern` as a bare string and the compiler passes no second argument. This battle is what
 * makes that a pinned property rather than an implementation detail nobody wrote down — adding a
 * `flags` key to the contract later would silently move the ground the structural refusal stands on.
 *
 * The two ways a document might try are both dead ends and both are asserted: a sibling `flags` key
 * is not read, and inline `(?i)` is not JavaScript syntax and is refused as an invalid source.
 */

import { buildDynamicValidators } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

battle(
  {
    claims: ["SEC-004"],
    title: "a document cannot change what its own pattern means",
    environments: ["node"],
  },
  async (ctx) => {
    // The control: the pattern is case-sensitive, which is what every assertion below is measured
    // against. If this ever passes, the rest of the battle is about nothing.
    const plain = buildDynamicValidators({ pattern: "^A$" });
    ctx.log.note("a case-sensitive pattern from a document", { refusedLower: plain.validators[0]("a").length > 0 });

    expectClaim(plain.validators.length === 1 && plain.validators[0]("a").length > 0, {
      claimIds: ["SEC-004"],
      what: "the control pattern did not refuse a lowercase value, so nothing below measures a flag",
    });

    expectEqual(plain.validators[0]("A"), [], {
      claimIds: ["SEC-004"],
      what: "the control pattern refused the value it exists to accept",
    });

    // A sibling key a document might carry, hoping it becomes the second argument to `RegExp`.
    const sibling = buildDynamicValidators({ pattern: "^A$", flags: "i" });
    ctx.log.note("a document carrying a flags key beside its pattern", {
      stillRefusesLower: sibling.validators[0]("a").length > 0,
    });

    expectClaim(sibling.validators[0]("a").length > 0, {
      claimIds: ["SEC-004"],
      what: "a `flags` key beside the pattern changed what the pattern matches",
    });

    // A literal written the way it is spelled in source, which is a string and not a delimiter pair.
    const delimited = buildDynamicValidators({ pattern: "/^A$/i" });
    expectClaim(delimited.validators.length === 0 || delimited.validators[0]("a").length > 0, {
      claimIds: ["SEC-004"],
      what: "a slash-delimited pattern was read as a literal with flags",
    });

    // And the inline form, which other regex dialects allow and JavaScript does not. It reaches the
    // compiler as an invalid source and is skipped with a diagnostic rather than thrown.
    const inline = buildDynamicValidators({ pattern: "(?i)^A$" });
    ctx.log.note("an inline flag group, which JavaScript has no syntax for", {
      validators: inline.validators.length,
    });

    expectEqual(inline.validators.length, 0, {
      claimIds: ["SEC-004"],
      what: "an inline flag group compiled into a working validator",
    });
  },
);
