/**
 * The last of the published names no battle had ever imported.
 *
 * Three of them are error classes, and the interesting thing about them is how a consumer is
 * supposed to meet one. `MdyActivationError` and `MdyAdapterContractError` are thrown, so `catch`
 * plus `instanceof` is the way. `MdyCrossRuntimeObservationError` is not: the engine constructs it
 * to borrow its message and reports that message under `MDY_CROSS_RUNTIME_OBSERVATION`, so a
 * consumer branching on `instanceof` waits forever for something that never arrives.
 *
 * That is not a defect — a stale read is not an exception, and turning it into one would break the
 * form of every consumer who has ever built a fresh `vanillaReactivity()` by accident. But it means
 * the *diagnostic code* is the contract for this one, and the class is contract only for what it
 * says. Both halves are pinned here, because a change to either — starting to throw, or reporting
 * under a different code — changes what a consumer has to write.
 *
 * The rest are the small answers the layers above assemble from: whether a runtime runs effects at
 * all, what a document's validator block declares about being required, and what a schema flattens
 * to when it holds no rows.
 */

import {
  MdyActivationError,
  MdyAdapterContractError,
  MdyCrossRuntimeObservationError,
  MDY_CROSS_RUNTIME_OBSERVATION,
  buildDynamicFieldValidators,
  eachOneOf,
  flattenDynamicSchema,
  reactivityRunsEffects,
  vanillaReactivity,
} from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

battle(
  {
    claims: ["REA-002"],
    title: "each named failure is catchable as itself and says who both parties are",
    environments: ["node"],
  },
  async (ctx) => {
    const cases = [
      { name: "MdyActivationError", error: new MdyActivationError("a.b"), names: ["a.b"] },
      { name: "MdyAdapterContractError", error: new MdyAdapterContractError("vue", "effects"), names: ["vue", "effects"] },
      {
        name: "MdyCrossRuntimeObservationError",
        error: new MdyCrossRuntimeObservationError("vanilla", "vue"),
        names: ["vanilla", "vue"],
      },
    ];

    for (const { name, error, names } of cases) {
      ctx.log.note("a named failure", { name, message: error.message });

      // An adapter that catches one of these has to be able to tell it apart from an ordinary
      // failure, and from the others, without reading the message.
      expectClaim(error instanceof Error && error.name === name, {
        claimIds: ["REA-002"],
        what: `${name} is not catchable as itself`,
        detail: `${error instanceof Error} / ${error.name}`,
      });

      // A diagnostic that does not name both sides of a mismatch sends the reader looking for which
      // of their runtimes it meant.
      for (const named of names) {
        expectClaim(error.message.includes(named), {
          claimIds: ["REA-002"],
          what: `${name} does not name ${JSON.stringify(named)}`,
          detail: error.message,
        });
      }

      // And it is one of Modyra's, which is how a consumer's logs stay attributable.
      expectClaim(error.message.startsWith("[modyra]"), {
        claimIds: ["REA-002"],
        what: `${name} is not attributed to the framework that raised it`,
        detail: error.message,
      });
    }

    // The cross-runtime one is reported rather than thrown, so the code is what a consumer matches
    // on. Pinning it here is what makes a change to either half visible.
    expectEqual(MDY_CROSS_RUNTIME_OBSERVATION, "MDY_CROSS_RUNTIME_OBSERVATION", {
      claimIds: ["REA-002"],
      what: "the code a cross-runtime read is reported under is not the one consumers match on",
    });
  },
);

battle(
  {
    claims: ["REA-001", "VAL-004", "DYN-002"],
    title: "a runtime declares whether it runs effects, and a document declares what it requires",
    environments: ["node"],
  },
  async (ctx) => {
    // Whether a runtime runs effects decides whether the engine may rely on one or has to push, so
    // this answer is read before any subscription is set up.
    const vanilla = vanillaReactivity();
    ctx.log.note("what each runtime says about effects", {
      vanilla: reactivityRunsEffects(vanilla),
    });

    expectClaim(reactivityRunsEffects(vanilla) === true, {
      claimIds: ["REA-001"],
      what: "the built-in runtime does not declare that it runs effects",
    });

    // The control: the answer comes from the runtime rather than being constant, so a runtime that
    // cannot run effects is not told that it can.
    expectClaim(reactivityRunsEffects({ kind: "pull-only", capabilities: { effects: false } }) === false, {
      claimIds: ["REA-001"],
      what: "a runtime that declares no effects was reported as running them",
    });

    // `marksRequired` is what puts `required` on the control, so it has to follow the document
    // rather than the presence of any validator at all.
    for (const [declared, required] of [
      [{ required: true }, true],
      [{ required: false }, false],
      [{ minLength: 2 }, false],
      [{}, false],
    ]) {
      const built = buildDynamicFieldValidators({ kind: "text", name: "a", validators: declared });
      ctx.log.note("what a validator block declares", { declared, marksRequired: built.marksRequired });

      expectEqual(built.marksRequired, required, {
        claimIds: ["VAL-004"],
        what: `${JSON.stringify(declared)} was read as ${built.marksRequired ? "required" : "optional"}`,
      });
    }

    // A per-element whitelist refuses the element that was never offered and stays out of the way of
    // everything that is not a list — the same emptiness boundary the other validators keep.
    const each = eachOneOf(["a", "b"], "not offered");
    expectEqual(each(["a", "b"]), [], {
      claimIds: ["VAL-004"],
      what: "a list of offered values was refused",
    });

    expectEqual(each(["a", "z"]), ["not offered"], {
      claimIds: ["VAL-004"],
      what: "a list containing a value that was never offered was accepted",
    });

    for (const other of [[], null, undefined, "a", 3]) {
      expectEqual(each(other), [], {
        claimIds: ["VAL-004"],
        what: `${JSON.stringify(other) ?? "undefined"} was judged as though it were a list of choices`,
      });
    }

    // Flattening a schema yields the concrete paths it declares, dotted through its groups. A
    // collection declares none, because a schema holds no rows — the paths appear when a form does.
    const flat = flattenDynamicSchema({
      node: "group",
      children: {
        a: { node: "field", field: { kind: "text" } },
        g: { node: "group", children: { b: { node: "field", field: { kind: "text" } } } },
      },
    });
    ctx.log.note("what a schema flattens to", { names: flat.map((each) => each.name) });

    expectEqual(flat.map((each) => each.name), ["a", "g.b"], {
      claimIds: ["DYN-002"],
      what: "a nested group did not flatten to the path a consumer addresses it by",
    });
  },
);
