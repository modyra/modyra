import { expect, test } from "@playwright/test";
import { dispatchHtmlDrag, openStudio } from "./support/studio.js";

/**
 * Contract v2 layout authoring: column rows built in the canvas, rendered by
 * @modyra/plain, and carried into the exported Contract.
 */

test.beforeEach(async ({ page }) => {
  await openStudio(page);
  await page.locator("[data-new]").click();
});

async function addFields(page: import("@playwright/test").Page, names: string[]): Promise<void> {
  for (const name of names) {
    // From the form root each time: inserting goes inside whatever is selected, and these fields
    // are meant to be root-level siblings.
    await page.locator(".outline-root").click();
    await page.locator('[data-template="text"]').click();
    await page.locator("[data-name]").fill(name);
    await page.locator("[data-name]").blur();
  }
}

const columnCounts = (page: import("@playwright/test").Page) =>
  page.locator(".mdy-layout-columns").evaluateAll((rows) => rows.map((row) => row.querySelectorAll(".mdy-layout-column").length));

async function toggleColumns(page: import("@playwright/test").Page, path: string): Promise<void> {
  const field = page.locator(`.plain-canvas-field[data-field-path="${path}"]`);
  await field.hover();
  await field.locator("[data-layout-columns]").click();
}

test("two fields become a column row, and a third widens it", async ({ page }) => {
  await addFields(page, ["city", "zip", "extra"]);

  await toggleColumns(page, "city");
  expect(await columnCounts(page)).toEqual([2]);

  // The only remaining free field joins the existing row rather than starting a new one.
  await toggleColumns(page, "extra");
  expect(await columnCounts(page)).toEqual([3]);

  // And back out again — a row that drops below two columns disappears entirely.
  await toggleColumns(page, "extra");
  expect(await columnCounts(page)).toEqual([2]);
});

test("a column row stays where its fields are and is undoable", async ({ page }) => {
  await addFields(page, ["first", "city", "zip", "last"]);

  await toggleColumns(page, "city");
  expect(await columnCounts(page)).toEqual([2]);
  // Order is preserved: the arranged pair must not jump to the top of the form.
  await expect(page.locator(".plain-canvas-field")).toHaveCount(4);
  const order = await page.locator(".plain-canvas-field").evaluateAll((els) => els.map((e) => e.dataset.fieldPath));
  expect(order).toEqual(["first", "city", "zip", "last"]);

  await page.locator("[data-undo]").click();
  expect(await columnCounts(page)).toEqual([]);
});

test("clicking a field pairs it with a free neighbour, not with an already-arranged one", async ({ page }) => {
  await addFields(page, ["a", "b", "c", "d"]);

  await toggleColumns(page, "a"); // a + b
  await toggleColumns(page, "c"); // must pair with d, not append to a+b
  expect(await columnCounts(page)).toEqual([2, 2]);
});

test("the authored layout reaches the exported Contract", async ({ page }) => {
  await addFields(page, ["city", "zip"]);
  await toggleColumns(page, "city");

  await page.locator('[data-inspector-tab="export"]').click();
  await page.locator("[data-export-generate]").click();
  await page.waitForSelector(".export-file");

  const paths = await page.locator(".export-file-path").allInnerTexts();
  const index = paths.findIndex((p) => p.includes("contract.json"));
  expect(index).toBeGreaterThanOrEqual(0);
  await page.locator("details.accordion summary").nth(index).click();
  const contract = JSON.parse(await page.locator(".export-file-code").nth(index).innerText());

  expect(contract.layout).toEqual([
    { kind: "columns", id: expect.any(String), columns: [["city"], ["zip"]] },
  ]);
});

test("column rows are offered for root fields, not for fields inside a group", async ({ page }) => {
  await page.locator('[data-template="group"]').click();
  await page.locator("[data-name]").fill("shipping");
  await page.locator("[data-name]").blur();
  const groupId = await page.locator(".plain-canvas-group").first().getAttribute("data-plain-group");

  await addFields(page, ["city"]);
  await page.locator("[data-plain-field-into]").last().selectOption(groupId!);

  // A group already owns where its children render; two owners for one node is the bug to avoid.
  const field = page.locator('.plain-canvas-field[data-field-path="shipping.city"]');
  await field.hover();
  await expect(field.locator("[data-layout-columns]")).toBeDisabled();
});

test("a field moves left and right within its row, by button and by keyboard", async ({ page }) => {
  // A row's order used to come from the schema's order, so the only way to change which column
  // something sat in was to reorder the form itself — vertical movement pretending to be horizontal.
  await page.locator('[data-template="text"]').click();
  await page.locator('[data-name]').fill('first');
  await page.locator('[data-name]').blur();
  await page.locator('[data-template="email"]').click();
  await page.locator('[data-name]').fill('second');
  await page.locator('[data-name]').blur();
  await page.locator('[data-layout-columns]').last().click();

  const columns = page.locator('.mdy-layout-columns .mdy-layout-column');
  await expect(columns).toHaveCount(2);
  const order = async () =>
    columns.evaluateAll((cells) =>
      cells.map((c) => c.querySelector<HTMLElement>('.plain-canvas-field')?.dataset.fieldPath ?? ''),
    );
  expect(await order()).toEqual(['first', 'second']);

  // The ends are ends: nothing to move past.
  await expect(page.locator('[data-layout-move="left"]').first()).toBeDisabled();
  await expect(page.locator('[data-layout-move="right"]').last()).toBeDisabled();

  await page.locator('[data-layout-move="right"]').first().click();
  expect(await order()).toEqual(['second', 'first']);

  await page.locator('[data-undo]').click();
  expect(await order()).toEqual(['first', 'second']);

  // Alt+←/→ is the keyboard counterpart of Alt+↑/↓. Plain ←/→ still move a picked-up node in and
  // out of a container, so the modifier is what keeps the two apart.
  await page.locator('.plain-canvas-field[data-field-path="second"] [data-plain-select]').click();
  await page.keyboard.press('Alt+ArrowLeft');
  expect(await order()).toEqual(['second', 'first']);
  await page.keyboard.press('Alt+ArrowRight');
  expect(await order()).toEqual(['first', 'second']);
});

test("dropping a control beside another makes a row, and one undo puts it back", async ({ page }) => {
  // Before this, a row could only be asked for by a button that picked the partner for you.
  await page.locator('[data-template="text"]').click();
  await page.locator('[data-name]').fill('first');
  await page.locator('[data-name]').blur();

  const field = page.locator('.plain-canvas-field[data-field-path="first"]');
  await dispatchHtmlDrag(page, page.locator('[data-template="email"]'), field.locator('.plain-canvas-drop-right'));

  const columns = page.locator('.mdy-layout-columns .mdy-layout-column');
  await expect(columns).toHaveCount(2);
  const order = async () =>
    columns.evaluateAll((cells) =>
      cells.map((c) => c.querySelector<HTMLElement>('.plain-canvas-field')?.dataset.fieldPath ?? ''),
    );
  expect((await order())[0]).toBe('first');
  expect((await order())[1]).toMatch(/^email/);

  // The schema move and the arrangement are one command: two undos would leave the field out of
  // the row but still moved, which is not a state the user was ever in.
  await page.locator('[data-undo]').click();
  await expect(page.locator('.mdy-layout-columns')).toHaveCount(0);
  await expect(page.locator('.plain-canvas-field')).toHaveCount(1);
});

test("dropping beside a field already in a row adds a column at that edge", async ({ page }) => {
  await page.locator('[data-template="text"]').click();
  await page.locator('[data-name]').fill('first');
  await page.locator('[data-name]').blur();
  await page.locator('[data-template="email"]').click();
  await page.locator('[data-name]').fill('second');
  await page.locator('[data-name]').blur();
  await page.locator('[data-layout-columns]').last().click();
  await expect(page.locator('.mdy-layout-columns .mdy-layout-column')).toHaveCount(2);

  const first = page.locator('.plain-canvas-field[data-field-path="first"]');
  await dispatchHtmlDrag(page, page.locator('[data-template="number"]'), first.locator('.plain-canvas-drop-left'));

  const columns = page.locator('.mdy-layout-columns .mdy-layout-column');
  await expect(columns).toHaveCount(3);
  const paths = await columns.evaluateAll((cells) =>
    cells.map((c) => c.querySelector<HTMLElement>('.plain-canvas-field')?.dataset.fieldPath ?? ''),
  );
  expect(paths[0]).toMatch(/^number/);
  expect(paths.slice(1)).toEqual(['first', 'second']);
});
