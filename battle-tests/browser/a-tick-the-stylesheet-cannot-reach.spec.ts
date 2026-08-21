/**
 * The class is on the element, the rule is in the sheet, and nothing paints.
 *
 * A theme audit compares the class names a renderer **emits** against the class names the stylesheet
 * **mentions**. Both halves can be right while the control is visibly dead, because what a rule needs
 * is not a name — it is a *relationship*:
 *
 *     .mdy-checkbox__control:checked + .mdy-checkbox__indicator      modyra.css:1155
 *     .mdy-toggle input:checked      + .mdy-toggle__track            modyra.css:1284
 *
 * Both use the adjacent sibling combinator. Move the indicator one level down — inside the label,
 * which is where a hidden native input's only click forwarder lives — and the input's next sibling is
 * the label. The selector matches nothing. The class is still emitted, the rule is still written, and
 * `test:themes` stays green because it is comparing two lists of names.
 *
 * That is what shipped: the value changed and the tick did not.
 *
 * So this asks the only question that catches it — **did the appearance change** — by reading the
 * computed style of the part the contract names, before and after the value moves. Not the class, not
 * the attribute: the paint.
 *
 * The properties are read broadly rather than named one by one on purpose. A theme is free to signal
 * "checked" with a background, a colour, a border, a transform or an opacity, and pinning one of them
 * would make this spec an opinion about design instead of a check that *something* answers.
 *
 * Claims under attack: UI-009, A11Y-001.
 */

import { expect, test } from "@playwright/test";
import { MDY_WIDGET_CONTRACTS } from "@modyra/widgets";

const HOSTS = [
  { name: "plain", page: "/index.html", ready: "battleReady", api: "battle" },
  { name: "lit", page: "/lit.html", ready: "battleLitReady", api: "battleLit" },
];

/** The part each boolean kind draws its state on, taken from the catalogue rather than named here. */
const DRAWN = [
  { kind: "checkbox", part: "indicator" },
  { kind: "toggle", part: "track" },
] as const;

/** The properties a theme might carry a state on. Broad, so this stays a check and not a preference. */
const WATCHED = [
  "background-color", "border-color", "border-width", "color",
  "opacity", "transform", "box-shadow", "outline-color",
];

for (const host of HOSTS) {
  for (const { kind, part } of DRAWN) {
    test(`${kind} shows the value it holds, ${host.name}`, async ({ page }) => {
      test.setTimeout(120_000);
      await page.goto(host.page);
      await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

      const selector = `.${(MDY_WIDGET_CONTRACTS[kind].parts as Record<string, { classes: string[] }>)[part].classes[0]}`;

      await page.evaluate(({ api, k }) => {
        (window as never as Record<string, { mountFields(i: string, f: unknown[]): unknown }>)[api]
          .mountFields("paint", [{ name: "b", kind: k, label: "B" }]);
      }, { api: host.api, k: kind });
      await page.waitForTimeout(250);

      const drawn = page.locator(`[data-form="paint"] ${selector}`).first();

      // The premise: the part the contract names is on the page. Without it the comparison below is
      // between two nothings, which is exactly how a missing part reads as a passing test.
      expect(await drawn.count(), `${kind} drew no ${part} (${selector}), so nothing could paint`).toBeGreaterThan(0);

      // The element **and** its `::after`, because that is where the tick lives:
      // `.mdy-checkbox__control:checked + .mdy-checkbox__indicator::after` is the mark itself, and
      // `getComputedStyle(element)` does not see a pseudo-element. A first version of this spec read
      // only the element and passed on a renderer whose tick never appeared — the box's own border
      // moved for an unrelated reason and that was enough to satisfy "something changed".
      const styleOf = async () =>
        drawn.evaluate((element, properties) => {
          const read = (pseudo: string | null) => {
            const computed = getComputedStyle(element as Element, pseudo);
            return Object.fromEntries(
              properties.map((property) => [`${pseudo ?? "self"} ${property}`, computed.getPropertyValue(property)]),
            );
          };
          return { ...read(null), ...read("::after"), "::after content": getComputedStyle(element as Element, "::after").content };
        }, WATCHED);

      const before = await styleOf();
      await page.evaluate(({ api }) => {
        (window as never as Record<string, { setValue(i: string, patch: unknown): unknown }>)[api]
          .setValue("paint", { b: true });
      }, { api: host.api });
      await page.waitForTimeout(250);
      const after = await styleOf();

      // The control on the instrument: the model really did move. A `setValue` that did nothing would
      // make "the paint did not change" true and meaningless.
      const held = await page.evaluate(({ api }) =>
        (window as never as Record<string, { valueOf(i: string): Record<string, unknown> }>)[api].valueOf("paint")?.b,
      { api: host.api });
      expect(held, "setValue did not reach the model, so this says nothing about painting").toBe(true);

      const moved = Object.keys(before).filter((property) => before[property] !== after[property]);
      expect(
        moved,
        `${kind}'s ${part} is painted identically checked and unchecked — the class is emitted and the `
          + `rule is written, so a selector no longer reaches it. before=${JSON.stringify(before)} `
          + `after=${JSON.stringify(after)}`,
      ).not.toEqual([]);
    });
  }
}
