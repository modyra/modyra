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
 * whether anything marks the controls as no longer live. Nothing does: they stay enabled, they
 * accept typing, and the browser paints what was typed because a text input holds its own value.
 * The form keeps the one it had.
 *
 * Asserted as the divergence rather than as a demand for one fix: disabling the controls when the
 * form they render ends, or taking the write, both close it.
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

  // The control is still there, and still accepting input. That is the premise rather than the
  // finding: a page mid-teardown looks exactly like this.
  await expect(code).toBeVisible();
  await expect(code).toBeEnabled();

  await code.fill("after the end");
  await settled(page);

  const shown = await code.inputValue();
  const held = await page.evaluate(() => window.battle.valueOf("main"));

  // What the user is looking at, and what the form would send if anything asked it. The control is
  // enabled, it took the text, and nothing on the page distinguishes it from one whose edits land.
  expect({ shown, held: held.rows.a.code }).toEqual({ shown: "after the end", held: "after the end" });
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

  await code.click();
  await code.fill("");
  await code.blur();
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
