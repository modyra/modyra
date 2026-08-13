/**
 * How a battle is declared and what it owes.
 *
 * `battle()` is the only entry point for an adversarial test. It exists to make four things
 * impossible to forget:
 *
 *   - naming the public claim under attack, so a break can be triaged by what it broke;
 *   - recording the seed and the operations, so the break can be replayed;
 *   - noticing that the attack ran at all, so a test cannot pass by exercising nothing;
 *   - writing the failure down as an artefact rather than as a stack trace.
 *
 * The wrapper never asserts anything about Modyra itself. What it asserts about is the battle.
 */

import test from "node:test";

import { claimsFor, worstSeverity } from "../models/claims.mjs";
import { assertSeverity } from "../models/severity.mjs";
import { createBattleContext } from "./context.mjs";
import { createOperationLog, assertExercised } from "./operation-log.mjs";
import { createRng, resolveSeed } from "./seed.mjs";
import { createScheduler } from "./scheduler.mjs";
import { describeEnvironment } from "./environment.mjs";
import { buildReport, formatSummary, writeReport } from "./reporting.mjs";

/**
 * @param meta.claims       Claim ids under attack. At least one, all registered.
 * @param meta.title        What the attack tries to make happen.
 * @param meta.severity     Optional override; defaults to the worst severity among the claims.
 * @param meta.environments Where this attack is meaningful; declared for the CI tiers.
 * @param meta.requires     Counters that must be positive for the battle to count as executed
 *                          (`structural`, `mountedPhases`, `unmountedPhases`, `observations`,
 *                          `asyncStarted`) — `actions` is always required.
 */
export function battle(meta, attack) {
  const claims = claimsFor(meta.claims);
  const severity = meta.severity ? assertSeverity(meta.severity) : worstSeverity(meta.claims);
  const name = `[${severity}][${meta.claims.join(",")}] ${meta.title}`;

  return test(name, { concurrency: false }, async (t) => {
    const seed = resolveSeed();
    const log = createOperationLog();
    const scheduler = createScheduler();
    const environment = describeEnvironment();
    const consoleOutput = [];
    const attachments = {};
    const contexts = [];
    const restoreConsole = captureConsole(consoleOutput);

    const ctx = {
      t,
      seed,
      rng: createRng(seed),
      log,
      scheduler,
      environment,
      claims,
      claimIds: [...meta.claims],

      /** Diagnostics the library emitted during this battle, in order. */
      diagnostics: () => consoleOutput.map((entry) => entry.text),

      /** Open a form from a schema spec; it is disposed when the battle ends, pass or fail. */
      open(spec, formOptions = {}) {
        const context = createBattleContext({
          spec,
          formOptions,
          log,
          scheduler,
          diagnostics: () => consoleOutput.map((entry) => entry.text),
        });
        contexts.push(context);
        return context;
      },

      /** Extra evidence to carry into the report. */
      attach(key, value) {
        attachments[key] = value;
      },
    };

    let failure = null;
    try {
      await attack(ctx);
      assertExercised(log, meta.requires ?? []);
    } catch (error) {
      failure = error;
    } finally {
      for (const context of contexts) {
        try {
          await context.dispose();
        } catch (disposeError) {
          // A teardown that throws is itself a finding, but never the one that hides the attack's.
          if (!failure) failure = disposeError;
        }
      }
      scheduler.restore();
      restoreConsole();
    }

    if (!failure) return;

    const report = buildReport({
      claimIds: [...meta.claims],
      severity,
      seed,
      environment,
      schema: contexts[0]?.spec ?? attachments.schema ?? null,
      operations: log.operations(),
      minimizedOperations: attachments.minimizedOperations ?? [],
      expected: failure.expectedState ?? null,
      actual: failure.actualState ?? null,
      divergence: failure.divergence ?? null,
      diagnostics: consoleOutput.map((entry) => entry.text),
      consoleOutput,
      message: failure.message,
      counts: log.counts(),
    });
    const file = writeReport(report);

    failure.message = [
      failure.message,
      "",
      formatSummary(report),
      `Report: ${file}`,
      ...(log.lines().length > 0 ? ["Operations:", ...log.lines().map((line) => `  ${line}`)] : []),
    ].join("\n");
    throw failure;
  });
}

/**
 * Diagnostics are evidence, so they are collected rather than silenced — and they still reach the
 * terminal, because a battle that hides a warning it did not assert on is hiding a finding.
 */
function captureConsole(sink) {
  const real = { warn: console.warn, error: console.error };
  for (const level of ["warn", "error"]) {
    console[level] = (...args) => {
      sink.push({ level, text: args.map(String).join(" ") });
      real[level](...args);
    };
  }
  return () => Object.assign(console, real);
}
