/**
 * Three forms the way an application actually drives them.
 *
 * Every other battle isolates one promise. These do not: they run a whole flow end to end and check
 * the promises together, because a contract can hold in isolation and still fail where two of its
 * rules meet. An invoice is edited and reordered and submitted; an inventory is scrolled through a
 * window that mounts and releases as it goes; a registration waits on a server that answers late and
 * out of order.
 *
 * A scenario is not a smoke test. Each one ends by asserting exactly what the flow was supposed to
 * produce — the payload a server would receive — rather than that nothing raised along the way.
 */

import { battle } from "../harness/battle.mjs";
import { expectClaim, expectEqual } from "../harness/assertions.mjs";
import { KEYED_ROWS_SPEC, NESTED_ORDERS_SPEC, POSITIONAL_ROWS_SPEC } from "../models/schemas.mjs";

battle(
  {
    claims: ["COL-001", "COL-002", "COL-007", "VAL-002", "SUB-001", "SUB-002"],
    title: "a keyed invoice survives being edited, renamed, corrected and submitted",
    environments: ["node"],
    requires: ["structural", "mountedPhases", "observations"],
  },
  async (ctx) => {
    const invoice = ctx.open(NESTED_ORDERS_SPEC);

    // The clerk opens an order that came from the server, with two lines already on it.
    await invoice.execute({
      type: "record.upsert",
      path: "orders",
      key: "INV-1001",
      value: {
        ref: "Acme Ltd",
        lines: [
          { sku: "WIDGET-A", allocations: [{ bin: "A1", qty: "4" }] },
          { sku: "WIDGET-B", allocations: [{ bin: "B2", qty: "1" }, { bin: "B3", qty: "2" }] },
        ],
      },
    });

    // They bind the cells they can see, correct a line, and reorder to put the larger one first.
    await invoice.execute({ type: "mount", paths: ["orders.INV-1001.lines.0.sku", "orders.INV-1001.lines.1.sku"] });
    await invoice.execute({ type: "field.set", path: "orders.INV-1001.lines.0.allocations.0.qty", value: "5" });
    await invoice.execute({ type: "array.move", path: "orders.INV-1001.lines", from: 1, to: 0 });

    // Then the order number turns out to be wrong, and accounting renumbers it.
    await invoice.execute({ type: "record.rename", path: "orders", from: "INV-1001", to: "INV-1002" });

    // One cell is not the clerk's to send: it is shown, and excluded from the payload.
    await invoice.execute({ type: "field.disable", path: "orders.INV-1002.ref" });
    await invoice.scheduler.flush();

    const finished = invoice.observe("the invoice as the clerk leaves it");
    const submitted = invoice.form.submitValue().orders;

    // The control: the flow has to have left one invoice with two lines, or the payload assertions
    // below are about a form the sequence emptied.
    expectClaim(finished.collections[0].keys.length === 1, {
      claimIds: ["COL-001"],
      what: "the flow left exactly the one invoice it opened",
      detail: JSON.stringify(finished.collections[0].keys),
    });

    expectEqual(Object.keys(submitted), ["INV-1002"], {
      claimIds: ["COL-007"],
      what: "the renumbered invoice is submitted under its new number and no other",
    });

    expectEqual(submitted["INV-1002"].lines, [
      { sku: "WIDGET-B", allocations: [{ bin: "B2", qty: "1" }, { bin: "B3", qty: "2" }] },
      { sku: "WIDGET-A", allocations: [{ bin: "A1", qty: "5" }] },
    ], {
      claimIds: ["COL-002", "SUB-002"],
      what: "the reordered lines carry their own allocations and the correction that was typed",
    });

    expectClaim(!("ref" in submitted["INV-1002"]), {
      claimIds: ["VAL-002"],
      what: "the disabled cell is excluded from what is sent",
      detail: JSON.stringify(submitted["INV-1002"]),
    });

    // And it is still in the form, because disabled is not deleted.
    expectEqual(invoice.form.getValue().orders["INV-1002"].ref, "Acme Ltd", {
      claimIds: ["VAL-002"],
      what: "the disabled cell is kept in the form the clerk is looking at",
    });
  },
);

battle(
  {
    claims: ["COL-001", "COL-003", "LIF-002", "SUB-001"],
    title: "a virtual inventory list means the same thing however far it has been scrolled",
    environments: ["node"],
    requires: ["structural", "mountedPhases", "unmountedPhases", "observations"],
  },
  async (ctx) => {
    const scrolled = ctx.open(POSITIONAL_ROWS_SPEC);
    const whole = ctx.open(POSITIONAL_ROWS_SPEC);

    const stock = Array.from({ length: 12 }, (_, index) => ({
      code: `SKU-${String(index).padStart(3, "0")}`,
      note: index % 3 === 0 ? "reorder" : "",
    }));

    for (const context of [scrolled, whole]) {
      await context.execute({ type: "array.setAll", path: "items", value: stock });
    }

    // The virtualised one binds a three-row window and drags it down the list, releasing behind it.
    for (let top = 0; top + 3 <= stock.length; top += 3) {
      const window = [0, 1, 2].map((offset) => `items.${top + offset}.code`);
      await scrolled.execute({ type: "mount", paths: window });
      await scrolled.execute({ type: "field.set", path: `items.${top}.note`, value: "counted" });
      await scrolled.execute({ type: "unmount", paths: window });
    }

    // The other one never renders anything and receives the same edits.
    for (let top = 0; top + 3 <= stock.length; top += 3) {
      await whole.execute({ type: "field.set", path: `items.${top}.note`, value: "counted" });
    }

    await scrolled.scheduler.flush();
    await whole.scheduler.flush();

    scrolled.observe("after the window walked the whole list");
    whole.observe("never rendered at all");
    const afterScrolling = scrolled.form.submitValue().items;
    const neverRendered = whole.form.submitValue().items;

    expectEqual(afterScrolling.length, 12, {
      claimIds: ["COL-001"],
      what: "scrolling neither added nor dropped a row",
    });

    expectEqual(afterScrolling, neverRendered, {
      claimIds: ["COL-003", "LIF-002", "SUB-001"],
      what: "what the list submits depends on how far it was scrolled",
    });

    // The control: the walk really did change the data, so the comparison is not between two
    // untouched lists.
    expectClaim(afterScrolling.filter((row) => row.note === "counted").length === 4, {
      claimIds: ["COL-001"],
      what: "the walk edited one row per window",
      detail: JSON.stringify(afterScrolling.map((row) => row.note)),
    });
  },
);

battle(
  {
    claims: ["VAL-001", "VAL-003", "COL-005", "SUB-001"],
    title: "a registration whose server answers late and out of order still submits the truth",
    environments: ["node"],
    requires: ["structural", "observations", "asyncStarted"],
  },
  async (ctx) => {
    const signup = ctx.open(KEYED_ROWS_SPEC);

    // Two applicants are entered. Each has a cell the server has to check.
    await signup.execute({ type: "record.upsert", path: "rows", key: "ada", value: { code: "ADA-1" } });
    await signup.execute({ type: "record.upsert", path: "rows", key: "grace", value: { code: "GRA-1" } });
    await signup.scheduler.flush();

    // The first applicant's code is corrected while the server is still checking the old one.
    await signup.execute({ type: "field.set", path: "rows.ada.tax", value: "OLD" });
    await signup.scheduler.flush();
    const stale = signup.asyncValidators.runs("rows.ada.tax").length;

    await signup.execute({ type: "field.set", path: "rows.ada.tax", value: "CORRECTED" });
    await signup.scheduler.flush();
    const current = signup.asyncValidators.runs("rows.ada.tax").length;

    expectClaim(current > stale, {
      claimIds: ["VAL-001"],
      what: "correcting the cell started a second check",
      detail: `${stale} then ${current}`,
    });

    // The second applicant withdraws while their own check is in flight.
    await signup.execute({ type: "record.remove", path: "rows", key: "grace" });
    await signup.scheduler.flush();

    // Now the server answers everything at once, in the worst order: the withdrawn applicant first,
    // then the superseded check with a rejection, then the one that actually applies.
    await signup.execute({ type: "async.resolve", token: "rows.grace.tax", ordinal: 1, result: ["withdrawn applicant rejected"] });
    await signup.execute({ type: "async.resolve", token: "rows.ada.tax", ordinal: stale, result: ["the code you already corrected is invalid"] });
    await signup.execute({ type: "async.resolve", token: "rows.ada.tax", ordinal: current, result: [] });
    await signup.scheduler.flush();

    const state = signup.observe("every answer in, worst order first");

    expectEqual(state.errors, [], {
      claimIds: ["VAL-001", "COL-005"],
      what: "an answer about a withdrawn applicant or a corrected code became the verdict",
    });

    expectEqual(Object.keys(signup.form.submitValue().rows), ["ada"], {
      claimIds: ["COL-005", "SUB-001"],
      what: "the withdrawn applicant is submitted, or the remaining one is not",
    });

    expectClaim(!state.pending, {
      claimIds: ["VAL-001"],
      what: "the form is still waiting after every answer arrived",
      detail: JSON.stringify(signup.asyncValidators.activeRuns().map((run) => run.path)),
    });
  },
);
