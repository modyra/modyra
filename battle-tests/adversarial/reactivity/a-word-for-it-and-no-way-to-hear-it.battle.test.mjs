/**
 * A vocabulary for saying what went wrong, and a condition that says it the old way.
 *
 * The diagnostics module states its own purpose: structured diagnostics that *replace ad-hoc
 * `console.warn()` calls so a consumer can route adapter-degradation events to their own logging or
 * telemetry*. It names three examples of such an event — a missing injector, an **unsupported
 * option**, a disabled async feature — and publishes seven codes described as emitted by core and
 * the reference adapters.
 *
 * `createSilentDiagnostics` exists because a library talking to the console is the thing a consumer
 * wants to stop. A message that goes to the console anyway is one that sink cannot silence and no
 * telemetry can see.
 *
 * `observerFor` is the pattern, and the control here: given a sink it reports through it with the
 * code, and given none it falls back to the console. Both halves are asserted, so a failure below is
 * about the condition that has no such route rather than about diagnostics never working.
 *
 * The condition that has none is the second of the three the header names. An option `createForm`
 * does not read is detected — it is not a silent case — and said straight to the console, with no
 * code, no severity and no sink to route it to: `createForm` takes no diagnostics at all.
 */

import {
  MDY_CROSS_RUNTIME_OBSERVATION,
  createForm,
  createSilentDiagnostics,
  field,
  observerFor,
  vanillaReactivity,
} from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

/** Run something with the console captured, and give back whatever it said. */
function whileListening(run) {
  const said = [];
  const realWarn = console.warn;
  const realError = console.error;
  console.warn = (...parts) => said.push(parts.join(" "));
  console.error = (...parts) => said.push(parts.join(" "));
  try {
    run();
  } finally {
    console.warn = realWarn;
    console.error = realError;
  }
  return said;
}

battle(
  {
    claims: ["REA-003", "REA-002"],
    title: "a sink hears the condition that has a route to it",
    environments: ["node"],
  },
  async (ctx) => {
    const form = createForm({ x: field("v") }, { devWarnings: false });
    const handle = form.f.x;
    const other = vanillaReactivity();

    const reported = [];
    const sink = { report: (diagnostic) => reported.push(diagnostic) };

    const withSink = whileListening(() => observerFor(handle, other, sink));
    ctx.log.note("a cross-runtime observation, with somewhere to report it", {
      reported: reported.map((each) => each.code),
      console: withSink.length,
    });

    expectEqual(reported.map((each) => each.code), [MDY_CROSS_RUNTIME_OBSERVATION], {
      claimIds: ["REA-003"],
      what: "the sink did not receive the code for a condition the vocabulary names",
    });

    expectClaim(reported[0]?.severity !== undefined && typeof reported[0]?.message === "string", {
      claimIds: ["REA-003"],
      what: "the diagnostic reached the sink without a severity or a message",
      detail: JSON.stringify(reported[0]),
    });

    // And the fallback, so the pattern is asserted whole: without a sink it goes to the console
    // rather than nowhere.
    const withoutSink = whileListening(() => observerFor(handle, other));
    expectClaim(withoutSink.length === 1, {
      claimIds: ["REA-003"],
      what: "the same condition said nothing at all when no sink was installed",
      detail: JSON.stringify(withoutSink),
    });

    form.destroy();
  },
);

battle(
  {
    claims: ["REA-003"],
    title: "the condition the vocabulary names second is said to the console and nowhere else",
    open: "reported, not enforced: finding 157, open in battle-tests/reports/open-findings.md",
    environments: ["node"],
  },
  async (ctx) => {
    // The premise: this is a detected condition, not a silent one. An option a form does not read is
    // noticed and said out loud.
    const said = whileListening(() => {
      const form = createForm({ x: field("v") }, { anOptionNoFormReads: true });
      form.destroy();
    });
    ctx.log.note("what a form says about an option it does not read", { said });

    expectClaim(said.some((line) => line.includes("anOptionNoFormReads")), {
      claimIds: ["REA-003"],
      what: "an option no form reads went unnoticed, so there is no diagnostic to route",
      detail: JSON.stringify(said),
    });

    // And there is nowhere for it to go instead. A sink is an argument to `observerFor`, never a
    // form's own; handing one to `createForm` is itself an option it does not read, which is the
    // shape of the gap rather than a workaround being used wrongly.
    const quiet = createSilentDiagnostics();
    const stillSaid = whileListening(() => {
      const form = createForm({ x: field("v") }, { diagnostics: quiet, anOptionNoFormReads: true });
      form.destroy();
    });

    expectEqual(stillSaid.filter((line) => line.includes("anOptionNoFormReads")), [], {
      claimIds: ["REA-003"],
      what: "a condition the vocabulary names is said only to the console, with no code and no sink that could take it",
      detail: JSON.stringify(stillSaid),
    });
  },
);
