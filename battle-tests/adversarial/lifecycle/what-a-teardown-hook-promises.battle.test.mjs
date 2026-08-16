/**
 * The hook a consumer hangs their cleanup on, and the four ways it could let them down.
 *
 * `onDestroy` is on the published form surface and had no battle. It is where a consumer unsubscribes
 * a socket, cancels a request, releases a lock — work that is not undone by anything else, so a hook
 * that fires twice does it twice, one that never fires leaks, and one that stops at the first failure
 * silently drops everybody who registered after the consumer whose cleanup was buggy.
 *
 * Four properties, each a different way it could fail:
 *
 *   - it fires, and **once**, however many times `destroy()` is called — teardown is not idempotent
 *     for the consumer even when it is for the engine;
 *   - a callback that throws does not take the others with it — one consumer's bad cleanup is not
 *     another consumer's leak;
 *   - a callback registered after the form is already gone still runs, rather than being dropped or
 *     throwing at the registrant;
 *   - the callback can still read the value the form held, which is the only moment it exists —
 *     a cleanup that reports what was abandoned needs it.
 *
 * All four hold. What the last assertion records rather than demands is the silence: a callback that
 * throws is isolated and nothing is said about it, on any channel, so a consumer whose cleanup is
 * broken finds out from its consequences.
 */

import { createForm, field } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

battle(
  {
    claims: ["API-001"],
    title: "a teardown hook fires once, in full, and while the value is still there",
    environments: ["node"],
  },
  async (ctx) => {
    // Fires, and once, however many times destroy is called.
    const once = createForm({ a: field("x") }, { devWarnings: false });
    let calls = 0;
    once.onDestroy(() => { calls += 1; });
    once.destroy();
    once.destroy();
    ctx.log.note("a hook under two destroys", { calls });

    expectEqual(calls, 1, {
      claimIds: ["API-001"],
      what: "a teardown hook did not fire exactly once across two destroys",
    });

    // One callback throwing does not take the others with it.
    const isolated = createForm({ a: field("x") }, { devWarnings: false });
    const ran = [];
    const said = [];
    isolated.onDestroy(() => { ran.push("first"); });
    isolated.onDestroy(() => { throw new Error("this consumer's cleanup is broken"); });
    isolated.onDestroy(() => { ran.push("third"); });

    const realWarn = console.warn;
    const realError = console.error;
    console.warn = (...parts) => said.push(parts.join(" "));
    console.error = (...parts) => said.push(parts.join(" "));
    let threw = null;
    try {
      isolated.destroy();
    } catch (error) {
      threw = error.constructor.name;
    } finally {
      console.warn = realWarn;
      console.error = realError;
    }
    ctx.log.note("a hook where one callback throws", { ran, threw, said });

    expectEqual(ran, ["first", "third"], {
      claimIds: ["API-001"],
      what: "a callback that threw took another consumer's cleanup with it",
    });

    expectEqual(threw, null, {
      claimIds: ["API-001"],
      what: "destroy() raised a consumer's cleanup failure at whoever called it",
    });

    // A late registrant still gets its cleanup rather than being dropped.
    const late = createForm({ a: field("x") }, { devWarnings: false });
    late.destroy();
    let lateCalls = 0;
    let lateThrew = null;
    try {
      late.onDestroy(() => { lateCalls += 1; });
    } catch (error) {
      lateThrew = error.constructor.name;
    }
    ctx.log.note("registering after the form is gone", { lateCalls, lateThrew });

    expectClaim(lateThrew === null && lateCalls === 1, {
      claimIds: ["API-001"],
      what: "a callback registered after destroy was dropped or raised at the registrant",
      detail: () => JSON.stringify({ lateCalls, lateThrew }),
    });

    // And the value is still readable, which is the only moment it is.
    const holding = createForm({ a: field("x") }, { devWarnings: false });
    holding.f.a.set("what the person left");
    let seen = null;
    holding.onDestroy(() => { seen = holding.getValue(); });
    holding.destroy();
    ctx.log.note("what the callback could read", { seen });

    expectEqual(seen, { a: "what the person left" }, {
      claimIds: ["API-001"],
      what: "a teardown callback could not read the value the form was holding",
    });
  },
);
