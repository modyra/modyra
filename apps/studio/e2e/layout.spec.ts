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

test("the size selector is on the canvas, not behind the toolbar", async ({ page }) => {
  // It used to live inside the floating toolbar, which is collapsed by default and floats over the
  // canvas — so choosing a size meant opening a FAB first, every time.
  await closeDock(page);
  await expect(page.locator('[data-dock-panel]')).toBeHidden();

  const bar = page.locator('.canvas-bar');
  await expect(bar).toBeVisible();
  for (const size of ['base', 'sm', 'md', 'lg']) {
    await expect(bar.locator(`[data-breakpoint="${size}"]`)).toBeVisible();
  }

  // And it works from there, with the toolbar still shut.
  await bar.locator('[data-breakpoint="md"]').click();
  await expect(bar.locator('[data-breakpoint="md"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.plain-canvas-frame')).toHaveAttribute('data-breakpoint-frame', 'md');
  await expect(page.locator('[data-dock-panel]')).toBeHidden();
});

test("changing one size leaves every other size alone", async ({ page }) => {
  // Reported: "ogni layout deve avere la sua conformazione, non è che se cambio in SM allora anche
  // MD sarà così." The contract cascades mobile-first because CSS does, so a size stating nothing
  // followed the nearest smaller one that did — and editing `sm` dragged `md` and `lg` with it.
  // Studio pins what the larger sizes are showing before the change, so they stop following.
  await addFields(page, ["first", "second"]);
  await page.locator('[data-layout-columns]').last().click();
  await expect(page.locator('.mdy-layout-columns .mdy-layout-column')).toHaveCount(2);

  const first = page.locator('.plain-canvas-field[data-field-path="first"]');
  const widthAt = async (size: string) => {
    await page.locator(`[data-breakpoint="${size}"]`).click();
    await first.hover();
    return first.locator('[data-row-columns] option:checked').innerText();
  };

  await page.locator('[data-breakpoint="sm"]').click();
  await first.hover();
  await first.locator('[data-row-columns]').selectOption('1');

  expect(await widthAt('sm')).toBe('1×');
  // The two that used to follow `sm`, and no longer do.
  expect(await widthAt('md')).toBe('2×');
  expect(await widthAt('lg')).toBe('2×');
  // Smaller sizes were never at risk — the cascade only runs upward — and must not have moved either.
  expect(await widthAt('base')).toContain('auto');

  // And the same holds a second time, from a size in the middle: `lg` keeps what it shows.
  expect(await widthAt('md')).toBe('2×');
  await first.locator('[data-row-columns]').selectOption('1');
  expect(await widthAt('lg')).toBe('2×');
});

test("a width says whether this size decided it or inherited it", async ({ page }) => {
  // A size that has never been touched states nothing and shows what it would inherit, marked as
  // inherited. Once a size *is* decided, the larger ones are pinned rather than left following it —
  // each size holds its own arrangement — and `auto` is how one is handed back to inheritance.
  await addFields(page, ["first", "second"]);
  await page.locator('[data-layout-columns]').last().click();
  await expect(page.locator('.mdy-layout-columns .mdy-layout-column')).toHaveCount(2);

  const first = page.locator('.plain-canvas-field[data-field-path="first"]');
  const width = first.locator('[data-row-columns]');
  const shown = async () => width.locator('option:checked').innerText();

  // Untouched: nothing stated anywhere, so every size reads as inherited.
  await page.locator('[data-breakpoint="lg"]').click();
  await first.hover();
  await expect(width).toHaveValue('');
  await expect(width).toHaveClass(/inherited/);

  await page.locator('[data-breakpoint="md"]').click();
  await first.hover();
  await width.selectOption('1');
  await expect(width).toHaveValue('1');
  await expect(width).not.toHaveClass(/inherited/);
  expect(await shown()).toBe('1×');

  // `lg` was pinned to what it was showing, so deciding `md` did not move it.
  await page.locator('[data-breakpoint="lg"]').click();
  await first.hover();
  await expect(width).toHaveValue('2');
  await expect(width).not.toHaveClass(/inherited/);

  // Handing `lg` back to inheritance is still possible, and then it follows `md` again.
  await width.selectOption('');
  await expect(width).toHaveClass(/inherited/);
  expect(await shown()).toContain('from md');

  // …and `md` is untouched by any of it.
  await page.locator('[data-breakpoint="md"]').click();
  await first.hover();
  await expect(width).toHaveValue('1');
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

  // Hidden at `base` alone: the larger sizes were pinned to what they were showing, so hiding here
  // does not hide them. The node stays reachable at every size, which is the whole reason the canvas
  // marks instead of removing.
  await page.locator('[data-breakpoint="md"]').click();
  await first.hover();
  await expect(first).not.toHaveClass(/hidden-here/);
  await expect(cell).toHaveCSS('--mdy-layout-column-display-md', 'flex');
  await expect(cell).toHaveCSS('--mdy-layout-column-display', 'none');

  // `md` decides for itself, and `base` keeps its own answer.
  await first.locator('[data-toggle-hidden]').click();
  await expect(first).toHaveClass(/hidden-here/);
  await page.locator('[data-breakpoint="base"]').click();
  await first.hover();
  await expect(first).toHaveClass(/hidden-here/);

  // Showing it again at `base` leaves `md` hidden, which is what per-size means.
  await first.locator('[data-toggle-hidden]').click();
  await expect(first).not.toHaveClass(/hidden-here/);
  await page.locator('[data-breakpoint="md"]').click();
  await first.hover();
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

test("the preview panel arranges by its own width, not the window's", async ({ page }) => {
  // The point of container queries, seen from the panel that most needed them: the inspector is a
  // few hundred pixels wide inside a 1280px window, and a row has to stack there because that is
  // what the form's own width earns — not spread into two columns because the *window* is wide.
  await addFields(page, ["first", "second"]);
  await page.locator('[data-layout-columns]').last().click();
  await page.locator('[data-inspector-tab="preview"]').click();

  const fields = page.locator('.preview-fields');
  await expect(fields.locator('.mdy-layout-columns')).toBeVisible();
  expect(await fields.evaluate((el) => getComputedStyle(el).containerType)).toBe('inline-size');

  const tracksAt = async (width: number | null) =>
    fields.evaluate((el, w) => {
      if (w !== null) (el as HTMLElement).style.width = `${w}px`;
      const row = el.querySelector('.mdy-layout-columns') as HTMLElement;
      return getComputedStyle(row).gridTemplateColumns.split(' ').length;
    }, width);

  // As it sits in the inspector: narrow, so stacked.
  expect(await tracksAt(null)).toBe(1);
  expect(await tracksAt(320)).toBe(1);
  // Widened past `sm` it takes its declared tracks — the window never moved.
  expect(await tracksAt(900)).toBe(2);
  expect(await page.evaluate(() => window.innerWidth)).toBe(1280);
});

test("zoom changes how big the canvas is drawn, never which arrangement it shows", async ({ page }) => {
  // A `lg` viewport is 80rem. With the outline and inspector open there is nowhere near that much
  // room, so the size most worth checking was the one you could not see.
  await addFields(page, ["first", "second"]);
  await toggleColumns(page, "first");
  await closeDock(page);
  await page.locator('[data-breakpoint="lg"]').click();

  const measure = () => page.evaluate(() => {
    const frame = document.querySelector('.plain-canvas-frame') as HTMLElement;
    const form = document.querySelector('.plain-canvas-form') as HTMLElement;
    const row = document.querySelector('.mdy-layout-columns') as HTMLElement;
    const canvas = document.querySelector('.canvas') as HTMLElement;
    return {
      onScreen: Math.round(frame.getBoundingClientRect().width),
      layout: Math.round(form.offsetWidth),
      tracks: getComputedStyle(row).gridTemplateColumns.split(' ').length,
      canvas: canvas.clientWidth,
    };
  });

  // Unscaled first, to establish what "too wide to see" means. The canvas fits by default now, so
  // this is the state the zoom exists to rescue rather than the one you land in.
  await page.locator('[data-zoom]').selectOption('1');
  const full = await measure();
  expect(full.tracks).toBe(2);
  expect(full.onScreen).toBeGreaterThan(full.canvas); // too wide to see, which is the problem

  await page.locator('[data-zoom]').selectOption('0.5');
  const half = await measure();
  // Drawn at half the size…
  expect(half.onScreen).toBeLessThan(full.onScreen * 0.6);
  expect(half.onScreen).toBeGreaterThan(full.onScreen * 0.4);
  // …while the form still measures `lg` and is still arranged as `lg`. Zoom must never move a
  // breakpoint: the whole point is to see the wide arrangement, not a narrower one.
  expect(half.layout).toBe(full.layout);
  expect(half.tracks).toBe(2);

  // Fit does the arithmetic for you, and the result is inside the canvas.
  await page.locator('[data-zoom]').selectOption('fit');
  const fitted = await measure();
  expect(fitted.onScreen).toBeLessThanOrEqual(fitted.canvas);
  expect(fitted.tracks).toBe(2);
  expect(fitted.layout).toBe(full.layout);
});

test("a popup still lands on its control while the canvas is zoomed", async ({ page }) => {
  // The reason the zoom is a transform rather than the `zoom` property: `zoom` is inherited into the
  // top layer, so a popup's viewport coordinates were read in the zoomed space and it landed about a
  // hundred pixels off its control. Measured, because the first mechanism tried looked fine until it
  // was measured.
  await page.locator('[data-template="date"]').click();
  await closeDock(page);
  await page.locator('[data-zoom]').selectOption('0.5');

  await page.locator('.mdy-datepicker__trigger').first().click();
  const geometry = await page.evaluate(() => {
    const popup = document.querySelector('.mdy-datepicker__popup') as HTMLElement;
    const anchor = document.querySelector('.mdy-renderer--datepicker .mdy-input-wrapper') as HTMLElement;
    const p = popup.getBoundingClientRect();
    const a = anchor.getBoundingClientRect();
    return {
      overlap: Math.round(Math.min(p.right, a.right) - Math.max(p.left, a.left)),
      anchorWidth: Math.round(a.width),
      dy: Math.round(p.top - a.bottom),
    };
  });

  expect(geometry.overlap).toBeGreaterThan(geometry.anchorWidth / 2);
  expect(geometry.dy).toBeGreaterThanOrEqual(0);
  expect(geometry.dy).toBeLessThanOrEqual(12);
});

test("every breakpoint is fully visible by default, so switching size shows the difference", async ({ page }) => {
  // Reported: "cambiando il breakpoint continuo ad avere lo stesso layout spalmato ovunque." The
  // arrangement was right all along — what was wrong is that you could not see it. A `md` form is
  // 64rem and an `lg` form 80rem, the canvas between the panels is a few hundred pixels, and at 100%
  // it simply scrolled: every size showed the same left-hand slice, measured at 51% of the form at
  // `lg`. So the canvas fits by default.
  await addFields(page, ["a", "b", "c"]);
  await toggleColumns(page, "a");
  await toggleColumns(page, "c");
  await closeDock(page);

  const seen = () => page.evaluate(() => {
    const canvas = document.querySelector('.canvas') as HTMLElement;
    const frame = document.querySelector('.plain-canvas-frame') as HTMLElement;
    const form = document.querySelector('.plain-canvas-form') as HTMLElement;
    const row = document.querySelector('.mdy-layout-columns') as HTMLElement;
    const f = frame.getBoundingClientRect(); const c = canvas.getBoundingClientRect();
    return {
      visible: Math.min(f.right, c.right) - Math.max(f.left, c.left),
      width: f.width,
      layout: Math.round(form.offsetWidth),
      tracks: getComputedStyle(row).gridTemplateColumns.split(' ').length,
    };
  });

  // Author a different arrangement at each size…
  for (const [size, across] of [['lg', '3'], ['md', '2'], ['sm', '1']] as const) {
    await page.locator(`[data-breakpoint="${size}"]`).click();
    const a = page.locator('.plain-canvas-field[data-field-path="a"]');
    await a.hover();
    await a.locator('[data-row-columns]').selectOption(across);
  }

  // …and every one of them is both fully on screen and its own arrangement.
  const widths: number[] = [];
  for (const [size, tracks] of [['base', 1], ['sm', 1], ['md', 2], ['lg', 3]] as const) {
    await page.locator(`[data-breakpoint="${size}"]`).click();
    const r = await seen();
    expect(r.visible, `${size} is cut off`).toBeGreaterThanOrEqual(r.width - 1);
    expect(r.tracks, `${size} draws the wrong arrangement`).toBe(tracks);
    widths.push(r.layout);
  }
  // The form really was laid out at four different widths, not one width four times.
  expect(new Set(widths).size).toBe(4);
});

test("one row, two rows at sm and one at md — the same three fields", async ({ page }) => {
  // The shape asked for, in the words it was asked in: at `sm` username and password share the first
  // row and the mail is under them; at `md` all three sit in one row. It is one row of three fields
  // told to be two tracks wide at `sm` and three at `md` — the third field wraps, because a row is a
  // grid and a grid wraps.
  //
  // Asserted from the *drawn* cells rather than from the width control: the tests above check what
  // the control says, and this checks what the form does with it.
  await addFields(page, ["username", "password", "mail"]);
  await toggleColumns(page, "username");
  await toggleColumns(page, "mail");
  await expect(page.locator(".mdy-layout-columns .mdy-layout-column")).toHaveCount(3);

  const setWidth = async (size: string, across: string) => {
    await page.locator(`[data-breakpoint="${size}"]`).click();
    const field = page.locator('.plain-canvas-field[data-field-path="username"]');
    await field.hover();
    await field.locator("[data-row-columns]").selectOption(across);
  };

  /** Which drawn row each field landed on, top to bottom, by the cell's own y position. */
  const rows = async (size: string) => {
    await page.locator(`[data-breakpoint="${size}"]`).click();
    await page.waitForTimeout(250);
    return page.locator(".mdy-layout-columns").first().evaluate((row) => {
      const cells = Array.from(row.querySelectorAll(".mdy-layout-column")) as HTMLElement[];
      const tops = cells.map((cell) => Math.round(cell.getBoundingClientRect().top));
      const lines = [...new Set(tops)].sort((a, b) => a - b);
      return cells.map((cell, i) => ({
        field: cell.querySelector("[data-field-path]")?.getAttribute("data-field-path") ?? null,
        line: lines.indexOf(tops[i]!),
      }));
    });
  };

  await setWidth("sm", "2");
  await setWidth("md", "3");

  // Two rows at `sm`: username and password together, the mail below them.
  expect(await rows("sm")).toEqual([
    { field: "username", line: 0 },
    { field: "password", line: 0 },
    { field: "mail", line: 1 },
  ]);

  // One row at `md`: all three on the same line.
  expect(await rows("md")).toEqual([
    { field: "username", line: 0 },
    { field: "password", line: 0 },
    { field: "mail", line: 0 },
  ]);

  // And `sm` did not follow `md` when `md` was set — each size holds its own arrangement.
  expect((await rows("sm")).map((cell) => cell.line)).toEqual([0, 0, 1]);
});
