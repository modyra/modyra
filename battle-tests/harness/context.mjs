/**
 * One form under attack, and the single interpreter that acts on it.
 *
 * Hand-written battles, generated campaigns and the replay command all go through
 * `executeOperation`. A second execution path would mean a replay that reproduces the harness
 * rather than the failure, and a shrinker minimising a sequence nobody else runs.
 *
 * The context owns nothing private: it holds the form, the collection handles named by the schema
 * spec, which paths a mount strategy currently claims, and the async runs the test controls.
 */

import { createForm } from "@modyra/core";

import { buildSchema } from "../models/schemas.mjs";
import { canonicalObservation } from "./canonical-snapshot.mjs";
import { createAsyncValidatorController } from "./async-controller.mjs";
import { createOperationLog } from "./operation-log.mjs";
import { createScheduler } from "./scheduler.mjs";

/** Operations whose execution is a wait by definition, and so cannot happen "now". */
const ASYNC_ONLY = new Set(["flush", "async.resolve", "async.reject", "draft.save", "draft.restore"]);

export function createBattleContext({
  spec,
  formOptions = {},
  log = createOperationLog(),
  scheduler = createScheduler(),
  diagnostics = () => [],
} = {}) {
  const asyncValidators = createAsyncValidatorController({ log });
  const { schema, collectionPaths } = buildSchema(spec, {
    asyncFor: (path) => [asyncValidators.validatorFor(path)],
  });
  const form = createForm(schema, formOptions);

  // A collection inside a row is reachable only through a key that does not exist yet, so the
  // schema spec names it with a wildcard — `orders.*.lines`. Only the collections a handle can be
  // resolved for at construction are held here; a nested one is reached the way a consumer reaches
  // it, through its parent's `row(key)`.
  const collections = {};
  for (const path of collectionPaths) {
    if (path.includes("*")) continue;
    collections[path] = resolveHandle(form, path);
  }

  const mounted = new Set();
  const disabledSignals = new Map();
  let consumedDiagnostics = 0;
  let lastObservation = null;

  const context = {
    spec,
    formOptions,
    form,
    log,
    scheduler,
    asyncValidators,
    collections,
    collectionPaths,

    /** Which record path a leaf path belongs to, or null — the interpreter routes cells through it. */
    collectionOf(path) {
      return Object.keys(collections).find((each) => path.startsWith(`${each}.`)) ?? null;
    },

    mountedPaths: () => [...mounted],

    mount(paths) {
      for (const path of paths) {
        form.claimField(path);
        mounted.add(path);
      }
    },

    unmount(paths) {
      for (const path of paths) {
        form.removeField(path);
        mounted.delete(path);
      }
    },

    /**
     * A disabled binding is a signal the binder owns, exactly as a renderer would hold one.
     *
     * The signal is created once per path and kept — a control does not swap the signal it exposes —
     * but the binding is declared on every operation, because that is what a renderer does each time
     * it binds a control, and a row that came and went in between has a new field to bind to.
     */
    setDisabled(path, disabled) {
      let signal = disabledSignals.get(path);
      if (!signal) {
        signal = form.reactivity.signal(false);
        disabledSignals.set(path, signal);
      }
      signal.set(disabled);
      form.setDisabled(path, signal);
    },

    /**
     * The public state right now.
     *
     * Diagnostics are reported as what was emitted **since the previous observation**, not as
     * everything the process has said. Cumulative diagnostics would make every snapshot differ from
     * the one before it for a reason that has nothing to do with the form's state, and a test
     * comparing two snapshots would have to ignore the field — which is exactly where a real
     * diagnostic goes unnoticed.
     */
    /**
     * Read the public state without recording anything.
     *
     * Kept apart from {@link observe} because reading a form is itself an act: computed values are
     * evaluated and pending work is given a chance to settle, so a replay that skips the reads an
     * attack made does not reproduce what the attack saw.
     */
    snapshot() {
      const emitted = diagnostics();
      const fresh = emitted.slice(consumedDiagnostics);
      consumedDiagnostics = emitted.length;
      lastObservation = canonicalObservation({
        form,
        collections,
        mounted: [...mounted],
        diagnostics: fresh,
        activeAsyncRuns: asyncValidators.activeRunCount(),
      });
      return lastObservation;
    },

    /** Read the state and record that the attack read it, so a replay reads it too. */
    observe(label = "observation") {
      log.record({ type: "observe", label, sync: true });
      log.observed(label);
      return context.snapshot();
    },

    /** The most recent observation, which a failure report uses when an assertion carried no state. */
    lastObservation: () => lastObservation,

    /**
     * The form options as a report can carry them.
     *
     * Options are how a form differs from another built on the same schema — history on or off, a
     * submit mode, a draft key — so a replay that ignored them would rebuild a different form and
     * report the break as unreproducible. Anything not expressible as data (a storage
     * implementation, a validator function) is dropped and named, because a replay that silently
     * substituted one would be reproducing something else.
     */
    replayableOptions() {
      const carried = {};
      const dropped = [];
      for (const [key, value] of Object.entries(formOptions)) {
        if (typeof value === "function") {
          dropped.push(key);
          continue;
        }
        if (value !== null && typeof value === "object") {
          const nested = {};
          for (const [innerKey, innerValue] of Object.entries(value)) {
            if (typeof innerValue === "function" || typeof innerValue === "object") dropped.push(`${key}.${innerKey}`);
            else nested[innerKey] = innerValue;
          }
          carried[key] = nested;
          continue;
        }
        carried[key] = value;
      }
      return { options: carried, dropped };
    },

    async execute(operation) {
      log.record(operation);
      await executeOperation(context, operation);
      return context;
    },

    async executeAll(operations) {
      for (const operation of operations) await context.execute(operation);
      return context;
    },

    /**
     * Apply an operation without yielding to the scheduler.
     *
     * `execute` is `await`ed, and an `await` is a microtask boundary: effects that run on the
     * reactivity's schedule have already run by the time the next line reads anything. That hides
     * every claim about the window between a change and the tick that follows it — the window a
     * click handler making two calls in a row actually lives in.
     *
     * Only operations that are synchronous by nature are accepted here; asking for a resolution or
     * a flush in the same breath is a contradiction, and is refused rather than quietly awaited.
     */
    executeNow(operation) {
      if (ASYNC_ONLY.has(operation.type)) {
        throw new Error(`${operation.type} cannot be executed without yielding; use execute()`);
      }
      // The log carries the fact: a replay that awaited here would close the window the attack
      // opened, and would report the break as unreproducible.
      log.record({ ...operation, sync: true });
      void executeOperation(context, operation);
      return context;
    },

    async dispose() {
      if (!form.destroyed) form.destroy();
      await scheduler.flush();
      scheduler.restore();
    },
  };

  return context;
}

/** `rows`, `address.city` — the handle a path names, without touching the engine. */
export function resolveHandle(form, path) {
  return path.split(".").reduce((node, segment) => {
    if (node === undefined || node === null) {
      throw new Error(`no handle at ${path}`);
    }
    return node[segment];
  }, form.f);
}

/**
 * Apply one operation the way a consumer would.
 *
 * A cell inside a keyed collection is written through its collection's `cell` handle rather than
 * through the form's field lookup: that is the call a renderer makes, and it is the one whose
 * behaviour before declaration is a claim under test.
 */
export async function executeOperation(context, operation) {
  const { form, collections, log } = context;

  switch (operation.type) {
    case "record.upsert":
      collections[operation.path].upsert(operation.key, operation.value);
      break;
    case "record.remove":
      collections[operation.path].remove(operation.key);
      break;
    case "record.rename":
      collections[operation.path].rename(operation.from, operation.to);
      break;
    case "record.patch":
      collections[operation.path].patch(operation.value);
      break;
    case "record.setAll":
      collections[operation.path].setAll(operation.value);
      break;

    case "array.push":
      collections[operation.path].push(operation.value);
      break;
    case "array.insert":
      collections[operation.path].insert(operation.index, operation.value);
      break;
    case "array.remove":
      collections[operation.path].remove(operation.index);
      break;
    case "array.move":
      collections[operation.path].move(operation.from, operation.to);
      break;
    case "array.setAll":
      collections[operation.path].setAll(operation.value ?? []);
      break;

    case "field.set":
      fieldOf(context, operation.path, (handle) => handle.set(operation.value));
      break;
    case "field.touch":
      fieldOf(context, operation.path, (handle) => handle.markAsTouched());
      break;
    case "field.dirty":
      fieldOf(context, operation.path, (handle) => handle.markAsDirty());
      break;
    case "field.disable":
      context.setDisabled(operation.path, true);
      break;
    case "field.enable":
      context.setDisabled(operation.path, false);
      break;

    case "mount":
      context.mount(operation.paths);
      break;
    case "unmount":
      context.unmount(operation.paths);
      break;

    case "submit":
      log.note("submit", { value: form.submitValue(), valid: form.state.valid() });
      break;
    case "reset":
      form.reset();
      break;
    case "undo":
      form.undo();
      break;
    case "redo":
      form.redo();
      break;

    case "draft.save":
      await context.scheduler.advance(operation.afterMs ?? 500);
      break;
    case "draft.restore":
      throw new Error("draft.restore requires a draft-aware context");

    case "async.resolve":
      context.asyncValidators.resolveRun(operation.token, operation.ordinal ?? 1, operation.result ?? []);
      await context.scheduler.flush();
      break;
    case "async.reject":
      context.asyncValidators.rejectRun(operation.token, operation.ordinal ?? 1, operation.message);
      await context.scheduler.flush();
      break;

    case "flush":
      await context.scheduler.advance(operation.ms ?? 0);
      break;
    case "destroy":
      form.destroy();
      break;
    case "observe":
      context.snapshot();
      break;

    default:
      throw new Error(`no interpreter for operation ${operation.type}`);
  }
}

/**
 * The handle a control would hold for `path`.
 *
 * Inside a keyed collection that is `cell(key, rest)`, which exists before its row does — asking the
 * form for the field instead would answer `null` and hide the waiting behaviour under test.
 */
function fieldOf(context, path, use) {
  const collectionPath = context.collectionOf(path);
  if (!collectionPath) return use(resolveHandle(context.form, path));

  const collection = context.collections[collectionPath];
  const [key, ...rest] = path.slice(collectionPath.length + 1).split(".");

  // A keyed collection hands out a cell handle before its row exists — that is the affordance under
  // test. A positional one has no such thing: `at(index)` answers for a row that is there, and
  // nothing at all for one that is not, which is what a write to a missing index means.
  if (typeof collection.cell === "function") {
    return use(collection.cell(key, rest.join(".") || undefined));
  }

  const row = collection.at(Number(key));
  if (row === null || row === undefined) return undefined;
  const handle = rest.reduce((node, segment) => (node == null ? node : node[segment]), row);
  return handle == null ? undefined : use(handle);
}
