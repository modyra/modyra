/**
 * The page a browser battle attacks.
 *
 * A host that mounts the Plain renderer through its published entry point and exposes, on `window`,
 * exactly the operations a table performs: declare a row, remove it, re-declare it, mount a second
 * form over the same names, tear one down. Nothing here asserts — the assertions live in the spec,
 * which reads the real DOM the browser built.
 */
import { parseDynamicForm } from "@modyra/core";
import { mountMdyForm } from "@modyra/plain";

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
      const handle = mountMdyForm(host, fields, {
        ...options,
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
  danglingReferences() {
    const dangling = [];
    for (const element of document.querySelectorAll("*")) {
      for (const attribute of [
        "for",
        "aria-controls",
        "aria-describedby",
        "aria-labelledby",
        "aria-errormessage",
        "aria-activedescendant",
      ]) {
        const value = element.getAttribute(attribute);
        if (!value) continue;
        for (const id of value.split(/\s+/)) {
          if (id && !document.getElementById(id)) {
            dangling.push(`${element.tagName.toLowerCase()}[${attribute}="${id}"]`);
          }
        }
      }
    }
    return dangling;
  },

  duplicateIds() {
    const counts = new Map();
    for (const element of document.querySelectorAll("[id]")) {
      counts.set(element.id, (counts.get(element.id) ?? 0) + 1);
    }
    return [...counts.entries()].filter(([, count]) => count > 1).map(([id]) => id);
  },

  /** Where focus is, and whether that element is still in the document. */
  focusState() {
    const active = document.activeElement;
    return {
      tag: active?.tagName.toLowerCase() ?? null,
      id: active?.id ?? null,
      connected: active ? active.isConnected : false,
      isBody: active === document.body,
    };
  },

  controlCount() {
    return document.querySelectorAll("#stage input, #stage select, #stage button").length;
  },
};

window.battleReady = true;
