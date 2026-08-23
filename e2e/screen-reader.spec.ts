import { expect, test } from "@playwright/test";
import { COMBOBOX_TRIGGER } from "./support/select-shape";

/**
 * What the browser computes, rather than what the markup asks for.
 *
 * Every other accessibility suite in this repository reads attributes: that `aria-describedby` is
 * present, that it names an element which exists. This one reads the browser's own accessible name
 * and description — the values a screen reader is actually handed. The two can disagree, and where
 * they do the attribute audit is the one that is wrong:
 *
 * - a reference to an element that exists but holds no text computes to no description at all;
 * - a name assembled from a hidden element computes to nothing;
 * - a label that is present in the DOM but `display: none` names nothing.
 *
 * None of those is visible to an audit that stops at the attribute, and each leaves a control that
 * a screen-reader user cannot identify while every existing check stays green.
 */

/**
 * The element each field treats as its operable control.
 *
 * Only visible fields are examined: the demo carries collapsed sections, and a control that is not
 * on screen has no accessible name to compute — asserting on it measures the fixture.
 */
const FIELD = ".mdy-renderer:visible";
const CONTROL = "input,select,textarea,button,[role=combobox],[role=radiogroup],[role=slider],[role=spinbutton]";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.locator(COMBOBOX_TRIGGER).first().waitFor({ state: "visible" });
});

test("every operable control has an accessible name", async ({ page }) => {
  const fields = page.locator(FIELD);
  const count = await fields.count();
  expect(count).toBeGreaterThan(5);

  const unnamed: string[] = [];
  for (let index = 0; index < count; index += 1) {
    const field = fields.nth(index);
    const control = field.locator(CONTROL).first();
    if ((await control.count()) === 0) continue;

    const kind = await field.evaluate(
      (element) => [...element.classList].find((c) => c.startsWith("mdy-renderer--")) ?? "mdy-renderer",
    );

    // The browser's own name computation, not the `aria-label` attribute: a name can come from a
    // label element, a `labelledby` reference or the control's own content, and only the computed
    // value says whether any of them arrived.
    try {
      await expect(control).toHaveAccessibleName(/\S/, { timeout: 2_000 });
    } catch {
      unnamed.push(kind);
    }
  }

  // A control with no accessible name is announced as its role alone — "edit", "button" — which
  // tells a screen-reader user what it is and nothing about what it is for.
  expect(unnamed).toEqual([]);
});

test("a control that claims a description actually has one", async ({ page }) => {
  // `aria-describedby` naming an element that exists is what the attribute audits check. Whether
  // that element contributes any text is a different question, and it is the one that decides
  // whether the description is announced.
  const described = page.locator(`${FIELD} [aria-describedby]:visible`);
  const count = await described.count();
  expect(count).toBeGreaterThan(0);

  const silent: string[] = [];
  for (let index = 0; index < count; index += 1) {
    const control = described.nth(index);
    const reference = (await control.getAttribute("aria-describedby")) ?? "";
    try {
      await expect(control).toHaveAccessibleDescription(/\S/, { timeout: 2_000 });
    } catch {
      silent.push(reference);
    }
  }

  expect(silent).toEqual([]);
});

test("the accessible name is the label the user can see", async ({ page }) => {
  // A name that does not match the visible label is the WCAG 2.5.3 failure: a speech-input user
  // says what they read and nothing happens.
  const field = page.locator(".mdy-renderer--text:visible").first();
  const label = (await field.locator(".mdy-label").first().innerText())
    .replace(/\*/g, "")
    .trim();
  expect(label.length).toBeGreaterThan(0);

  await expect(field.locator("input").first()).toHaveAccessibleName(new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});
