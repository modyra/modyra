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
import { MDY_LAYOUT_CLASSES, layoutNodeAttributes } from "@modyra/widgets";
import { assertLayoutWithinDepth } from "@modyra/core";
import { parseDynamicForm, assertSafeDynamicFieldNames, buildDynamicFieldValidators, createLitForm, field, mdyEmptyValueFor, parseDynamicFields } from "@modyra/lit/adapter";
import { defineMdyElements, mdyLitTagFor } from "@modyra/lit/ui";
import { createBattleHost } from "./shared-host.mjs";

defineMdyElements();

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


function mountOneField({ declared, handle, into, idPrefix }) {

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
    if (idPrefix !== null && idPrefix !== undefined) {
      element.setAttribute("id-scope", String(idPrefix));
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
    element.field = handle;
    // Into the group the document put it in, or straight onto the form when it named none.
    into.append(element);
      
  return element;
}

window.battleLit = createBattleHost({
  createForm: createLitForm,
  mountOneField,
  errorSummaryElement: () => document.createElement("mdy-form-errors"),
  tagFor: (kind) => mdyLitTagFor(kind),
});

window.battleLitReady = true;
