/**
 * A row nobody declared, and a form that says it is ready to send it.
 *
 * A draft is written flat — one entry per leaf path — and read back the same way. `lines.x.sku` is a
 * cell of row `x`, and the row is recreated from the path. That is what makes a draft able to restore
 * a collection at all.
 *
 * It also means the path is the instruction. `draftShapeMatches` guards the *value* against the
 * field's initial, and the security guide is explicit that a draft lives where every script on the
 * origin can write it — so one extra segment in a key is the whole attack:
 *
 *     lines.a.b.sku
 *
 * There is no row `a`, and no `b` inside a row. Both are made. What comes back is a row the document
 * never described, holding an object where the schema has a string.
 *
 * The layering that is supposed to catch this is recorded in `draft-shape-gate.battle.test.mjs`: the
 * gate is permissive on purpose because *the shape alone invalidates*, so `canSubmit` is false and a
 * consumer following the contract cannot send it. That is the part which does not happen here. The
 * form reports itself valid, submittable, and free of errors — and then neither way of sending it
 * works: `submitValue()` refuses by name, and `submit()` fails with a `TypeError` from inside.
 *
 * Both are asserted, because they are different promises. A form that cannot be submitted must say so
 * before it is asked, and a published read must answer for any state the engine let itself reach.
 */

import { buildDynamicFormSchema, createForm } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

/** Storage this battle owns, so nothing depends on an environment having one. */
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
const restored = () => new Promise((resolve) => setTimeout(resolve, 120));

const document = {
  node: "group",
  children: {
    lines: {
      node: "record",
      item: { node: "group", children: { sku: { node: "field", field: { kind: "text", label: "S" } } } },
    },
  },
};

battle(
  {
    claims: ["PER-001", "COL-002"],
    severity: "S1",
    title: "a draft cannot add a row the document never declared",
    environments: ["node"],
  },
  async (ctx) => {
    const storage = memoryStorage();
    const sent = [];
    const open = () => createForm(buildDynamicFormSchema(document), {
      draft: { key: "k", storage },
      devWarnings: false,
    });

    // An honest draft first, written by the engine itself, so what follows is the engine's own
    // envelope with one key added rather than a shape this battle invented.
    const honest = open();
    honest.f.lines.upsert("x", { sku: "S1" });
    await saved();
    const envelope = JSON.parse(storage.written.get("k"));
    honest.destroy();

    expectClaim(Object.hasOwn(envelope.value, "lines.x.sku"), {
      claimIds: ["PER-001"],
      what: "the engine's own draft does not carry a row as a flat path, so the attack below is not the one this battle describes",
      detail: JSON.stringify(envelope.value),
    });

    // One extra segment, in a place a value gate cannot see: the key, not the value.
    envelope.value["lines.a.b.sku"] = "OWNED";
    storage.written.set("k", JSON.stringify(envelope));

    const form = open();
    await restored();
    ctx.log.note("what came back from a draft with one key added", {
      keys: [...form.f.lines.keys()],
      value: form.getValue(),
      valid: form.state.valid(),
      canSubmit: form.state.canSubmit(),
    });

    // Everything is measured before anything is asserted: the first failure is the cause and the
    // other two are what it costs, and a report carrying one of the three is worth less than a
    // report carrying all of them.
    const submittable = form.state.canSubmit();
    let readFailed = null;
    try {
      form.submitValue();
    } catch (error) {
      readFailed = String(error.message);
    }
    let sendFailed = null;
    try {
      // The handler belongs to `submit`, not to `createForm` — a form takes no `onSubmit`, and
      // passing one there is an option it does not read.
      await form.submit((value) => { sent.push(value); });
    } catch (error) {
      sendFailed = `${error.constructor.name}: ${error.message}`;
    }
    const whole = {
      keys: [...form.f.lines.keys()],
      valid: form.state.valid(),
      canSubmit: submittable,
      errors: form.errorsFor("lines")().map((each) => each.message),
      readFailed,
      sendFailed,
      onSubmitCalled: sent.length,
    };
    ctx.log.note("the whole state a draft left behind", whole);

    // The row itself.
    expectEqual(whole.keys, ["x"], {
      claimIds: ["COL-002", "PER-001"],
      what: "a draft added a row the document never declared",
      detail: JSON.stringify(whole),
    });

    expectClaim(!(submittable && readFailed !== null), {
      claimIds: ["PER-001"],
      what: "the form reports itself submittable and reading what it would submit throws",
      detail: JSON.stringify({ canSubmit: submittable, readFailed }),
    });

    expectClaim(sendFailed === null, {
      claimIds: ["PER-001"],
      what: "submitting a form restored from a draft threw",
      detail: String(sendFailed),
    });

    form.destroy();
  },
);
