/**
 * Which form a handle came from, asked from outside.
 *
 * `handleFormOf` is how a consumer holding a handle finds the form that built it — the lookup an
 * adapter needs when a control is handed a cell and nothing else. It is the public half of the
 * registry the cross-runtime guard reads, and it had no battle.
 *
 * The property that matters is not that it answers but that it never answers *wrongly*. A handle
 * attributed to the wrong form sends a write, a claim or a teardown to a form the consumer is not
 * looking at, and every one of those is silent. So the battle runs two forms at once, of different
 * collection kinds, and asks every handle each of them hands out.
 *
 * Two boundaries are asserted beside it because they are what a caller has to be able to rely on:
 * an object the engine never built is unknown rather than guessed at, and a destroyed form still
 * owns the handles it made — a teardown reading `handleFormOf` to decide what to release must not
 * be told the handle is ownerless the moment it matters.
 */

import { createForm, handleFormOf, vanillaReactivity } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";
import { buildSchema, KEYED_ROWS_SPEC, POSITIONAL_ROWS_SPEC } from "../../models/schemas.mjs";

const open = (spec) =>
  createForm(buildSchema(spec).schema, { reactivity: vanillaReactivity(), devWarnings: false });

battle(
  {
    claims: ["REA-001"],
    title: "every handle two forms hand out names the form it came from",
    environments: ["node"],
  },
  async (ctx) => {
    const keyed = open(KEYED_ROWS_SPEC);
    keyed.f.rows.upsert("a", { code: "A" });
    const positional = open(POSITIONAL_ROWS_SPEC);
    positional.f.items.push({ code: "P" });

    const handles = [
      ["a keyed collection", keyed.f.rows, keyed],
      ["a plain field", keyed.f.title, keyed],
      ["a row of a keyed collection", keyed.f.rows.row("a"), keyed],
      ["a cell of a keyed row", keyed.f.rows.cell("a", "code"), keyed],
      ["a field found by path", keyed.getField("rows.a.code"), keyed],
      ["a positional collection", positional.f.items, positional],
      ["a row of a positional collection", positional.f.items.at(0), positional],
    ];

    for (const [what, handle, owner] of handles) {
      const named = handleFormOf(handle);
      ctx.log.note("a handle asked which form built it", {
        what,
        answered: named === keyed ? "keyed" : named === positional ? "positional" : "neither",
      });

      // Identity, not equality: two forms of the same schema would compare equal on everything a
      // consumer can read, and the point of the registry is telling them apart.
      expectClaim(named === owner, {
        claimIds: ["REA-001"],
        what: `${what} named a form that did not build it`,
        detail: named === undefined ? "no form at all" : "the other form",
      });
    }

    // An object the engine never built is unknown rather than attributed to whichever form asked.
    // The comment on the registry says a caller falls back to the form it already has, and it can
    // only do that if the answer is honestly absent.
    expectEqual(handleFormOf({}), undefined, {
      claimIds: ["REA-001"],
      what: "an object no form built was claimed by one",
    });

    // A teardown reads this to decide what to release, and it runs after destroy by definition.
    const collection = keyed.f.rows;
    keyed.destroy();
    expectClaim(handleFormOf(collection) === keyed, {
      claimIds: ["REA-001"],
      what: "a destroyed form stopped owning the handles it built",
    });

    positional.destroy();
  },
);
