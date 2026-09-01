/**
 * Verdicts computed away from a browser, carried, and started from.
 *
 * The page is the one place the two roads can be seen side by side rather than asserted: a form
 * built and written here, and a form whose verdicts were taken elsewhere, serialised, and restored.
 * A reader drives both and compares the columns.
 *
 * The third button is the one worth having on a page. It builds a sending side whose rules froze at
 * creation — the defect the whole path exists for — and the row that changes is the snapshot's own
 * verdict, not the restored one, because a restore re-derives. Seeing that is the difference between
 * believing the property and knowing where it does not hold.
 */
import {
  createForm,
  field as mdyField,
  mdyRestoreSnapshot,
  mdyServerSnapshot,
  minLength as mdyMinLength,
  required as mdyRequired,
  vanillaReactivity,
} from "@modyra/core";
import { actionWithHint, scenario, toolbar, verdictPrinter } from "./shell.js";

const SCHEMA = () => ({
  name: mdyField("", [mdyRequired("Name is required")]),
  code: mdyField("ab", [mdyMinLength(3, "too short")]),
});

/** Written the same way on both roads, so a difference in the columns is never a difference in input. */
const written = (form) => {
  form.f.name.set("Ada");
  return form;
};

/**
 * A sending side whose rules stopped re-running when the form was built.
 *
 * Not a hypothetical: it is what a runtime that freezes its computations does, and the reason a
 * runtime must declare `serverSnapshots` before this path will use it.
 */
const frozenAtCreation = (form) => {
  const stuck = new Map(form.fieldNames().map((path) => {
    const state = form.getField(path)();
    return [path, { valid: state.valid(), errors: state.errors() }];
  }));
  const live = form.getField.bind(form);
  form.getField = (path) => {
    const real = live(path);
    return () => ({ ...real(), valid: () => stuck.get(path).valid, errors: () => stuck.get(path).errors });
  };
  return form;
};

const verdictsOf = (form) => form.fieldNames().map((path) => {
  const state = form.getField(path)();
  return {
    path,
    value: state.value(),
    verdict: state.valid() ? "valid" : "invalid",
    errors: state.errors().map((each) => each.message),
  };
});

export const carriedPanel = {
  id: "carried",
  title: "Carried",

  /** The public names this panel drives. */
  exercises: ["mdyServerSnapshot", "mdyRestoreSnapshot"],

  mount(work, readout) {
    const reactivity = vanillaReactivity();
    let state = { taken: null, restored: null, frozen: false };

    scenario(work, "A form's verdicts computed where there is no browser, carried as text, and started from here.");

    const bar = toolbar(work);
    let print = () => {};

    const take = (freeze) => {
      const sending = written(freeze ? frozenAtCreation(createForm(SCHEMA())) : createForm(SCHEMA()));
      const carried = mdyServerSnapshot(sending, reactivity);
      // What actually crosses a boundary is text. A structure that only survives as a live object
      // has not been carried, so the page does what a response does.
      const asText = JSON.parse(JSON.stringify(carried));
      state = {
        taken: asText,
        restored: verdictsOf(mdyRestoreSnapshot(createForm(SCHEMA()), asText, reactivity)),
        frozen: freeze,
      };
      print();
    };

    actionWithHint(bar, "Take and restore", "build away from the browser, carry, start from it", () => take(false));
    actionWithHint(bar, "Freeze the sender", "rules that never re-ran — watch which column moves", () => take(true));
    actionWithHint(bar, "Refuse a runtime", "a runtime that has not declared the capability", () => {
      const cannot = { ...reactivity, kind: "frozen-runtime",
        capabilities: { ...reactivity.capabilities, serverSnapshots: false } };
      try {
        mdyServerSnapshot(createForm(SCHEMA()), cannot);
        state = { ...state, refusal: "it was not refused" };
      } catch (error) {
        state = { ...state, refusal: error.message };
      }
      print();
    });

    print = verdictPrinter(readout, () => state, (current) => {
      if (!current.taken) return ["Nothing carried yet."];
      const said = current.taken.fields.map((each) =>
        `${each.path}: the sender said ${each.verdict}${each.errors.length ? ` (${each.errors.join(", ")})` : ""}`);
      const here = (current.restored ?? []).map((each) =>
        `${each.path}: here it computes ${each.verdict}${each.errors.length ? ` (${each.errors.join(", ")})` : ""}`);
      const agree = JSON.stringify(current.taken.fields.map((each) => each.verdict))
        === JSON.stringify((current.restored ?? []).map((each) => each.verdict));
      return [
        ...said,
        ...here,
        agree
          ? "The two roads agree."
          : "They disagree — the sender's own verdicts are the ones that are wrong, and a restore would not have shown it.",
        ...(current.refusal ? [`Refusal: ${current.refusal}`] : []),
      ];
    });

    print();
    return () => {};
  },
};
