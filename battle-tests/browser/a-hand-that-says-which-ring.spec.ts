/**
 * The hand's length is the only thing that says which ring a person chose.
 *
 * A 24-hour face carries two numbers at every position — 3 outside and 15 inside sit at the same
 * angle. The contract tells them apart by the pointer's distance from the centre, and
 * `timepickerDialPick` returns the `ring` it decided. **Without the hand shortening, the two
 * selections are drawn identically**, and a person cannot tell which they picked until they read the
 * header. The discrimination exists and is invisible.
 *
 * The property is not "shorter for the inner ring", which any two different lengths satisfy. It is
 * the one a person actually sees: **the knob at the end of the hand sits on the circumference of the
 * numbers being considered.** So the hand's length is compared against the distance from the dial's
 * centre to the *selected number itself* — the same circle the face drew — and the two must agree on
 * whichever ring is in play.
 *
 * Stated that way it needs no second mount to compare against, and it fails for a hand given a length
 * of its own rather than the ring's fraction: a wrong number puts the knob off the circle, on either
 * ring, and `inner < outer` would not have noticed.
 *
 * The length is read from the rendered geometry rather than from a class, because the defect this
 * guards against is a third copy of the inner-ring ratio. `MDY_TIMEPICKER_INNER_RING` and the
 * stylesheet's own figure are already checked against each other by
 * `packages/widgets/test/css-properties.spec.mjs`; what that cannot see is whether the **hand** was
 * given a fourth number of its own. Measuring the drawn length is what catches that.
 *
 * Claims under attack: UI-011, UI-009.
 */

import { expect, test } from "@playwright/test";

// **Every renderer, from the shared list.** The local list this replaced was not a scope
// decision: the angular host published six of the twenty-two doors these specs need, so a
// spec wanting one it lacked left the renderer out and the next reader copied the list.
import { HOSTS } from "./bench";

for (const host of HOSTS) {
  test(`the hand is shorter on the inner ring, ${host.name}`, async ({ page }) => {
    test.setTimeout(150_000);
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    /** Open a timepicker holding `value` and report the hand's drawn length. */
    const handFor = async (value: string) => {
      await page.evaluate(({ api, v }) => {
        const stage = document.querySelector("#stage");
        stage?.querySelectorAll('[data-form^="hand-"]').forEach((node) => node.remove());
        (window as never as Record<string, { mountFields(i: string, f: unknown[]): unknown }>)[api]
          .mountFields(`hand-${v.replace(":", "")}`, [{ name: "t", kind: "timepicker", label: "T", initialValue: v }]);
      }, { api: host.api, v: value });
      await page.waitForTimeout(250);

      const scope = `[data-form="hand-${value.replace(":", "")}"]`;
      for (const selector of [`${scope} [aria-haspopup]`, `${scope} button`, `${scope} input`]) {
        const opener = page.locator(selector).first();
        if (await opener.count() === 0) continue;
        await opener.click({ force: true }).catch(() => undefined);
        await page.waitForTimeout(250);
        if (await page.locator(`${scope} [aria-expanded="true"]`).count() > 0) break;
      }

      // The picker opens on its number fields — `viewMode` defaults to `"input"` — so the dial is not
      // drawn until someone asks for it. A spec that read the hand without this measured a view that
      // was never on screen, which is what the premise guard below caught the first time.
      // Clicked through the element rather than through the page's hit test. `force: true` sends the
      // press to whatever is under the point, and a renderer whose popup is in the top layer puts
      // something else there — so the toggle was never pressed and the dial never appeared, on one
      // host and not the other.
      await page.evaluate(() => {
        if (document.querySelector(".mdy-timepicker-dial__face")) return;
        // The picker opens on the dial now, so a toggle sent unconditionally leaves the view
        // this spec is about — the default changed under the spec, not the renderer.
        (document.querySelector(".mdy-timepicker-mode-toggle") as HTMLElement | null)?.click();
      });
      await page.waitForTimeout(250);

      return page.evaluate(() => {
        const face = document.querySelector(".mdy-timepicker-dial__face");
        const hand = document.querySelector(".mdy-timepicker-dial__hand");
        const picked = document.querySelector(".mdy-timepicker-dial__number--selected");
        if (!face || !hand || !picked) return null;

        const middle = (element: Element) => {
          const box = element.getBoundingClientRect();
          return { x: box.left + box.width / 2, y: box.top + box.height / 2, h: Math.max(box.width, box.height) };
        };
        const centre = middle(face);
        const number = middle(picked);
        const reach = Math.hypot(number.x - centre.x, number.y - centre.y);
        // A hand of no size is a hand nobody can see, and two zeros satisfy any comparison.
        return middle(hand).h > 0 && reach > 0
          ? { hand: Math.round(middle(hand).h), toNumber: Math.round(reach) }
          : null;
      });
    };

    // 15:00 is on the inner ring of a 24-hour face; 03:00 is at the same angle on the outer.
    const inner = await handFor("15:00");
    const outer = await handFor("03:00");

    // The premise: a hand was drawn at all, both times. A picker that never opened would make
    // "the lengths differ" unanswerable and "they match" vacuously true.
    expect(
      { inner: inner !== null, outer: outer !== null },
      "the picker drew no hand, so its length could not be read",
    ).toEqual({ inner: true, outer: true });

    // Two pixels of slack: the knob is centred on the hand's end and both boxes are rounded.
    const offCircle = ([where, seen]: [string, { hand: number; toNumber: number }]) =>
      Math.abs(seen.hand - seen.toNumber) > 2 ? `${where}: hand ${seen.hand}px, numbers at ${seen.toNumber}px` : null;

    expect(
      [["15:00 inner", inner!], ["03:00 outer", outer!]].map(offCircle).filter(Boolean),
      "the hand does not reach the circle the numbers are drawn on, so its knob sits off the ring the "
        + "person is choosing from",
    ).toEqual([]);

    // And the two rings really are different circles, or the comparison above is one measurement
    // made twice and says nothing about the shortening.
    expect(
      inner!.toNumber,
      `both rings report the same radius (${inner!.toNumber}px), so this face is not the two-ring one`,
    ).toBeLessThan(outer!.toNumber);
  });
}
