/**
 * One form, one locale, two refusals, two languages.
 *
 * A field that declares a locale speaks it, and it does — including in a refusal the **widget** makes.
 * An Italian date box handed prose says `Non è stato possibile leggerlo. Correggilo, oppure svuota il
 * campo.` That message is one of forty keys in `messagesForLocale`, and it follows the tag.
 *
 * A refusal a **validator** makes does not. `required` carries `'This field is required'` as a default
 * in `@modyra/core`, there is no validation wording in any locale table, and a document cannot supply
 * its own — `$defs.validators` declares `required, email, min, max, minLength, maxLength, pattern`
 * and no message.
 *
 * So the same form, asked for one language, shows both:
 *
 *     Non è stato possibile leggerlo. Correggilo, oppure svuota il campo.
 *     This field is required
 *
 * The contrast is inside the same contract. `MdyDynamicValidation` — the cross-field slot — makes
 * `message` **required**, and says why: *a validation nobody can read is a field that will not submit
 * for no stated reason*. The per-field rules have no message to require.
 *
 * The English run is the control: there both refusals are English, so what fails is the mixing rather
 * than one of the two being untranslated.
 *
 * Claims under attack: LOC-003, DYN-001.
 */

import { expect, test } from "@playwright/test";

type Api = Record<string, {
  mountFields(id: string, fields: unknown[]): unknown;
  submit(id: string): unknown;
  errorsOf(id: string, path: string): Array<{ message?: string }>;
  dispose(id: string): void;
}>;

/** Both kinds of refusal from one form, in one language. */
async function refusalsIn(page: import("@playwright/test").Page, locale: string, unreadable: string) {
  await page.evaluate((tag) => {
    (window as never as Api).battle.mountFields("t", [
      { name: "quando", kind: "datepicker", label: "Quando", locale: tag },
      { name: "nome", kind: "text", label: "Nome", locale: tag, validators: { required: true } },
    ]);
  }, locale);
  await page.waitForTimeout(320);

  const dateBox = page.locator('[data-form="t"] input[type="text"]').first();
  await dateBox.fill(unreadable);
  await dateBox.blur();
  await page.waitForTimeout(240);

  await page.evaluate(() => (window as never as Api).battle.submit("t"));
  await page.waitForTimeout(360);

  const seen = await page.evaluate(() => {
    const battle = (window as never as Api).battle;
    return {
      fromTheWidget: battle.errorsOf("t", "quando").map((each) => each.message ?? ""),
      fromTheValidator: battle.errorsOf("t", "nome").map((each) => each.message ?? ""),
    };
  });
  await page.evaluate(() => (window as never as Api).battle.dispose("t"));
  await page.waitForTimeout(60);
  return seen;
}

test("a refusal in a language nobody asked for", async ({ page }) => {
  test.setTimeout(200_000);
  await page.goto("/index.html");
  await page.waitForFunction(() => (window as never as Record<string, boolean>).battleReady === true);

  const english = await refusalsIn(page, "en-GB", "4 March 2026");
  const italian = await refusalsIn(page, "it-IT", "4 marzo 2026");

  // The premise: both forms produced both kinds of refusal, so there are two to compare.
  for (const [where, seen] of [["English", english], ["Italian", italian]] as const) {
    expect(seen.fromTheWidget.length, `the ${where} form's date box did not refuse, so there is nothing to compare`).toBeGreaterThan(0);
    expect(seen.fromTheValidator.length, `the ${where} form's required rule did not fire`).toBeGreaterThan(0);
  }

  // The control: asked for English, both refusals are the English ones. So what fails below is the
  // mixing rather than one of the two never being translated at all.
  expect(english.fromTheWidget.join(" "), "the English widget refusal is not the English one").toContain("could not be read");
  expect(english.fromTheValidator.join(" "), "the English validator refusal is not the English one").toContain("required");

  // And the same form asked for Italian: the widget speaks it, so the validator must too.
  expect(italian.fromTheWidget.join(" "), "the Italian widget refusal did not follow the locale, so this is a different finding").not.toContain("could not be read");

  expect(
    italian.fromTheValidator.join(" "),
    `one form asked for Italian shows ${JSON.stringify(italian.fromTheWidget[0])} and ${JSON.stringify(italian.fromTheValidator[0])}, and a document has no message to give it`,
  ).not.toBe(english.fromTheValidator.join(" "));
});
