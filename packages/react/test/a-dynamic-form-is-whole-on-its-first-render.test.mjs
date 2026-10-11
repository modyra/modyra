/**
 * A form built from a document has the document's rules on its very first render.
 *
 * The server renders once and never runs an effect, and a client's first paint happens before its
 * effects. A rule applied only in an effect is missing from both: the field reads as not required,
 * the form reads as valid, and the server's markup disagrees with the client that hydrates it.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { useMdyDynamicForm } from "../dist/index.js";

const FIELDS = [{ name: "email", kind: "text", label: "Email", validators: { required: true } }];

test("the first render sees the document's required rule and the verdict it implies", () => {
  let seen = null;
  function Probe() {
    const form = useMdyDynamicForm(FIELDS);
    seen = { required: form.f.email.required(), valid: form.state.valid() };
    return null;
  }
  renderToString(createElement(Probe));
  // The premise: the probe rendered at all, so an empty reading is not a pass.
  assert.notEqual(seen, null);
  assert.deepEqual(seen, { required: true, valid: false });
});
