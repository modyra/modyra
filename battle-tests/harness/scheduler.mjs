/**
 * Time the test decides.
 *
 * Async battles are about ordering: a validator that resolves after its row was removed, a debounce
 * that fires after the form was destroyed, a timeout that races a resolution. A `sleep` long enough
 * to make those orders likely is both slow and a coin toss, so the suite drives the clock instead
 * and asserts on an observable condition rather than on elapsed time.
 *
 * Only the global timer functions are replaced. Anything holding its own reference to
 * `node:timers` — the test runner included — keeps real time, so a battle that hangs still fails.
 */

const REAL = Object.freeze({
  setTimeout: globalThis.setTimeout,
  clearTimeout: globalThis.clearTimeout,
  setInterval: globalThis.setInterval,
  clearInterval: globalThis.clearInterval,
  setImmediate: globalThis.setImmediate,
});

export function createScheduler() {
  /** @type {Map<number, {due: number, fn: Function, args: unknown[], every: number | null}>} */
  const timers = new Map();
  let installed = false;
  let clock = 0;
  let nextId = 1;

  const schedule = (fn, delay, args, every) => {
    const id = nextId++;
    timers.set(id, { due: clock + Math.max(0, Number(delay) || 0), fn, args, every });
    // Node hands back an object with `unref`; anything that calls it must keep working.
    return Object.assign(Object.create({ unref: () => id, ref: () => id }), { id });
  };
  const cancel = (handle) => {
    const id = typeof handle === "object" && handle !== null ? handle.id : handle;
    timers.delete(id);
  };

  const due = () => {
    let earliest = null;
    for (const [id, timer] of timers) {
      if (earliest === null || timer.due < earliest.timer.due || (timer.due === earliest.timer.due && id < earliest.id)) {
        earliest = { id, timer };
      }
    }
    return earliest;
  };

  return {
    install() {
      if (installed) return;
      installed = true;
      globalThis.setTimeout = (fn, delay, ...args) => schedule(fn, delay, args, null);
      globalThis.clearTimeout = cancel;
      globalThis.setInterval = (fn, delay, ...args) => schedule(fn, delay, args, Math.max(1, Number(delay) || 1));
      globalThis.clearInterval = cancel;
    },
    restore() {
      if (!installed) return;
      installed = false;
      Object.assign(globalThis, REAL);
      timers.clear();
    },
    now: () => clock,
    pending: () => timers.size,

    /** Let every already-queued microtask and promise continuation run. */
    async flush(rounds = 3) {
      for (let round = 0; round < rounds; round += 1) {
        await new Promise((resolve) => REAL.setImmediate(resolve));
      }
    },

    /** Move the clock forward, running what falls due, flushing microtasks between callbacks. */
    async advance(ms) {
      const target = clock + Math.max(0, ms);
      for (;;) {
        const next = due();
        if (!next || next.timer.due > target) break;
        timers.delete(next.id);
        clock = next.timer.due;
        if (next.timer.every !== null) {
          timers.set(next.id, { ...next.timer, due: clock + next.timer.every });
        }
        next.timer.fn(...next.timer.args);
        await this.flush(1);
      }
      clock = target;
      await this.flush();
    },

    /**
     * Run every timer until none is left. `limit` is a guard against a self-rescheduling timer, and
     * exceeding it is a finding rather than a hang.
     */
    async runAll(limit = 1000) {
      for (let step = 0; step < limit; step += 1) {
        const next = due();
        if (!next) {
          await this.flush();
          return;
        }
        await this.advance(Math.max(0, next.timer.due - clock));
      }
      throw new Error(`scheduler.runAll exceeded ${limit} timers — a timer is rescheduling itself`);
    },
  };
}
