/**
 * Two factories for receiving what the engine has to say, and no way to hand one over.
 *
 * `createConsoleDiagnostics` and `createSilentDiagnostics` are published, and so are the codes a
 * report would carry: `MDY_SCOPE_DESTROYED`, `MDY_UNSUPPORTED_ADAPTER_OPTION`,
 * `MDY_SSR_SNAPSHOT_MISMATCH`, `MDY_ASYNC_FEATURE_DISABLED`, `MDY_EFFECTS_UNAVAILABLE`. A consumer
 * reading that surface has every reason to build a sink, name the codes they care about, and wait.
 *
 * Nothing takes the sink. `createForm` reads `submitMode`, `reactivity`, `validators`, `history`,
 * `draft`, `security`, `autoActivate` and `devWarnings` — it says so itself when handed anything
 * else — and `diagnostics` is not among them. The only published option that accepts one belongs to
 * a single adapter's reactivity.
 *
 * What the engine has to say to everyone else it says to the console, which is not a thing an
 * application can route, filter by code, or send anywhere.
 *
 * The control matters here more than usual: a sink handed to something that ignores it is silent for
 * the same reason an engine with nothing to report is silent, and a battle that cannot tell those
 * apart proves nothing. So the provocation is one the engine *does* speak about — an option it does
 * not read — and the sink is asked whether it heard the thing the console did.
 */

import {
  createConsoleDiagnostics,
  createForm,
  createSilentDiagnostics,
  field,
} from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

/** Run `work`, keeping whatever the engine says to the console while it happens. */
async function whatItSaid(work) {
  const said = [];
  const realWarn = console.warn;
  const realError = console.error;
  console.warn = (...parts) => said.push(parts.join(" "));
  console.error = (...parts) => said.push(parts.join(" "));
  try {
    await work();
  } finally {
    console.warn = realWarn;
    console.error = realError;
  }
  return said;
}

battle(
  {
    claims: ["REA-002", "API-001"],
    title: "a sink built from the published factories can be given to a form",
    environments: ["node"],
  },
  async (ctx) => {
    // The factories work: one keeps quiet, the other prints. Both are published for a consumer to
    // choose between, which is the evidence that receiving reports was meant to be possible.
    const quiet = createSilentDiagnostics();
    const loud = createConsoleDiagnostics();

    const heard = await whatItSaid(async () => {
      quiet.report({ code: "MDY_TEST", severity: "error", message: "this must not be printed" });
      loud.report({ code: "MDY_TEST", severity: "error", message: "this must be printed" });
    });

    expectClaim(!heard.some((line) => line.includes("must not be printed")) && heard.some((line) => line.includes("must be printed")), {
      claimIds: ["REA-002"],
      what: "the published sinks do not behave as their names say, so nothing below is measurable",
      detail: JSON.stringify(heard),
    });

    // A provocation the engine does speak about, so silence from a sink is the sink and not the
    // absence of anything to report.
    const reports = [];
    const sink = { report: (entry) => reports.push(entry) };

    const spokenToTheConsole = await whatItSaid(async () => {
      const form = createForm({ x: field("v") }, { diagnostics: sink, devWarnings: true });
      form.destroy();
    });
    ctx.log.note("what the engine said, and to whom", {
      console: spokenToTheConsole,
      sink: reports.map((each) => each.code ?? String(each)),
    });

    // The control: it did have something to say, and it said it out loud.
    expectClaim(spokenToTheConsole.length > 0, {
      claimIds: ["API-001"],
      what: "the engine said nothing at all, so a silent sink means nothing",
      detail: JSON.stringify(spokenToTheConsole),
    });

    // And the sink, handed to the only constructor a consumer has, heard none of it.
    expectClaim(reports.length > 0, {
      claimIds: ["REA-002", "API-001"],
      what: "a form was given a sink built from the published factories and reported nothing to it, so the codes it publishes cannot reach an application",
      detail: JSON.stringify({ console: spokenToTheConsole, sink: reports }),
    });
  },
);

battle(
  {
    claims: ["API-001"],
    title: "an option a form does not read is named back to whoever passed it",
    environments: ["node"],
  },
  async (ctx) => {
    // Not a finding — a good behaviour worth keeping, and the reason the battle above can tell a
    // deaf sink from a quiet engine. A form says which options it read and which it did not.
    const said = await whatItSaid(async () => {
      createForm({ x: field("v") }, { devWarnings: true, wombat: true }).destroy();
    });
    ctx.log.note("what a form says about an option it does not read", { said });

    expectEqual(said.length > 0 && said.some((line) => line.includes("wombat")), true, {
      claimIds: ["API-001"],
      what: "a form took an option it does not read without saying so",
      detail: JSON.stringify(said),
    });
  },
);
