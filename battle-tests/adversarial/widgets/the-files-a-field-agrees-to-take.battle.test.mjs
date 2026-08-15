/**
 * What a file field agrees to take, and what shape it hands back.
 *
 * `fileSelectionTransition(candidates, options)` is the published decision: which of the files a user
 * picked are kept, which are turned away, and what the field then holds. Nothing in this suite had
 * named it, and it decides two things that are quiet when they are wrong.
 *
 * The first is `accept`. Its tokens are the HTML ones: an extension, a media-type wildcard, an exact
 * media type. The token that means *any file at all* is a star, a slash and a star — and under the
 * rule for wildcards it becomes "does this file's type begin with a star and a slash", which nothing
 * does. So the most permissive value a form can state turns every file away. A user picks a file and
 * the field stays empty, with nothing on the page to say why.
 *
 * (That token is written only inside strings below. Spelled in a comment it would end this one.)
 *
 * The second is the shape. `MDY_VALUE_CONTRACTS.file` declares `file[]` — a list, always — and the
 * transition returns a bare file when the field is not `multiple`, which is the ordinary case. A
 * renderer that writes it straight to the model puts a value there that the field's own shape check
 * refuses, and the form reports the field invalid for every file the user picks.
 *
 * Both are asserted against the published contract rather than against a preference: `matchesValueShape`
 * is the checker the engine itself uses.
 */

import { MDY_VALUE_CONTRACTS, matchesValueShape } from "@modyra/core";
import { fileSelectionTransition } from "@modyra/widgets";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

/** Files a person could pick, in the shapes a browser hands over. */
const PICKED = Object.freeze([
  Object.freeze({ name: "photo.png", type: "image/png", size: 10 }),
  Object.freeze({ name: "notes.txt", type: "text/plain", size: 10 }),
]);

const namesOf = (files) => files.map((each) => each.name);

battle(
  {
    claims: ["UI-006", "VAL-004"],
    title: "the token that means any file takes any file",
    environments: ["node"],
  },
  async (ctx) => {
    // The controls first: the tokens that do work, so a refusal below is the token rather than a
    // filter that turns everything away.
    const wide = fileSelectionTransition(PICKED, { accept: "", multiple: true });
    const byType = fileSelectionTransition(PICKED, { accept: "image/*", multiple: true });
    const byExtension = fileSelectionTransition(PICKED, { accept: ".png", multiple: true });
    ctx.log.note("tokens that select", {
      none: namesOf(wide.accepted),
      wildcard: namesOf(byType.accepted),
      extension: namesOf(byExtension.accepted),
    });

    expectEqual(namesOf(wide.accepted), ["photo.png", "notes.txt"], {
      claimIds: ["UI-006"],
      what: "a field stating no accept at all turned a file away",
    });

    expectEqual(namesOf(byType.accepted), ["photo.png"], {
      claimIds: ["UI-006"],
      what: "a media-type wildcard did not select by type",
    });

    expectEqual(namesOf(byExtension.accepted), ["photo.png"], {
      claimIds: ["UI-006"],
      what: "an extension did not select by name",
    });

    // And the one that means everything.
    for (const accept of ["*/*", "*"]) {
      const outcome = fileSelectionTransition(PICKED, { accept, multiple: true });
      ctx.log.note("the token that means any file", { accept, accepted: namesOf(outcome.accepted) });

      expectEqual(namesOf(outcome.accepted), ["photo.png", "notes.txt"], {
        claimIds: ["UI-006"],
        what: `a field stating accept=${JSON.stringify(accept)} turned away every file the user picked`,
        detail: JSON.stringify({ accepted: namesOf(outcome.accepted), rejected: namesOf(outcome.rejected) }),
      });
    }
  },
);

battle(
  {
    claims: ["UI-006", "VAL-003"],
    title: "a file field hands back the shape it says it holds",
    environments: ["node"],
  },
  async (ctx) => {
    const declared = MDY_VALUE_CONTRACTS.file;
    ctx.log.note("what the contract says a file field holds", declared);

    // The premise: the shape is a list, and the checker used here is the engine's own.
    expectEqual(declared.shape, "file[]", {
      claimIds: ["VAL-003"],
      what: "a file field no longer declares that it holds a list, so this battle is about the wrong shape",
    });

    // A field taking several files: the list is a list.
    const many = fileSelectionTransition(PICKED, { accept: "", multiple: true });
    expectClaim(matchesValueShape(declared.shape, many.value), {
      claimIds: ["VAL-003"],
      what: "a multiple file field handed back something that is not a list of files",
      detail: JSON.stringify(many.value),
    });

    // And a field taking one, which is the ordinary case and the one a renderer writes straight
    // into the model.
    const one = fileSelectionTransition(PICKED.slice(0, 1), { accept: "", multiple: false });
    ctx.log.note("what a single-file field hands back", { value: one.value, isArray: Array.isArray(one.value) });

    expectClaim(matchesValueShape(declared.shape, one.value), {
      claimIds: ["VAL-003", "UI-006"],
      what: "a single-file field handed back a value its own shape check refuses, so a form holding it is invalid for every file picked",
      detail: JSON.stringify({ value: one.value, isArray: Array.isArray(one.value) }),
    });
  },
);
