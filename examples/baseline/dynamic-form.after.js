/**
 * SCENARIO (b) — a form described by data, with a condition.
 *
 * A back end sends a document describing three fields: a name, a country, and a tax code that is
 * shown only when the country is Italy. The page renders whatever the document says, refuses a
 * document it cannot read, and shows the person why.
 *
 * That is the whole specification. It does not change when the library does, and the after-version
 * of this pass is re-implemented from these words rather than edited from this file.
 */
import { mountDynamicForm } from "@modyra/plain";

const document = {
  version: 2,
  fields: [
    { name: "fullName", kind: "text", label: "Full name", validators: { required: true } },
    { name: "country", kind: "select", label: "Country", options: [
      { value: "it", label: "Italy" },
      { value: "fr", label: "France" },
    ] },
    { name: "taxCode", kind: "text", label: "Tax code" },
  ],
  rules: [
    { effect: "visible", target: "taxCode", when: { field: "country", operator: "equals", value: "it" } },
  ],
};

export function mountInto(host) {
  // A refused document is the ordinary case, not the exception: it comes from somewhere else and
  // nobody here controls it. The refusal arrives as the failure it is, carrying what was lost, so
  // showing the person why is showing them what came back.
  try {
    return mountDynamicForm(host, document);
  } catch (refusal) {
    host.textContent = refusal.message;
    return null;
  }
}
