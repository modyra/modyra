/**
 * The page a browser battle attacks.
 *
 * A host that mounts the Plain renderer through its published entry point and exposes, on `window`,
 * exactly the operations a table performs: declare a row, remove it, re-declare it, mount a second
 * form over the same names, tear one down. Nothing here asserts — the assertions live in the spec,
 * which reads the real DOM the browser built.
 */
import { mountMdyForm } from "@modyra/plain";

const mounted = new Map();

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
    const handle = mountMdyForm(host, fieldsFor(key), {
      collections: [{ path: "rows", kind: "record" }],
      ...(idPrefix === undefined ? {} : { idPrefix }),
    });
    mounted.set(id, { handle, host });
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
      const handle = mountMdyForm(host, fields, options);
      mounted.set(id, { handle, host });
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
      const handle = mountMdyForm(host, fields, {
        onSubmit: () => {
          if (errors !== null && typeof errors === "object" && errors.__throw !== undefined) {
            throw new Error(String(errors.__throw));
          }
          return errors;
        },
      });
      mounted.set(id, { handle, host });
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

  /** What the form says about its last submission — the errors a renderer could show. */
  lastSubmitErrorsOf(id) {
    return mounted.get(id).handle.form.state.lastSubmitErrors().map((entry) => ({
      path: entry.path ?? null,
      message: typeof entry.message === "string" ? entry.message : String(entry.message),
    }));
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
