import assert from "node:assert/strict";
import test from "node:test";

import {
  MDY_DRAFT_KEY_IN_USE,
  MDY_DYNAMIC_MEMBERS,
  MDY_VALIDATION_MESSAGES,
  MDY_VALIDATION_MESSAGES_DEFAULT,
  createForm,
  field,
  flattenDynamicForm,
  validationMessagesForLocale,
} from "../dist/index.js";

/**
 * A rule's message in the language a form is written in.
 *
 * Published as a table per language and a function that chooses one, so a host can read a message
 * without running a form — a summary above the fields, a report, a server saying the same thing the
 * page said. A locale nobody has a table for falls back to the default rather than to nothing: an
 * empty message is a field that refuses and does not say why.
 */
test("a validation message is answered in the language asked for, or in the default", () => {
  /** @type {import("../dist/index.js").MdyValidationMessages} */
  const italian = validationMessagesForLocale("it");
  assert.equal(italian.required, "Campo obbligatorio");
  assert.equal(validationMessagesForLocale("zz").required, MDY_VALIDATION_MESSAGES_DEFAULT.required);
  assert.equal(validationMessagesForLocale("it-CH").required, MDY_VALIDATION_MESSAGES.it.required);

  // Every language answers every rule the default answers: a table missing one is a field that
  // refuses silently in that language only.
  for (const [language, table] of Object.entries(MDY_VALIDATION_MESSAGES)) {
    for (const rule of Object.keys(MDY_VALIDATION_MESSAGES_DEFAULT)) {
      assert.ok(table[rule], `${language} has no message for ${rule}`);
    }
  }
});

/**
 * The members each slot of a document declares, which the parser reports an undeclared one against.
 *
 * Published because the contract audit holds them against the JSON Schemas, and because a host
 * generating a document can read what a slot may carry rather than guessing from an example.
 */
test("the declared members of a document's slots are published, and a field's include its name", () => {
  assert.deepEqual(
    Object.keys(MDY_DYNAMIC_MEMBERS).sort(),
    ["document", "field", "layoutColumns", "layoutSection", "layoutSlot", "option", "rule", "validation", "validators"],
  );
  assert.ok(MDY_DYNAMIC_MEMBERS.field.includes("name"));
  assert.ok(MDY_DYNAMIC_MEMBERS.document.includes("requiresContext"));
  assert.ok(MDY_DYNAMIC_MEMBERS.option.includes("value"));
});

/**
 * The pair a document is taken apart into —
 * `{@link import("../dist/index.js").MdyDynamicFlatForm}` — carries a collection's row template.
 */
test("a flattened document carries the shape of a row for a collection that has none", () => {
  /** @type {import("../dist/index.js").MdyDynamicFlatForm} */
  const flat = flattenDynamicForm({
    node: "group",
    children: {
      rows: {
        node: "record",
        item: { node: "group", children: { code: { node: "field", field: { kind: "text" } } } },
      },
    },
  });

  assert.deepEqual(flat.fields, [], "a collection with no rows names no flat field");
  assert.equal(flat.collections[0]?.path, "rows");
  assert.deepEqual(flat.collections[0]?.item?.fields.map((each) => each.name), ["code"]);
});

/**
 * The code a form reports when a draft key already holds another form's work.
 *
 * Published so a host can key on it: the message says what happened, and the code is what a sink
 * filters on without matching text.
 */
test("a draft key another form is using is refused under a published code", async () => {
  const written = new Map();
  const storage = {
    read: (key) => written.get(key) ?? null,
    write: (key, value) => written.set(key, value),
    remove: (key) => written.delete(key),
  };
  const first = createForm({ a: field("") }, { draft: { key: "shared", storage, debounceMs: 0 }, devWarnings: false });
  first.f.a.set("mine");
  await new Promise((resolve) => setTimeout(resolve, 40));
  first.destroy();

  // Said to the console, which is where this engine says everything it has to say to a host — the
  // code is what makes the sentence keyable rather than matchable.
  const heard = [];
  const realWarn = console.warn;
  console.warn = (...parts) => heard.push(parts.map(String).join(" "));
  let second;
  try {
    second = createForm({ b: field("") }, { draft: { key: "shared", storage, debounceMs: 0 } });
    second.f.b.set("theirs");
    await new Promise((resolve) => setTimeout(resolve, 60));
  } finally {
    console.warn = realWarn;
  }

  assert.ok(
    heard.some((said) => said.includes("belongs to another")),
    `a form took a key holding another form's draft without saying so: ${JSON.stringify(heard)}`,
  );
  // And the code the refusal carries is the published one, which is what a sink filters on: the
  // console line carries the sentence, a sink carries the code.
  const reported = [];
  const third = createForm(
    { c: field("") },
    { draft: { key: "shared", storage, debounceMs: 0 }, diagnostics: { report: (entry) => reported.push(entry.code) } },
  );
  third.f.c.set("mine too");
  await new Promise((resolve) => setTimeout(resolve, 60));
  assert.ok(
    reported.includes(MDY_DRAFT_KEY_IN_USE),
    `the refusal did not reach a sink under its published code: ${JSON.stringify(reported)}`,
  );
  third.destroy();
  assert.equal(JSON.parse(written.get("shared")).value.a, "mine", "the other form's draft was replaced");
  second.destroy();
});
