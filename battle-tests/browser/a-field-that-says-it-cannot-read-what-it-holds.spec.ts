/**
 * A control that says it cannot read what it is showing, on a form that sends anyway.
 *
 * A date field accepts typing as well as picking, so it has a state no other kind has: text the user
 * meant as a date and the field cannot parse. The widgets carry a message for exactly this, in all
 * five languages — "That could not be read. Leave it and correct it, or clear the field." — and the
 * handling around it is careful. The typed text stays on screen, which is what the message promises
 * and what UI-006 requires: the widget does not erase what the user wrote in order to make itself
 * consistent. The control is marked `aria-invalid="true"` and shows the message.
 *
 * The form's verdict does not include it. The model holds `null`, no rule objects to a `null`, and
 * submitting sends `{"when": null}` while the field on screen reads "not a date" and carries an
 * error telling the user to correct it.
 *
 * What the server receives is a field the user left empty. There is no way to tell that apart from a
 * field the user actually left empty, and the one party who could tell — the page — was displaying
 * the difference at the moment it sent.
 *
 * The submit path does respect the form's errors: the same field marked required refuses, stacking
 * "This field is required" under the unreadable message. So this is not a form that submits through
 * anything. It is an error the verdict cannot see.
 */

import { expect, test } from "@playwright/test";

/** A document with one date field, optionally one the user must fill. */
const documentWith = (required: boolean) => ({
  version: 3,
  fields: [{
    name: "when",
    kind: "datepicker",
    label: "When",
    initialValue: "2026-04-03",
    ...(required ? { validators: { required: true } } : {}),
  }],
});

/** Text a user could type into a date field meaning it as a date. */
const UNREADABLE = "not a date";

test("a form does not send a field that says it cannot be read", async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto("/index.html");
  await page.waitForFunction(() => (window as never as Record<string, boolean>).battleReady === true);

  const mount = async (id: string, required: boolean) => {
    const outcome = await page.evaluate(({ mountId, doc }) =>
      (window as never as Record<string, { mountDocument(i: string, e: unknown): { mounted: boolean } }>)
        .battle.mountDocument(mountId, doc), { mountId: id, doc: documentWith(required) });
    expect(outcome.mounted, "the document did not mount").toBe(true);
    await page.waitForTimeout(300);
  };
  const control = (id: string) => page.evaluate((sel) => {
    const root = document.querySelector(sel);
    const input = root?.querySelector("input") as HTMLInputElement | null;
    return {
      shown: input?.value ?? null,
      ariaInvalid: input?.getAttribute("aria-invalid") ?? null,
      errors: root ? Array.from(root.querySelectorAll(".mdy-control__errors li")).map((e) => (e.textContent ?? "").trim()) : [],
    };
  }, `[data-form="${id}"]`);
  /**
   * Whether the page is offering to send this form.
   *
   * The generated button carries no type of its own — a form that reports its own errors keeps the
   * browser's submit behaviour out of it — so it is found by the label it was given.
   */
  const offered = (id: string) => page.evaluate((sel) => {
    const button = Array.from(document.querySelectorAll(`${sel} button`))
      .find((each) => (each.textContent ?? "").trim() === "Submit") as HTMLButtonElement | undefined;
    return button === undefined ? null : button.disabled === false;
  }, `[data-form="${id}"]`);

  /**
   * Press submit if the page offers it, and report what was sent.
   *
   * A disabled button is the page declining, which is an answer rather than a reason to wait: a
   * click that waits for it to become enabled never returns.
   */
  const submit = async (id: string) => {
    if (await offered(id) === true) {
      await page.locator(`[data-form="${id}"] button`, { hasText: /^Submit$/ }).first().click();
      await page.waitForTimeout(360);
    }
    return page.evaluate(({ mountId }) =>
      (window as never as Record<string, { submittedBy(i: string): unknown[] }>).battle.submittedBy(mountId),
      { mountId: id });
  };
  const type = async (id: string, text: string) => {
    const input = page.locator(`[data-form="${id}"] input`).first();
    await input.fill(text);
    await input.blur();
    await page.waitForTimeout(340);
  };

  // The control: a readable date submits, so a refusal below is the state rather than a page that
  // never sends anything.
  await mount("readable", false);
  expect(await submit("readable")).toEqual([{ when: "2026-04-03" }]);

  // And the control that the submit path does respect the form's errors: the same field, required,
  // refuses while it holds nothing readable.
  await mount("required", true);
  await type("required", UNREADABLE);
  const requiredState = await control("required");
  expect(requiredState.errors.length, "a required field holding unreadable text reported nothing").toBeGreaterThan(0);
  expect(await offered("required"), "the page offered to send a required field holding nothing readable").toBe(false);
  expect(await submit("required"), "a required field with nothing readable in it was sent").toEqual([]);

  // The field the document did not mark required, holding text it says it cannot read.
  await mount("optional", false);
  await type("optional", UNREADABLE);
  const state = await control("optional");

  expect(state.shown, "the typed text was erased instead of left for the user to correct").toBe(UNREADABLE);
  expect(state.ariaInvalid, "the control does not report itself invalid").toBe("true");
  expect(state.errors, "the control does not say it cannot read what it holds").not.toEqual([]);

  expect(
    await offered("optional"),
    "the page offers to send a form while showing an error on the field it would send as empty",
  ).toBe(false);

  expect(
    await submit("optional"),
    "a form sent a field as empty while the page was showing the text it could not read",
  ).toEqual([]);
});
