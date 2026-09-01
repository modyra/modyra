/**
 * The drawing layer takes readings and nothing else.
 *
 * The signature is the mechanism, not a rule anyone has to remember: there is no overload taking a
 * bare `T`, so a caller holding one cannot reach the drawing layer without first saying where it
 * came from or why there is none. A layer that accepted both would depend on its authors choosing
 * the right call every time, which is the habit being replaced rather than a defence against it.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { drawReadings, reading, unread } from "../dist/testing/index.js";

/** A host that records what it was asked to draw, so the cells can be read back. */
function recorder() {
  const rows = [];
  return {
    rows,
    row() {
      const cells = [];
      rows.push(cells);
      return { append: (...given) => cells.push(...given) };
    },
    cell: (text, kind) => ({ text, kind }),
  };
}

const WHERE = { source: "input", at: "text.control", method: "getAttribute(id)" };

test("a read value is drawn with where it came from", () => {
  const host = recorder();
  drawReadings(host, [{ label: "id", reading: reading(WHERE, () => "field-1") }]);

  const [row] = host.rows;
  assert.equal(row[0].text, "id");
  assert.equal(row[1].text, "field-1");
  assert.equal(row[1].kind, "value");
  // The column a reader uses to go and look for themselves.
  assert.match(row[2].text, /input/);
  assert.match(row[2].text, /getAttribute\(id\)/);
});

test("an unread is drawn as a reason, and no cell is empty", () => {
  const host = recorder();
  drawReadings(host, [
    { label: "no probe", reading: reading(WHERE, () => undefined) },
    { label: "threw", reading: reading(WHERE, () => { throw new Error("bad selector"); }) },
    { label: "not asked", reading: unread("not-attempted", "text.control") },
    { label: "unsupported", reading: unread("unsupported", "text.control") },
  ]);

  assert.equal(host.rows.length, 4);
  for (const row of host.rows) {
    for (const cell of row) {
      assert.notEqual(cell.text.trim(), "", "a cell was drawn blank, which reads as an absent value");
    }
    assert.equal(row[1].kind, "unread", "an unread was drawn as though it carried a value");
  }
});

test("a value that is legitimately empty is drawn as a value, not as an absence", () => {
  const host = recorder();
  drawReadings(host, [{ label: "aria-label", reading: reading(WHERE, () => "") }]);
  const [row] = host.rows;
  assert.equal(row[1].kind, "value", "an empty string was drawn as though nobody had looked");
});

test("how a value is shown is the caller's, and the reason never is", () => {
  const host = recorder();
  drawReadings(
    host,
    [
      { label: "present", reading: reading(WHERE, () => ({ verdict: "drawn" })) },
      { label: "absent", reading: unread("absent-probe", "text.popup") },
    ],
    (value) => `verdict: ${value.verdict}`,
  );
  assert.equal(host.rows[0][1].text, "verdict: drawn");
  // The formatter is not consulted for an unread: there is no value to format, and asking it would
  // hand a caller the chance to render one as blank.
  assert.match(host.rows[1][1].text, /not read/);
});
