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

  const collections = {};
  for (const path of collectionPaths) collections[path] = resolveHandle(form, path);

  const mounted = new Set();
  const disabledSignals = new Map();
  let consumedDiagnostics = 0;

  const context = {
    spec,
    form,
    log,
    scheduler,
    asyncValidators,
    collections,
    collectionPaths,

    /** Which record path a leaf path belongs to, or null — the interpreter routes cells through it. */
    collectionOf(path) {
      return collectionPaths.find((each) => path.startsWith(`${each}.`)) ?? null;
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

    /** A disabled binding is a signal the binder owns, exactly as a renderer would hold one. */
    setDisabled(path, disabled) {
      let signal = disabledSignals.get(path);
      if (!signal) {
        signal = form.reactivity.signal(false);
        disabledSignals.set(path, signal);
        form.setDisabled(path, signal);
      }
      signal.set(disabled);
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
    observe(label = "observation") {
      log.observed(label);
      const emitted = diagnostics();
      const fresh = emitted.slice(consumedDiagnostics);
      consumedDiagnostics = emitted.length;
      return canonicalObservation({
        form,
        collections,
        mounted: [...mounted],
        diagnostics: fresh,
        activeAsyncRuns: asyncValidators.activeRunCount(),
      });
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
  if (collectionPath) {
    const [key, ...rest] = path.slice(collectionPath.length + 1).split(".");
    return use(context.collections[collectionPath].cell(key, rest.join(".") || undefined));
  }
  return use(resolveHandle(context.form, path));
}
