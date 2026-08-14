/**
 * Data a consumer hands over that does not behave like data.
 *
 * `hostile-paths` attacks the names external data arrives under. This attacks the values: a row
 * built from a server response, a snapshot, a store, an ORM entity. None of those is guaranteed to
 * be a plain object, and each way it is not is a way a collection can be left describing something
 * it does not hold.
 *
 * The invariants are the ones a caller cannot check for themselves: their object is not mutated and
 * not kept, a trap is not walked into a loop, and — the one that breaks — an accessor that raises
 * does not leave a row half-declared. Whether a property the caller's prototype carries counts as
 * the row's data is measured here and deliberately not asserted; the reason is at the call site.
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

    // A property the caller's prototype carries is read as the row's data — measured, and left
    // unasserted on purpose. A class instance or an ORM entity legitimately keeps its cells on a
    // prototype, so reading the chain is a defensible contract; an attacker-supplied base makes it
    // an injection point. Nothing public states which, so a battle that pinned either answer would
    // be inventing the contract rather than attacking it. What *is* asserted is that the row is
    // still a row: whatever it read, it read into the shape the template describes.
    const inherited = Object.create({ note: "from the prototype" });
    inherited.code = "P";
    const onInherited = keyedForm();
    onInherited.f.rows.upsert("a", inherited);
    ctx.log.note("a row whose prototype carries a cell name", {
      read: onInherited.getValue().rows.a.note,
    });

    expectEqual(Object.keys(onInherited.getValue().rows.a).sort(), ["code", "note"], {
      claimIds: ["COL-001"],
      what: "the row has the cells the template describes and no others",
    });
    onInherited.destroy();

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
