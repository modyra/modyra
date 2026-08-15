/**
 * A draft that names a position, and a list that grows to reach it.
 *
 * A keyed collection now checks a restored path against what a row declares, so `lines.a.b.sku` no
 * longer invents a row. A positional one has nothing to check: index 5 of a list of strings names a
 * cell the row template really does declare — the row is simply not there yet, and the list grows
 * until it is.
 *
 * That is the right behaviour for a draft the engine wrote, which is why this is not "arrays should
 * refuse to grow". It is that the number in the path is taken from storage the security guide
 * describes as writable by every script on the origin, and nothing bounds it. A list of one comes
 * back as a list of six, and the five in between are padding nobody typed.
 *
 * The cost is not linear. Measured in a child process, restoring one tampered entry:
 *
 *     tags.5        list of 6        153ms
 *     tags.5000     list of 5001     243ms
 *     tags.50000    list of 50001   5119ms
 *     tags.200000   the process died, over 30s
 *
 * So the same door that adds five empty strings adds four billion if the number says so, and the form
 * never opens. This battle asserts the small case because it is deterministic and quick; the shape is
 * the same one all the way up.
 */

import { buildDynamicFormSchema, createForm } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

function memoryStorage() {
  const written = new Map();
  return {
    written,
    read: (key) => written.get(key) ?? null,
    write: (key, value) => written.set(key, value),
    remove: (key) => written.delete(key),
  };
}

const saved = () => new Promise((resolve) => setTimeout(resolve, 700));
const restored = () => new Promise((resolve) => setTimeout(resolve, 150));

const document = {
  node: "group",
  children: {
    tags: { node: "array", item: { node: "field", field: { kind: "text", label: "T" } } },
  },
};

battle(
  {
    claims: ["PER-001", "COL-001"],
    severity: "S1",
    title: "a draft does not grow a list to reach a position it names",
    environments: ["node"],
  },
  async (ctx) => {
    const storage = memoryStorage();
    const open = () => createForm(buildDynamicFormSchema(document), {
      draft: { key: "k", storage },
      devWarnings: false,
    });

    // The engine's own draft, so the envelope below is its shape with one entry added rather than
    // one this battle invented.
    const honest = open();
    honest.f.tags.push("t");
    await saved();
    const envelope = JSON.parse(storage.written.get("k"));
    honest.destroy();

    // The control: restored untouched, the list comes back as it was. A restore that dropped
    // everything would pass the assertion below for the wrong reason.
    const untouched = open();
    await restored();
    ctx.log.note("the honest draft, restored", { length: untouched.f.tags.length(), value: untouched.getValue() });

    expectEqual(untouched.getValue().tags, ["t"], {
      claimIds: ["PER-001"],
      what: "an untouched draft did not come back as it was saved, so nothing below is a measurement",
    });
    untouched.destroy();

    // One entry, naming a position past the end.
    envelope.value["tags.5"] = "X";
    storage.written.set("k", JSON.stringify(envelope));

    const form = open();
    await restored();
    const value = form.getValue().tags;
    ctx.log.note("the same draft with one position added", { length: form.f.tags.length(), value });

    expectEqual(value, ["t"], {
      claimIds: ["PER-001", "COL-001"],
      what: `a draft naming position 5 left a list of ${form.f.tags.length()}: ${JSON.stringify(value)}`,
    });

    // And whatever is decided about the growth, the form has to remain usable: a list padded with
    // entries nobody typed is one a consumer reads and sends.
    expectClaim(form.state.canSubmit() === false || value.length === 1, {
      claimIds: ["PER-001"],
      what: "a list a draft padded is submittable, so the padding reaches whoever receives the form",
      detail: JSON.stringify({ canSubmit: form.state.canSubmit(), submitted: form.submitValue() }),
    });

    form.destroy();
  },
);
