import { expect, test } from "@playwright/test";

/**
 * What a user sees when the form ends and its controls are still on the page.
 *
 * A framework destroys its model and removes its nodes at two different moments. An `ngOnDestroy`
 * runs; the elements stay until an animation finishes or the host's scheduler gets to them. The
 * controls are live in that window, and anything typed into them reaches a form that has ended.
 *
 * Both teardowns are published and they are not the same operation. `MdyPlainForm.dispose()`
 * "unmounts every field, destroys their controllers/effects, and deactivates the form"; `form` is
 * exposed beside it as "the real, running @modyra/core form backing every rendered field", and
 * ending that is what a host does when the model's owner outlives nothing else.
 *
 * That a destroyed form keeps answering is deliberate — a renderer torn down in the other order
 * keeps reading, and throwing would turn an ordinary race into a crash. What a real DOM adds is
 * whether anything marks the controls as no longer live.
 *
 * The property, and it names no mechanism: **an edit made after the form ended does not reach the
 * model.** Disabling the controls and refusing the write both hold it, and the assertions accept
 * either — a check written around one of them goes red the day the other is chosen, which is not a
 * regression and reads exactly like one.
 *
 * Claims under attack: LIF-001 (destroy leaves nothing observable behind), REA-002.
 */

const settled = async (page: import("@playwright/test").Page) => {
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve(null)))),
  );
};

test.beforeEach(async ({ page }) => {
  await page.goto("/index.html");
  await page.waitForFunction(() => (window as never as { battleReady?: boolean }).battleReady === true);
});

test("controls left on the page after the form ended are not still offering to edit it", async ({ page }) => {
  await page.evaluate(() => window.battle.mount("main", { key: "a" }));
  await page.evaluate(() => window.battle.declareRow("main", "a", { code: "", note: "", plan: null }));
  await settled(page);

  const code = page.locator('[data-form="main"] input').first();
  await code.fill("before");
  await settled(page);

  const beforeEnd = await page.evaluate(() => window.battle.valueOf("main"));
  expect(beforeEnd.rows.a.code).toBe("before");

  // The window: the model ends, the nodes stay.
  await page.evaluate(() => window.battle.destroyFormOnly("main"));
  await settled(page);

  // The nodes stay: a page mid-teardown looks exactly like this, and that is the premise, not the
  // finding.
  await expect(code).toBeVisible();

  // The property, stated so that either repair satisfies it: **an edit made after the form ended
  // does not reach the model.** Refusing the write and taking the control out of play both hold it,
  // and the assertion names neither — a check that pins the mechanism expires the day the mechanism
  // changes, which is how this file came to be red while the defect it describes was fixed.
  const reachable = await code.isEditable();
  if (reachable) await code.fill("after the end").catch(() => undefined);
  await settled(page);

  const held = await page.evaluate(() => window.battle.valueOf("main"));
  expect(
    held.rows.a.code,
    reachable
      ? "the control still took the text and the form kept it, so a form that ended is still being edited"
      : "the control refused the edit, and the value the form ended with must be the value it holds",
  ).toBe("before");
});

test("a required cell emptied after the form ended does not paint an error the form does not have", async ({ page }) => {
  await page.evaluate(() => window.battle.mount("main", { key: "a" }));
  await page.evaluate(() => window.battle.declareRow("main", "a", { code: "filled", note: "", plan: null }));
  await settled(page);

  const code = page.locator('[data-form="main"] input').first();
  await code.click();
  await code.fill("");
  await code.blur();
  await settled(page);

  // The control: while the form is alive, emptying a required cell paints an error. Whatever the
  // page shows after the end is measured against this rather than against an assumption.
  const liveError = await page.locator('[data-form="main"]').innerText();
  expect(liveError).toContain("required");

  await page.evaluate(() => window.battle.declareRow("main", "a", { code: "filled", note: "", plan: null }));
  await settled(page);
  await page.evaluate(() => window.battle.destroyFormOnly("main"));
  await settled(page);

  // Read, do not drive. Once the control is out of play a click waits for an element that will
  // never accept one, and the timeout reads as the page failing to paint rather than as the control
  // correctly refusing. What is under test here is what the page *says*, which needs no interaction.
  if (await code.isEditable()) {
    await code.fill("");
    await code.blur();
  }
  await settled(page);

  const shownAfter = await page.locator('[data-form="main"]').innerText();
  const held = await page.evaluate(() => window.battle.valueOf("main"));

  // The other half, and it holds: the page says nothing new after the end. The renderer's effects
  // are gone, so no message about a value the form does not hold is ever painted. This is what
  // bounds the failure above to the value alone.
  expect({ paintsRequired: shownAfter.includes("required"), held: held.rows.a.code }).toEqual({
    paintsRequired: false,
    held: "filled",
  });
});
