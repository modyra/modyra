/**
 * Data a consumer hands over that does not behave like data.
 *
 * `hostile-paths` attacks the names external data arrives under. This attacks the values: a row
 * built from a server response, a snapshot, a store, an ORM entity. None of those is guaranteed to
 * be a plain object, and each way it is not is a way a collection can be left describing something
 * it does not hold.
 *
 * The invariants are the ones a caller cannot check for themselves: their object is not mutated and
 * not kept, a trap is not walked into a loop, an accessor that raises does not leave a row
 * half-declared, and a row reads the object it was given — prototype chain included, per ADR 0045 —
 * without letting a name the schema never declared become a cell.
 */

import { array, createForm, field, group, record } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

const ROW = { code: field(""), note: field("n") };

const keyedForm = () => createForm({ rows: record(group({ ...ROW })) }, { devWarnings: false });
const positionalForm = () => createForm({ items: array(group({ ...ROW })) }, { devWarnings: false });

/** A row whose first cell raises when it is read — an ORM entity behind a lazy association. */
const withThrowingGetter = () => ({
  get code() {
    throw new Error("this column was not loaded");
  },
  note: "kept",
});

battle(
  {
    claims: ["SEC-001", "COL-001"],
    title: "a row built from an object that is not plain data is read as data and nothing else",
    environments: ["node"],
  },
  async (ctx) => {
    // Frozen: a caller who froze their snapshot must not have it written to, and must not be
    // refused for freezing it.
    const frozen = Object.freeze({ code: "F" });
    const onFrozen = keyedForm();
    onFrozen.f.rows.upsert("a", frozen);
    ctx.log.note("a frozen object handed over as a row", {});

    expectEqual(onFrozen.getValue().rows.a, { code: "F", note: "n" }, {
      claimIds: ["COL-001"],
      what: "a frozen row is read, and the cells it omits take the template's",
    });

    expectEqual(frozen, { code: "F" }, {
      claimIds: ["SEC-001"],
      what: "the caller's frozen object was written to",
    });
    onFrozen.destroy();

    // A row reads the object it was given, prototype chain included — ADR 0045. A class instance or
    // an ORM entity keeps cells on its prototype, a computed column or a getter over a loaded
    // association, and a row built from one has to see them. The safety of that rests on where
    // untrusted shapes actually arrive: documents, drafts and patches are filtered to the paths the
    // schema declares, and those doors are `hostile-paths`'s subject.
    //
    // This was measured and left unasserted until the decision existed. It is asserted now.
    const inherited = Object.create({ note: "from the prototype" });
    inherited.code = "P";
    const onInherited = keyedForm();
    onInherited.f.rows.upsert("a", inherited);
    ctx.log.note("a row whose prototype carries a cell name", {
      read: onInherited.getValue().rows.a.note,
    });

    expectEqual(onInherited.getValue().rows.a, { code: "P", note: "from the prototype" }, {
      claimIds: ["COL-001", "SEC-001"],
      what: "a row did not read the cell its object inherits",
    });

    // And it is still the row the template describes: an inherited name the schema never declared
    // may not become a cell, which is the half that would make the chain an injection point.
    const stranger = Object.create({ note: "n", undeclared: "should not be a cell" });
    stranger.code = "S";
    const onStranger = keyedForm();
    onStranger.f.rows.upsert("b", stranger);

    expectEqual(Object.keys(onStranger.getValue().rows.b).sort(), ["code", "note"], {
      claimIds: ["SEC-001", "COL-001"],
      what: "a name the prototype carries and the schema does not became a cell",
      detail: JSON.stringify(onStranger.getValue().rows.b),
    });
    onInherited.destroy();
    onStranger.destroy();

    // A proxy is data with opinions. What matters is that it is read a bounded number of times: a
    // collection that walked it repeatedly would hang on a trap that never returns.
    let traps = 0;
    const proxied = new Proxy({ code: "X" }, {
      get(target, key) {
        traps += 1;
        if (traps > 1000) throw new Error("the collection walked the proxy without bound");
        return target[key];
      },
    });
    const onProxy = keyedForm();
    onProxy.f.rows.upsert("a", proxied);
    ctx.log.note("a row behind a proxy", { traps });

    expectEqual(onProxy.getValue().rows.a, { code: "X", note: "n" }, {
      claimIds: ["SEC-001"],
      what: "a proxied row is read like any other",
    });

    expectClaim(traps < 50, {
      claimIds: ["SEC-001"],
      what: "the collection read the proxy a bounded number of times",
      detail: `${traps} trap call(s)`,
    });
    onProxy.destroy();

    // One object, two forms. A collection that kept the reference would let an edit in one form
    // appear in the other, and in the caller's own object.
    const shared = { code: "S" };
    const first = keyedForm();
    const second = keyedForm();
    first.f.rows.upsert("a", shared);
    second.f.rows.upsert("a", shared);
    first.f.rows.cell("a", "code").set("edited in the first form");
    ctx.log.note("one object declared into two forms", {});

    expectEqual(second.getValue().rows.a, { code: "S", note: "n" }, {
      claimIds: ["SEC-001"],
      what: "editing one form changed a row declared from the same object in another",
    });

    expectEqual(shared, { code: "S" }, {
      claimIds: ["SEC-001"],
      what: "the caller's object was written to by a form it was handed to",
    });
    first.destroy();
    second.destroy();
  },
);

battle(
  {
    claims: ["COL-001", "SEC-001", "COL-008"],
    title: "a row whose value raises while it is read is not left half-declared",
    environments: ["node"],
  },
  async (ctx) => {
    const form = keyedForm();
    form.f.rows.upsert("ok", { code: "OK" });

    let raised = null;
    try {
      form.f.rows.upsert("bad", withThrowingGetter());
    } catch (error) {
      raised = error;
    }
    ctx.log.note("a row declared from an object whose accessor raised", { raised: raised?.message });

    // The control: the read really did raise, so what follows is about the aftermath rather than
    // about an object that turned out to be ordinary.
    expectClaim(raised !== null, {
      claimIds: ["COL-001"],
      what: "the accessor raised while the row was being declared",
    });

    // The collection must not describe a row it does not hold. A consumer iterating `keys()` and
    // reading each one out of `getValue()` finds a hole: the key is there and the row is not.
    const keys = [...form.f.rows.keys()];
    const value = form.getValue().rows;
    const holes = keys.filter((key) => value[key] === undefined);

    expectClaim(holes.length === 0, {
      claimIds: ["COL-001", "SEC-001"],
      what: "a key survived the failed declaration with no row behind it",
      detail: `keys ${JSON.stringify(keys)}, value has ${JSON.stringify(Object.keys(value))}`,
    });

    expectEqual(form.submitValue().rows, value, {
      claimIds: ["COL-008"],
      what: "what a submit carries disagrees with what the form holds",
    });

    form.destroy();
  },
);

battle(
  {
    claims: ["COL-001", "SEC-001"],
    title: "a positional row whose value raises does not lengthen the list",
    environments: ["node"],
  },
  async (ctx) => {
    const form = positionalForm();
    form.f.items.push({ code: "OK" });

    let raised = null;
    try {
      form.f.items.push(withThrowingGetter());
    } catch (error) {
      raised = error;
    }
    ctx.log.note("a row pushed from an object whose accessor raised", { raised: raised?.message });

    expectClaim(raised !== null, {
      claimIds: ["COL-001"],
      what: "the accessor raised while the row was being pushed",
    });

    // `length()` and the value are the same statement about how many rows there are, made twice.
    expectEqual(form.f.items.length(), form.getValue().items.length, {
      claimIds: ["COL-001", "SEC-001"],
      what: "the list counts a row its value does not contain",
    });

    form.destroy();
  },
);
