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
 * **The press is a real one, and that is not a detail.** A first version dispatched
 * `new PointerEvent("pointerdown", { bubbles: true, composed: true })`, and measured in the same
 * Chromium this tier launches:
 *
 *     {"isPrimary": false, "button": 0, "pointerId": 0}
 *
 * `isPrimary` defaults to **false** on a constructed `PointerEvent`, so `dismissal-dom.ts`'s
 * `e.isPrimary ?? true` never applies, the press is discarded as non-primary, and the state machine
 * never leaves `idle`. Those three events could not dismiss a popup under **any** rule — the spec
 * passed on a correct implementation, a broken one, and an absent one alike.
 *
 * So the press comes from `page.mouse`, which is trusted and carries the fields a person's finger
 * carries. And the spec no longer takes on faith that its own press works: **a press outside must
 * dismiss**, asserted first. Without that control, a press that does nothing is indistinguishable
 * from a rule that correctly kept the popup open.
 *
 * Claims under attack: UI-005.
 */

import { expect, test } from "@playwright/test";
import { MDY_WIDGET_CONTRACTS } from "@modyra/widgets";

// **Every renderer, from the shared list.** The local list this replaced was not a scope
// decision: the angular host published six of the twenty-two doors these specs need, so a
// spec wanting one it lacked left the renderer out and the next reader copied the list.
import { HOSTS } from "./bench";

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
    const survivedAnOutsidePress: string[] = [];

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
      // A point on the popup's own surface with **nothing interactive under it**. Pressing an option
      // closes the overlay for its own reasons, and a spec that pressed one would report "closed"
      // whatever the dismissal rule did — which is the discriminator this whole spec turns on. So the
      // point is chosen by asking what is under it, and a kind whose popup offers no such point is
      // skipped rather than asserted about.
      const box = await page.evaluate(({ mountId }) => {
        const opener = document.querySelector(`[data-form="${mountId}"] [aria-controls]`);
        const popup = opener && document.getElementById(opener.getAttribute("aria-controls") ?? "");
        if (!popup) return null;
        const rect = popup.getBoundingClientRect();
        if (rect.width <= 8 || rect.height <= 8) return null;
        const interactive = "button, [role=option], [role=gridcell], input, a, select, textarea, [tabindex]";
        for (const [dx, dy] of [[2, 2], [rect.width - 2, 2], [2, rect.height - 2], [rect.width - 2, rect.height - 2], [rect.width / 2, rect.height - 2]]) {
          const x = rect.left + dx;
          const y = rect.top + dy;
          const under = document.elementFromPoint(x, y);
          if (!under || !popup.contains(under)) continue;
          if (under.closest(interactive)) continue;
          return { x, y, under: under.className || under.tagName };
        }
        return null;
      }, { mountId: id });

      if (!box) { unopened.push(`${kind} (no inert point inside its popup)`); continue; }

      await page.mouse.click(box.x, box.y);
      await page.waitForTimeout(250);

      if (await page.locator(`[data-form="${id}"] [aria-expanded="true"]`).count() === 0) closed.push(kind);

      // **The control, and it runs here rather than after the sweep.** It used to press outside once
      // per kind at the end, by which time every kind's popup was open at once: seven overlays on one
      // page, and which of them receives a press in the corner depends on how they happen to be laid
      // out. A stylesheet that made fields shorter changed that layout and this reported "the popup
      // survived an outside press" about a press another overlay had taken — a page arrangement read
      // as a dismissal rule. Dismissing each before opening the next removes the arrangement from the
      // question, and the control asserts the same thing it always did.
      // What is under the press is reported with the failure, because "an outside press did not
      // dismiss" and "the press landed on something that ate it" are different findings and the
      // message has to say which. A backdrop is the canonical outside press — a person clicking the
      // dimmed area expects the panel to close — so landing on one is not an excuse.
      const under = await page.evaluate(() => {
        const at = document.elementFromPoint(2, 2);
        return `${at?.tagName.toLowerCase()}.${String(at?.className).split(/\s+/)[0] || "(no class)"}`;
      });
      await page.mouse.click(2, 2);
      await page.waitForTimeout(250);
      if (await page.locator(`[data-form="${id}"] [aria-expanded="true"]`).count() > 0) {
        survivedAnOutsidePress.push(`${kind} (the press landed on ${under})`);
      }
    }

    expect(
      survivedAnOutsidePress,
      "a press in the corner of the page did not dismiss an open popup, so the presses in this spec "
        + "are not reaching the dismissal rule and nothing above was measured",
    ).toEqual([]);

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
