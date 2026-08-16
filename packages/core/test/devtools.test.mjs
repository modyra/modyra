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

test("a field decides whether the panel shows its value, and the name heuristic only fills the silence", async () => {
  const { isSensitivePath } = await import("../dist/devtools.js");

  // Undeclared: the guess, which is useful and imperfect.
  assert.equal(isSensitivePath("password"), true);
  assert.equal(isSensitivePath("nickname"), false);
  // `cardStyle` is not a card number, and `notes` may hold a recovery phrase. A guess cannot know
  // either; a declaration does, and wins in both directions.
  assert.equal(isSensitivePath("cardStyle"), true);
  assert.equal(isSensitivePath("cardStyle", false), false);
  assert.equal(isSensitivePath("notes", true), true);
});

test("a masked value is not readable through the error printed beside it", () => {
  // Masking the value column and printing the value in the next one does not mask the value, and
  // quoting what was rejected is the most ordinary way to write a validation message. The server
  // half is worse: a message that arrives over the wire is not the consumer's to rewrite.
  const form = makeForm("password", "hunter2-the-actual-password", '"hunter2-the-actual-password" is not long enough');
  const snapshot = mdyFormSnapshot(form);
  const field = snapshot.fields[0];

  assert.equal(field.value, "•••");
  assert.equal(
    JSON.stringify(snapshot).includes("hunter2-the-actual-password"),
    false,
    "the secret is somewhere in the snapshot",
  );
  // The reason survives — a panel exists to say why a field is invalid.
  assert.match(field.errors[0], /is not long enough/);
});

test("a masked number and a masked list of values are redacted too", () => {
  const pin = mdyFormSnapshot(makeForm("cardSecret", 1234, "1234 is not a valid code"));
  assert.equal(JSON.stringify(pin).includes("1234"), false);

  const list = mdyFormSnapshot(makeForm("tokenList", ["tok_a", "tok_bb"], "tok_a and tok_bb were revoked"));
  assert.equal(JSON.stringify(list).includes("tok_a"), false, "a value inside a list stayed readable");
  assert.equal(JSON.stringify(list).includes("tok_bb"), false);
});

test("a field nobody masked keeps its message as it was written", () => {
  const snapshot = mdyFormSnapshot(makeForm("nickname", "ada", '"ada" is already taken'));
  assert.equal(snapshot.fields[0].value, "ada");
  assert.equal(snapshot.fields[0].errors[0], '[server] "ada" is already taken');
});

test("the panel survives a value JSON cannot carry", () => {
  // The panel is what a developer opens when something is already wrong, so a value the form is
  // allowed to hold must not be the thing that stops it: the engine reports an unexpected shape as
  // a verdict rather than refusing the write, and a BigInt reaching the row renderer used to raise
  // inside the render effect, freezing the panel on its previous paint.
  const host = makeHost();
  const dispose = mountMdyDevtools(makeForm("total", 10n, "wrong shape"), host, 1_000_000);
  const rendered = host.innerHTML;
  dispose();

  assert.match(rendered, /<td>total<\/td>/, "the field is not in the panel at all");
  assert.match(rendered, /\[BigInt: 10\]/, "the panel does not say what the value is");
});
