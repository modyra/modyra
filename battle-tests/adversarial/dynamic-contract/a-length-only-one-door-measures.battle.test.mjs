/**
 * The path-length cap, on the two doors a document can declare a path through.
 *
 * `MDY_MAX_DYNAMIC_PATH_LENGTH` is 512, and the reason it is a *length* and not a depth is written
 * where it is declared: a path is not only structure — it is the payload key, the draft key, the
 * widget id, and a string every renderer carries per field, so the cost of a name is paid on every
 * read of every value.
 *
 * A **nested** document is held to it. A **flat** one is not:
 *
 *     nested, path ~510 characters       accepted
 *     nested, path ~600 characters       MDY_DYNAMIC_PATH_TOO_LONG, refused
 *     flat, name of 512 characters       accepted
 *     flat, name of 513 characters       accepted, no diagnostic
 *     flat, name of 100 000 characters   accepted, no diagnostic
 *
 * The flat door is the one a document over a wire arrives at — `fields: [{ name, kind, label }]` is
 * the whole of version 1 and the field half of every version since — so the door with no cap is the
 * one the untrusted document uses.
 *
 * It is not a parse-time cost: a thousand fields with twenty-thousand-character names parse in 31 ms
 * and build in 108 ms. The cost is the one the constant names, and it is paid afterwards, by every
 * consumer of every name, for as long as the form is open.
 *
 * Green when a name too long for a path is refused whichever door declares it, with the code the
 * other door already uses.
 */

import { parseDynamicForm } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

/** The cap, as the source declares it — not exported, so it is written here and checked below. */
const CAP = 512;

const flatDocument = (length) => ({
  version: 2,
  fields: [{ name: "x".repeat(length), kind: "text", label: "L" }],
  layout: [],
});

/** A tree `depth` groups deep, whose leaf path is about `3 * depth` characters. */
function nestedDocument(depth) {
  let node = { node: "field", field: { kind: "text", label: "leaf" } };
  for (let index = 0; index < depth; index += 1) node = { node: "group", label: "g", children: { gg: node } };
  return { version: 3, schema: node, fields: [], layout: [] };
}

const codesOf = (document) => {
  const parsed = parseDynamicForm(document, { mode: "lenient" });
  return {
    accepted: parsed.acceptedCount,
    codes: [...new Set(parsed.diagnostics.map((each) => each.code))]
      .filter((code) => code !== "MDY_DYNAMIC_DEPRECATED_VERSION"),
  };
};

battle(
  {
    claims: ["DYN-003", "DYN-001"],
    title: "a path too long is refused whichever door declared it",
    environments: ["node"],
  },
  async (ctx) => {
    // The control, and the half that works: the nested door refuses a path past the cap and takes one
    // under it, so the cap is live and this battle is about where it is asked rather than whether.
    const shortEnough = codesOf(nestedDocument(170));
    const tooDeep = codesOf(nestedDocument(200));
    ctx.log.note("the nested door", { shortEnough, tooDeep });

    expectEqual([shortEnough.accepted, shortEnough.codes], [1, []], {
      claimIds: ["DYN-003"],
      what: "the nested door refused a path that fits, so the cap is not the thing being measured",
    });
    expectEqual(tooDeep.codes, ["MDY_DYNAMIC_PATH_TOO_LONG"], {
      claimIds: ["DYN-003"],
      what: "the nested door stopped refusing a path past the cap, so there is no working half to compare against",
    });

    // And the flat door, on names either side of the same cap.
    const fits = codesOf(flatDocument(CAP));
    ctx.log.note("a flat name exactly at the cap", fits);
    expectEqual([fits.accepted, fits.codes], [1, []], {
      claimIds: ["DYN-001"],
      what: "the flat door refused a name that fits the cap",
    });

    const over = [];
    for (const length of [CAP + 1, 1000, 100000]) {
      const seen = codesOf(flatDocument(length));
      ctx.log.note("a flat name past the cap", { length, ...seen });
      if (!seen.codes.includes("MDY_DYNAMIC_PATH_TOO_LONG")) {
        over.push(`${length} characters: accepted ${seen.accepted}, ${seen.codes.join(" ") || "no diagnostic"}`);
      }
    }

    expectEqual(over, [], {
      claimIds: ["DYN-003", "DYN-001"],
      what: "a flat name past the path cap was taken without the diagnostic the nested door raises",
    });
  },
);
