/**
 * A popup opened where there is no room under it.
 *
 * An overlay opens below its anchor until it cannot. Then it flips, and two published constants say
 * what "cannot" means: `MDY_OVERLAY_VIEWPORT_MARGIN` is the room it must leave at the edge of the
 * window, and `popupPlacementClass` is the modifier it wears once it has flipped — the hook the
 * shipped stylesheets key on to move the shadow and the pointer to the other side.
 *
 * Neither was named by anything in this suite, and the failure is one nobody reports as a bug: a
 * calendar that opens below a field near the bottom of the window is simply half off the screen, and
 * the user scrolls. On a short window, or a field in a footer, the half that is missing is the half
 * with the days in it.
 *
 * The control is the same field near the top, where there *is* room: it must open below and wear no
 * modifier, so the flip below is the lack of room rather than an overlay that always goes up.
 *
 * Claims under attack: UI-001.
 */

import { expect, test } from "@playwright/test";
import { MDY_OVERLAY_VIEWPORT_MARGIN, MDY_POPUP_CLASS } from "@modyra/widgets";

// **Every renderer, from the shared list.** The local list this replaced was not a scope
// decision: the angular host published six of the twenty-two doors these specs need, so a
// spec wanting one it lacked left the renderer out and the next reader copied the list.
import { HOSTS } from "./bench";

/** A window short enough that a field pushed down it has no room underneath. */
const VIEWPORT = { width: 900, height: 600 };

for (const host of HOSTS) {
  test(`a popup with nowhere below to go opens above, ${host.name}`, async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize(VIEWPORT);
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    /** Mount a datepicker with `padding` above it, and open it however this renderer opens it. */
    const openAt = async (id: string, padding: number) => {
      await page.evaluate(({ api, mountId, pad }) => {
        (document.querySelector("#stage") as HTMLElement).style.paddingTop = `${pad}px`;
        (window as never as Record<string, { mountFields(i: string, f: unknown[]): unknown }>)[api]
          .mountFields(mountId, [{ name: "x", kind: "datepicker", label: "X" }]);
      }, { api: host.api, mountId: id, pad: padding });
      await page.waitForTimeout(320);

      for (const selector of [
        `[data-form="${id}"] [aria-haspopup]`,
        `[data-form="${id}"] button`,
        `[data-form="${id}"] input`,
      ]) {
        const candidate = page.locator(selector).first();
        if (await candidate.count() === 0) continue;
        await candidate.click({ force: true }).catch(() => undefined);
        await page.waitForTimeout(320);
        const open = await page.evaluate((sel) =>
          document.querySelector(`${sel} [aria-expanded="true"]`) !== null, `[data-form="${id}"]`);
        if (open) return true;
      }
      return false;
    };

    const measure = (id: string) => page.evaluate(({ popupClass, margin, sel }) => {
      const popup = Array.from(document.querySelectorAll(`.${popupClass}, [role="dialog"], [role="listbox"]`))
        .find((each) => each.getClientRects().length > 0);
      if (popup === undefined) return null;
      const box = popup.getBoundingClientRect();
      const anchor = document.querySelector(`${sel} input`)?.getBoundingClientRect() ?? null;
      return {
        flippedClass: (popup.getAttribute("class") ?? "").split(" ").some((each) => each.endsWith("--above")),
        withinTop: box.top >= margin - 1,
        withinBottom: box.bottom <= window.innerHeight - margin + 1,
        above: anchor !== null && box.bottom <= anchor.top + 1,
      };
    }, { popupClass: MDY_POPUP_CLASS, margin: MDY_OVERLAY_VIEWPORT_MARGIN, sel: `[data-form="${id}"]` });

    // The control: room underneath, so it opens underneath and says nothing about flipping.
    expect(await openAt("roomy", 0), "the field near the top did not open").toBe(true);
    const roomy = await measure("roomy");
    expect(roomy, "no popup was on screen for the field near the top").not.toBeNull();
    expect(roomy!.above, "a popup with room below it opened above anyway").toBe(false);
    expect(roomy!.flippedClass, "a popup that did not flip wears the flipped modifier").toBe(false);
    expect(roomy!.withinTop && roomy!.withinBottom, "a popup with room around it left the window").toBe(true);

    await page.evaluate(({ api }) =>
      (window as never as Record<string, { dispose(i: string): void }>)[api].dispose("roomy"), { api: host.api });
    await page.waitForTimeout(120);

    // And the same field with the window's floor just under it.
    expect(await openAt("cramped", VIEWPORT.height - 80), "the field near the bottom did not open").toBe(true);
    const cramped = await measure("cramped");
    expect(cramped, "no popup was on screen for the field near the bottom").not.toBeNull();

    expect(cramped!.above, "a popup with nowhere below to go opened below anyway").toBe(true);
    expect(cramped!.flippedClass, "a flipped popup does not wear the modifier the stylesheets key on").toBe(true);
    expect(
      cramped!.withinTop && cramped!.withinBottom,
      "a flipped popup left the window rather than keeping the margin the contract declares",
    ).toBe(true);
  });
}
