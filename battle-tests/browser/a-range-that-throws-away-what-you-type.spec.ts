import { expect, test } from "@playwright/test";

/**
 * Two text inputs that take what you type and throw it away.
 *
 * A `daterange` renders two text inputs with placeholders. They accept keystrokes and display them:
 * `inputValue()` right after typing `03/04/2026` is `"03/04/2026"`. On blur the text is erased and
 * the form's value is still `{ start: null, end: null }`.
 *
 * This is not the finding a datepicker and a timepicker had, where a value the control *could not
 * read* vanished. The same string, in the same locale, into a single `datepicker`, is read and kept —
 * that is a green assertion elsewhere in this tier. Here a well-formed date is discarded too, so
 * there is nothing to read wrongly: the inputs are not wired to the value at all.
 *
 * The calendar is the control, and it works: opening the popup and choosing two days sets
 * `{ start: "2026-08-05", end: "2026-08-09" }`. So the control is usable and this is not "the
 * daterange is broken" — it is that its text inputs invite an interaction they discard, which is
 * worse than not offering one. A person who types a range, tabs away and sees two empty boxes has no
 * way to learn that the calendar was the only door.
 *
 * Claims under attack: LOC-001, VAL-003.
 */

type Page = import("@playwright/test").Page;

const settled = async (page: Page) => {
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve(null)))),
  );
};

async function mountRange(page: Page, id: string) {
  await page.evaluate(
    (mountId) => window.battle.mountFields(mountId, [{ name: "f", kind: "daterange", label: "F" }] as never),
    id,
  );
  await settled(page);
  const host = `[data-form="${id}"]`;
  return {
    host,
    start: page.locator(`${host} .mdy-daterange__input`).first(),
    end: page.locator(`${host} .mdy-daterange__input`).nth(1),
  };
}

/** Everything a person could notice about the range right now. */
async function readBack(page: Page, host: string, id: string) {
  return page.evaluate(
    ({ selector, mountId }) => {
      const element = document.querySelector(selector) as HTMLElement;
      const inputs = [...element.querySelectorAll<HTMLInputElement>(".mdy-daterange__input")];
      const errors = element.querySelector(".mdy-control__errors") as HTMLElement | null;
      const supporting = element.querySelector(".mdy-supporting-text") as HTMLElement | null;
      const wrapper = element.querySelector(".mdy-input-wrapper") as HTMLElement | null;
      return {
        shows: inputs.map((each) => each.value),
        invalid: inputs.map((each) => each.getAttribute("aria-invalid")),
        wrapperHasError: (wrapper?.className ?? "").includes("--error"),
        errorText: (errors?.innerText ?? "").trim(),
        supportingText: (supporting?.innerText ?? "").trim(),
        value: (window.battle.valueOf(mountId) as Record<string, unknown>).f,
      };
    },
    { selector: host, mountId: id },
  );
}

const explained = (seen: Awaited<ReturnType<typeof readBack>>) =>
  seen.invalid.includes("true")
  || seen.wrapperHasError
  || seen.errorText !== ""
  || seen.supportingText !== "";

test.beforeEach(async ({ page }) => {
  await page.goto("/index.html");
  await page.waitForFunction(() => (window as never as { battleReady?: boolean }).battleReady === true);
});

test("the calendar sets the range it was asked for", async ({ page }) => {
  // The control. Without it everything below would also be true of a control that holds no value at
  // all, which is a different and larger finding than the one being made.
  const { host } = await mountRange(page, "range-calendar");
  await page.locator(`${host} .mdy-daterange__input`).first().click();
  await page.waitForTimeout(250);

  const chosen = await page.evaluate((selector) => {
    const element = document.querySelector(selector) as HTMLElement;
    const cells = [...element.querySelectorAll<HTMLElement>('[role="gridcell"]')]
      .filter((each) => each.getAttribute("aria-disabled") === null);
    const labels = [cells[10], cells[14]].map((each) => each?.innerText ?? "");
    cells[10]?.click();
    cells[14]?.click();
    return labels;
  }, host);
  await page.waitForTimeout(200);

  const seen = await readBack(page, host, "range-calendar");
  const range = seen.value as { start: unknown; end: unknown };
  expect(
    { start: typeof range.start, end: typeof range.end },
    `choosing the days ${chosen.join(" and ")} left the range at ${JSON.stringify(seen.value)}`,
  ).toEqual({ start: "string", end: "string" });
});

test("a range the control can read is one it keeps when it is typed", async ({ page }) => {
  const { host, start, end } = await mountRange(page, "range-typed");

  await start.focus();
  await page.keyboard.type("03/04/2026");
  const startShowsWhileTyping = await start.inputValue();
  await end.focus();
  await page.keyboard.type("05/04/2026");
  await page.keyboard.press("Tab");
  await page.waitForTimeout(200);

  // The premise: the inputs did take the keystrokes, so what follows is about leaving them rather
  // than about typing being ignored at the DOM.
  expect(startShowsWhileTyping, "the start input did not accept the keystrokes at all")
    .toBe("03/04/2026");

  const seen = await readBack(page, host, "range-typed");
  expect(seen.value, `a well-formed range was typed and discarded: ${JSON.stringify(seen)}`)
    .toEqual({ start: "2026-03-04", end: "2026-05-04" });
});

test("what the range could not read is kept or explained", async ({ page }) => {
  const attempts = [
    { text: "not a date", what: "not a date at all" },
    { text: "31/02/2026", what: "a day that does not exist" },
  ];

  const swallowed: Array<Record<string, unknown>> = [];
  for (const [index, attempt] of attempts.entries()) {
    const id = `range-bad-${index}`;
    const { host, start } = await mountRange(page, id);
    await start.focus();
    await page.keyboard.type(attempt.text);
    const whileTyping = await start.inputValue();
    await page.keyboard.press("Tab");
    await page.waitForTimeout(200);

    expect(whileTyping, `the input ignored the typing of ${attempt.text}`).toBe(attempt.text);

    const seen = await readBack(page, host, id);
    const kept = seen.shows[0] !== "";
    if (!kept && !explained(seen)) swallowed.push({ ...attempt, ...seen });
  }

  // Either repair closes this: keep the text so it can be corrected, or clear it and say why.
  expect(swallowed, JSON.stringify(swallowed, null, 1)).toEqual([]);
});

test("lit discards it too, so the defect belongs to the contract", async ({ page }) => {
  // The same question asked of the other renderer. A defect both have is the contract's; one only one
  // has belongs to that renderer, and the other usually shows the shape that avoids it. Here they
  // agree, which places the repair in the shared controller rather than twice in markup.
  await page.goto("/lit.html");
  await page.waitForFunction(() => (window as never as { battleLitReady?: boolean }).battleLitReady === true);
  await page.evaluate(
    () => window.battleLit.mountFields("lit-range", [{ name: "f", kind: "daterange", label: "F" }] as never),
  );
  await page.waitForTimeout(250);

  const start = page.locator('[data-form="lit-range"] .mdy-daterange__input').first();
  await start.focus();
  await page.keyboard.type("03/04/2026");
  const whileTyping = await start.inputValue();
  await page.keyboard.press("Tab");
  await page.waitForTimeout(250);

  // The premise, as on the plain side: the input did take the keystrokes.
  expect(whileTyping, "the lit start input did not accept the keystrokes at all").toBe("03/04/2026");

  const seen = await page.evaluate(() => {
    const element = document.querySelector('[data-form="lit-range"]') as HTMLElement;
    const inputs = [...element.querySelectorAll<HTMLInputElement>(".mdy-daterange__input")];
    return { shows: inputs.map((each) => each.value), value: (window.battleLit.valueOf("lit-range") as Record<string, unknown>).f };
  });

  expect(seen.value, `lit discarded a well-formed range too: ${JSON.stringify(seen)}`)
    .toEqual({ start: "2026-03-04", end: null });
});
