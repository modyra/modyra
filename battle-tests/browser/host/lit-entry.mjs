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
import { buildDynamicFieldValidators, createLitForm, field, MDY_VALUE_CONTRACTS, parseDynamicFields } from "@modyra/lit/adapter";
import { defineMdyElements } from "@modyra/lit/ui";

defineMdyElements();

const mounted = new Map();

/** The element that renders each kind, as a consumer would write it. */
const TAG = {
  text: "mdy-text-field",
  textarea: "mdy-textarea-field",
  email: "mdy-text-field",
  password: "mdy-text-field",
  number: "mdy-number-field",
  slider: "mdy-slider-field",
  checkbox: "mdy-checkbox-field",
  toggle: "mdy-toggle-field",
  select: "mdy-select-field",
  radio: "mdy-radio-group-field",
  multiselect: "mdy-multiselect-field",
  segmented: "mdy-segmented-field",
  datepicker: "mdy-datepicker-field",
  daterange: "mdy-daterange-field",
  timepicker: "mdy-timepicker-field",
  file: "mdy-file-field",
  colors: "mdy-colors-field",
};

/**
 * What a kind's value starts as, from the contract rather than from a list kept here.
 *
 * `MDY_VALUE_CONTRACTS` already says what shape a kind holds and whether it may be null, so a second
 * list beside it can only drift. It drifted once: the blank was chosen with `??`, which reads a
 * legitimate `null` as absent and fell through to `""` — so every nullable kind in this host started
 * as an empty string, and a battle reading a fresh number saw `""` where the contract says `null`.
 */
const blankFor = (kind) => {
  const contract = MDY_VALUE_CONTRACTS[kind];
  if (contract === undefined) return "";
  if (contract.nullable) return null;
  switch (contract.shape) {
    case "boolean": return false;
    case "number": return 0;
    case "option": return null;
    case "option[]":
    case "file[]": return [];
    case "dateRange": return { start: null, end: null };
    default: return "";
  }
};

window.battleLit = {
  /** Build a form over `fields` and render one element per field. */
  mountFields(id, fields, options = {}) {
    const host = document.createElement("section");
    host.dataset.form = id;
    document.querySelector("#stage").append(host);
    try {
      // A field's rules come from the document the same way a consumer's would: the contract parser
      // reads them and the validator builder compiles them. Building the schema without that step
      // makes every field unconstrained, which looks like the renderer losing them.
      const parsed = parseDynamicFields(fields.map((each) => ({ ...each, name: each.name })));
      const rulesFor = (name) => {
        const declared = parsed.find((each) => each.name === name);
        return declared === undefined ? { validators: [] } : buildDynamicFieldValidators(declared);
      };
      const schema = Object.fromEntries(
        fields.map((each) => {
          const built = rulesFor(each.name);
          return [
            each.name,
            field(each.initialValue === undefined ? blankFor(each.kind) : each.initialValue, built.validators ?? [], {
              marksRequired: built.marksRequired,
            }),
          ];
        }),
      );
      const form = createLitForm(schema, options);

      // Lit publishes no form component: a Lit form is whatever the host writes, so the summary
      // region is an element the host places. It goes first, because a summary found by scrolling
      // past the fields is one nobody reads.
      const summary = document.createElement("mdy-form-errors");
      summary.form = form;
      host.append(summary);

      for (const declared of fields) {
        const tag = TAG[declared.kind] ?? "mdy-text-field";
        const element = document.createElement(tag);
        element.setAttribute("label", declared.label ?? declared.name);
        if (declared.options !== undefined) element.options = declared.options;

        // Everything else a document says about the field is the element's to render — a bound, a
        // step, a placeholder. Forwarding only what this host happens to name makes a renderer look
        // like it ignores a property the document declared.
        for (const [name, value] of Object.entries(declared)) {
          if (["name", "kind", "label", "options", "initialValue", "validators"].includes(name)) continue;
          if (value === undefined || value === null) continue;
          element[name] = value;
        }
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
