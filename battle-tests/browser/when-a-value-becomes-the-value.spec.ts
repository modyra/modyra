/**
 * The moment an interaction becomes a value.
 *
 * `MDY_VALUE_CONTRACTS` carries a column that says when, per kind, and it is exported with its
 * meaning written next to it: `live` is "every interaction writes through: typing, dragging,
 * toggling", `confirm` is "the field only changes on an explicit confirmation; interaction edits a
 * draft". Sixteen kinds say `live` and one says `confirm`.
 *
 * A consumer reads that column to know whether a value can be watched — an autosave, a dependent
 * field, a preview. Nothing in this suite had ever compared it against a widget.
 *
 * Four kinds answer the question with something other than a keystroke, which is where the column is
 * load-bearing rather than obvious: a text field writing on keystroke is not in doubt, and a control
 * that opens or confirms something before it decides could reasonably do either.
 *
 * Two of the three are the controls for the third. The datepicker declares `live` and is, the
 * timepicker declares `confirm` and is, so a failure on the range is about the range rather than
 * about this spec having misread a published word.
 *
 * Claims under attack: UI-006, VAL-003.
 */

import { expect, test } from "@playwright/test";

import { MDY_VALUE_CONTRACTS } from "@modyra/core";

// **Every renderer, from the shared list.** The local list this replaced was not a scope
// decision: the angular host published six of the twenty-two doors these specs need, so a
// spec wanting one it lacked left the renderer out and the next reader copied the list.
import { HOSTS , SETTLES} from "./bench";

type Api = Record<string, {
  mountFields(id: string, fields: unknown[]): unknown;
  valueOf(id: string): Record<string, unknown>;
}>;

/** Click whatever this renderer opens its calendar with, whichever button that turns out to be. */
async function openCalendar(page: import("@playwright/test").Page, id: string) {
  const openers = page.locator(`[data-form="${id}"] button`);
  for (let index = 0; index < await openers.count(); index += 1) {
    await openers.nth(index).click({ timeout: 3000 }).catch(() => {
        // One candidate of several, and most are not the opener. Which one was is decided by the
        // check after this loop, so a press that does not land is a step of the sweep, not a fault.
      });
    await page.waitForTimeout(220);
    if (await page.locator('[role="gridcell"]').count() > 6) return true;
  }
  return false;
}

for (const host of HOSTS) {
  test(`a datepicker writes through on the interaction, ${host.name}`, async ({ page }) => {
    test.setTimeout(180_000);
    expect(MDY_VALUE_CONTRACTS.datepicker.commit, "the contract this test reads changed").toBe("live");

    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);
    await page.evaluate(({ api }) => {
      (window as never as Api)[api].mountFields("d", [{ name: "x", kind: "datepicker", label: "X" }]);
    }, { api: host.api });
    await page.waitForTimeout(320);

    expect(await openCalendar(page, "d"), "no calendar opened, so nothing below is a measurement").toBe(true);

    // **The role, not the tag.** This asked for a `button` carrying or inside the cell, and the
    // contract declares `element: "gridcell"` — a role. One renderer draws a `div` with that role
    // and was reported as having no cells, which is this selector encoding another renderer's tag
    // choice as if it were the contract.
    const cells = page.locator('[role="gridcell"]');
    await cells.nth(10).click({ timeout: 4000 });
    await page.waitForTimeout(300);

    const held = await page.evaluate(({ api }) => (window as never as Api)[api].valueOf("d").x, { api: host.api });
    expect(held, "a datepicker declaring live did not write through on the pick").not.toBeNull();
  });

  test(`a daterange writes through on the interaction, ${host.name}`, async ({ page }) => {
    test.setTimeout(180_000);
    // The declared answer for this kind, read rather than assumed. `complete` is the word added for
    // it: the field changes when what the user is building becomes a value — which for a range means
    // both ends, and is why one end writes nothing.
    expect(MDY_VALUE_CONTRACTS.daterange.commit).toBe("complete");

    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);
    await page.evaluate(({ api }) => {
      (window as never as Api)[api].mountFields("r", [{ name: "x", kind: "daterange", label: "X" }]);
    }, { api: host.api });
    await page.waitForTimeout(320);

    expect(await openCalendar(page, "r"), "no calendar opened, so nothing below is a measurement").toBe(true);

    const cells = page.locator('[role="gridcell"]');
    const first = (await cells.nth(8).textContent())?.trim();
    await cells.nth(8).click({ timeout: 4000 });
    await page.waitForTimeout(320);

    const afterOneEnd = await page.evaluate(({ api }) => (window as never as Api)[api].valueOf("r").x, { api: host.api });

    // The control, taken after: picking the other end does write through, so the field is reachable
    // and the calendar is the right one.
    await cells.nth(12).click({ timeout: 4000 });
    await page.waitForTimeout(320);
    const afterBothEnds = await page.evaluate(({ api }) => (window as never as Api)[api].valueOf("r").x, { api: host.api }) as { start: string | null; end: string | null };
    expect(afterBothEnds.start, "picking both ends did not write through either, so this measures the harness").not.toBeNull();

    // `complete` says the value arrives when it becomes one, so a half-picked range holds nothing —
    // and the assertion is that the two ends together are what completes it.
    expect(
      afterOneEnd,
      `a daterange declaring "${MDY_VALUE_CONTRACTS.daterange.commit}" held ${JSON.stringify(afterOneEnd)} after only ${JSON.stringify(first)} was picked`,
    ).toEqual({ start: null, end: null });
  });
}

test("a timepicker changes only on confirmation, plain", async ({ page }) => {
  test.setTimeout(180_000);
  expect(MDY_VALUE_CONTRACTS.timepicker.commit, "the contract this test reads changed").toBe("confirm");

  await page.goto("/index.html");
  await page.waitForFunction(() => (window as never as Record<string, boolean>).battleReady === true);
  await page.evaluate(() => {
    (window as never as Api).battle.mountFields("t", [{ name: "x", kind: "timepicker", label: "X" }]);
  });
  await page.waitForTimeout(320);

  const held = () => page.evaluate(() => (window as never as Api).battle.valueOf("t").x);
  const open = async () => {
    const openers = page.locator('[data-form="t"] button');
    for (let index = 0; index < await openers.count(); index += 1) {
      await openers.nth(index).click({ timeout: 3000 }).catch(() => {
        // One candidate of several, and most are not the opener. Which one was is decided by the
        // check after this loop, so a press that does not land is a step of the sweep, not a fault.
      });
      await page.waitForTimeout(220);
      if (await page.locator(".mdy-timepicker-dial").count() > 0) return true;
    }
    return false;
  };

  expect(await open(), "no time popup opened, so nothing below is a measurement").toBe(true);
  const segments = page.locator(".mdy-timepicker-segment-input");
  await segments.first().fill("7");
  await page.waitForTimeout(320);

  expect(await held(), "a timepicker declaring confirm wrote an edit through before it was confirmed").toBeNull();

  await page.locator("button").filter({ hasText: /^Cancel$/ }).first().click({ timeout: 4000 });
  await expect.poll(() => held(), { message: "cancelling a time edit left it in the model", ...SETTLES }).toBeNull();

  // The control: confirming does commit, so the two nulls above are the draft rather than a popup
  // that changes nothing at all.
  expect(await open(), "the time popup did not open a second time").toBe(true);
  await segments.first().fill("9");
  await page.waitForTimeout(260);
  await page.locator("button").filter({ hasText: /^OK$/ }).first().click({ timeout: 4000 });
  await expect.poll(() => held(), { message: "a confirmed time edit did not reach the model", ...SETTLES }).not.toBeNull();
});


test("a colour field commits what is chosen, not what is passed over, plain", async ({ page }) => {
  test.setTimeout(180_000);
  // The declared answer for this kind. `confirm` answers for the control the label names and a
  // keyboard writes into — the one a person can leave half-finished, where `#11` is not a colour.
  expect(MDY_VALUE_CONTRACTS.colors.commit).toBe("confirm");

  await page.goto("/index.html");
  await page.waitForFunction(() => (window as never as Record<string, boolean>).battleReady === true);
  await page.evaluate(() => {
    (window as never as Api).battle.mountFields("c", [{ name: "x", kind: "colors", label: "X" }]);
  });
  await page.waitForTimeout(260);

  const held = () => page.evaluate(() => (window as never as Api).battle.valueOf("c").x);

  // The other control of the same field, recorded rather than asserted against the word: a kind
  // carries one word and this field has two controls, so the word answers for the typed one and
  // these lines are what the word does not cover.
  //
  // The platform's own chooser says two different things and only one of them is a value. It reports
  // every colour a pointer moves across as it moves across it, and reports a choice once. A drag is
  // something to look at, and the place to look at it is the chooser, which is where the person's
  // eyes already are.
  const swatchSays = (colour: string, announcement: string) => page.evaluate(({ colour, announcement }) => {
    const swatch = document.querySelector('[data-form="c"] input[type="color"]') as HTMLInputElement;
    swatch.value = colour;
    swatch.dispatchEvent(new Event(announcement, { bubbles: true }));
  }, { colour, announcement });

  // Compared against what the field held a moment earlier, not against a particular empty: a field
  // nobody has set answers with its own idea of nothing, and asserting which one it is would be a
  // test of that instead of of the drag.
  const beforeTheDrag = await held();
  await swatchSays("#778899", "input");
  await page.waitForTimeout(260);
  expect(
    await held(),
    "a colour the pointer moved across became the field's value, so abandoning the chooser would "
    + "leave whichever one it happened to be over",
  ).toBe(beforeTheDrag);

  await swatchSays("#445566", "change");
  await expect.poll(() => held(), { message: "a colour chosen in the platform's chooser did not reach the field, so nothing here is about the hex box", ...SETTLES }).toBe("#445566");

  // And the hex box, typed a character at a time, ending on a complete colour.
  const hex = page.locator('[data-form="c"] .mdy-colors__hex-input').first();
  // Cleared first: the swatch above put its own colour in this box, and typing into it would append.
  await hex.fill("");
  await hex.focus();
  for (const character of "#112233") {
    await page.keyboard.type(character);
    await page.waitForTimeout(90);
  }
  expect(await hex.inputValue(), "the box does not hold the colour that was typed into it").toBe("#112233");

  // `confirm` means interaction edits a draft: typing a whole colour changes nothing yet.
  expect(
    await held(),
    `a colour field declaring "${MDY_VALUE_CONTRACTS.colors.commit}" wrote a typed colour through before it was confirmed`,
  ).toBe("#445566");

  // And the confirmation lands it.
  await hex.blur();
  await expect.poll(() => held(), { message: "leaving the box did not commit the colour typed into it", ...SETTLES }).toBe("#112233");
});
