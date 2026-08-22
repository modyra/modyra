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
import { assertSafeDynamicFieldNames, buildDynamicFieldValidators, createLitForm, field, MDY_VALUE_CONTRACTS, parseDynamicFields } from "@modyra/lit/adapter";
import { defineMdyElements, mdyLitTagFor } from "@modyra/lit/ui";

defineMdyElements();

const mounted = new Map();

/**
 * The handle for a name, walked rather than looked up.
 *
 * A name is a **path**: `createForm({ "a.b": field("") })` nests, so the value is `{ a: { b: "" } }`
 * and the handle lives at `f.a.b` — `f["a.b"]` is `undefined`. A flat lookup leaves the element with
 * no handle, drawing nothing and saying nothing, which reads as the renderer dropping a field. The
 * Plain door walks the name for the same reason.
 */
function handleFor(form, name) {
  let at = form.f;
  for (const segment of String(name).split(".")) {
    if (at === undefined || at === null) return undefined;
    at = at[segment];
  }
  return at;
}

/** The element that renders each kind, as a consumer would write it. */

/**
 * The control type a text-family kind needs said out loud.
 *
 * Three kinds share one element, and the element renders a plain text box unless it is told
 * otherwise. A consumer who names the element without naming the type gets a password field that
 * shows what is typed into it, which is why this sits beside the tag rather than in a caller.
 */
const CONTROL_TYPE = {
  email: "email",
  password: "password",
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
      // The names first, through the same guard the Plain door runs before it builds anything. A host
      // that skips it collapses a duplicate name into one schema key and hands two elements the same
      // handle, which reads in a spec as the renderer choosing that binding — and no renderer chose
      // it. `@modyra/lit` publishes no door that mounts a document, so this host *is* the door, and a
      // door that does not refuse what the contract refuses is measuring itself.
      assertSafeDynamicFieldNames(fields);

      // A field's rules come from the document the same way a consumer's would: the contract parser
      // reads them and the validator builder compiles them. Building the schema without that step
      // makes every field unconstrained, which looks like the renderer losing them.
      // The same two doors the plain host offers, and the same default: raw unless the caller asks
      // to come through the parser. Symmetry matters more than which default is chosen — when the
      // two hosts disagreed about who parses, three renderer "defects" were the disagreement.
      const parsed = options.parse === true
        ? parseDynamicFields(fields.map((each) => ({ ...each, name: each.name })))
        : fields.map((each) => ({ ...each, name: each.name }));
      const rules = parseDynamicFields(fields.map((each) => ({ ...each, name: each.name })));
      const rulesFor = (name) => {
        const declared = rules.find((each) => each.name === name);
        return declared === undefined ? { validators: [] } : buildDynamicFieldValidators(declared);
      };
      // The form is built from what the parser returned, not from what the caller handed in. A field
      // the contract refuses never reaches a consumer's form, so a host that mounts it anyway is
      // measuring a document the contract does not describe — and a spec reads that as the renderer
      // accepting something it never saw.
      const schema = Object.fromEntries(
        parsed.map((each) => {
          const built = rulesFor(each.name);
          return [
            each.name,
            // `marksRequired` is not one of `field()`'s options — it is the fourth argument of
            // `upsertValidators(name, key, validators, marksRequired)`, which is how `applyFlatValidators`
            // hands it over for Plain. Passed here it was refused three times per mount with
            // `field() was given "marksRequired", which it does not read` — noise on the console
            // channel a spec now reads for warnings that matter. The required marker is derived from
            // the validator regardless, so nothing is lost by not saying it twice.
            field(each.initialValue === undefined ? blankFor(each.kind) : each.initialValue, built.validators ?? []),
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

      for (const declared of parsed) {
        // **The package says which element draws a kind, and says `null` for one it does not.**
        // This host kept a map of its own with a text field as the fallback, so a document
        // declaring `passwordd` mounted a text input and put the value on the screen — a refusal
        // invented by the harness, not a behaviour of `@modyra/lit`. `mdyLitTagFor` is published
        // for exactly this, and `null` is what lets the host refuse the way the plain door does
        // rather than guess.
        const tag = mdyLitTagFor(declared.kind);
        if (tag === null || tag === undefined) {
          throw new Error(`[modyra] Unknown dynamic field kind: ${JSON.stringify(declared)}`);
        }
        const element = document.createElement(tag);
        element.setAttribute("label", declared.label ?? declared.name);
        // A host with two forms on one page is what gives them separate identities, and this host is
        // the door — so a scope the caller asked for reaches the element the way a consumer's would.
        // Without it a spec measuring two scoped forms is measuring two unscoped ones and reads the
        // renderer as ignoring an option it was never handed.
        if (options.idPrefix !== undefined && options.idPrefix !== null) {
          element.setAttribute("id-scope", String(options.idPrefix));
        }
        const controlType = CONTROL_TYPE[declared.kind];
        if (controlType !== undefined) element.setAttribute("type", controlType);
        if (declared.options !== undefined) element.options = declared.options;

        // Everything else a document says about the field is the element's to render — a bound, a
        // step, a placeholder. Forwarding only what this host happens to name makes a renderer look
        // like it ignores a property the document declared.
        for (const [name, value] of Object.entries(declared)) {
          if (["name", "kind", "label", "options", "initialValue", "validators"].includes(name)) continue;
          if (value === undefined || value === null) continue;
          element[name] = value;
        }
        element.field = handleFor(form, declared.name);
        host.append(element);
      }
      mounted.set(id, { form, host, submitted: [] });
      return { mounted: true, tags: parsed.map((each) => mdyLitTagFor(each.kind)) };
    } catch (error) {
      return { mounted: false, message: String(error?.message ?? error) };
    }
  },

  /** Submit with an answer, so a spec can ask what a refusal looks like here. */
  async submitAnswering(id, answer) {
    const entry = mounted.get(id);
    await entry.form.submit((value) => {
      entry.submitted.push(structuredClone(value));
      if (answer !== null && typeof answer === "object" && answer.__throw !== undefined) {
        throw new Error(String(answer.__throw));
      }
      return answer;
    });
  },

  /**
   * Submit the way a page does, and keep what was handed over.
   *
   * "What the page sent" is a question about the page rather than about which convenience a spec
   * mounted through, and it has to be askable of both renderers or a difference between them reads
   * as a silence.
   */
  async submit(id) {
    const entry = mounted.get(id);
    await entry.form.submit((value) => {
      entry.submitted.push(structuredClone(value));
      return null;
    });
    return entry.submitted.length;
  },

  /** Every value this form has handed to its submit action, in order. */
  submittedBy(id) {
    return mounted.get(id)?.submitted ?? [];
  },

  lastSubmitErrorsOf(id) {
    return mounted.get(id).form.state.lastSubmitErrors().map((entry) => ({
      path: entry.path ?? null,
      message: typeof entry.message === "string" ? entry.message : String(entry.message),
    }));
  },

  /**
   * Turn a field off, the way an application turns one off.
   *
   * A disabled widget is a state the contract makes promises about, and asking one renderer without
   * being able to ask the other makes a silence look like an answer.
   */
  disable(id, path) {
    mounted.get(id).form.setDisabled(path, () => true);
  },

  /**
   * Put a field out of play without hiding it, the way an application makes one read-only.
   *
   * Readonly and disabled are different states with different promises — a read-only field is still
   * submitted — and asking one renderer without being able to ask the other makes a silence look
   * like an answer.
   */
  readonly(id, path) {
    mounted.get(id).form.setReadonly(path, () => true);
  },

  /**
   * End the form and leave the controls in the document.
   *
   * The window a framework opens between destroying its model and removing its nodes: an element
   * still holds a handle to a form that has ended, and whatever the user does in that window reaches
   * it. Asking one renderer and not the other makes a difference there look like a silence.
   */
  destroyFormOnly(id) {
    mounted.get(id).form.destroy();
  },

  /**
   * Change the value from outside, the way an application does.
   *
   * Everything else this host offers drives the page and reads the model. This is the other
   * direction — a value arriving from a fetch, a reset, a patch — and a control that does not follow
   * it shows the user something the form no longer holds.
   */
  setValue(id, patch) {
    mounted.get(id).form.patchValue(patch);
  },

  /** Put the form back where it started. */
  reset(id) {
    mounted.get(id).form.reset();
  },

  /**
   * What the engine says is wrong with one field, and whether the form may be sent.
   *
   * The page is a projection of this. Asking both in the same breath is what makes a verdict the
   * model holds but the page never shows into a measurable difference rather than an impression.
   */
  errorsOf(id, path) {
    return mounted.get(id).form.errorsFor(path)();
  },

  canSubmitOf(id) {
    return mounted.get(id).form.state.canSubmit();
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
