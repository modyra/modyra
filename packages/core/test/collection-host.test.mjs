/**
 * A collection talks to an interface, and the interface is enough.
 *
 * `MdyFormRegistry` was declared inside the engine's own file, beside its only implementation, and
 * both collection managers imported the concrete class and called eight methods that were on no
 * interface at all. An abstraction nothing can be substituted for is a description of a class, and
 * the only way to tell the two apart is to substitute something.
 *
 * The double below implements `MdyCollectionHost` and nothing else — no engine, no validation, no
 * value tree. If a manager reaches past the contract, it reaches for a method that is not here.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { field, group, vanillaReactivity } from "../dist/index.js";
import { MdyArrayManager } from "../dist/array-manager.js";
import { MdyRecordManager } from "../dist/record-manager.js";

/** Records what a collection asks for, and answers with the least that satisfies the contract. */
function hostDouble(rx) {
  const calls = [];
  const fields = new Map();
  const gates = new Map();
  const bindings = new Map();
  const note = (name, ...args) => calls.push(`${name}(${args.filter((a) => typeof a === "string").join(",")})`);

  const refFor = (name) => {
    if (!fields.has(name)) {
      const value = rx.signal(undefined);
      fields.set(name, () => ({
        value,
        errors: rx.signal([]),
        valid: rx.computed(() => true),
        touched: rx.signal(false),
        dirty: rx.signal(false),
        pending: rx.signal(false),
        required: rx.signal(false),
        disabled: rx.signal(false),
        readonly: rx.signal(false),
        interactivity: rx.computed(() => "enabled"),
        set: (next) => value.set(next),
        markAsTouched() {},
        markAsDirty() {},
      }));
    }
    return fields.get(name);
  };

  return {
    calls,
    fieldsHeld: () => [...fields.keys()],
    gatesHeld: () => [...gates.keys()],

    // ── MdyFormRegistry ──────────────────────────────────────────────────────
    addValidators: (...a) => note("addValidators", ...a),
    upsertValidators: (...a) => note("upsertValidators", ...a),
    removeValidators: (...a) => note("removeValidators", ...a),
    upsertAsyncValidators: (...a) => note("upsertAsyncValidators", ...a),
    setInitialValue: (...a) => note("setInitialValue", ...a),
    setSanitizer: (...a) => note("setSanitizer", ...a),
    setDisabled: (...a) => note("setDisabled", ...a),
    setInactive: (...a) => note("setInactive", ...a),
    setReadonly: (...a) => note("setReadonly", ...a),
    claimField: (...a) => note("claimField", ...a),
    removeField: (name) => { note("removeField", name); fields.delete(name); },

    // ── what a collection needs beyond a control ─────────────────────────────
    registerPathGate: (prefix, gate) => {
      note("registerPathGate", prefix);
      gates.set(prefix, gate);
      return () => gates.delete(prefix);
    },
    refreshPathGate: (prefix) => note("refreshPathGate", prefix),
    // What a binder said about a path, held by the host rather than by the field, so a row that
    // changes identity can carry it — see MdyCollectionHost.
    carryBindings: (pairs) => {
      note("carryBindings", ...pairs.map(([from]) => from));
      const carried = pairs.map(([from, to]) => [to, bindings.get(from)]).filter(([, binding]) => binding);
      for (const [from] of pairs) bindings.delete(from);
      for (const [to, binding] of carried) bindings.set(to, binding);
    },
    clearBindings: (name) => { note("clearBindings", name); bindings.delete(name); },
    // A bulk write is one change, and the host is what knows what a change is — see
    // MdyCollectionHost. The double has no history, so running the callback is the whole contract.
    mutate: (fn) => { note("mutate"); fn(); },
    // The host holds the fields in an order, and a keyed collection is what decides the order of the
    // ones under its path — see MdyCollectionHost. The double keeps a Map for the same reason the
    // engine does: a value read out of it reads the rows in this order.
    orderRowsUnder: (prefix, order) => {
      note("orderRowsUnder", prefix);
      const rank = new Map(order.map((key, index) => [key, index]));
      const under = [...fields.keys()].filter((name) => name.startsWith(`${prefix}.`));
      const sorted = [...under].sort((a, b) =>
        (rank.get(a.slice(prefix.length + 1).split(".")[0]) ?? Infinity) -
        (rank.get(b.slice(prefix.length + 1).split(".")[0]) ?? Infinity));
      const held = new Map(sorted.map((name) => [name, fields.get(name)]));
      for (const name of sorted) fields.delete(name);
      for (const [name, ref] of held) fields.set(name, ref);
    },

    peekField: (name) => fields.get(name) ?? null,
    getField: (name) => refFor(name),
    fieldNames: () => [...fields.keys()],
    // The prefix-scoped half of the same question: which children a path has, without handing back
    // the whole form for the caller to filter.
    childSegmentsUnder: (prefix) => {
      const under = new Set();
      for (const name of fields.keys()) {
        if (!name.startsWith(`${prefix}.`)) continue;
        under.add(name.slice(prefix.length + 1).split(".")[0]);
      }
      return [...under];
    },
    errorsFor: () => rx.computed(() => []),
    ownField: (...a) => note("ownField", ...a),
    disownField: (...a) => note("disownField", ...a),
    warnDev: (message) => note("warnDev", message),
  };
}

test("an array manager runs against a host that is not the engine", () => {
  const rx = vanillaReactivity();
  const engine = hostDouble(rx);
  const manager = new MdyArrayManager(
    { rx, engine, path: "items", item: group({ name: field(""), qty: field(1) }) },
    [{ name: "Bolt", qty: 4 }],
  );

  assert.equal(manager.rowCount(), 1, "the initial row was not registered");
  manager.push({ name: "Nut", qty: 8 });
  assert.equal(manager.rowCount(), 2);
  manager.remove(0);
  assert.equal(manager.rowCount(), 1);

  // The gate is how a collection answers for its own paths, and it is on the contract now.
  assert.deepEqual(engine.gatesHeld(), ["items"], "the manager did not claim its path range");
  manager.destroy();
});

test("an array manager reconciles against a host that answers only the older contract", () => {
  const rx = vanillaReactivity();
  const engine = hostDouble(rx);
  // `childSegmentsUnder` is optional, so a host written before it exists must still reconcile — from
  // `fieldNames`, which is what the collection falls back to. Removed rather than never added, so
  // the double stays one object and the two paths are the same object's two answers.
  delete engine.childSegmentsUnder;

  const manager = new MdyArrayManager(
    { rx, engine, path: "items", item: group({ name: field("") }) },
    [{ name: "Bolt" }],
  );
  assert.equal(manager.rowCount(), 1);
  manager.push({ name: "Nut" });
  assert.equal(manager.rowCount(), 2, "the fallback reconciliation lost a row the manager declared");
  manager.destroy();
});

test("a record manager runs against the same double", () => {
  const rx = vanillaReactivity();
  const engine = hostDouble(rx);
  const manager = new MdyRecordManager(
    { rx, engine, path: "people", item: field("") },
    { ada: "Ada" },
  );

  assert.deepEqual([...manager.keys()], ["ada"]);
  manager.upsert("grace", "Grace");
  assert.deepEqual([...manager.keys()].sort(), ["ada", "grace"]);
  manager.rename("ada", "ada2");
  assert.deepEqual([...manager.keys()].sort(), ["ada2", "grace"]);
  manager.remove("grace");
  assert.deepEqual([...manager.keys()], ["ada2"]);

  assert.deepEqual(engine.gatesHeld(), ["people"]);
  manager.destroy();
});

test("neither manager reached for a method the contract does not have", () => {
  const rx = vanillaReactivity();
  const engine = hostDouble(rx);
  // A `Proxy` answers the question the double alone cannot: the double *has* the contract's methods,
  // so a manager calling something else would throw `undefined is not a function` and be reported as
  // a crash rather than as what it is — a dependency on the concrete class.
  const strict = new Proxy(engine, {
    get(target, property) {
      if (property in target) return Reflect.get(target, property);
      throw new Error(`[test] a collection reached past MdyCollectionHost for "${String(property)}"`);
    },
  });

  const manager = new MdyArrayManager(
    { rx, engine: strict, path: "rows", item: field("") },
    ["a", "b"],
  );
  manager.push("c");
  manager.move(0, 2);
  manager.setAll(["x"]);
  assert.equal(manager.rowCount(), 1);
  manager.destroy();
});

/**
 * The kind vocabulary has one home.
 *
 * `MdyValueKind` used to be `(typeof MDY_DYNAMIC_FIELD_KINDS)[number]` — the canonical type of this
 * library derived from a constant inside a thirteen-hundred-line JSON parser, which also closed a
 * cycle between three modules. It is a leaf now, and the document format names it rather than owning
 * it. A re-export that quietly forks would be invisible without this.
 */
test("a kind is declared once, whatever names it", async () => {
  const { MDY_FIELD_KINDS } = await import("../dist/field-kinds.js");
  const { MDY_DYNAMIC_FIELD_KINDS, MDY_VALUE_CONTRACTS } = await import("../dist/index.js");

  /** @type {ReadonlyArray<import("../dist/field-kinds.js").MdyFieldKind>} */
  const kinds = MDY_FIELD_KINDS;
  assert.equal(kinds.length, 17);
  assert.deepEqual([...MDY_DYNAMIC_FIELD_KINDS], [...MDY_FIELD_KINDS],
    "the document format forked the vocabulary instead of naming it");
  assert.deepEqual(Object.keys(MDY_VALUE_CONTRACTS).sort(), [...MDY_FIELD_KINDS].sort(),
    "a kind exists with no value contract, or a contract with no kind");
});
