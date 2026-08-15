/**
 * A property a document sets, a parser checks, an editor offers — and no protection reads.
 *
 * `sensitive` is a boolean on a dynamic field. The Dynamic Form Contract declares it, the parser
 * type-checks it and drops the whole field when it is not a boolean, and the project editor offers
 * it as something an author toggles. Everything about it says it is read.
 *
 * What reads it is nothing that protects the value. A draft keeps out what `exclude` names, and
 * `exclude` is a list of paths the application passes when it creates the form — it does not consult
 * the document. The devtools panel masks what a path *looks* like plus what a caller's predicate
 * answers. A renderer is handed the field and has no statement to act on. So a document that marks
 * a field sensitive is written to storage in clear text, and the author is told nothing.
 *
 * The reading that makes this worth a battle is the one an author would take: the flag is the only
 * thing in the document that names secrecy, so setting it looks like the protection. The value it
 * covers is exactly the value worth covering.
 *
 * This battle is red on its last assertion. It becomes green when marking a field sensitive either
 * keeps it out of storage or says, once, that it did not.
 */

import { buildDynamicFormSchema, createForm, parseDynamicForm } from "@modyra/core";

import { battle } from "../../harness/battle.mjs";
import { expectClaim, expectEqual } from "../../harness/assertions.mjs";

/** Storage a battle owns, so nothing depends on an environment having one. */
function memoryStorage() {
  const written = new Map();
  return {
    written,
    read: (key) => written.get(key) ?? null,
    write: (key, value) => written.set(key, value),
    remove: (key) => written.delete(key),
  };
}

/** A sink that keeps what it is told, so a missing diagnostic is a measurement. */
function recordingDiagnostics() {
  const reports = [];
  return { reports, report: (entry) => reports.push(entry) };
}

const SECRET = "sk-live-DEADBEEF";

const documentWith = (extra) => ({
  node: "group",
  children: {
    secret: { node: "field", field: { kind: "text", label: "API key", ...extra } },
    plain: { node: "field", field: { kind: "text", label: "Nickname" } },
  },
});

const saved = () => new Promise((resolve) => setTimeout(resolve, 700));

battle(
  {
    claims: ["SEC-005", "PER-001"],
    title: "a document's sensitive flag is checked at the door and kept",
    environments: ["node"],
  },
  async (ctx) => {
    // The premise: this is a property the contract reads, not an unknown key carried along. A parser
    // that type-checks it has looked at it, so its silence downstream is not an omission of parsing.
    const wrong = parseDynamicForm({
      node: "group",
      children: { secret: { node: "field", field: { kind: "text", label: "API key", sensitive: "yes" } } },
    });
    ctx.log.note("a document whose sensitive is not a boolean", {
      fields: wrong.fields?.length ?? null,
      diagnostics: (wrong.diagnostics ?? []).map((each) => each.code ?? String(each)),
    });

    expectClaim((wrong.fields ?? []).every((each) => each.name !== "secret"), {
      claimIds: ["SEC-005"],
      what: "a non-boolean sensitive was carried through instead of being refused, so the parser does not read this property",
      detail: JSON.stringify(wrong.fields ?? null),
    });

    // And the protection a draft does offer, so the finding below is a flag that does not reach a
    // mechanism rather than a mechanism that does not exist.
    const storage = memoryStorage();
    const excluded = createForm(buildDynamicFormSchema(documentWith({ sensitive: true })), {
      draft: { key: "excluded", storage, exclude: ["secret"] },
      devWarnings: false,
    });
    excluded.f.secret.set(SECRET);
    excluded.f.plain.set("a name");
    await saved();
    const withExclude = storage.written.get("excluded") ?? "";
    excluded.destroy();

    expectClaim(!withExclude.includes(SECRET) && withExclude.includes("a name"), {
      claimIds: ["PER-001"],
      what: "naming a field in exclude did not keep it out of the draft, so this battle has no working mechanism to compare against",
      detail: withExclude.slice(0, 160),
    });
  },
);

battle(
  {
    claims: ["SEC-005", "PER-001"],
    title: "marking a field sensitive protects it, or says that it did not",
    environments: ["node"],
  },
  async (ctx) => {
    const storage = memoryStorage();
    const diagnostics = recordingDiagnostics();
    const form = createForm(buildDynamicFormSchema(documentWith({ sensitive: true })), {
      draft: { key: "marked", storage },
      diagnostics,
      devWarnings: false,
    });

    form.f.secret.set(SECRET);
    form.f.plain.set("a name");
    await saved();
    const envelope = storage.written.get("marked") ?? "";
    ctx.log.note("a draft written for a field the document marked sensitive", {
      inClear: envelope.includes(SECRET),
      diagnostics: diagnostics.reports.map((each) => each.code ?? String(each)),
    });

    // The control: the draft was written at all, so an absent secret would mean protection rather
    // than a form that never saved anything.
    expectClaim(envelope.includes("a name"), {
      claimIds: ["PER-001"],
      what: "no draft was written, so nothing can be concluded about what it holds",
      detail: envelope.slice(0, 160),
    });

    const spoke = diagnostics.reports.some((each) =>
      JSON.stringify(each).includes("sensitive") || JSON.stringify(each).includes("secret"));

    expectEqual({ inClear: envelope.includes(SECRET), spoke }, { inClear: false, spoke: false }, {
      claimIds: ["SEC-005", "PER-001"],
      what: "a field the document marked sensitive was written to storage in clear text and nothing said so",
      detail: JSON.stringify({ envelope: envelope.slice(0, 160), reports: diagnostics.reports }),
    });

    form.destroy();
  },
);
