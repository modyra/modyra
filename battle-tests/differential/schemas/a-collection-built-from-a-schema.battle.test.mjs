/**
 * The same collection, built from a schema and from a document.
 *
 * A schema bridge is judged on flat fields everywhere in this suite, and a flat field is the case
 * where the two routes cannot differ much. A keyed record and a positional array are where they can:
 * identity, ordering, and where a finding lands are all decisions, and each route takes them
 * separately.
 *
 * Three questions, and they are different in kind.
 *
 * Whether a schema's record becomes a **collection** at all, or a leaf holding an object — because a
 * leaf holding an object has no row identity, and every promise about keys surviving a rename is
 * about something that does not exist there.
 *
 * Whether the two routes then *agree* under the operations that move rows around.
 *
 * And where the schema's own rules land. A rule written on a row's cell has to attach to that row's
 * cell — `lines.a.sku`, not the collection, and not the form. That is the claim about findings
 * reaching the fields they name, asked where the path has to be built rather than read.
 *
 * What the two routes are *allowed* to differ on is asserted too: a schema carries constraints a
 * document never declared, so the schema-built form is invalid where the document-built one is not.
 * That difference is the bridge working, and pinning it keeps a future "make them agree" from
 * quietly deleting it.
 */

import { z } from "zod";

import { createZodForm } from "@modyra/zod";
import { buildDynamicFormSchema, createForm } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

const settled = () => new Promise((resolve) => setTimeout(resolve, 80));

/** The same shape, said twice: once as a schema, once as a document. */
const fromSchema = () => createZodForm(z.object({
  lines: z.record(z.string(), z.object({ sku: z.string() })),
  tags: z.array(z.string()),
}), {});

const fromDocument = () => createForm(buildDynamicFormSchema({
  node: "group",
  children: {
    lines: {
      node: "record",
      item: { node: "group", children: { sku: { node: "field", field: { kind: "text", label: "S" } } } },
    },
    tags: { node: "array", item: { node: "field", field: { kind: "text", label: "T" } } },
  },
}), { devWarnings: false });

/** Everything both routes must answer the same way. */
const observe = (form) => ({
  value: form.getValue(),
  submitted: form.submitValue(),
  keys: [...form.f.lines.keys()],
  length: form.f.tags.length(),
});

battle(
  {
    claims: ["DYN-001", "COL-002"],
    title: "a schema's record is a collection, and moves like the one a document builds",
    environments: ["node"],
  },
  async (ctx) => {
    const schemaForm = fromSchema();
    const documentForm = fromDocument();

    // The first question: a collection, not a leaf holding an object. Asked by what the handle
    // offers, because that is what every other promise about rows is written against.
    const wanted = ["keys", "row", "cell", "upsert", "remove", "rename", "setAll"];
    const offered = Object.keys(schemaForm.f.lines);
    ctx.log.note("what a schema-built record offers", { offered });

    for (const method of wanted) {
      expectClaim(offered.includes(method), {
        claimIds: ["COL-002"],
        what: `a record built from a schema has no ${method}, so it is not a keyed collection`,
        detail: JSON.stringify(offered),
      });
    }

    expectEqual(Object.keys(schemaForm.f.lines).sort(), Object.keys(documentForm.f.lines).sort(), {
      claimIds: ["DYN-001"],
      what: "the two routes hand out different record handles",
    });

    expectEqual(Object.keys(schemaForm.f.tags).sort(), Object.keys(documentForm.f.tags).sort(), {
      claimIds: ["DYN-001"],
      what: "the two routes hand out different array handles",
    });

    // The second question: the same sequence, compared after every step rather than at the end, so a
    // divergence is attributed to the operation that caused it.
    const sequence = [
      ["upsert a", (form) => form.f.lines.upsert("a", { sku: "S1" })],
      ["upsert b", (form) => form.f.lines.upsert("b", { sku: "S2" })],
      ["rename a to z", (form) => form.f.lines.rename("a", "z")],
      ["push a tag", (form) => form.f.tags.push("t1")],
      ["push another", (form) => form.f.tags.push("t2")],
      ["move the first tag last", (form) => form.f.tags.move(0, 1)],
      ["remove b", (form) => form.f.lines.remove("b")],
      ["set every row at once", (form) => form.f.lines.setAll({ q: { sku: "S9" } })],
    ];

    for (const [what, apply] of sequence) {
      apply(schemaForm);
      apply(documentForm);
      await settled();

      const fromOne = observe(schemaForm);
      const fromOther = observe(documentForm);
      ctx.log.note("after one operation", { what, fromOne });

      expectEqual(fromOne, fromOther, {
        claimIds: ["DYN-001", "COL-002"],
        what: `the two routes disagree after "${what}"`,
      });
    }

    schemaForm.destroy?.();
    documentForm.destroy();
  },
);

battle(
  {
    claims: ["SCH-001"],
    title: "a rule a schema writes on a row's cell lands on that row's cell",
    environments: ["node"],
  },
  async (ctx) => {
    const form = createZodForm(z.object({
      lines: z.record(z.string(), z.object({ sku: z.string().min(2) })),
    }), {});

    form.f.lines.upsert("a", { sku: "" });
    await settled();

    const onTheCell = form.errorsFor("lines.a.sku")().map((each) => each.message);
    ctx.log.note("where the schema's rule landed", { onTheCell, valid: form.state.valid() });

    expectClaim(onTheCell.length > 0, {
      claimIds: ["SCH-001"],
      what: "a rule written on a row's cell did not reach that cell",
      detail: JSON.stringify({ onTheCell, form: form.errorsFor("lines")().map((each) => each.message) }),
    });

    expectClaim(form.state.valid() === false, {
      claimIds: ["SCH-001"],
      what: "a row that breaks the schema left the form valid",
    });

    // And it lifts when the row satisfies it, so the finding is about the value rather than about a
    // rule that fires whatever the row holds.
    form.f.lines.cell("a", "sku").set("XYZ");
    await settled();

    expectEqual(form.errorsFor("lines.a.sku")(), [], {
      claimIds: ["SCH-001"],
      what: "a row that satisfies the schema still carries the finding",
    });

    expectClaim(form.state.valid() === true, {
      claimIds: ["SCH-001"],
      what: "a form whose only row satisfies the schema is still invalid",
    });

    // The difference the two routes are allowed to have, pinned so that making them agree would have
    // to be a decision rather than a side effect: the document declares no such rule, and is valid
    // for the same row.
    const documentForm = fromDocument();
    documentForm.f.lines.upsert("a", { sku: "" });
    await settled();

    expectClaim(documentForm.state.valid() === true, {
      claimIds: ["SCH-001"],
      what: "the document route enforces a rule only the schema declared",
      detail: JSON.stringify(documentForm.errorsFor("lines.a.sku")()),
    });

    form.destroy?.();
    documentForm.destroy();
  },
);

battle(
  {
    claims: ["SEC-001", "COL-002", "DYN-001"],
    title: "a key a record cannot have is refused the same way whichever route built it",
    environments: ["node"],
  },
  async (ctx) => {
    // Row keys are the one part of a collection that comes from outside — an id from a fetch, a
    // filename, whatever the domain calls a row. Both routes have to answer the same way, because a
    // consumer choosing a schema over a document is not choosing a security posture.
    const schemaForm = fromSchema();
    const documentForm = fromDocument();

    const refused = ["__proto__", "constructor", "prototype", "", "a.b"];
    const accepted = ["0", "toString"];

    for (const key of [...refused, ...accepted]) {
      // Ignored rather than thrown: a hostile key in a batch must not take the batch down with it.
      schemaForm.f.lines.upsert(key, { sku: "S" });
      documentForm.f.lines.upsert(key, { sku: "S" });
    }
    await settled();

    const fromOne = [...schemaForm.f.lines.keys()].sort();
    const fromOther = [...documentForm.f.lines.keys()].sort();
    ctx.log.note("what survived a hostile batch of keys", { fromOne, fromOther });

    expectEqual(fromOne, accepted.slice().sort(), {
      claimIds: ["SEC-001", "COL-002"],
      what: "a schema-built record kept a key it cannot have, or lost one it can",
    });

    expectEqual(fromOne, fromOther, {
      claimIds: ["DYN-001"],
      what: "the two routes disagree about which keys a record may have",
    });

    expectClaim(Object.getPrototypeOf({}) === Object.prototype, {
      claimIds: ["SEC-001"],
      what: "the prototype was touched by a key naming it",
    });

    // The control: the keys that were accepted really are usable rows rather than names in a list.
    for (const key of accepted) {
      expectEqual(schemaForm.f.lines.cell(key, "sku").value(), "S", {
        claimIds: ["COL-002"],
        what: `the row under ${JSON.stringify(key)} does not hold what it was given`,
      });
    }

    schemaForm.destroy?.();
    documentForm.destroy();
  },
);
