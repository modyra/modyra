import { expect, test } from "@playwright/test";

/**
 * Questions a browser has to answer, asked of every renderer that has one.
 *
 * These assert on **contract classes** — `.mdy-renderer`, `.mdy-label`, `.mdy-input-wrapper` — which
 * are the same in every renderer by definition. That is what makes one file legitimate here: a
 * difference between the projects is a real divergence and not a fixture detail, which is the
 * opposite of what a per-renderer copy of the same assertions would tell you.
 *
 * Two of the three rows here were Angular-only until this file existed. Not because the questions
 * were Angular's, but because the harness served one demo.
 */

const FIELD = ".mdy-renderer:visible";

/** WCAG 1.4.4: text to 200%, viewport unchanged. Not page zoom — only the type grows. */
async function doubleTextSize(page: import("@playwright/test").Page): Promise<void> {
  await page.addStyleTag({ content: ":root { font-size: 200% !important; }" });
  await page.waitForTimeout(150);
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.locator(FIELD).first().waitFor({ state: "visible" });
});

/** The roles a form control takes. Everything else on the page is the example's own chrome. */
const CONTROL_ROLES = new Set([
  "textbox", "combobox", "checkbox", "switch", "slider", "spinbutton", "radiogroup", "listbox",
]);

/**
 * Chromium's own accessibility tree, in one call.
 *
 * This is what a screen reader is handed, and it is read through CDP rather than by asserting on
 * each control in turn: a per-control loop with retries takes longer than the test timeout on a page
 * with twenty fields, which is a harness limit reported as a renderer defect.
 *
 * **Chromium only.** No other engine exposes a computed accessibility tree to an automation client,
 * and a name computed by JavaScript would be this repository's opinion of the algorithm rather than
 * a browser's. Where a spec's other half is engine-independent it keeps running everywhere; only the
 * tree assertions stop.
 */
async function accessibilityTree(page: import("@playwright/test").Page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Accessibility.enable");
  const { nodes } = await cdp.send("Accessibility.getFullAXTree");
  return nodes.filter((node) => !node.ignored && CONTROL_ROLES.has(node.role?.value as string));
}

test("every operable control has an accessible name", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "the computed accessibility tree is only readable in Chromium");

  // A name can come from a label element, a `labelledby` reference or the control's own content, and
  // only the computed value says whether any of them arrived. A control with none is announced as
  // its role alone — "edit", "button" — which says what it is and nothing about what it is for.
  const controls = await accessibilityTree(page);
  expect(controls.length).toBeGreaterThan(0);

  const unnamed = controls
    .filter((node) => !(node.name?.value ?? "").trim())
    .map((node) => node.role?.value);
  expect(unnamed).toEqual([]);
});

test("a control that claims a description has one", async ({ page, browserName }) => {
  // Two halves of one question. `aria-describedby` naming an element that exists is what the
  // attribute audits check; whether that element contributes any text is what decides if anything is
  // announced, and a reference to a missing or empty element computes to no description at all.
  const dangling = await page.evaluate(() =>
    [...document.querySelectorAll(".mdy-renderer [aria-describedby]")]
      .flatMap((element) => (element.getAttribute("aria-describedby") ?? "").split(/\s+/))
      .filter((id) => id && !document.getElementById(id)));
  expect(dangling).toEqual([]);

  // Conditional on the page actually having something to say. A renderer may render its
  // supporting-text element unconditionally and let a host slot into it — the element is then in the
  // document, so the reference resolves and the contract is met, but an example that slots nothing
  // leaves every description empty. That is the example being bare, not the renderer being wrong,
  // and asserting otherwise fails a conformant renderer for the fixture's silence.
  // Referenced *and* non-empty. Counting any element with text is too loose: an example may write
  // its own `.mdy-supporting-text` outside the component, with no id and nothing pointing at it, and
  // that describes no control however much text it holds.
  const describing = await page.evaluate(() =>
    [...document.querySelectorAll(".mdy-supporting-text, .mdy-control__errors")]
      .filter((element) => element.id
        && (element.textContent ?? "").trim()
        && document.querySelector(`[aria-describedby~="${element.id}"]`)).length);
  if (describing === 0) test.skip(true, "nothing on this page describes a control yet");

  // The dangling-reference half above is the DOM's own business and runs on every engine. Only the
  // question "did it reach the tree" needs a tree to read.
  test.skip(browserName !== "chromium", "the computed accessibility tree is only readable in Chromium");

  const controls = await accessibilityTree(page);
  const described = controls.filter((node) => (node.description?.value ?? "").trim());
  // Where the page does describe a control, the description has to reach the tree.
  expect(described.length).toBeGreaterThan(0);
});

test("no field overflows the viewport at 200% text", async ({ page }) => {
  await doubleTextSize(page);

  // Scoped to what the renderer laid out. The shared class vocabulary is deliberately available to
  // host markup, so "carries an mdy- class" does not mean "Modyra put it there" — asserting on the
  // wider set reports the example page's own layout as a framework defect.
  const offenders = await page.evaluate(() => {
    const limit = document.documentElement.clientWidth;
    return [...document.querySelectorAll(".mdy-renderer")]
      .flatMap((field) => [field, ...field.querySelectorAll("*")])
      .filter((element) => element.getBoundingClientRect().right > limit + 2)
      .map((element) => `${element.tagName.toLowerCase()}.${[...element.classList].join(".")}`)
      .slice(0, 8);
  });
  expect(offenders).toEqual([]);
});

test("a label stays with its control at 200% text", async ({ page }) => {
  await doubleTextSize(page);

  // The id relation survives any layout; what can break is the visual one. A label that no longer
  // sits with the control it names is a field the user has to guess at.
  const field = page.locator(`${FIELD}:has(.mdy-label):has(input)`).first();
  const label = field.locator(".mdy-label").first();
  const control = field.locator("input").first();

  const [labelBox, controlBox] = await Promise.all([label.boundingBox(), control.boundingBox()]);
  expect(labelBox).not.toBeNull();
  expect(controlBox).not.toBeNull();
  if (!labelBox || !controlBox) return;

  expect(labelBox.y).toBeLessThanOrEqual(controlBox.y + controlBox.height);
  expect(labelBox.x).toBeLessThan(controlBox.x + controlBox.width);
});
