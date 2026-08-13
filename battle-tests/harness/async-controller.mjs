/**
 * Async validators whose completion the attack chooses.
 *
 * The interesting orders are the ones a real server produces rarely and a test never produces by
 * accident: the newest run answering first, the oldest answering last with an error, an answer
 * arriving for a row that has since been removed. A validator that resolves on its own schedule
 * cannot be put into those orders, so these do not resolve until told.
 *
 * Every run is observable — started, aborted, settled — because "no survivors after teardown" is a
 * claim about runs, and a claim about runs needs runs that can be counted.
 */

export function createAsyncValidatorController({ log = null } = {}) {
  /** @type {Map<string, {runs: Array<Run>}>} */
  const byPath = new Map();
  let nextRunId = 1;

  const slotFor = (path) => {
    let slot = byPath.get(path);
    if (!slot) {
      slot = { runs: [] };
      byPath.set(path, slot);
    }
    return slot;
  };

  const controller = {
    /**
     * The validator to hand to a field. Each invocation registers a run and hands back a promise
     * the test settles later; a superseded run is marked aborted by the engine's own signal.
     */
    validatorFor(path) {
      const slot = slotFor(path);
      return (value, ctx) => {
        const run = {
          id: nextRunId++,
          path,
          value,
          startedAt: Date.now(),
          aborted: false,
          settled: null,
          resolve: null,
          reject: null,
        };
        const promise = new Promise((resolve, reject) => {
          run.resolve = resolve;
          run.reject = reject;
        });
        ctx.signal.addEventListener("abort", () => {
          run.aborted = true;
        });
        slot.runs.push(run);
        log?.asyncRunStarted();
        log?.note("async-run-started", { path, run: run.id });
        return promise;
      };
    },

    /** Every run ever started for a path, oldest first. */
    runs(path) {
      return [...slotFor(path).runs];
    },

    /** Runs that have neither settled nor been superseded. */
    activeRuns(path = null) {
      const paths = path === null ? [...byPath.keys()] : [path];
      return paths.flatMap((each) => slotFor(each).runs.filter((run) => run.settled === null));
    },

    /** How many runs are still outstanding anywhere — the number a canonical snapshot carries. */
    activeRunCount() {
      return controller.activeRuns().length;
    },

    /**
     * Settle one run by its ordinal for that path (1 is the first run started).
     *
     * Ordinal rather than identity so a test can say "the older run answers last" without holding
     * the run object, and so a report can replay the same decision from data.
     */
    resolveRun(path, ordinal, errors = []) {
      const run = runAt(path, ordinal);
      run.settled = { kind: "resolved", errors };
      run.resolve(errors);
      log?.note("async-run-resolved", { path, run: run.id, errors });
      return run;
    },

    rejectRun(path, ordinal, message = "async failure") {
      const run = runAt(path, ordinal);
      run.settled = { kind: "rejected", message };
      run.reject(new Error(message));
      log?.note("async-run-rejected", { path, run: run.id, message });
      return run;
    },

    /** Settle everything outstanding — the teardown check needs a state with nothing in flight. */
    resolveAll(errors = []) {
      for (const run of controller.activeRuns()) {
        run.settled = { kind: "resolved", errors };
        run.resolve(errors);
      }
    },

    /** What survived: outstanding runs that were never aborted, by path. */
    survivors() {
      return controller
        .activeRuns()
        .filter((run) => !run.aborted)
        .map((run) => ({ path: run.path, run: run.id }));
    },
  };

  function runAt(path, ordinal) {
    const runs = slotFor(path).runs;
    const run = runs[ordinal - 1];
    if (!run) {
      throw new Error(
        `no async run ${ordinal} for ${path}; ${runs.length} run(s) started — the attack expected a ` +
          `validator to be running and it was not`,
      );
    }
    if (run.settled !== null) throw new Error(`async run ${ordinal} for ${path} already settled`);
    return run;
  }

  return controller;
}
