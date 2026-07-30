import { expect, test } from "@playwright/test";
import { closeDock, dispatchHtmlDrag, openDock, openStudio } from "./support/studio.js";

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
  // The toolbar floats over the canvas, and arranging happens on the canvas — so put it away first,
  // exactly as a user does once the fields are in, then put it back: Undo and the templates live
  // inside it, and a helper must leave the page as it found it.
  await closeDock(page);
  const field = page.locator(`.plain-canvas-field[data-field-path="${path}"]`);
  await field.hover();
  await field.locator("[data-layout-columns]").click();
  await openDock(page);
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

test("the breakpoint selector previews the size and authors only that size", async ({ page }) => {
  await addFields(page, ["first", "second"]);
  await page.locator('[data-layout-columns]').last().click();
  await expect(page.locator('.mdy-layout-columns .mdy-layout-column')).toHaveCount(2);

  const frame = page.locator('.plain-canvas-frame');
  await expect(frame).toHaveAttribute('data-breakpoint-frame', 'base');
  const baseWidth = await frame.evaluate((el) => el.getBoundingClientRect().width);

  // The arrangement, not only the width. `base` stacks — one track — because that is what the row
  // does on a phone; the canvas used to narrow to a phone and go on drawing the desktop's two
  // columns, since the foundation's breakpoints key on the window and the window had not changed.
  const row = page.locator('.mdy-layout-columns');
  const trackCount = async () =>
    (await row.evaluate((el) => getComputedStyle(el).gridTemplateColumns)).split(' ').length;
  expect(await trackCount()).toBe(1);

  // Choosing a size widens the canvas to it, and the row it draws is that size's row.
  await page.locator('[data-breakpoint="md"]').click();
  await expect(frame).toHaveAttribute('data-breakpoint-frame', 'md');
  await expect(page.locator('[data-breakpoint="md"]')).toHaveAttribute('aria-pressed', 'true');
  expect(await frame.evaluate((el) => el.getBoundingClientRect().width)).toBeGreaterThan(baseWidth);
  expect(await trackCount()).toBe(2);

  // Narrowing the row at md writes an override, and leaves the arrangement itself alone.
  const first = page.locator('.plain-canvas-field[data-field-path="first"]');
  await first.hover();
  await first.locator('[data-row-columns]').selectOption('1');

  // One track across at md, two from sm: the override lands on md alone, and the arrangement the
  // other sizes inherit is untouched. The canvas draws the md row, so it stacks here and now.
  await expect(row).toHaveCSS('--mdy-layout-column-count-md', '1');
  await expect(row).toHaveCSS('--mdy-layout-column-count-sm', '2');
  expect(await trackCount()).toBe(1);
  await expect(page.locator('.mdy-layout-columns > .mdy-layout-column')).toHaveCount(2);
});

test("a field can be hidden at one size and shown at another", async ({ page }) => {
  await addFields(page, ["first", "second"]);
  await page.locator('[data-layout-columns]').last().click();
  await expect(page.locator('.mdy-layout-columns .mdy-layout-column')).toHaveCount(2);

  // Hidden on the narrowest screen. The canvas marks it rather than removing it — it is an editor,
  // and a node taken off the canvas takes the eye that would put it back with it.
  const first = page.locator('.plain-canvas-field[data-field-path="first"]');
  await first.hover();
  await first.locator('[data-toggle-hidden]').click();
  const cell = page.locator('.mdy-layout-columns > .mdy-layout-column').first();
  await expect(first).toHaveClass(/hidden-here/);
  await expect(cell).toHaveCSS('--mdy-layout-column-display', 'none');

  // …and shown again from md, which the cascade needs said explicitly rather than left unsaid. The
  // node is still reachable, which is the whole reason the canvas marks instead of hiding.
  await page.locator('[data-breakpoint="md"]').click();
  await first.hover();
  await first.locator('[data-toggle-hidden]').click();
  await expect(first).not.toHaveClass(/hidden-here/);
  await expect(cell).toHaveCSS('--mdy-layout-column-display-md', 'flex');
  await expect(cell).toHaveCSS('--mdy-layout-column-display', 'none');

  // Back to base, where nothing has undone the hiding.
  await page.locator('[data-breakpoint="base"]').click();
  await expect(first).toHaveClass(/hidden-here/);
});

test("a group in a row can be hidden at a size, all the way to the canvas", async ({ page }) => {
  // The whole chain: the group's own control writes the placement, the compiler puts it on the
  // section that occupies the column, and the renderer applies it to that column.
  await page.locator('[data-template="group"]').click();
  await page.locator('[data-name]').fill('shipping');
  await page.locator('[data-name]').blur();
  const groupId = await page.locator('.plain-canvas-group').first().getAttribute('data-plain-group');

  await addFields(page, ['city', 'country']);
  await page.locator('[data-plain-field-into]').first().selectOption(groupId!);

  const group = page.locator('.plain-canvas-group').first();
  await group.hover();
  await page.locator(`[data-layout-columns="${groupId}"]`).click();
  await expect(page.locator('.mdy-layout-columns > .mdy-layout-column')).toHaveCount(2);

  // The toolbar floats over the canvas; with nothing left to add it is in the way, exactly as it is
  // for a user reaching for a control underneath it.
  await closeDock(page);
  await group.hover();
  await page.locator(`[data-toggle-hidden="${groupId}"]`).click();

  const groupCell = page.locator('.mdy-layout-columns > .mdy-layout-column').filter({ has: page.locator('.plain-canvas-group') });
  await expect(groupCell).toHaveCSS('--mdy-layout-column-display', 'none');
  await expect(page.locator('.plain-canvas-group').first()).toHaveClass(/hidden-here/);
  // Hidden at a size is not deleted, and on the canvas not even removed: the group and its field
  // stay editable, which is what makes the hiding undoable.
  await expect(groupCell.locator('.plain-canvas-field[data-field-path="shipping.city"]')).toBeVisible();
});

test("a group sits in a column beside a control, keeping its fields", async ({ page }) => {
  // The one arrangement Studio could never make: a container had no column of its own, because the
  // compiler spilled its leaves into whatever slot it occupied. It now compiles to a section, so the
  // row holds the group as a single child.
  await page.locator('[data-template="group"]').click();
  await page.locator('[data-name]').fill('shipping');
  await page.locator('[data-name]').blur();
  const groupId = await page.locator('.plain-canvas-group').first().getAttribute('data-plain-group');

  await addFields(page, ['city', 'country']);
  await page.locator('[data-plain-field-into]').first().selectOption(groupId!);

  const group = page.locator('.plain-canvas-group').first();
  await group.hover();
  await page.locator(`[data-layout-columns="${groupId}"]`).click();

  const columns = page.locator('.mdy-layout-columns > .mdy-layout-column');
  await expect(columns).toHaveCount(2);
  // The group is one column, and its field is inside it — not a second column of its own.
  await expect(columns.locator('.plain-canvas-group')).toHaveCount(1);
  await expect(
    columns.locator('.plain-canvas-group .plain-canvas-field[data-field-path="shipping.city"]'),
  ).toBeVisible();
  await expect(page.locator('.plain-canvas-field[data-field-path="country"]')).toBeVisible();
});
