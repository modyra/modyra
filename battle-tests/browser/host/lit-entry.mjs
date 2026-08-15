/**
 * The page a browser battle attacks, rendered by `@modyra/lit`.
 *
 * The Plain host mounts a whole form with one call. Lit is a component library: elements are
 * registered once and each is bound to a field handle by setting `.field`, which is what a consumer
 * writes in a template. This host does the same thing imperatively so a spec can drive it without a
 * template compiler in the page.
 *
 * It exposes the same shape of operations as the Plain host where they mean the same thing, so a spec
 * can ask both renderers the same question.
 */
import { createLitForm, field } from "@modyra/lit/adapter";
import { defineMdyElements } from "@modyra/lit/ui";

defineMdyElements();

const mounted = new Map();

/** The element that renders each kind, as a consumer would write it. */
const TAG = {
  text: "mdy-text-field",
  textarea: "mdy-textarea-field",
  email: "mdy-text-field",
  number: "mdy-number-field",
  checkbox: "mdy-checkbox-field",
  select: "mdy-select-field",
};

window.battleLit = {
  /** Build a form over `fields` and render one element per field. */
  mountFields(id, fields, options = {}) {
    const host = document.createElement("section");
    host.dataset.form = id;
    document.querySelector("#stage").append(host);
    try {
      const schema = Object.fromEntries(fields.map((each) => [each.name, field(each.initialValue ?? "")]));
      const form = createLitForm(schema, options);
      for (const declared of fields) {
        const tag = TAG[declared.kind] ?? "mdy-text-field";
        const element = document.createElement(tag);
        element.setAttribute("label", declared.label ?? declared.name);
        element.field = form.f[declared.name];
        host.append(element);
      }
      mounted.set(id, { form, host });
      return { mounted: true, tags: fields.map((each) => TAG[each.kind] ?? "mdy-text-field") };
    } catch (error) {
      return { mounted: false, message: String(error?.message ?? error) };
    }
  },

  /** Submit with an answer, so a spec can ask what a refusal looks like here. */
  async submitAnswering(id, answer) {
    const entry = mounted.get(id);
    await entry.form.submit(() => {
      if (answer !== null && typeof answer === "object" && answer.__throw !== undefined) {
        throw new Error(String(answer.__throw));
      }
      return answer;
    });
  },

  lastSubmitErrorsOf(id) {
    return mounted.get(id).form.state.lastSubmitErrors().map((entry) => ({
      path: entry.path ?? null,
      message: typeof entry.message === "string" ? entry.message : String(entry.message),
    }));
  },

  valueOf(id) {
    return mounted.get(id).form.getValue();
  },

  dispose(id) {
    const entry = mounted.get(id);
    entry.form.destroy?.();
    entry.host.remove();
    mounted.delete(id);
  },
};

window.battleLitReady = true;
