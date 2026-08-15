/**
 * A page that cannot keep what the user typed.
 *
 * Draft persistence is a headline of this engine: `docs/guides/typed-forms.md` documents debounced
 * autosave, restore on load and field exclusion, and four claims cover it. A form takes it as an
 * option — `draft: { key, storage }` — and writes as the user types.
 *
 * One renderer's published mount has nowhere to put that option. Its options are `collections`,
 * `onSubmit`, `submitLabel`, `layout` and `idPrefix`; it builds the form itself, and the form it
 * builds has no draft. Handing the option in anyway is accepted without a word and nothing is ever
 * written.
 *
 * The other renderer takes its options straight to the form, so the same call keeps a draft — which
 * is what makes this a missing slot rather than a feature that does not work.
 *
 * The same shape as finding 117, where a document's cross-field validations have a compiler that no
 * adapter can call.
 */

import { expect, test } from "@playwright/test";

const HOSTS = [
  { name: "plain", page: "/index.html", ready: "battleReady", api: "battle" },
  { name: "lit", page: "/lit.html", ready: "battleLitReady", api: "battleLit" },
];

for (const host of HOSTS) {
  test(`a form asked to keep a draft keeps one, ${host.name}`, async ({ page }) => {
    test.setTimeout(180_000);
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    const outcome = await page.evaluate(({ api }) => {
      window.localStorage.clear();
      return (window as never as Record<string, { mountFields(i: string, f: unknown[], o?: unknown): { mounted: boolean } }>)[api]
        .mountFields("d", [{ name: "who", kind: "text", label: "Who" }], { draft: { key: "kept" } });
    }, { api: host.api });

    // The premise: asking for a draft did not stop the form being built.
    expect(outcome.mounted, "a form asked to keep a draft did not mount at all").toBe(true);
    await page.waitForTimeout(300);

    const control = page.locator('[data-form="d"] input').first();
    expect(await control.count(), "the form built no control to type into").toBe(1);

    await control.fill("typed into a draft");
    await control.blur();
    // The engine debounces before it writes.
    await page.waitForTimeout(900);

    const stored = await page.evaluate(() => {
      const keys = Object.keys(window.localStorage);
      return keys.length === 0 ? null : String(window.localStorage.getItem(keys[0]));
    });

    expect(
      stored,
      "the form was asked to keep a draft, accepted the option without a word, and kept nothing",
    ).not.toBeNull();

    expect(stored, "something was written but it does not hold what was typed").toContain("typed into a draft");
  });
}
