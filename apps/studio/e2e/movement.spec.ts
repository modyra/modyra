import { expect, test } from "@playwright/test";
import { openStudio } from "./support/studio.js";

/**
 * Every way a node can move, and the cases that had no way at all.
 *
 * A repeater's row shape *is* the array's item, so the model refuses to move, duplicate or delete
 * it. Studio offered all four anyway and each one put an error in the footer — "Node is not
 * movable", "Replace the array item or delete its array". What it never offered was the operation
 * that is valid: replacing the shape, so a repeater's rows stayed whatever they were created as.
 */
test.beforeEach(async ({ page }) => { await openStudio(page); });

test("a row shape offers no operation the model will refuse", async ({ page }) => {
  await page.locator('[data-template="array"]').click();
  const itemId = await page.locator(".plain-canvas-array-item").getAttribute("data-plain-select");

  const controls = page.locator(`[data-plain-group="${itemId}"] .plain-canvas-group-actions`);
  await expect(controls.locator("[data-plain-group-root]")).toHaveCount(0);
  await expect(controls.locator("[data-plain-group-into]")).toHaveCount(0);
  await expect(controls.locator("[data-duplicate]")).toHaveCount(0);
  await expect(controls.locator("[data-delete]")).toHaveCount(0);
});

test("a repeater's row shape can be changed, in both directions", async ({ page }) => {
  await page.locator('[data-template="array"]').click();

  const shape = page.locator("[data-plain-array-shape]");
  await expect(shape).toHaveValue("group");

  await shape.selectOption("text");
  await expect(page.locator(".plain-canvas-array-item")).toHaveText(/Item schema: text/);
  // A scalar row has no group fieldset, so a control living on the group could never bring one back.
  await expect(page.locator("[data-plain-array-shape]")).toHaveValue("text");

  await page.locator("[data-plain-array-shape]").selectOption("group");
  await expect(page.locator(".plain-canvas-array-item")).toHaveText(/Item schema: group/);
  await expect(page.locator(".plain-canvas-array .plain-canvas-group")).toHaveCount(1);
});

test("a field moves into a repeater's row and back out to the root", async ({ page }) => {
  await page.locator('[data-template="array"]').click();
  await page.locator(".outline-root").click();
  await page.locator('[data-template="text"]').click();

  const itemId = await page.locator(".plain-canvas-array-item").getAttribute("data-plain-select");
  await page.locator("[data-plain-field-into]").first().selectOption(itemId!);

  // The outline, not the canvas: a repeater with no initial rows has no row fields to render, so
  // the field is really in the row shape and correctly invisible on a form that has no rows yet.
  const depths = () => page.locator(".outline .tree").evaluate((tree: Element) => {
    const walk = (list: Element, depth: number): string[] => {
      const out: string[] = [];
      for (const item of Array.from(list.children)) {
        if (item.tagName !== "LI") { out.push(...walk(item, depth)); continue; }
        const kind = item.querySelector(".node small")?.textContent?.trim();
        if (kind) out.push(`${depth}:${kind}`);
        for (const child of Array.from(item.children)) {
          if (child.tagName === "UL" || child.tagName === "SECTION") out.push(...walk(child, depth + 1));
        }
      }
      return out;
    };
    return walk(tree, 0);
  });
  expect(await depths()).toEqual(["0:array", "1:group", "2:field"]);

  // The canvas has no control for it — a repeater with no rows renders no row fields — so the way
  // back out is the outline's pick-up: Space to lift, ArrowLeft to leave the container. That aimed
  // at the row shape, which is an array's item and has no sibling slot, and threw every time.
  const fieldNode = page.locator('.outline .tree [data-node]').last();
  await fieldNode.focus();
  await page.keyboard.press(" ");
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("Enter");
  expect(await depths()).toEqual(["0:array", "1:group", "0:field"]);
});

test("the keyboard moves a node into a repeater's row shape", async ({ page }) => {
  await page.locator('[data-template="array"]').click();
  await page.locator(".outline-root").click();
  await page.locator('[data-template="text"]').click();

  const depths = () => page.locator(".outline .tree").evaluate((tree: Element) => {
    const walk = (list: Element, depth: number): string[] => {
      const out: string[] = [];
      for (const item of Array.from(list.children)) {
        if (item.tagName !== "LI") { out.push(...walk(item, depth)); continue; }
        const kind = item.querySelector(".node small")?.textContent?.trim();
        if (kind) out.push(`${depth}:${kind}`);
        for (const child of Array.from(item.children)) {
          if (child.tagName === "UL" || child.tagName === "SECTION") out.push(...walk(child, depth + 1));
        }
      }
      return out;
    };
    return walk(tree, 0);
  });
  expect(await depths()).toEqual(["0:array", "1:group", "0:field"]);

  // ArrowRight moves into the previous sibling. A repeater is a container as much as a group is —
  // moving into one means moving into the shape of its rows, which it refused to do.
  await page.locator('.outline .tree [data-node]').last().focus();
  await page.keyboard.press(" ");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Enter");
  expect(await depths()).toEqual(["0:array", "1:group", "2:field"]);
});
