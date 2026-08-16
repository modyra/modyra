/**
 * A value the panel cannot print, and the way it stops instead of saying so.
 *
 * `@modyra/core/serialize` exists for exactly this class of value. Its own header says why: a native
 * `File` has no enumerable own properties, so it stringifies to `{}` — *"a payload or a devtools
 * panel showing an empty object where the user picked a document"* — and a value that refers back to
 * itself is *"described rather than walked: a cycle is a mistake to report rather than a stack to
 * exhaust."* Both are handled, by description: `[File: note.txt (5 bytes)]`, `[Circular]`.
 *
 * A `BigInt` is the same class of value and is not. `JSON.stringify` refuses it outright, and the
 * serializer refuses it the same way — so `mdyFormSnapshot`, which is what the devtools panel reads,
 * throws `TypeError: Do not know how to serialize a BigInt` for a form holding one.
 *
 * A form can hold one. The engine reports a wrong shape as a verdict rather than refusing the write —
 * which is what lets a field show what a person typed and say why it is wrong — so
 * `field.set(10n)` is a value the model carries and the panel then dies on. The panel is the thing a
 * developer opens *because* something is wrong.
 *
 * The controls come first and matter: the serializer must still describe the two values it was
 * written for, and the same form with an ordinary number must snapshot cleanly. Without them a throw
 * here would say nothing about `BigInt`.
 */

import { createForm, field } from "@modyra/core";
import { mdyFormSnapshot } from "@modyra/core/devtools";
import { mdyFormSerialize } from "@modyra/core/serialize";

import { battle } from "../../harness/battle.mjs";
import { expectClaim } from "../../harness/assertions.mjs";

const attempt = (run) => {
  try {
    return { ok: true, value: run() };
  } catch (error) {
    return { ok: false, error: `${error.constructor.name}: ${String(error.message).slice(0, 80)}` };
  }
};

battle(
  {
    claims: ["API-001"],
    title: "the panel describes a value it cannot print, the way it describes the others",
    environments: ["node"],
  },
  async (ctx) => {
    // The control: the two values this serializer was written for are described rather than dropped
    // or thrown on. If either stopped, a failure below would be about the serializer as a whole.
    const cyclic = { a: 1 };
    cyclic.self = cyclic;
    const described = attempt(() => JSON.stringify(mdyFormSerialize({
      doc: new File(["hello"], "note.txt", { type: "text/plain" }),
      loop: cyclic,
    })));
    ctx.log.note("the values the serializer exists for", described);

    expectClaim(described.ok && described.value.includes("[File:") && described.value.includes("[Circular]"), {
      claimIds: ["API-001"],
      what: "the serializer no longer describes a File or a cycle, so this battle is not about one value",
      detail: () => JSON.stringify(described),
    });

    // The second control: an ordinary form snapshots, so what fails below is the value and not the
    // panel.
    const ordinary = createForm({ n: field(1) }, { devWarnings: false });
    const before = attempt(() => JSON.stringify(mdyFormSnapshot(ordinary)));
    expectClaim(before.ok, {
      claimIds: ["API-001"],
      what: "a form holding an ordinary number could not be snapshotted at all",
      detail: () => JSON.stringify(before),
    });

    // And the value a form can hold and the panel cannot print. The engine reports a wrong shape as
    // a verdict rather than refusing the write, so this is a state a model reaches.
    ordinary.f.n.set(10n);
    ctx.log.note("what the model holds now", { type: typeof ordinary.getValue().n });

    const after = attempt(() => JSON.stringify(mdyFormSnapshot(ordinary)));
    ctx.log.note("what the panel did with it", after);

    expectClaim(after.ok, {
      claimIds: ["API-001"],
      what: "a form holding a BigInt stopped the devtools panel instead of being described",
      detail: () => JSON.stringify(after),
    });

    ordinary.destroy();
  },
);
