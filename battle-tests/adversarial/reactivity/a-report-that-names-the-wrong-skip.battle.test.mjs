/**
 * The ledger names *which* check a declaration bought out, not merely that one was bought.
 *
 * A suite that skips what an adapter cannot do is right to skip it, and the ledger exists so a green
 * run cannot hide how much of it never ran. But a ledger is a report, and a report is only worth the
 * checks nobody has ever seen fail: one that answered "something was skipped" for every input would
 * satisfy a test asking whether anything was skipped, and would say nothing about which.
 *
 * Three properties, and each is the one a wrong report would break first:
 *
 *   which     turning off exactly one capability names the checks that capability gates, and the
 *             names change when a different capability is turned off. A report keyed to "some flag
 *             is false" passes the count and fails this.
 *   how many  a second capability turned off buys out strictly more than the first alone. A ledger
 *             that recorded one entry per run — or per adapter — is monotone in nothing, and this is
 *             where that shows.
 *   the other way   a capability declared true and honoured appears nowhere among the skips. This is
 *             the dangerous direction: a check quietly skipped while the declaration says the
 *             runtime can do it reads as proven, and the whole point of the ledger is that it
 *             cannot. The count alone cannot see it, because it is a skip that should not be there
 *             rather than one that is missing.
 *
 * The adapter is vanilla with its capabilities overridden, which is deliberate: an invented runtime
 * that claims what it cannot do makes the suite *fail* rather than skip — that is the suite working
 * — and a failing adapter measures nothing about skipping.
 *
 * Claims under attack: REA-004.
 */
import assert from "node:assert/strict";

import { vanillaReactivity } from "@modyra/core";
import {
  reactivityContractLedger,
  resetReactivityContractLedger,
  runReactivityContractTests,
} from "@modyra/core/testing";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

/** Vanilla's own declaration, the honest baseline every probe below varies one key from. */
const HONEST = vanillaReactivity().capabilities;

/**
 * Run the suite against an adapter whose capabilities are ours, and read what it recorded.
 *
 * The bodies have to run: skips are recorded where they happen, so a ledger read without running
 * them reports every check as performed — the very claim it exists to refute.
 */
function skipsUnder(capabilities) {
  resetReactivityContractLedger();
  const bodies = [];
  runReactivityContractTests(
    (_title, fn) => bodies.push(fn),
    assert,
    "probe",
    () => {
      const reactivity = vanillaReactivity();
      const scope = reactivity.createScope({ debugName: "probe" });
      return {
        reactivity: {
          ...reactivity,
          capabilities,
          effect: (fn, options) => reactivity.effect(fn, { ...options, scope: options?.scope ?? scope }),
        },
        flushIfSupported: () => Promise.resolve(),
        destroy: () => scope.destroy(),
      };
    },
  );
  return { bodies, ledger: () => reactivityContractLedger() };
}

battle(
  {
    claims: ["REA-004"],
    title: "the ledger names which declaration bought a check out, not that one was bought",
    environments: ["node"],
  },
  async (ctx) => {
    const honest = skipsUnder(HONEST);
    for (const body of honest.bodies) await body();
    const baseline = honest.ledger();

    // The premise: this is the real suite and not a stub of it. A ledger over three checks would
    // satisfy everything below and mean nothing.
    expectClaim(baseline.registered.length >= 10, {
      claimIds: ["REA-004"],
      what: `the suite registered ${baseline.registered.length} checks, too few to be the real one`,
    });

    // **The other way, and the direction that matters.** Vanilla declares what it can do and does it,
    // so a check bought out here is a check skipped while its declaration says otherwise — which
    // reads as proven and is the failure the ledger exists to make impossible.
    //
    // A reason may name more than one declaration — *"capabilities.computedEquality or
    // capabilities.effects is not true"* — and then one false among them is enough to buy the check
    // out honestly. Reading such a reason as a culprit because it *mentions* a capability that is
    // true was this probe's first answer, and it accused a skip that vanilla is entitled to: it
    // declares `computedEquality: false`. So the charge only stands when every declaration the
    // reason names is true, which is the only shape under which nothing justifies the skip.
    const named = (because) => [...because.matchAll(/capabilities\.([A-Za-z]+)/g)].map((hit) => hit[1]);
    const boughtOutWhileCapable = baseline.skipped
      .filter((skip) => {
        const keys = named(skip.because);
        return keys.length > 0 && keys.every((key) => HONEST[key] === true);
      });
    expectClaim(boughtOutWhileCapable.length === 0, {
      claimIds: ["REA-004"],
      what: "a check was skipped naming a capability its adapter declares true: "
        + boughtOutWhileCapable.map((skip) => `${skip.check} — ${skip.because}`).join(" · "),
    });

    ctx.log.note("the honest adapter", {
      registered: baseline.registered.length,
      skipped: baseline.skipped.length,
      because: baseline.skipped.map((skip) => skip.because),
    });

    // **Which.** One capability off at a time, and the report must name that one — not merely record
    // that something went unperformed.
    const seen = new Map();
    for (const key of ["pureComputeds", "batching", "signalEquality", "computedEquality"]) {
      if (HONEST[key] !== true) continue;
      const probe = skipsUnder({ ...HONEST, [key]: false });
      for (const body of probe.bodies) await body();
      const skips = probe.ledger().skipped;

      const named = skips.filter((skip) => skip.because.includes(`capabilities.${key}`));
      expectClaim(named.length > 0, {
        claimIds: ["REA-004"],
        what: `turning off capabilities.${key} bought a check out and the ledger never named it: `
          + `${skips.map((skip) => skip.because).join(" · ") || "(nothing skipped at all)"}`,
      });
      seen.set(key, { total: skips.length, named: named.length });

      // Every skip this probe records beyond the honest baseline must be attributable to the one key
      // that changed. A report that widens under any change is a report that does not read the key.
      const strays = skips
        .filter((skip) => !baseline.skipped.some((was) => was.check === skip.check))
        .filter((skip) => !skip.because.includes(`capabilities.${key}`));
      expectClaim(strays.length === 0, {
        claimIds: ["REA-004"],
        what: `turning off capabilities.${key} also bought out checks it does not gate: `
          + strays.map((skip) => `${skip.check} — ${skip.because}`).join(" · "),
      });
    }

    ctx.log.note("one capability at a time", Object.fromEntries(seen));

    // **How many.** Two off buys out strictly more than either alone: a ledger keyed to the run, or
    // to the adapter, is flat here whatever the input.
    //
    // Stated with its own limit: of the three properties here, this is the one no planted defect has
    // been seen to break on its own. Three were tried in the ledger — a fixed reason, a plausible
    // fixed reason, and one entry kept per adapter — and *which* caught all three first, because it
    // is the stronger question and fails earlier. So this is a cheap guard on the count rather than
    // a check demonstrated to catch something the others miss, and that is what it should be read as.
    const [first, second] = [...seen.keys()];
    expectClaim(first !== undefined && second !== undefined, {
      claimIds: ["REA-004"],
      what: "fewer than two capabilities were true, so nothing here compared two against one",
    });
    const both = skipsUnder({ ...HONEST, [first]: false, [second]: false });
    for (const body of both.bodies) await body();
    const together = both.ledger().skipped.length;

    ctx.log.note("two capabilities off", {
      [first]: seen.get(first).total, [second]: seen.get(second).total, together,
    });
    expectClaim(together > Math.max(seen.get(first).total, seen.get(second).total), {
      claimIds: ["REA-004"],
      what: `${first} and ${second} together bought out ${together}, no more than either alone `
        + `(${seen.get(first).total} and ${seen.get(second).total}) — the count does not read the keys`,
    });

    // And the registration is unmoved by any of it: what is asked is fixed, what runs is not.
    expectEqual(both.ledger().registered.length, baseline.registered.length, {
      claimIds: ["REA-004"],
      what: "the suite registered a different number of checks once capabilities changed, so the "
        + "ledger counts what ran rather than what was asked",
    });
  },
);
