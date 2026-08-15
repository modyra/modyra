/**
 * A cross-field rule the document carries, the parser compiles, and the page does not apply.
 *
 * `validations` is a top-level key of the Dynamic Form Contract: an expression, a message, and
 * optionally the field that wears the error. It is what a document uses to say the things a single
 * field cannot — an end after a start, a confirmation matching what it confirms, a total that has to
 * add up.
 *
 * The parser accepts it and reports it. `buildDynamicValidations` compiles it into form-level
 * validators, and applied to a form they fire: the form goes invalid and the document's own message
 * lands on the document's own target.
 *
 * Nothing a renderer publishes has a place to put them. The mount options carry `collections`,
 * `layout`, `onSubmit`, `submitLabel` and `idPrefix`; the builder beneath them takes fields,
 * reactivity and collections. So a page built from a document holds every per-field rule the
 * document declared and none of its cross-field ones, and a form the document says is wrong is
 * valid and submittable.
 *
 * The control is the same document's per-field rule, on the same page, in the same mount: it becomes
 * a native constraint and produces the document's message when broken. Document validation is wired.
 * It is the cross-field kind that is dropped, silently and with nothing to read.
 */

import { expect, test } from "@playwright/test";

/** A document whose two rules are both about the same two fields. */
const DOCUMENT = {
  version: 3,
  fields: [
    { name: "start", kind: "text", label: "Start", initialValue: "same", validators: { minLength: 2 } },
    { name: "end", kind: "text", label: "End", initialValue: "same" },
  ],
  validations: [{
    when: { op: "equals", operands: [{ path: "start" }, { path: "end" }] },
    message: "Start and end must differ",
    target: "end",
  }],
};

test("a document's cross-field rule reaches the page", async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto("/index.html");
  await page.waitForFunction(() => (window as never as Record<string, boolean>).battleReady === true);

  const outcome = await page.evaluate((doc) =>
    (window as never as Record<string, { mountDocument(i: string, e: unknown): { mounted: boolean } }>)
      .battle.mountDocument("v", doc), DOCUMENT);

  // The premise: the document parsed and the page was built from it. A refused document would make
  // everything below vacuous.
  expect(outcome.mounted, "the document did not parse, so nothing was drawn from it").toBe(true);
  await page.waitForTimeout(320);

  const errorsOn = (name: string) => page.evaluate((field) => {
    const control = document.querySelector(`[data-form="v"] [data-mdy-field="${field}"]`);
    return control
      ? Array.from(control.querySelectorAll(".mdy-control__errors li")).map((each) => (each.textContent ?? "").trim())
      : null;
  }, name);

  // The control: the per-field rule from the same document is applied. Break it, and the document's
  // own message appears on the field that carries it.
  const first = page.locator('[data-form="v"] input').first();
  await first.fill("x");
  await first.blur();
  await page.waitForTimeout(320);
  expect(await errorsOn("start"), "the document's per-field rule was not applied either").toEqual(["Minimum length is 2"]);

  // Put it back, so the only thing wrong with the form is the thing the document's cross-field rule
  // is about: the two fields holding the same value.
  await first.fill("same");
  await first.blur();
  await page.waitForTimeout(320);

  const state = await page.evaluate(() => {
    const form = (window as never as Record<string, { valueOf(i: string): Record<string, unknown> }>).battle.valueOf("v");
    return { start: form.start, end: form.end };
  });
  expect(state, "the two fields do not hold the same value, so the rule has nothing to fire on").toEqual({ start: "same", end: "same" });

  expect(
    await errorsOn("end"),
    "a form the document declares invalid carries none of its cross-field message",
  ).toEqual(["Start and end must differ"]);
});
