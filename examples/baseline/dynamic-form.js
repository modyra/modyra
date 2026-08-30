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
import { applyDynamicRules, parseDynamicForm } from "@modyra/core";
import { mountMdyForm } from "@modyra/plain";

const document = {
  // Not 1. Versions 2, 3 and 4 are read; 1 was this runtime's own and is refused with a diagnostic
  // that says so — which is the parser being good, and the first thing a beginner meets.
  version: 2,
  fields: [
    { name: "fullName", kind: "text", label: "Full name", validators: { required: true } },
    { name: "country", kind: "select", label: "Country", options: [
      { value: "it", label: "Italy" },
      { value: "fr", label: "France" },
    ] },
    { name: "taxCode", kind: "text", label: "Tax code" },
  ],
  // A condition is a rule beside the fields, naming the field it governs — not a member of the field
  // it governs. Written the other way it is an unknown member: the document is still accepted, the
  // condition is silently dropped, and the only sign is a diagnostic on a document that says `ok`.
  rules: [
    { effect: "visible", target: "taxCode", when: { field: "country", operator: "equals", value: "it" } },
  ],
};

export function mountInto(host) {
  const parsed = parseDynamicForm(document);

  // A refused document is the ordinary case, not the exception: it comes from somewhere else and
  // nobody here controls it. Reporting the diagnostics is what makes a refusal usable.
  if (!parsed.ok) {
    host.textContent = parsed.diagnostics
      .map((one) => `${one.code} at ${one.path}: ${one.message}`)
      .join("\n");
    return null;
  }

  // The arrangement travels beside the fields rather than inside them, so it is passed separately.
  const form = mountMdyForm(host, parsed.fields, { layout: parsed.layout });
  // And the rules are read by the parser but not applied by it: without this call the tax code is
  // there for every country and the document looks obeyed.
  applyDynamicRules(form, parsed.rules);
  return form;
}
