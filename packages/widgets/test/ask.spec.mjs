/**
 * The four questions an adapter asks the contract.
 *
 * These replaced the same expressions written out by hand across three adapters, so the property that
 * matters is not that each answers *an* answer — it is that each answers what the hand-written form
 * answered, **for every kind**, not for the one kind whoever wrote it happened to try. Two derivations
 * that agree on the data in front of you have not been compared; the check is the input shape where
 * they would part.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  bindingForIntent,
  capabilityOf,
  isWidgetKind,
  keyMeans,
  keyBindingFor,
  MDY_WIDGET_CONTRACTS,
  MDY_WIDGET_KEYBOARD,
  MDY_WIDGET_KINDS,
} from "../dist/index.js";

test("isWidgetKind admits every kind and nothing shaped like one", () => {
  for (const kind of MDY_WIDGET_KINDS) assert.ok(isWidgetKind(kind), `${kind} is a kind and was refused`);
  for (const near of ["Select", "select ", "textfield", "", "listbox", "MDY_TEXT"]) {
    assert.equal(isWidgetKind(near), false, `"${near}" is not a kind and was admitted`);
  }
  for (const wrong of [null, undefined, 7, {}, [], Symbol("select"), new String("select")]) {
    assert.equal(isWidgetKind(wrong), false, `${String(wrong)} is not a string and was admitted`);
  }
});

test("keyMeans agrees with the table for every key of every kind, in both phases", () => {
  let asked = 0;
  for (const kind of MDY_WIDGET_KINDS) {
    for (const binding of MDY_WIDGET_KEYBOARD[kind]) {
      for (const open of [true, false]) {
        const answered = keyBindingFor(kind, binding.key, open, binding.on);
        if (answered === null || answered === undefined) continue;
        asked += 1;
        assert.equal(keyMeans(kind, binding.key, answered.intent, open, binding.on), true,
          `${kind}: ${binding.key} answers ${answered.intent} and keyMeans denies it`);
        assert.equal(keyMeans(kind, binding.key, "__nothing_declares_this__", open, binding.on), false,
          `${kind}: ${binding.key} means an intent nothing declares`);
      }
    }
  }
  const declared = MDY_WIDGET_KINDS.reduce((n, kind) => n + MDY_WIDGET_KEYBOARD[kind].length, 0);
  assert.ok(asked >= declared, `${asked} bindings answered of ${declared} declared — the table stopped being reached`);
});

test("bindingForIntent returns a binding that declares the intent it was asked for", () => {
  let found = 0;
  for (const kind of MDY_WIDGET_KINDS) {
    for (const binding of MDY_WIDGET_KEYBOARD[kind]) {
      const answered = bindingForIntent(kind, binding.intent);
      assert.ok(answered !== null, `${kind} declares ${binding.intent} and bindingForIntent found none`);
      assert.equal(answered.intent, binding.intent,
        `${kind}: asked for ${binding.intent} and got ${answered.intent}`);
      found += 1;
    }
    assert.equal(bindingForIntent(kind, "__nothing_declares_this__"), null,
      `${kind} answered a binding for an intent nothing declares`);
  }
  // Derived, not a number somebody guessed: every binding the table declares was asked for.
  const declared = MDY_WIDGET_KINDS.reduce((n, kind) => n + MDY_WIDGET_KEYBOARD[kind].length, 0);
  assert.equal(found, declared, `${found} intents exercised of ${declared} declared`);
});

test("bindingForIntent honours the phase where the kind declares one", () => {
  for (const kind of MDY_WIDGET_KINDS) {
    for (const binding of MDY_WIDGET_KEYBOARD[kind]) {
      if (binding.when === undefined) continue;
      const wrongPhase = binding.when === "open" ? false : true;
      const answered = bindingForIntent(kind, binding.intent, wrongPhase);
      if (answered === null) continue;
      assert.notEqual(answered.when, binding.when,
        `${kind}: asked in the ${wrongPhase ? "open" : "closed"} phase and got a ${binding.when}-only binding`);
    }
  }
});

test("capabilityOf tells a declared no from a name nobody declares", () => {
  // The distinction the raw index cannot make: `undefined` and `false` are both falsy, so a renderer
  // asking for a capability under a name that has since been renamed reads "this kind does not do
  // that" and behaves correctly by accident until the day the answer should have been yes.
  let yes = 0, no = 0;
  for (const kind of MDY_WIDGET_KINDS) {
    const declared = MDY_WIDGET_CONTRACTS[kind].capabilities;
    for (const [name, value] of Object.entries(declared)) {
      if (typeof value !== "boolean") continue;
      assert.equal(capabilityOf(kind, name), value, `${kind}.${name} is declared ${value}`);
      value ? (yes += 1) : (no += 1);
    }
    assert.equal(capabilityOf(kind, "__nobody_declares_this__"), false);
  }
  assert.ok(yes > 0 && no > 0, `capabilities exercised: ${yes} true, ${no} false — need both to assert anything`);
});

test("capabilityOf refuses a capability that is not a yes or a no", () => {
  // Six kinds declare `dismissOnOutsidePointer` as a named strategy and `anchoring` as measurements.
  // Answered as a boolean they would come back `false`, which reads as "this kind does not dismiss on
  // an outside pointer" for every kind that does. The wrong door must not answer politely.
  const configured = MDY_WIDGET_KINDS.flatMap((kind) =>
    Object.entries(MDY_WIDGET_CONTRACTS[kind].capabilities)
      .filter(([, value]) => typeof value !== "boolean")
      .map(([name]) => [kind, name]));

  assert.ok(configured.length > 0, "no capability is declared as anything but a boolean — this asserts nothing");
  for (const [kind, name] of configured) {
    assert.throws(() => capabilityOf(kind, name), TypeError,
      `${kind}.${name} is not a boolean and capabilityOf answered instead of raising`);
  }
});
