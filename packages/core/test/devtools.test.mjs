/**
 * Devtools panel: external strings (paths, values, error messages) must be
 * HTML-escaped before interpolation into innerHTML (SECURITY.md: never
 * render external strings as HTML).
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { mdyFormSnapshot, mountMdyDevtools } from "../dist/devtools.js";

const makeForm = (path, value, message) => ({
  state: {
    valid: () => false,
    pending: () => false,
    submitting: () => false,
    submitCount: () => 0,
  },
  fieldNames: () => [path],
  getField: () => () => ({
    value: () => value,
    valid: () => false,
    touched: () => false,
    dirty: () => false,
    pending: () => false,
    errors: () => [{ kind: "server", message }],
  }),
});

const makeHost = () => ({
  classList: { add() {} },
  style: { cssText: "" },
  innerHTML: "",
});

test("devtools escapes HTML in field values and error messages", () => {
  const form = makeForm(
    "comment",
    '<img src=x onerror="alert(1)">',
    "<script>alert(2)</script>",
  );
  const host = makeHost();
  const dispose = mountMdyDevtools(form, host, 1_000_000);
  dispose();

  assert.ok(host.innerHTML === "", "dispose clears the panel");
  const rendered = (() => {
    const h = makeHost();
    const d = mountMdyDevtools(form, h, 1_000_000);
    const html = h.innerHTML;
    d();
    return html;
  })();
  assert.ok(!rendered.includes("<img"), "raw <img> must not reach innerHTML");
  assert.ok(!rendered.includes("<script>"), "raw <script> must not reach innerHTML");
  assert.ok(rendered.includes("&lt;img"), "value is escaped, not dropped");
  assert.ok(rendered.includes("&lt;script&gt;"), "error message is escaped, not dropped");
});

test("devtools escapes HTML in field paths", () => {
  const host = makeHost();
  const dispose = mountMdyDevtools(
    makeForm('<b onmouseover="x()">p</b>', "v", "e"),
    host,
    1_000_000,
  );
  assert.ok(!host.innerHTML.includes("<b onmouseover"), "raw path markup must not reach innerHTML");
  assert.ok(host.innerHTML.includes("&lt;b"), "path is escaped, not dropped");
  dispose();
});

test("snapshot still masks sensitive fields", () => {
  const snap = mdyFormSnapshot(makeForm("password", "hunter2", "bad"));
  assert.equal(snap.fields[0].value, "•••");
});
