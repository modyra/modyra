/**
 * A form that says `Cerca…` and then `This field is required`.
 *
 * A field that declares a locale speaks it — that is the rule in the renderer's own words, and it
 * holds: the search box inside an Italian multiselect reads `Cerca…`, and the same field under
 * `en-GB` reads `Search…`. Forty keys of chrome follow the tag.
 *
 * None of them is a refusal. `messagesForLocale` has placeholders, button labels and announcements
 * and no validation wording at all, and a document cannot supply its own: `$defs.validators` declares
 * `required, email, min, max, minLength, maxLength, pattern` and no message. So a form generated for
 * an Italian user asks in Italian and refuses in English, and nothing the author writes changes it.
 *
 * The contrast is inside the same contract. `MdyDynamicValidation` — the cross-field slot — makes
 * `message` **required**, with the reason stated: *a validation nobody can read is a field that will
 * not submit for no stated reason*. The same sentence applies to the per-field rules, which have no
 * message to require.
 *
 * The chrome is asserted first, in both locales. Without it, a page where the locale never arrived
 * would produce the same English refusal and look like this finding.
 *
 * Claims under attack: LOC-003, DYN-001.
 */

import { expect, test } from "@playwright/test";

type Api = Record<string, {
  mountFields(id: string, fields: unknown[]): unknown;
  submit(id: string): unknown;
  dispose(id: string): void;
}>;

/** What a form shows for one locale: a chrome string that follows it, and a refusal. */
async function speaking(page: import("@playwright/test").Page, locale: string) {
  await page.evaluate((tag) => {
    (window as never as Api).battle.mountFields("i", [
      { name: "who", kind: "text", label: "Nome", locale: tag, validators: { required: true } },
      { name: "tags", kind: "multiselect", label: "Etichette", locale: tag, options: [{ value: "a", label: "A" }] },
    ]);
  }, locale);
  await page.waitForTimeout(320);

  const openers = page.locator('[data-form="i"] button, [data-form="i"] [role="combobox"]');
  for (let index = 0; index < Math.min(await openers.count(), 3); index += 1) {
    await openers.nth(index).click({ timeout: 2200 }).catch(() => {});
    await page.waitForTimeout(200);
    if (await page.locator(".mdy-multiselect-overlay__input").count() > 0) break;
  }
  const chrome = await page.evaluate(() =>
    (document.querySelector(".mdy-multiselect-overlay__input") as HTMLInputElement | null)?.placeholder ?? null);

  await page.evaluate(() => (window as never as Api).battle.submit("i"));
  await page.waitForTimeout(340);
  const refusal = await page.evaluate(() =>
    (document.querySelector('[data-form="i"] [id$="__errors"]')?.textContent ?? "").trim() || null);

  await page.evaluate(() => (window as never as Api).battle.dispose("i"));
  await page.waitForTimeout(60);
  return { chrome, refusal };
}

test("a refusal in a language nobody asked for", async ({ page }) => {
  test.setTimeout(200_000);
  await page.goto("/index.html");
  await page.waitForFunction(() => (window as never as Record<string, boolean>).battleReady === true);

  const italian = await speaking(page, "it-IT");
  const english = await speaking(page, "en-GB");

  // The control: the locale reaches the page and changes what it says.
  expect(italian.chrome, "the Italian form's search box does not speak Italian, so the locale never arrived").toBe("Cerca…");
  expect(english.chrome, "the English form's search box does not speak English").toBe("Search…");

  // The premise: both forms refused, so there is a refusal to read.
  expect(italian.refusal, "the Italian form did not refuse, so there is nothing to read it in").not.toBeNull();

  expect(
    italian.refusal,
    `the same form says ${JSON.stringify(italian.chrome)} in its controls and ${JSON.stringify(italian.refusal)} in its refusal, and a document has no message to give it`,
  ).not.toBe(english.refusal);
});
