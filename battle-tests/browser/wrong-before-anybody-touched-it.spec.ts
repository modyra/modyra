/**
 * A field that was wrong before the user arrived.
 *
 * Most wrong fields are wrong because somebody typed something. Some are wrong on arrival: an initial
 * value the shape refuses, a draft restored from an older schema, a value a server sent back. Nobody
 * touched them, and nobody may ever touch them — the user has no reason to visit a field they did not
 * fill in.
 *
 * `projectFieldShellA11y` treats the mark and the message as one answer: *the wrapper, the label,
 * `aria-invalid` and whether the error text renders are four faces of one question, answered once*.
 * Withholding one and not the other is the case that comment rules out, and it is the case a form
 * reaches by being restored rather than typed into.
 *
 * What it costs: a control outlined as wrong with no reason beside it, and a submit button that will
 * not go, over a value the person never entered.
 *
 * The control is the same field after a touch, which must show the message in both renderers —
 * otherwise this would be about a page that shows no messages at all, which is finding 125.
 */

import { expect, test } from "@playwright/test";

const HOSTS = [
  { name: "plain", page: "/index.html", ready: "battleReady", api: "battle" },
  { name: "lit", page: "/lit.html", ready: "battleLitReady", api: "battleLit" },
];

for (const host of HOSTS) {
  test(`a field wrong on arrival says why, ${host.name}`, async ({ page }) => {
    test.setTimeout(180_000);
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    // A value the field's own shape refuses, present before anybody arrives.
    await page.evaluate(({ api }) => {
      (window as never as Record<string, { mountFields(i: string, f: unknown[]): unknown }>)[api]
        .mountFields("t", [{ name: "age", kind: "number", label: "Age", initialValue: "not a number" }]);
    }, { api: host.api });
    await page.waitForTimeout(420);

    const state = () => page.evaluate(() => {
      const root = document.querySelector('[data-form="t"]');
      const control = root?.querySelector("input") as HTMLInputElement | null;
      return {
        marked: control?.getAttribute("aria-invalid") ?? null,
        message: (root?.querySelector('[id$="__errors"]')?.textContent ?? "").trim() || null,
      };
    });

    const onArrival = await state();

    // The premise: the form did read the value as wrong. Otherwise there is nothing to explain.
    expect(onArrival.marked, "a value the shape refuses did not mark the control wrong").toBe("true");

    expect(
      onArrival.message,
      "the control is marked wrong and the reason is withheld, over a value the person never typed",
    ).not.toBeNull();

    // The control: after a touch the message is there in both, so the withholding above is about
    // *when* rather than about a page that cannot show messages.
    const control = page.locator('[data-form="t"] input').first();
    await control.focus();
    await control.blur();
    await page.waitForTimeout(340);

    expect((await state()).message, "the message is missing even after the field was touched")
      .toContain("This field holds number");
  });
}
