/**
 * Claims under attack: UI-003.
 */

import { expect, test } from "@playwright/test";

/**
 * Three options declared, two rendered.
 *
 * A document may declare two options with the same value, and the parser keeps both: `strict` answers
 * `ok`, no diagnostic, three options in and three options out. The page shows two. The generated id
 * for an option is built from its value, so the second collides with the first and one of them is
 * never rendered — the user cannot see it and cannot choose it.
 *
 * Which one disappears is worth stating: the *first*. A list reading "Pro monthly, Pro yearly, Lite"
 * renders "Pro yearly, Lite", so the option an author put first is the one that goes.
 *
 * The precedent is in the same parser. Two fields sharing a name are refused with
 * `MDY_DYNAMIC_DUPLICATE_NAME` and the second is dropped loudly, because an id built from a name
 * collides the same way. Option values build ids too, and nothing checks them.
 *
 * Either resolution closes it: refuse the duplicate the way a duplicate name is refused, or generate
 * an option id that does not depend on the value being unique. What cannot stand is a form that
 * offers fewer choices than the document it was built from, without saying so anywhere.
 */

const settled = async (page: import("@playwright/test").Page) => {
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve(null)))),
  );
};

const PLANS = [
  { value: "pro", label: "Pro monthly" },
  { value: "pro", label: "Pro yearly" },
  { value: "lite", label: "Lite" },
];

test.beforeEach(async ({ page }) => {
  await page.goto("/index.html");
  await page.waitForFunction(() => (window as never as { battleReady?: boolean }).battleReady === true);
});

test("a list of distinct options renders all of them", async ({ page }) => {
  // The control. Three options that differ in value render as three, so what happens below is the
  // duplicate rather than a renderer that drops the third of anything.
  await page.evaluate(
    (options) => window.battle.mountFields("clean", [{ name: "s", kind: "select", searchable: true, label: "Plan", options }] as never),
    [
      { value: "pro-monthly", label: "Pro monthly" },
      { value: "pro-yearly", label: "Pro yearly" },
      { value: "lite", label: "Lite" },
    ],
  );
  await settled(page);
  await page.locator('[data-form="clean"] [role="combobox"]').click();
  await settled(page);

  const listed = await page.evaluate(() => [...document.querySelectorAll('[role="option"]')].map((each) => each.textContent));
  expect(listed).toEqual(["Pro monthly", "Pro yearly", "Lite"]);
});

test("every option a document declares is one a person can choose", async ({ page }) => {
  await page.evaluate(
    (options) => window.battle.mountFields("dup", [{ name: "s", kind: "select", searchable: true, label: "Plan", options }] as never),
    PLANS,
  );
  await settled(page);
  await page.locator('[data-form="dup"] [role="combobox"]').click();
  await settled(page);

  const listed = await page.evaluate(() => [...document.querySelectorAll('[role="option"]')].map((each) => ({
    text: each.textContent,
    id: each.id,
  })));

  // The mechanism, recorded beside the count: the ids collide because they are built from the value.
  expect(new Set(listed.map((each) => each.id)).size, JSON.stringify(listed)).toBe(listed.length);
  expect(listed.map((each) => each.text)).toEqual(["Pro monthly", "Pro yearly", "Lite"]);
});
