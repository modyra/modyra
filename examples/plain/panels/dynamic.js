/**
 * A form declared as data, and what the parser says about it.
 *
 * The document arrives over a network, so it is parsed rather than trusted: an expression is data
 * and never code, a field name is a path and is checked as one, and everything the parser rejects
 * it says out loud. Paste something broken and read the diagnostics — that is the panel.
 */
import { MDY_DYNAMIC_DIAGNOSTICS, MDY_DYNAMIC_INVALID_FIELD, evaluateRuleCondition, parseDynamicForm } from "@modyra/core";
import { mountMdyForm } from "@modyra/plain";
import { formErrorsOf, MDY_FORM_SHELL_CLASSES, MDY_FORM_SHELL_STRUCTURE, MDY_TIMEPICKER_DEFAULT_FORMAT, timepickerPlaceholder } from "@modyra/widgets";
import { action, readoutPrinter, toolbar } from "./shell.js";

const SAMPLE = {
  version: 2,
  fields: [
    { name: "email", kind: "email", label: "Email", validators: { required: true, email: true } },
    { name: "code", kind: "text", label: "Code", validators: { minLength: 2, maxLength: 8, pattern: "^[A-Z]+$" } },
    { name: "plan", kind: "select", label: "Plan", options: [
      { value: "free", label: "Free" }, { value: "pro", label: "Pro" },
    ] },
    { name: "starts", kind: "datepicker", label: "Starts" },
    // The pair is the point: the same kind, one opening on the face and one on the number boxes,
    // because a document names the view rather than the renderer choosing it. The second also spells
    // out the two defaults the contract owns, so what a field gets when it says nothing is visible
    // beside a field that says something.
    { name: "meets", kind: "timepicker", label: "Meets" },
    {
      name: "shiftEnds",
      kind: "timepicker",
      label: "Shift ends",
      viewMode: "input",
      format: MDY_TIMEPICKER_DEFAULT_FORMAT,
      placeholder: timepickerPlaceholder(MDY_TIMEPICKER_DEFAULT_FORMAT),
    },
    { name: "seats", kind: "number", label: "Seats" },
  ],
  // What the document says the form does, not only what it holds. Change the plan and watch the
  // seat count leave the page and the payload with it: a rule is a binding on the form, so what it
  // decides reaches what is sent and not only what is drawn.
  rules: [
    { effect: "visible", target: "seats", when: { field: "plan", operator: "equals", value: "pro" } },
  ],
};

/** Documents that must be refused, and the reason each one is refused for. */
const BROKEN = {
  "a kind nobody declared": { version: 2, fields: [{ name: "a", kind: "wormhole", label: "A" }] },
  "a view a picker does not have": { version: 2, fields: [{ name: "a", kind: "timepicker", label: "A", viewMode: "sundial" }] },
  "a name that is not a path": { version: 2, fields: [{ name: "__proto__", kind: "text", label: "A" }] },
  "a pattern that is not one": { version: 2, fields: [{ name: "a", kind: "text", validators: { pattern: "(" } }] },
  "options that are not options": { version: 2, fields: [{ name: "a", kind: "select", options: "free,pro" }] },
};

export const dynamicPanel = {
  id: "dynamic",
  title: "Declared as data",
  blurb:
    "Edit the document and render it. The buttons paste documents that must be refused; each one should produce a diagnostic that names what is wrong and where, and no form at all.",
  /**
   * The public names this panel drives.
   *
   * Declared rather than inferred: `audit-coverage-and-demo` used to search the demo sources for
   * a name, which counted an import line as a demonstration and made almost everything look
   * covered. What a panel exercises is a claim its own browser test checks.
   */
  exercises: [
    "MDY_DYNAMIC_DIAGNOSTICS",
    "MDY_TIMEPICKER_DEFAULT_FORMAT",
    "timepickerPlaceholder",
    "applyFlatValidators",
    "buildFlatFormSchema",
    "MDY_DYNAMIC_INVALID_FIELD",
    "parseDynamicForm",
    "mountMdyForm",
    "applyDynamicRules",
    "evaluateRuleCondition",
    "MdyDynamicField",
    "MdyDynamicDiagnostic",
    "MdyDynamicFormParseResult",
    "MDY_FORM_SHELL_CLASSES",
    "MDY_FORM_SHELL_STRUCTURE",
    "MdyFormShellPart",
    "formErrorsOf",
  ],

  invariant:
    "Expressions are data, never code. Nothing in this document is evaluated, a field name is validated as a path before it becomes one, and a document the parser rejects mounts nothing rather than mounting partly.",

  mount(work, readout) {
    const bar = toolbar(work);
    const editor = document.createElement("textarea");
    editor.dataset.dynamicSource = "";
    editor.rows = 14;
    editor.style.cssText = "width:100%;font:12px ui-monospace,monospace;margin-bottom:1rem";
    editor.value = JSON.stringify(SAMPLE, null, 2);
    work.append(editor);

    const formHost = document.createElement("div");
    formHost.dataset.dynamicForm = "";
    work.append(formHost);

    let mounted = null;
    let lastResult = { ok: false, reason: "not rendered yet" };

    const render = () => {
      mounted?.dispose();
      mounted = null;
      formHost.replaceChildren();

      let document_;
      try { document_ = JSON.parse(editor.value); }
      catch (error) { lastResult = { ok: false, reason: "not valid JSON", detail: String(error.message) }; return print(); }

      const parsed = parseDynamicForm(document_);
      lastResult = {
        ok: parsed.ok,
        version: parsed.version,
        fields: parsed.fields.map((f) => `${f.name}: ${f.kind}`),
        diagnostics: parsed.diagnostics.map((d) => `${d.severity} ${d.code} at ${d.path} — ${d.message}`),
        // Each rule's condition against the form's current value: the same answer the binding uses,
        // asked directly, so what a rule is doing is readable rather than inferred from what moved.
        rules: parsed.rules.map((rule) => {
          const holds = evaluateRuleCondition(rule.when, mounted ? mounted.form.getValue() : {});
          return `${rule.effect} ${rule.target} when ${rule.when.field} ${rule.when.operator} ${JSON.stringify(rule.when.value)} → ${holds}`;
        }),
      };
      // A document the parser refused mounts nothing. Rendering "the part that parsed" is how a
      // rejected document becomes a form somebody fills in.
      if (parsed.ok && parsed.fields.length > 0) {
        mounted = mountMdyForm(formHost, parsed.fields, {
          idPrefix: "dyn",
          layout: parsed.layout,
          // Passed, because a form built without them behaves as though the array were empty.
          rules: parsed.rules,
        });
      }
      print();
    };

    action(bar, "Render", render);
    for (const [label, document_] of Object.entries(BROKEN)) {
      action(bar, label, () => { editor.value = JSON.stringify(document_, null, 2); render(); });
    }
    action(bar, "Back to a good one", () => { editor.value = JSON.stringify(SAMPLE, null, 2); render(); });
    // A refusal that names no field. A failed call, a service that is down, a rule only a server can
    // check: the engine keeps it, and `mdy-form__errors` is where a person reads it — above the
    // fields, because a summary below a long form is one nobody scrolls to.
    action(bar, "The service is down", () => {
      void mounted?.form.submit(async () => [{ path: null, message: "The service is unavailable. Nothing was saved." }]);
      print();
    });

    // Every refusal the parser has a name for, listed where a reader can compare it against what
    // the document above actually produced. A code is what a consumer matches on; the sentence
    // beside it is prose and may be reworded.
    const legend = document.createElement("details");
    legend.innerHTML = `<summary>What this parser can refuse (${MDY_DYNAMIC_DIAGNOSTICS.length} named, plus ${MDY_DYNAMIC_INVALID_FIELD})</summary>`;
    const list = document.createElement("ul");
    for (const { code, phrase } of MDY_DYNAMIC_DIAGNOSTICS) {
      const item = document.createElement("li");
      item.textContent = `${code} — recognised by "${phrase}"`;
      list.append(item);
    }
    legend.append(list);
    work.append(legend);

    const print = readoutPrinter(readout, () => ({
      ...lastResult,
      controlsMounted: formHost.querySelectorAll(".mdy-renderer").length,
      // What the form has to say about itself, and where it says it. The two are printed together
      // because a refusal the engine holds and the page does not show is the failure this region
      // exists for: a person pressed the button, the answer was no, and nothing appeared.
      formRefusals: mounted
        ? formErrorsOf(mounted.form.state.lastSubmitErrors()).map((error) => error.message)
        : [],
      refusalsOnScreen: formHost.querySelectorAll(`.${MDY_FORM_SHELL_CLASSES.formErrorItem}`).length,
      // The part name, printed because it is what a renderer outside this repository writes against:
      // `MdyFormShellPart` is the closed vocabulary, and the class is derived from it rather than
      // spelled.
      regionPart: /** @type {import("@modyra/widgets").MdyFormShellPart} */ (MDY_FORM_SHELL_STRUCTURE.nodes[0].part),
    }));

    render();
    return () => { mounted?.dispose(); print.cancel(); };
  },
};
