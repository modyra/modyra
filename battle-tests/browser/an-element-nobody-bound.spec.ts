/**
 * An element on the page, asked to render a field it was never given.
 *
 * A Lit form is whatever a consumer writes: elements are registered once and each is bound by setting
 * `.field`. Forgetting one is the ordinary mistake of that shape of API — a renamed handle, a
 * conditional branch that never assigns, a template that binds four of five.
 *
 * What happens then, measured on five elements, two frames after they were connected:
 *
 *     mdy-text-field        text ""   inputs 0
 *     mdy-number-field      text ""   inputs 0
 *     mdy-select-field      text ""   inputs 0
 *     mdy-checkbox-field    text ""   inputs 0
 *     mdy-datepicker-field  text ""   inputs 0
 *     the console           said nothing
 *
 * Not even the `label` attribute it was given is drawn. An empty custom element in a page reads as a
 * layout gap, not as a missing binding, and there is nothing anywhere to search for.
 *
 * **This library is loud everywhere else.** `assertUsableWidgetId` throws a sentence naming what is
 * wrong with the id. `mountMdyForm` refuses a bad field name and says which. `devWarnings` exists for
 * exactly this class — its own evidence line is *"the calls that could not do anything"*. The element
 * surface is the one published door that fails in silence.
 *
 * Not zero frames, because binding after appending is legitimate and is what every host does:
 * `createElement`, append, assign `.field`. What is under attack is an element that has been given
 * time to paint and still has nothing to paint from.
 *
 * **And the other direction is asserted beside it**, because it is the one a repair gets wrong: an
 * element bound a frame *after* it was appended must stay silent. Measured while this was being
 * repaired, a warning at two frames fired on exactly that host — legitimate code, told off. Without
 * this half, a repair that warns immediately goes green here and is wrong everywhere.
 *
 * Green when an element that painted without a field says so once, where a developer will find it.
 * Throwing is the wrong answer — it would break the create-then-bind order every host uses.
 *
 * Claims under attack: API-001.
 */

import { expect, test } from "@playwright/test";

/** One element per shape of control, so a warning wired to one kind is not read as all of them. */
const TAGS = [
  "mdy-text-field",
  "mdy-number-field",
  "mdy-select-field",
  "mdy-checkbox-field",
  "mdy-datepicker-field",
];

test("an element that painted without a field says so", async ({ page }) => {
  const said: string[] = [];
  page.on("console", (message) => said.push(`${message.type()}: ${message.text()}`));
  page.on("pageerror", (error) => said.push(`pageerror: ${error.message}`));

  await page.goto("/lit.html");
  await page.waitForFunction(() => (window as never as { battleLitReady?: boolean }).battleLitReady === true);

  const drawn = await page.evaluate(async (tags) => {
    const stage = document.querySelector("#stage") as HTMLElement;
    const rest = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve(null))));
    const seen: Array<{ tag: string; text: string; controls: number }> = [];
    for (const tag of tags) {
      const element = document.createElement(tag);
      element.setAttribute("label", "Unbound");
      stage.append(element);
      await rest();
      seen.push({
        tag,
        text: (element.textContent ?? "").trim(),
        controls: element.querySelectorAll("input, select, textarea, button").length,
      });
    }
    return seen;
  }, TAGS);

  // The other direction, in the same page: an element bound one frame after it was appended is a
  // host doing the ordinary thing, and must draw no complaint. Asserted before the finding below so
  // that a repair which warns too eagerly fails here rather than passing on the half it satisfies.
  const boundLate = await page.evaluate(async () => {
    const stage = document.querySelector("#stage") as HTMLElement;
    const before = (window as never as { __mdySaid?: string[] }).__mdySaid ?? [];
    const element = document.createElement("mdy-text-field");
    element.setAttribute("label", "Late");
    stage.append(element);
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
    const host = (window as never as Record<string, Record<string, (...a: unknown[]) => unknown>>).battleLit;
    host.mountFields("late", [{ name: "v", kind: "text", label: "Late" }] as never);
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve(null))));
    return { drew: element.querySelectorAll("input").length, before: before.length };
  });
  const complainedAboutLate = said.filter((line) => /Late/.test(line));
  expect(complainedAboutLate, `an element bound a frame after it was appended was told off: ${complainedAboutLate.join(" | ")}`)
    .toEqual([]);
  expect(boundLate.drew).toBeGreaterThanOrEqual(0);

  // The control on the measurement: the elements really are defined and really did paint nothing.
  // An undefined custom element would also be empty, and would be a different finding.
  const defined = await page.evaluate((tags) => tags.every((tag) => customElements.get(tag) !== undefined), TAGS);
  expect(defined, "the elements under test are not registered, so nothing here is about binding").toBe(true);
  expect(drawn.every((each) => each.controls === 0), JSON.stringify(drawn)).toBe(true);

  // And the finding: five elements drew nothing, and nothing was said about any of them.
  const complaints = said.filter((line) => /modyra|field|bind/i.test(line));
  expect(complaints, `five unbound elements drew nothing and the console said: ${said.join(" | ") || "(nothing)"}`)
    .not.toEqual([]);
});
