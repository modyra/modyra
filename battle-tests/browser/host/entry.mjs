/**
 * The page a browser battle attacks.
 *
 * A host that mounts the Plain renderer through its published entry point and exposes, on `window`,
 * exactly the operations a table performs: declare a row, remove it, re-declare it, mount a second
 * form over the same names, tear one down. Nothing here asserts — the assertions live in the spec,
 * which reads the real DOM the browser built.
 */
import { parseDynamicFields, parseDynamicForm } from "@modyra/core";
import { createMdyAnnouncer } from "@modyra/widgets";
import { mountMdyForm } from "@modyra/plain";
import { documentProbes } from "./document-probes.mjs";

const mounted = new Map();

/**
 * Wrap a submit action so the host keeps what it was handed.
 *
 * Every mount goes through this, because "what the page sent" is a question about the page and not
 * about which convenience a spec happened to mount through. The value is cloned on the way past: the
 * form goes on owning the one it handed over.
 */
const recording = (submitted, action) => (value, ...rest) => {
  submitted.push(structuredClone(value));
  return action === undefined ? null : action(value, ...rest);
};

const fieldsFor = (key) => [
  { name: `rows.${key}.code`, kind: "text", label: "Code", validators: { required: true } },
  { name: `rows.${key}.note`, kind: "text", label: "Note" },
  {
    name: `rows.${key}.plan`,
    kind: "select",
    // The shape this fixture means, said rather than defaulted. A select that names none is the
    // platform's own chooser, which draws no trigger, no listbox and no options of its own — and a
    // suite written against the combobox then looks for parts nothing drew and reports the renderer.
    searchable: true,
    label: "Plan",
    options: [
      { value: "basic", label: "Basic" },
      { value: "pro", label: "Pro" },
    ],
  },
];

window.battle = {
  /** Mount a form over one row's cells, optionally scoped by an id prefix. */
  mount(id, { key = "a", idPrefix } = {}) {
    const host = document.createElement("section");
    host.dataset.form = id;
    document.querySelector("#stage").append(host);
    const submitted = [];
    const handle = mountMdyForm(host, fieldsFor(key), {
      collections: [{ path: "rows", kind: "record" }],
      onSubmit: recording(submitted),
      ...(idPrefix === undefined ? {} : { idPrefix }),
    });
    mounted.set(id, { handle, host, submitted });
    return id;
  },

  /**
   * Mount over a field list the caller chose, so a spec can render names and row keys the
   * convenience above never produces.
   */
  mountFields(id, fields, options = {}) {
    const host = document.createElement("section");
    host.dataset.form = id;
    document.querySelector("#stage").append(host);
    try {
      const submitted = [];
      // **Both doors are real, and this host offers both rather than choosing one.**
      //
      // `mountMdyForm` reads a field list and does not parse it: a consumer calling it with raw
      // fields gets exactly that, including the refusals it raises itself. `parseDynamicForm` is
      // the other door, and it drops what the contract will not carry — a granularity whose step
      // does not divide the face, an option value declared twice.
      //
      // A host that always parses hides the first door's refusals; one that never parses shows a
      // renderer honouring what the contract refuses. Both were measured here as renderer defects
      // and neither was one. So the caller says which door it came through, and the default is the
      // raw one, because that is what `mountFields` is named for.
      const given = options.parse === true ? parseDynamicFields(fields) : fields;
      const { parse: _parse, ...forwarded } = options;
      const handle = mountMdyForm(host, given, {
        ...forwarded,
        onSubmit: recording(submitted, options.onSubmit),
      });
      mounted.set(id, { handle, host, submitted });
      return { mounted: true };
    } catch (error) {
      return { mounted: false, message: String(error?.message ?? error) };
    }
  },

  /**
   * Mount with a submit handler that answers with `errors`, so a spec can see what a page does with
   * what a server said. `errors` is passed through untouched — the point is what an application
   * hands back, including shapes a signature does not stop.
   */
  mountWithSubmit(id, fields, errors) {
    const host = document.createElement("section");
    host.dataset.form = id;
    document.querySelector("#stage").append(host);
    try {
      // `throw` is a shape too: an action whose network call failed. The engine turns it into a
      // form-level error, and a spec can then ask whether the page shows one.
      const submitted = [];
      const handle = mountMdyForm(host, fields, {
        onSubmit: recording(submitted, () => {
          if (errors !== null && typeof errors === "object" && errors.__throw !== undefined) {
            throw new Error(String(errors.__throw));
          }
          return errors;
        }),
      });
      mounted.set(id, { handle, host, submitted });
      return { mounted: true };
    } catch (error) {
      return { mounted: false, message: String(error?.message ?? error) };
    }
  },

  removeRow(id, key) {
    mounted.get(id).handle.form.f.rows.remove(key);
  },

  declareRow(id, key, value) {
    mounted.get(id).handle.form.f.rows.upsert(key, value);
  },

  /**
   * Mount with a submit action that takes `ms` to answer.
   *
   * A synchronous action never leaves a window for a second press to arrive in, and a slow network is
   * exactly when somebody presses again — so the question "does this submit twice" can only be asked
   * of an action that is still running.
   */
  mountSlowSubmit(id, fields, ms, errors = null) {
    const host = document.createElement("section");
    host.dataset.form = id;
    document.querySelector("#stage").append(host);
    const submitted = [];
    try {
      const handle = mountMdyForm(host, fields, {
        onSubmit: recording(submitted, () => new Promise((resolve) => setTimeout(() => resolve(errors), ms))),
      });
      mounted.set(id, { handle, host, submitted });
      return { mounted: true };
    } catch (error) {
      return { mounted: false, message: String(error?.message ?? error) };
    }
  },

  /** Whether the form is in the middle of a submission. */
  submittingOf(id) {
    return mounted.get(id).handle.form.state.submitting();
  },

  /** Take a field out of play, the way a binding does, so a spec can see what submission does with it. */
  disable(id, path) {
    mounted.get(id).handle.form.setDisabled(path, () => true);
  },

  /**
   * Submit and answer with `errors`, so a spec can ask what a page does with what a server said
   * without mounting a second form to say it. `errors` is passed through untouched.
   */
  async submitAnswering(id, answer) {
    const entry = mounted.get(id);
    await entry.handle.form.submit((value) => {
      entry.submitted.push(structuredClone(value));
      if (answer !== null && typeof answer === "object" && answer.__throw !== undefined) {
        throw new Error(String(answer.__throw));
      }
      return answer;
    });
  },

  /**
   * Submit without pressing anything, so a spec can ask what a page sends without also asking
   * whether it offered to send it. The button is a separate question and has its own specs.
   */
  async submit(id) {
    const entry = mounted.get(id);
    await entry.handle.form.submit((value) => {
      entry.submitted.push(structuredClone(value));
      return null;
    });
    return entry.submitted.length;
  },

  /** Every value this form has handed to its submit action, in order. */
  submittedBy(id) {
    return mounted.get(id)?.submitted ?? [];
  },

  /** What the form says about its last submission — the errors a renderer could show. */
  lastSubmitErrorsOf(id) {
    return mounted.get(id).handle.form.state.lastSubmitErrors().map((entry) => ({
      path: entry.path ?? null,
      message: typeof entry.message === "string" ? entry.message : String(entry.message),
    }));
  },

  /**
   * Mount a form the way an application mounts one that arrived as data.
   *
   * A document is parsed before it is drawn, and what the parser returns is what the page is built
   * from — the fields it accepted and the layout it validated. Mounting the envelope's own arrays
   * instead would draw a form no check has passed, which is the mistake this route exists to stop.
   *
   * A refusal is an outcome the caller can read, not an exception: a document that does not parse
   * leaves nothing on the page, and the diagnostics say why.
   */
  mountDocument(id, envelope, options = {}) {
    const parsed = parseDynamicForm(envelope, { mode: options.mode ?? "strict" });
    if (!parsed.ok) {
      return {
        mounted: false,
        diagnostics: parsed.diagnostics.map((each) => ({ code: each.code, path: each.path, message: each.message })),
      };
    }

    const host = document.createElement("section");
    host.dataset.form = id;
    document.querySelector("#stage").append(host);
    try {
      const submitted = [];
      const handle = mountMdyForm(host, parsed.fields, {
        layout: parsed.layout,
        rules: parsed.rules,
        // Every slot the parse fills is a slot a consumer's mount receives. `validations` holds the
        // document's cross-field rules; dropping it here builds a form whose rules were read and
        // then thrown away, which reads in a spec as the renderer never enforcing them.
        validations: parsed.validations,
        // And the rows. `mountMdyForm` takes them (`packages/plain/src/mount.ts:27`), a document
        // declares them through the tree — `node: "record"` with an `item` carrying the row
        // template — and the parse hands them back with that template attached.
        //
        // Dropping them here is the same defect as the sentence above, which I wrote for
        // `validations` and then did not finish asking of the rest: **no browser spec could see a
        // document's rows render in any renderer**, and one that tried would have read this fixture
        // as the renderer losing them.
        collections: parsed.collections,
        onSubmit: recording(submitted),
      });
      mounted.set(id, { handle, host, submitted });
      return { mounted: true, accepted: parsed.acceptedCount, rejected: parsed.rejectedCount };
    } catch (error) {
      return { mounted: false, message: String(error?.message ?? error) };
    }
  },

  /**
   * Put a field out of play without hiding it, the way an application makes one read-only.
   *
   * Readonly and disabled are different states with different promises — a read-only field is still
   * submitted — and asking one renderer without being able to ask the other makes a silence look
   * like an answer.
   */
  readonly(id, path) {
    mounted.get(id).handle.form.setReadonly(path, () => true);
  },

  /**
   * Change the value from outside, the way an application does.
   *
   * Everything else this host offers drives the page and reads the model. This is the other
   * direction — a value arriving from a fetch, a reset, a patch — and a control that does not follow
   * it shows the user something the form no longer holds.
   */
  setValue(id, patch) {
    mounted.get(id).handle.form.patchValue(patch);
  },

  /** Put the form back where it started. */
  reset(id) {
    mounted.get(id).handle.form.reset();
  },

  /**
   * What the engine says is wrong with one field, and whether the form may be sent.
   *
   * The page is a projection of this. Asking both in the same breath is what makes a verdict the
   * model holds but the page never shows into a measurable difference rather than an impression.
   */
  errorsOf(id, path) {
    return mounted.get(id).handle.form.errorsFor(path)();
  },

  canSubmitOf(id) {
    return mounted.get(id).handle.form.state.canSubmit();
  },

  /**
   * A published widget helper that needs a document to be asked anything.
   *
   * Exposed rather than reached for through a mounted form, because it is shared by id across every
   * caller in a page — which is the thing worth asking about, and a form does not own it.
   */
  announce(regionId, message) {
    createMdyAnnouncer(regionId).announce(message);
  },

  valueOf(id) {
    return mounted.get(id).handle.form.getValue();
  },

  /**
   * End the form and leave the controls in the document.
   *
   * The window a framework opens between destroying its model and removing its nodes: an
   * `ngOnDestroy` runs, and the elements stay until an animation or the host's own scheduler takes
   * them. Anything the user does in that window reaches a form that has ended.
   */
  destroyFormOnly(id) {
    mounted.get(id).handle.form.destroy();
  },

  dispose(id) {
    const entry = mounted.get(id);
    entry.handle.dispose();
    entry.host.remove();
    mounted.delete(id);
  },

  /** Every id reference in the document that points at nothing. */
  // The four that read the page and nothing else, shared with the other two hosts: there is one
  // right answer to each and no adapter in any of them.
  ...documentProbes,
};

window.battleReady = true;
