/**
 * A form declared as data, and what the parser says about it.
 *
 * The document arrives over a network, so it is parsed rather than trusted: an expression is data
 * and never code, a field name is a path and is checked as one, and everything the parser rejects
 * it says out loud. Paste something broken and read the diagnostics — that is the panel.
 */
import { parseDynamicForm } from "@modyra/core";
import { mountMdyForm } from "@modyra/plain";
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
  ],
};

/** Documents that must be refused, and the reason each one is refused for. */
const BROKEN = {
  "a kind nobody declared": { version: 2, fields: [{ name: "a", kind: "wormhole", label: "A" }] },
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
    "parseDynamicForm",
    "mountMdyForm",
    "MdyDynamicField",
    "MdyDynamicDiagnostic",
    "MdyDynamicFormParseResult",
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
      };
      // A document the parser refused mounts nothing. Rendering "the part that parsed" is how a
      // rejected document becomes a form somebody fills in.
      if (parsed.ok && parsed.fields.length > 0) {
        mounted = mountMdyForm(formHost, parsed.fields, { idPrefix: "dyn" });
      }
      print();
    };

    action(bar, "Render", render);
    for (const [label, document_] of Object.entries(BROKEN)) {
      action(bar, label, () => { editor.value = JSON.stringify(document_, null, 2); render(); });
    }
    action(bar, "Back to a good one", () => { editor.value = JSON.stringify(SAMPLE, null, 2); render(); });

    const print = readoutPrinter(readout, () => ({
      ...lastResult,
      controlsMounted: formHost.querySelectorAll(".mdy-renderer").length,
    }));

    render();
    return () => { mounted?.dispose(); print.cancel(); };
  },
};
