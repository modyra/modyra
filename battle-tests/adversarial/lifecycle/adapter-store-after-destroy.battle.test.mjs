/**
 * A binding that keeps notifying after the form it belongs to is gone.
 *
 * `LIF-001` says destroy leaves no observable reactive work, and names an effect firing afterwards
 * as the break. Every attack on it so far has watched the engine, which is the half that cannot
 * leak: the thing that subscribes is an adapter's binding, and no battle had ever held one.
 *
 * `@modyra/react`'s field store is the shape a `useSyncExternalStore` consumer holds. It exposes its
 * own `destroy`, and that works — the question is what the *form's* destroy owes a binding made
 * from one of its handles, because a component does not always get to run its cleanup first. A
 * store still notifying after the form ended re-renders a component against a form that is gone.
 */

import { createForm, field, group, record } from "@modyra/core";
import { createFieldStore, reactReactivity } from "@modyra/react";

import { battle } from "../../harness/battle.mjs";
import { expectClaim } from "../../harness/assertions.mjs";

const settled = () => new Promise((resolve) => setTimeout(resolve, 0));

function subscribedStore(cell) {
  const store = createFieldStore(cell);
  const state = { notifications: 0 };
  store.subscribe(() => {
    state.notifications += 1;
  });
  return { store, state };
}

battle(
  {
    claims: ["LIF-001"],
    title: "a field store stops notifying when the form that owns its handle is destroyed",
    environments: ["node"],
  },
  async (ctx) => {
    const form = createForm({ rows: record(group({ code: field("") })) }, {
      reactivity: reactReactivity(),
      devWarnings: false,
    });
    form.f.rows.upsert("a", { code: "A" });
    const cell = form.f.rows.cell("a", "code");
    const { store, state } = subscribedStore(cell);
    ctx.log.note("a react field store subscribed to a row's cell", {});

    cell.set("B");
    await settled();

    // The control: the store is really subscribed, so what follows is about the destroy rather than
    // about a subscription that never worked.
    expectClaim(state.notifications > 0, {
      claimIds: ["LIF-001"],
      what: "the store notified while the form was alive",
      detail: `${state.notifications} notification(s)`,
    });

    const beforeDestroy = state.notifications;
    form.destroy();
    await settled();

    // The engine answers a write after destroy rather than raising — that is its own documented
    // behaviour — so the write goes through and the question is who hears about it.
    cell.set("written after the form was destroyed");
    await settled();

    expectClaim(state.notifications === beforeDestroy, {
      claimIds: ["LIF-001"],
      what: "a store subscribed to a destroyed form's handle still notifies its subscriber",
      detail: `${state.notifications - beforeDestroy} notification(s) after destroy`,
    });

    store.destroy();
  },
);

battle(
  {
    claims: ["LIF-001"],
    title: "a field store that tore itself down stops notifying",
    environments: ["node"],
  },
  async (ctx) => {
    const form = createForm({ rows: record(group({ code: field("") })) }, {
      reactivity: reactReactivity(),
      devWarnings: false,
    });
    form.f.rows.upsert("a", { code: "A" });
    const cell = form.f.rows.cell("a", "code");
    const { store, state } = subscribedStore(cell);
    ctx.log.note("a react field store about to tear itself down", {});

    cell.set("B");
    await settled();
    expectClaim(state.notifications > 0, {
      claimIds: ["LIF-001"],
      what: "the store notified while it was subscribed",
      detail: `${state.notifications} notification(s)`,
    });

    // The positive control for the battle above: the documented teardown does silence it, so a
    // failure there is about which teardown was used rather than about stores never stopping.
    const beforeTeardown = state.notifications;
    store.destroy();
    cell.set("written after the store tore itself down");
    await settled();

    expectClaim(state.notifications === beforeTeardown, {
      claimIds: ["LIF-001"],
      what: "a store that destroyed itself still notifies",
      detail: `${state.notifications - beforeTeardown} notification(s) after teardown`,
    });

    form.destroy();
  },
);
