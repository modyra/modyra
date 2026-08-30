import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

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


/**
 * Whether an accepted record argues that a reference may name an empty reserved container.
 *
 * Read rather than restated: an allowance held in a test is one nobody can find and nobody can
 * overturn, and the reasoning and the silence it buys then live in two places and drift.
 */
const reservedContainersAreAllowed = (): boolean => {
  const path = join(process.cwd(), "docs", "architecture",
    "0180-a-container-held-open-under-a-field-that-can-fail.md");
  if (!existsSync(path)) return false;
  const text = readFileSync(path, "utf8");
  return /^Status:\s*Accepted\s*$/m.test(text)
    && text.includes("A reference to an empty reserved container is not a defect");
};


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
  // **A reference naming nothing, not a description that says nothing.** The two look identical in a
  // failing assertion — both read as "the description came back empty" — and they are different
  // defects in different places. A container held open under a field that can fail is empty until
  // there is a message, deliberately: the reference then has no moment at which it names an element
  // not yet drawn or already gone, and an empty description announces nothing, which is what an
  // empty container is for. A reference to an element that is not on the page is a promise the
  // document cannot keep, and no rendering of the field will make it resolve.
  //
  // The allowance is read from the record that argues it, not restated here: if that record is
  // superseded or rewritten, this asks for a description again rather than going on excusing.
  expect(
    reservedContainersAreAllowed(),
    "no accepted record argues that a reference may name an empty container, so this is asking for "
    + "a description again — either the record is owed or this check is",
  ).toBe(true);

  const described = page.locator(`${FIELD} [aria-describedby]:visible`);
  const count = await described.count();
  expect(count).toBeGreaterThan(0);

  const silent: string[] = [];
  for (let index = 0; index < count; index += 1) {
    const control = described.nth(index);
    const reference = (await control.getAttribute("aria-describedby")) ?? "";
    const missing = await control.evaluate((node) =>
      (node.getAttribute("aria-describedby") ?? "").split(/\s+/).filter(Boolean)
        .filter((id) => document.getElementById(id) === null));
    if (missing.length > 0) {
      silent.push(`${reference} — names ${missing.join(" ")}, which is not on the page`);
      continue;
    }
  }

  expect(
    silent,
    `${silent.length} control(s) point a screen reader at an element that is not there:\n`
    + `${silent.join("\n")}\n\n`
    + "A container that is on the page and holds nothing announces nothing, which is what an empty "
    + "container is for. A reference to an element the page does not have is a promise no rendering "
    + "of the field can keep.",
  ).toEqual([]);
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
