/**
 * A press inside a popup the widget sent somewhere else.
 *
 * `select` and `multiselect` in `@modyra/plain` do this:
 *
 *     document.body.appendChild(popup)     select-field.ts:147, multiselect-field.ts:182
 *
 * So the popup is no longer inside the field, and a light-dismiss rule that answers "is this inside?"
 * by containment alone says **no** to a press on the widget's own list — and closes it under the
 * person's finger, on the way to the option they were reaching for.
 *
 * The rule that prevents it used to be supplied by each renderer, on the stated grounds that *"only
 * it knows where its portal went"*. That was false: a widget that portals a popup **declares** the
 * relationship, through the opener's `aria-controls`, and the branch is derivable from the root. Four
 * renderers were answering a question the contract could already answer once, and three answered it
 * by containment.
 *
 * What is asserted is the property rather than the mechanism: **press inside the open popup, and it
 * is still open.** True whether the popup is portalled or not, so a renderer that stops portalling
 * does not have to edit this, and one that starts is caught by it.
 *
 * The press lands on the popup's own surface and not on an option — choosing an option closes the
 * overlay for its own reasons and would report "closed" whether the rule worked or not. That
 * discriminator is the whole spec; without it this passes on a broken rule.
 *
 * **Sensitivity is unproven in this tier.** Neutralising `portalRootFor` in the built host bundle did
 * not turn this red, and the reason was not established — most likely the bundler inlines it, so the
 * patched definition is not the one the call site uses. `esecutore` reproduced the defect at source
 * level with the same discriminator (portal lookup off, renderer's list truncated to the wrapper →
 * the popup dismisses under its own press), so the defect is real and measured; what is not yet shown
 * is that **this** spec would catch its return. Read the green accordingly.
 *
 * Claims under attack: UI-005.
 */

import { expect, test } from "@playwright/test";
import { MDY_WIDGET_CONTRACTS } from "@modyra/widgets";

const HOSTS = [
  { name: "plain", page: "/index.html", ready: "battleReady", api: "battle" },
  { name: "lit", page: "/lit.html", ready: "battleLitReady", api: "battleLit" },
];

/** Every kind the catalogue gives a popup to, so a kind added later is asked without editing this. */
const KINDS = Object.keys(MDY_WIDGET_CONTRACTS).filter((kind) => {
  const parts = MDY_WIDGET_CONTRACTS[kind as keyof typeof MDY_WIDGET_CONTRACTS].parts as Record<string, unknown>;
  return Boolean(parts.popup ?? parts.listbox);
});

const OPTIONS = [{ value: "a", label: "A" }, { value: "b", label: "B" }];

for (const host of HOSTS) {
  test(`a press inside an open popup does not dismiss it, ${host.name}`, async ({ page }) => {
    test.setTimeout(180_000);
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    expect(KINDS.length, "the catalogue declares no popup on any kind").toBeGreaterThan(3);

    const closed: string[] = [];
    const unopened: string[] = [];

    for (const kind of KINDS) {
      const id = `pop-${kind}`;
      await page.evaluate(({ api, k, mountId, options }) => {
        const field: Record<string, unknown> = { name: "f", kind: k, label: "L" };
        if (/select/.test(k)) field.options = options;
        (window as never as Record<string, { mountFields(i: string, f: unknown[]): unknown }>)[api]
          .mountFields(mountId, [field]);
      }, { api: host.api, k: kind, mountId: id, options: OPTIONS });
      await page.waitForTimeout(200);

      for (const selector of [`[data-form="${id}"] [aria-haspopup]`, `[data-form="${id}"] button`, `[data-form="${id}"] input`]) {
        const opener = page.locator(selector).first();
        if (await opener.count() === 0) continue;
        await opener.click({ force: true }).catch(() => undefined);
        await page.waitForTimeout(200);
        if (await page.locator(`[data-form="${id}"] [aria-expanded="true"]`).count() > 0) break;
      }

      // A kind that did not open is not evidence either way, and counting it as a pass is how a
      // sweep reports health it never measured.
      if (await page.locator(`[data-form="${id}"] [aria-expanded="true"]`).count() === 0) {
        unopened.push(kind);
        continue;
      }

      // The popup may be anywhere — that is the point — so it is found by what the opener names
      // rather than by looking inside the field.
      const pressedInside = await page.evaluate(({ mountId }) => {
        const opener = document.querySelector(`[data-form="${mountId}"] [aria-controls]`);
        const popup = opener && document.getElementById(opener.getAttribute("aria-controls") ?? "");
        if (!popup) return false;
        const box = popup.getBoundingClientRect();
        if (box.width === 0 || box.height === 0) return false;
        // The popup's own surface, near its edge, away from any option.
        const target = document.elementFromPoint(box.left + 2, box.top + 2) ?? popup;
        target.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, composed: true }));
        target.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, composed: true }));
        target.dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true }));
        return true;
      }, { mountId: id });

      if (!pressedInside) { unopened.push(`${kind} (popup not locatable)`); continue; }
      await page.waitForTimeout(250);

      if (await page.locator(`[data-form="${id}"] [aria-expanded="true"]`).count() === 0) closed.push(kind);
    }

    // The control: enough kinds actually opened for the sweep to mean something.
    expect(
      KINDS.length - unopened.length,
      `only ${KINDS.length - unopened.length} of ${KINDS.length} popups opened, so this measured almost nothing (${unopened.join(", ")})`,
    ).toBeGreaterThan(1);

    expect(
      closed,
      "a press inside the widget's own open popup dismissed it — the rule that decides 'inside' does "
        + "not reach a popup the widget moved out of its subtree",
    ).toEqual([]);
  });
}
