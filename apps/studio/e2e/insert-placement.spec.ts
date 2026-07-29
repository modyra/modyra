import { expect, test } from "@playwright/test";
import { openStudio } from "./support/studio.js";

/**
 * Where a newly inserted node lands.
 *
 * `insertTemplate` moved the selection onto the new node *before* asking where it should go, and the
 * answer comes from whatever is selected. The new node is not in the index yet, so the lookup found
 * nothing and fell through to "append at the form root" — every insert landed at the root however
 * carefully a container had been chosen first, which made groups and repeaters impossible to fill.
 */
test.beforeEach(async ({ page }) => { await openStudio(page); });

/** The outline, as an indented shape — the model's nesting as the user sees it. */
async function outlineShape(page: import("@playwright/test").Page): Promise<string[]> {
  return page.locator(".outline .tree").evaluate((tree: Element) => {
    const walk = (list: Element, depth: number): string[] => {
      const out: string[] = [];
      for (const item of Array.from(list.children)) {
        if (item.tagName !== "LI") { out.push(...walk(item, depth)); continue; }
        const label = item.querySelector(".node-label")?.textContent?.trim();
        const kind = item.querySelector(".node small")?.textContent?.trim();
        if (label) out.push(`${depth}:${label} [${kind}]`);
        for (const child of Array.from(item.children)) {
          if (child.tagName === "UL" || child.tagName === "SECTION") out.push(...walk(child, depth + 1));
        }
      }
      return out;
    };
    return walk(tree, 0);
  });
}

test("a control inserted with a group selected lands inside that group", async ({ page }) => {
  await page.locator('[data-template="group"]').click();
  await page.locator('[data-template="text"]').click();

  expect(await outlineShape(page)).toEqual(["0:New group [group]", "1:Text [field]"]);
});

test("a repeater row takes a control and a group side by side", async ({ page }) => {
  await page.locator('[data-template="array"]').click();
  const itemId = await page.locator(".plain-canvas-array-item").getAttribute("data-plain-select");

  await page.locator(`.outline [data-select="${itemId}"]`).click();
  await page.locator('[data-template="text"]').click();
  await page.locator(`.outline [data-select="${itemId}"]`).click();
  await page.locator('[data-template="group"]').click();

  // A row is whatever its shape says it is: a control and a group are both allowed in it.
  expect(await outlineShape(page)).toEqual([
    "0:New array [array]",
    "1:item [group]",
    "2:Text [field]",
    "2:New group [group]",
  ]);
});
