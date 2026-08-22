/**
 * Pressing send twice before the first one answers.
 *
 * It is the ordinary way a slow submission is met: the page did not visibly change, so the person
 * presses again. Where the submission books a seat, charges a card or files a claim, running the
 * handler twice is the most expensive defect a form can have, and it is invisible in every test that
 * submits once and waits.
 *
 * Two guards, and this asks for both. The **button** goes out of action while a submission is in
 * flight, so the ordinary second press cannot happen. The **engine** refuses a second submission
 * however it was asked for, which is what protects a page that drives the form itself — a keyboard
 * shortcut, a retry, a host with no button of its own.
 *
 * And the third thing, which is the control: the guard lets go. A form that refused every submission
 * after the first would pass a test that only counts them.
 */

import { expect, test } from "@playwright/test";

// **Every renderer, from the shared list.** The local list this replaced was not a scope
// decision: the angular host published six of the twenty-two doors these specs need, so a
// spec wanting one it lacked left the renderer out and the next reader copied the list.
import { HOSTS } from "./bench";

for (const host of HOSTS) {
  test(`two submissions at once run the handler once, ${host.name}`, async ({ page }) => {
    test.setTimeout(180_000);
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    await page.evaluate(({ api }) => {
      (window as never as Record<string, { mountFields(i: string, f: unknown[]): unknown }>)[api]
        .mountFields("t", [{ name: "who", kind: "text", label: "Who", initialValue: "lorenzo" }]);
    }, { api: host.api });
    await page.waitForTimeout(300);

    const sentCount = () => page.evaluate(({ api }) =>
      (window as never as Record<string, { submittedBy(i: string): unknown[] }>)[api].submittedBy("t").length,
      { api: host.api });

    // Two, fired without waiting for the first.
    await page.evaluate(async ({ api }) => {
      const battle = window as never as Record<string, { submitAnswering(i: string, a: unknown): Promise<void> }>;
      const first = battle[api].submitAnswering("t", null);
      const second = battle[api].submitAnswering("t", null);
      await Promise.allSettled([first, second, new Promise((resolve) => setTimeout(resolve, 600))]);
    }, { api: host.api });
    await page.waitForTimeout(320);

    expect(await sentCount(), "a second submission ran while the first was still in flight").toBe(1);

    // The control: the guard lets go. Otherwise "one" would be true of a form that never sends again.
    await page.evaluate(({ api }) =>
      (window as never as Record<string, { submit(i: string): Promise<number> }>)[api].submit("t"),
      { api: host.api });
    await page.waitForTimeout(340);

    expect(await sentCount(), "the form refused every submission after the first, so the guard never lets go").toBe(2);
  });
}

test("the button goes out of action while a submission is in flight", async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto("/index.html");
  await page.waitForFunction(() => (window as never as Record<string, boolean>).battleReady === true);

  // A submission slow enough that a person would press again.
  await page.evaluate(() => {
    (window as never as Record<string, { mountSlowSubmit(i: string, f: unknown[], ms: number): unknown }>).battle
      .mountSlowSubmit("s", [{ name: "who", kind: "text", label: "Who", initialValue: "lorenzo" }], 900);
  });
  await page.waitForTimeout(300);

  const state = () => page.evaluate(() => {
    // `window.battle`, not `window`: the host hangs its operations off that one name, and reading
    // them from the window itself is a quiet `undefined` rather than an error.
    const battle = (window as never as Record<string, Record<string, (i: string) => never>>).battle;
    const button = Array.from(document.querySelectorAll('[data-form="s"] button'))
      .find((each) => (each.textContent ?? "").trim() === "Submit") as HTMLButtonElement | undefined;
    return { submitting: battle.submittingOf("s"), sent: battle.submittedBy("s").length, offered: button === undefined ? null : !button.disabled };
  });

  expect(await state(), "the form is already submitting before anything was pressed")
    .toEqual({ submitting: false, sent: 0, offered: true });

  const button = page.locator('[data-form="s"] button', { hasText: /^Submit$/ }).first();
  await button.click();
  await page.waitForTimeout(220);

  expect(await state(), "the button stayed offered while a submission was in flight")
    .toEqual({ submitting: true, sent: 1, offered: false });

  // Press it again anyway, and ask the form directly as well.
  await button.click({ force: true }).catch(() => undefined);
  await page.evaluate(() => (window as never as Record<string, { submit(i: string): Promise<number> }>).battle.submit("s")).catch(() => undefined);
  await page.waitForTimeout(240);

  expect((await state()).sent, "a second submission got through while the first was in flight").toBe(1);

  await page.waitForTimeout(1200);
  expect(await state(), "the form did not come back to rest after its submission answered")
    .toEqual({ submitting: false, sent: 1, offered: true });
});
