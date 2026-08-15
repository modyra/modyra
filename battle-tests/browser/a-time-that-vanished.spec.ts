import { expect, test } from "@playwright/test";

/**
 * What a page does with a date or a time it could not read.
 *
 * Refusing is right, and the engine already does it: `parseLocalizedDate` answers `null` for a day
 * that does not exist, and a battle holds that. This is the other half — what the person who typed it
 * is told.
 *
 * They are told nothing. The text is erased on blur, the value becomes null, `aria-invalid` stays
 * `false`, and no message is rendered anywhere. Someone who typed `14:30` into a time field watches it
 * disappear and has no way to learn that this control wanted `2:30 PM`. The same for a date typed in
 * a shape the field does not read, and for a day that does not exist.
 *
 * Two different repairs close this and the battle accepts either: keep the text so it can be
 * corrected, or clear it and say why. What it refuses is the third thing — clearing it while the form
 * reports that nothing is wrong.
 *
 * The formats each control does take are asserted alongside, because "it erased what I typed" and "it
 * takes nothing" are different findings and only the first one is this one.
 *
 * "Explained" is read from the two surfaces that would carry an explanation — the control's own error
 * list and `aria-invalid` — rather than from the rendered text of the field. The field's text also
 * holds its label and the submit button, so a check that read all of it would find words on the page
 * and call the value explained. That is how the first version of this battle was green.
 *
 * Claims under attack: LOC-001, A11Y-004, VAL-003.
 */

const settled = async (page: import("@playwright/test").Page) => {
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve(null)))),
  );
};

/** Type into a picker, leave it, and read back everything a person could notice. */
async function typeAndLeave(page: import("@playwright/test").Page, kind: string, text: string, id: string) {
  await page.evaluate(
    ({ mountId, declared }) => window.battle.mountFields(mountId, [declared] as never),
    { mountId: id, declared: { name: "f", kind, label: "F" } },
  );
  await settled(page);

  const host = `[data-form="${id}"]`;
  const control = page.locator(`${host} [aria-haspopup]`).first();
  await control.focus();
  await page.keyboard.type(text);
  const whileTyping = await control.inputValue();
  await page.keyboard.press("Tab");
  await page.waitForTimeout(160);

  return page.evaluate(
    ({ selector, mountId, typed }) => {
      const host = document.querySelector(selector) as HTMLElement;
      const element = host.querySelector("[aria-haspopup]") as HTMLInputElement;
      const errors = host.querySelector(".mdy-control__errors") as HTMLElement | null;
      const supporting = host.querySelector(".mdy-supporting-text") as HTMLElement | null;
      return {
        whileTyping: typed,
        shows: element.value,
        value: (window.battle.valueOf(mountId) as Record<string, unknown>).f,
        invalid: element.getAttribute("aria-invalid"),
        errorText: (errors?.innerText ?? "").trim(),
        supportingText: (supporting?.innerText ?? "").trim(),
      };
    },
    { selector: host, mountId: id, typed: whileTyping },
  );
}

test.beforeEach(async ({ page }) => {
  await page.goto("/index.html");
  await page.waitForFunction(() => (window as never as { battleReady?: boolean }).battleReady === true);
});

test("the shape each picker does read is one it keeps", async ({ page }) => {
  // The control. Without it, everything below would also be true of a control that reads nothing at
  // all, which is a different and larger finding than the one being made.
  const date = await typeAndLeave(page, "datepicker", "03/04/2026", "ok-date");
  expect({ shows: date.shows, value: date.value }).toEqual({ shows: "2026-03-04", value: "2026-03-04" });

  const time = await typeAndLeave(page, "timepicker", "2:30 PM", "ok-time");
  expect({ shows: time.shows, value: time.value }).toEqual({ shows: "02:30 PM", value: "02:30 PM" });
});

test("what a picker cannot read is either kept or explained", async ({ page }) => {
  const attempts = [
    { kind: "timepicker", text: "14:30", what: "a 24-hour time, which is how most of the world writes one" },
    { kind: "timepicker", text: "banana", what: "not a time at all" },
    { kind: "datepicker", text: "not a date", what: "not a date at all" },
    { kind: "datepicker", text: "31/02/2026", what: "a day that does not exist" },
  ];

  const swallowed: Array<Record<string, unknown>> = [];
  for (const [index, attempt] of attempts.entries()) {
    const outcome = await typeAndLeave(page, attempt.kind, attempt.text, `bad-${index}`);

    // The premise for each: the control did accept the keystrokes, so what follows is about leaving
    // the field rather than about typing being ignored.
    expect(outcome.whileTyping, `${attempt.kind} ignored the typing of ${attempt.text}`).toBe(attempt.text);

    const kept = outcome.shows !== "";
    const explained = outcome.invalid === "true" || outcome.errorText !== "" || outcome.supportingText !== "";
    if (!kept && !explained) swallowed.push({ ...attempt, ...outcome });
  }

  // Either repair closes this: keep the text so it can be corrected, or clear it and say why.
  expect(swallowed, JSON.stringify(swallowed, null, 1)).toEqual([]);
});
