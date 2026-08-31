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

/**
 * Type into a picker, leave it, and read back everything a person could notice.
 *
 * A timepicker is mounted **asking for the twelve-hour clock**, because that is the notation every
 * assertion in this file is about. It is not the default: ADR 0116 made every renderer default to
 * 24-hour, and its Consequences say plainly that a form which showed `02:30 PM` now shows `14:30`.
 * These mounts declared no format and asserted the twelve-hour answers, so they were pinning the
 * premise 0116 reversed — a spec outliving its contract, the same shape as the Tab binding.
 *
 * They could not simply be corrected until now: 0116 recorded that a document had no way to ask for
 * either clock, and deliberately left the slot for a later batch. `format` is that slot.
 */
async function typeAndLeave(page: import("@playwright/test").Page, kind: string, text: string, id: string) {
  await page.evaluate(
    ({ mountId, declared }) => window.battle.mountFields(mountId, [declared] as never),
    { mountId: id, declared: kind === "timepicker"
        ? { name: "f", kind, label: "F", format: "12h" }
        : { name: "f", kind, label: "F" } },
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

/** Type into a picker that is already mounted, leave it, and read the same surfaces back. */
async function retypeAndLeave(page: import("@playwright/test").Page, id: string, text: string) {
  const host = `[data-form="${id}"]`;
  const control = page.locator(`${host} [aria-haspopup]`).first();
  await control.focus();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.type(text);
  await page.keyboard.press("Tab");
  await page.waitForTimeout(160);

  return page.evaluate(
    ({ selector, mountId }) => {
      const host = document.querySelector(selector) as HTMLElement;
      const element = host.querySelector("[aria-haspopup]") as HTMLInputElement;
      const errors = host.querySelector(".mdy-control__errors") as HTMLElement | null;
      const supporting = host.querySelector(".mdy-supporting-text") as HTMLElement | null;
      return {
        shows: element.value,
        value: (window.battle.valueOf(mountId) as Record<string, unknown>).f,
        invalid: element.getAttribute("aria-invalid"),
        errorText: (errors?.innerText ?? "").trim(),
        supportingText: (supporting?.innerText ?? "").trim(),
      };
    },
    { selector: host, mountId: id },
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

  // The value is the one thing pinned exactly: it is ISO always, which is what
  // [ADR 0178](../../docs/architecture/0178-a-date-a-person-can-read-aloud.md) settles first.
  expect(date.value, "the picker did not take the date that was typed").toBe("2026-03-04");

  // What it *shows* is the reading, not the value — a named month in the reader's language. Asserted
  // as a shape rather than as a string: the exact words depend on the language the page is read in,
  // and a check that pins them fails the day somebody runs the suite elsewhere while the behaviour
  // is right. What matters here is that the control answered at all and answered with something
  // other than the notation it stores.
  expect(date.shows, "the picker read the date and showed nothing back").not.toBe("");
  expect(date.shows, "the picker echoed the value's own notation rather than a reading of it")
    .not.toBe(date.value);

  // Two columns, and they are not the same thing: `MDY_VALUE_CONTRACTS.timepicker` holds a time as
  // `HH:mm` — `explainValueMismatch("timepicker", "02:30 PM")` refuses it in those words — while
  // twelve-hour notation is what this control shows the person who typed it.
  const time = await typeAndLeave(page, "timepicker", "2:30 PM", "ok-time");
  expect({ shows: time.shows, value: time.value }).toEqual({ shows: "02:30 PM", value: "14:30" });
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

test("a picker that was corrected is holding the correction and nothing of the attempt", async ({ page }) => {
  // The other side of the finding above, and the one a repair can fail while satisfying it.
  //
  // Either repair — keeping the text, or clearing it with a reason — gives the control something to
  // carry between the typing and the verdict. Whatever that is has to end when the person types
  // something the picker reads: a control still showing the text it could not read, or still
  // explaining an error about it, has turned a correction into a field that argues with its own
  // value.
  // The timepicker row reads oddly on purpose: `"14:30"` is both the text this control cannot read
  // and the value it holds once the same time is typed in the notation it does read. That is the two
  // columns in one row — what a person may type is the control's business, what the form holds is the
  // value contract's.
  const attempts = [
    { kind: "timepicker", bad: "14:30", good: "2:30 PM", holds: "14:30" },
    { kind: "datepicker", bad: "31/02/2026", good: "03/04/2026", holds: "2026-03-04" },
  ];

  const arguing: Array<Record<string, unknown>> = [];
  for (const [index, attempt] of attempts.entries()) {
    const id = `corrected-${index}`;

    // The premise: the bad value really did go in, so what follows is about the correction rather
    // than about a control that refused the keystrokes.
    const rejected = await typeAndLeave(page, attempt.kind, attempt.bad, id);
    expect(rejected.value, `${attempt.kind} took ${attempt.bad} as a value`).toBeNull();

    const corrected = await retypeAndLeave(page, id, attempt.good);

    // The value is the correction.
    expect(corrected.value, `${attempt.kind} did not take ${attempt.good} after ${attempt.bad}`)
      .toBe(attempt.holds);

    // And nothing of the attempt survived it: not the text, not the error, not aria-invalid.
    const stillShowsTheAttempt = corrected.shows === attempt.bad;
    const stillExplaining = corrected.invalid === "true"
      || corrected.errorText !== ""
      || corrected.supportingText !== "";
    if (stillShowsTheAttempt || stillExplaining) arguing.push({ ...attempt, ...corrected });
  }

  expect(arguing, JSON.stringify(arguing, null, 1)).toEqual([]);
});
