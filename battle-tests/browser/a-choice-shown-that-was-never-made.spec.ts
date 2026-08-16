/**
 * A control naming a choice the form is not holding.
 *
 * UI-004 is the promise: a choice the list no longer offers is still shown as the choice it is, and
 * `optionsWithUnrecognizedValue` is where it is kept — what it will not erase, it has to show. The
 * value contracts say why the case is ordinary rather than exotic: an option's value is whatever the
 * option list holds, so a list that changed between a draft and a reload, or a value an application
 * fetched, is a value with no option behind it.
 *
 * A native `<select>` cannot hold one. Assigning a value that matches no `<option>` leaves the
 * element on index 0, and the page then presents the *first offered choice* as the current one. That
 * is not the same failure as showing nothing: the model holds one thing and the control says
 * another, and the two are both plausible answers, so nothing on screen reveals which is real.
 *
 * The message makes it worse rather than better. On a submit attempt the field reads "Value must be
 * one of: Alpha, Beta" while the control visibly shows Alpha — an instruction the user has, from
 * where they are standing, already followed.
 *
 * Each assertion carries its controls: the same field holding an offered value shows it, so the
 * measurement is about the unoffered one; and the two kinds beside it in the same renderer select
 * nothing at all, so this is one control's answer rather than the renderer's.
 *
 * Claims under attack: UI-004.
 */

import { expect, test } from "@playwright/test";

const OPTIONS = [{ value: "a", label: "Alpha" }, { value: "b", label: "Beta" }];

const HOSTS = [
  { name: "plain", page: "/index.html", ready: "battleReady", api: "battle" },
  { name: "lit", page: "/lit.html", ready: "battleLitReady", api: "battleLit" },
] as const;

type Api = Record<string, {
  mountFields(id: string, fields: unknown[]): unknown;
  setValue(id: string, patch: unknown): void;
  submit(id: string): unknown;
  valueOf(id: string): Record<string, unknown>;
  canSubmitOf(id: string): boolean;
  dispose(id: string): void;
}>;

/**
 * The choice the control presents, however this renderer presents one.
 *
 * A native element answers with its own value; a custom trigger answers with the text in it. Both
 * are read, because a promise about what the user can see cannot be asked of one implementation.
 */
async function shownChoice(page: import("@playwright/test").Page, id: string) {
  return page.evaluate((formId) => {
    const root = document.querySelector(`[data-form="${formId}"]`);
    const native = root?.querySelector("select") as HTMLSelectElement | null;
    const trigger = root?.querySelector('button[aria-haspopup], [role="combobox"]');
    const checked = Array.from(root?.querySelectorAll('input[type="radio"]') ?? [])
      .filter((each) => (each as HTMLInputElement).checked)
      .map((each) => (each as HTMLInputElement).value);
    const asserted = Array.from(root?.querySelectorAll('[aria-checked="true"], [aria-selected="true"]') ?? [])
      .map((each) => (each.textContent ?? "").trim());
    return {
      nativeValue: native ? native.value : null,
      triggerText: trigger ? (trigger.textContent ?? "").replace(/\s+/g, " ").trim() : null,
      checked,
      asserted,
      message: (root?.querySelector('[id$="__errors"]')?.textContent ?? "").trim() || null,
    };
  }, id);
}

for (const host of HOSTS) {
  test(`a select holding a value no option carries, ${host.name}`, async ({ page }) => {
    test.setTimeout(180_000);
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    const mount = (id: string) => page.evaluate(({ api, formId, options }) => {
      (window as never as Api)[api].mountFields(formId, [{ name: "x", kind: "select", label: "X", options }]);
    }, { api: host.api, formId: id, options: OPTIONS });

    // The control: an offered value is shown. A control that presents nothing whatever it holds
    // would pass the assertion below for the wrong reason.
    await mount("offered");
    await page.waitForTimeout(280);
    await page.evaluate(({ api }) => (window as never as Api)[api].setValue("offered", { x: "b" }), { api: host.api });
    await page.waitForTimeout(320);

    const offered = await shownChoice(page, "offered");
    const showsBeta = offered.nativeValue === "b"
      || (offered.triggerText ?? "").includes("Beta")
      || offered.checked.includes("b")
      || offered.asserted.some((text) => text.includes("Beta"));
    expect(showsBeta, "a select did not show a choice that is on its own list, so nothing below is a measurement").toBe(true);
    await page.evaluate(({ api }) => (window as never as Api)[api].dispose("offered"), { api: host.api });

    // And a value with no option behind it — a list that changed, a value an application fetched.
    await mount("unoffered");
    await page.waitForTimeout(280);
    await page.evaluate(({ api }) => (window as never as Api)[api].setValue("unoffered", { x: "zzz" }), { api: host.api });
    await page.waitForTimeout(320);
    // A submit attempt, so the message is present in both renderers and this is not finding 150.
    await page.evaluate(({ api }) => (window as never as Api)[api].submit("unoffered"), { api: host.api });
    await page.waitForTimeout(360);

    const held = await page.evaluate(({ api }) => (window as never as Api)[api].valueOf("unoffered").x, { api: host.api });
    const shown = await shownChoice(page, "unoffered");

    // The premise: the model kept what it was given. UI-006 already holds here, and this finding is
    // the other half — what the page says about a value the model is holding correctly.
    expect(held, "the model replaced the value, which is a different finding than this one").toBe("zzz");

    const presentsAnOfferedChoice = shown.nativeValue === "a" || shown.nativeValue === "b"
      || OPTIONS.some(({ label }) => (shown.triggerText ?? "") === label || shown.asserted.includes(label))
      || shown.checked.length > 0;

    expect(
      presentsAnOfferedChoice,
      `the control presents ${JSON.stringify(shown.nativeValue ?? shown.triggerText)} as the current choice while the form holds "zzz", and the message beside it reads ${JSON.stringify(shown.message)}`,
    ).toBe(false);
  });

  // The second control, in the same renderer: the kinds that answer the same question and get it
  // right. A renderer that could not represent an unoffered value at all would fail here too.
  for (const kind of ["radio", "segmented"]) {
    test(`a ${kind} holding a value no option carries, ${host.name}`, async ({ page }) => {
      test.setTimeout(140_000);
      await page.goto(host.page);
      await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);
      await page.evaluate(({ api, k, options }) => {
        (window as never as Api)[api].mountFields("u", [{ name: "x", kind: k, label: "X", options }]);
      }, { api: host.api, k: kind, options: OPTIONS });
      await page.waitForTimeout(280);
      await page.evaluate(({ api }) => (window as never as Api)[api].setValue("u", { x: "zzz" }), { api: host.api });
      await page.waitForTimeout(320);

      const shown = await shownChoice(page, "u");
      expect(
        shown.checked.length === 0 && shown.asserted.length === 0,
        `a ${kind} asserts ${JSON.stringify([...shown.checked, ...shown.asserted])} as chosen while the form holds "zzz"`,
      ).toBe(true);
    });
  }
}
