/**
 * How deep an option may be before a draft stops recognising it.
 *
 * An option is compared by what it holds rather than by which object it is, which is what lets a
 * choice survive being written to a draft as JSON and read back as a different object. The walk is
 * bounded, and past the bound the comparison answers "different" — the safe direction, since two
 * options are never wrongly called the same.
 *
 * What it costs is the other direction, and it is the defect the members comparison exists to fix,
 * returning at depth: an option nested past the bound is never recognised as itself, so a form
 * restored from its own draft refuses the choice the user made and names it as one that was never
 * offered. There is nothing the user can do except pick it again.
 *
 * Measured through a real round trip rather than through the guard alone, because the guard
 * answering "different" is only a defect once a draft has produced the copy it is asked about:
 *
 *   depth 8 — saved, restored, still valid
 *   depth 9 — saved, restored, invalid
 *
 * An option carrying a whole domain entity is three to five levels deep, so the bound is comfortable
 * rather than tight. This battle exists so that lowering it, or changing what counts as a level, is
 * a failing test rather than a form that quietly stops accepting what it offered.
 */

import { createForm, field, oneOf } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim } from "../../harness/assertions.mjs";

/** The deepest option a draft round trip is expected to recognise. */
const RECOGNISED_DEPTH = 8;

/** An option nested `levels` deep, of the shape an entity graph produces. */
function nestedOption(levels) {
  let option = { id: 1, label: "One" };
  for (let level = 0; level < levels; level += 1) option = { nested: option };
  return option;
}

function memoryStorage() {
  const written = new Map();
  return {
    read: (key) => written.get(key) ?? null,
    write: (key, value) => written.set(key, value),
    remove: (key) => written.delete(key),
  };
}

const saved = () => new Promise((resolve) => setTimeout(resolve, 700));
const restored = () => new Promise((resolve) => setTimeout(resolve, 60));

/** Fill a form with `option`, let it save, reopen it, and report whether the choice survived. */
async function survivesItsOwnDraft(option) {
  const storage = memoryStorage();
  const open = () => createForm({ choice: field(null, [oneOf([option])]) }, {
    draft: { key: "choice", storage },
    devWarnings: false,
  });

  const first = open();
  first.f.choice.set(option);
  const acceptedWhenChosen = first.state.valid();
  await saved();
  first.destroy();

  const second = open();
  await restored();
  const acceptedWhenRestored = second.state.valid();
  second.destroy();

  return { acceptedWhenChosen, acceptedWhenRestored };
}

battle(
  {
    claims: ["PER-003"],
    title: "an option of ordinary depth survives its own draft",
    environments: ["node"],
  },
  async (ctx) => {
    for (const depth of [0, 3, RECOGNISED_DEPTH]) {
      const outcome = await survivesItsOwnDraft(nestedOption(depth));
      ctx.log.note("an option at a depth a draft recognises", { depth, ...outcome });

      // The control at every depth: the choice is legitimate while the user is holding it, so what
      // the restore asserts is the round trip rather than the guard refusing it all along.
      expectClaim(outcome.acceptedWhenChosen === true, {
        claimIds: ["PER-003"],
        what: `an option nested ${depth} deep was refused before anything was saved`,
      });

      expectClaim(outcome.acceptedWhenRestored === true, {
        claimIds: ["PER-003"],
        what: `an option nested ${depth} deep did not survive its own draft`,
        detail: JSON.stringify(outcome),
      });
    }
  },
);

battle(
  {
    claims: ["PER-003"],
    title: "the bound is where it is recorded to be",
    environments: ["node"],
  },
  async (ctx) => {
    // Past the bound the comparison stops walking and answers "different", so a restored draft
    // refuses the user's own choice. This is the recorded cost of comparing members rather than
    // identity, and pinning it here is what makes moving the bound visible in either direction:
    // raising it turns this assertion, lowering it turns the battle above.
    const beyond = await survivesItsOwnDraft(nestedOption(RECOGNISED_DEPTH + 1));
    ctx.log.note("an option nested past the bound", { depth: RECOGNISED_DEPTH + 1, ...beyond });

    expectClaim(beyond.acceptedWhenChosen === true, {
      claimIds: ["PER-003"],
      what: "an option past the bound was refused while the user was holding it, which is a wider failure than the bound",
      detail: JSON.stringify(beyond),
    });

    expectClaim(beyond.acceptedWhenRestored === false, {
      claimIds: ["PER-003"],
      what: "an option past the recorded bound now survives its draft, so the bound has moved",
      detail: JSON.stringify(beyond),
    });
  },
);
