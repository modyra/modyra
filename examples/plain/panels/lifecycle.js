/**
 * What a form remembers, and when it stops.
 *
 * A draft survives the page; undo and redo walk the values the form has held; deactivating stops
 * the effects that write both. The last one is what a framework adapter needs and a demo rarely
 * shows: a form whose host has gone away must stop saving, and must pick up again on return.
 */
import { createForm, field as mdyField, required as mdyRequired } from "@modyra/core";
import { renderField } from "@modyra/plain";
import { adoptSilentWrites, bindFormReset } from "@modyra/widgets";
import { action, grid, readoutPrinter, toolbar } from "./shell.js";

const FIELDS = [
  { name: "title", kind: "text", label: "Title" },
  { name: "notes", kind: "textarea", label: "Notes" },
  { name: "secret", kind: "password", label: "Secret (kept out of the draft)" },
];

export const lifecyclePanel = {
  id: "lifecycle",
  title: "Lifecycle",
  blurb:
    "Type something, reload the page, and it is still here. Undo walks back through what you typed. Deactivate and the autosave stops — reload then, and the draft is whatever it was when the form went quiet.",
  /**
   * The public names this panel drives.
   *
   * Declared rather than inferred: `audit-coverage-and-demo` used to search the demo sources for
   * a name, which counted an import line as a demonstration and made almost everything look
   * covered. What a panel exercises is a claim its own browser test checks.
   */
  exercises: [
    "createForm",
    "field",
    "required",
    "renderField",
    "MdyDraftOptions",
    "MdyDraftStorage",
    "bindFormReset",
    "MdyFormResetBinding",
    "adoptSilentWrites",
    "MdySilentWriteBinding",
  ],

  invariant:
    "A draft is the form's value and nothing else. `exclude` keeps a field out of storage entirely, and an error-free submit clears the draft rather than leaving a stale copy to be restored over a fresh form.",

  mount(work, readout) {
    const form = createForm(
      {
        title: mdyField("", [mdyRequired()]),
        notes: mdyField(""),
        secret: mdyField(""),
      },
      {
        history: { maxEntries: 50 },
        draft: { key: "modyra-lab-draft", exclude: ["secret"], debounceMs: 150 },
      },
    );

    const bar = toolbar(work);

    /**
     * A real `<form>` around the fields, with the Cancel button a consumer actually writes.
     *
     * `type="reset"` is elementary HTML and the browser answers it by returning each control to its
     * `value` *attribute* — which this renderer never writes, since it keeps the box in step with
     * the model. Unbound, Cancel emptied the boxes and left the value the form would send untouched:
     * what a person saw stopped being what they submitted. `bindFormReset` is what closes that.
     */
    const enclosing = document.createElement("form");
    enclosing.noValidate = true;
    enclosing.addEventListener("submit", (event) => { event.preventDefault(); });
    work.append(enclosing);

    const area = grid(enclosing);
    const dispose = FIELDS.map((f) => renderField(area, f, form.f[f.name], form.reactivity));

    const cancel = document.createElement("button");
    cancel.type = "reset";
    cancel.textContent = "Cancel (the browser's own reset)";
    cancel.dataset.action = cancel.textContent;
    enclosing.append(cancel);

    const unbindReset = bindFormReset({ element: cancel, reset: () => form.reset() });

    /**
     * Values written into the boxes by something that never says so, told to the model.
     *
     * Type something, follow a link away, and press Back: one browser puts the typing straight into
     * the boxes and tells nobody, so the field showed what was written while the form still held
     * what it was built with. Autofill does the same at a different moment. Reading one value and
     * submitting another is the state this closes.
     *
     * `renderField` already does this for a form it mounts. It is here explicitly because the panel
     * builds its own form, and because a reader should see what the call looks like.
     */
    const stopAdopting = adoptSilentWrites({ root: enclosing });

    action(bar, "Undo", () => form.undo());
    action(bar, "Redo", () => form.redo());
    action(bar, "Reset", () => form.reset());
    action(bar, "Deactivate", () => form.deactivate());
    action(bar, "Activate", () => form.activate());
    action(bar, "Clear the draft", () => form.clearDraft());
    // Three writes, one entry: what a person did once should undo once.
    action(bar, "Three writes, one undo step", () =>
      form.mutate(() => {
        form.f.title.set("A title");
        form.f.notes.set("Some notes");
        form.f.secret.set("not stored");
      }));
    action(bar, "Submit", () => form.submit(() => {}));

    const print = readoutPrinter(readout, () => ({
      value: form.getValue(),
      changes: form.getChanges(),
      canUndo: form.canUndo(),
      canRedo: form.canRedo(),
      hasDraft: form.hasDraft(),
      // Read from storage rather than from the form: whether `secret` is excluded is a claim about
      // what was written, and the form would answer about what it holds.
      stored: readStoredDraft(),
      formValid: form.state.valid(),
    }));

    /**
     * The draft is written after a pause, so the readout is printed twice: once for what the form
     * holds now, and once after the pause for what reached storage. A single print would show the
     * form's new value beside the *previous* draft and read as though `exclude` had failed.
     */
    let afterTheWrite = null;
    const effect = form.reactivity.effect(() => {
      form.state.valid();
      form.canUndo();
      form.canRedo();
      form.hasDraft();
      for (const f of FIELDS) form.f[f.name].value();
      print();
      clearTimeout(afterTheWrite);
      afterTheWrite = setTimeout(print, 250);
    });

    return () => { effect.destroy(); clearTimeout(afterTheWrite); print.cancel(); unbindReset(); stopAdopting(); for (const d of dispose) d?.(); form.destroy(); };
  },
};

/** The field names that actually reached storage — the claim `exclude` makes is about this, not about the form. */
function readStoredDraft() {
  try {
    const raw = localStorage.getItem("modyra-lab-draft");
    if (raw === null) return null;
    const parsed = JSON.parse(raw);
    const value = parsed && typeof parsed === "object" && "value" in parsed ? parsed.value : parsed;
    return value && typeof value === "object" ? Object.keys(value) : [];
  } catch {
    return "unreadable";
  }
}
