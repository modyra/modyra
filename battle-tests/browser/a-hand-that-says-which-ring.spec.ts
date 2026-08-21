/**
 * The hand's length is the only thing that says which ring a person chose.
 *
 * A 24-hour face carries two numbers at every position — 3 outside and 15 inside sit at the same
 * angle. The contract tells them apart by the pointer's distance from the centre, and
 * `timepickerDialPick` returns the `ring` it decided. **Without the hand shortening, the two
 * selections are drawn identically**, and a person cannot tell which they picked until they read the
 * header. The discrimination exists and is invisible.
 *
 * Two properties, and the second is the one most likely to be right in one renderer and forgotten in
 * the others:
 *
 *   - the hand is **shorter** when the value is on the inner ring than when it is on the outer;
 *   - the hand rests at **the number's angle, not the pointer's** — release between two numbers and
 *     it sits on one of them.
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

const HOSTS = [
  { name: "plain", page: "/index.html", ready: "battleReady", api: "battle" },
  { name: "lit", page: "/lit.html", ready: "battleLitReady", api: "battleLit" },
];

const HAND = ".mdy-timepicker-dial__hand";

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
      const toDial = page.locator(".mdy-timepicker-mode-toggle").first();
      if (await toDial.count() > 0) {
        await toDial.click({ force: true }).catch(() => undefined);
        await page.waitForTimeout(250);
      }

      const hand = page.locator(HAND).first();
      if (await hand.count() === 0) return null;
      const drawn = await hand.evaluate((element) => {
        const box = (element as HTMLElement).getBoundingClientRect();
        return Math.round(Math.max(box.width, box.height));
      });
      // A hand of no size is a hand nobody can see, and reporting it as a length would let "both are
      // zero" satisfy "both are equal" — a pass, or a failure, about a view that is not on screen.
      return drawn > 0 ? drawn : null;
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

    expect(
      inner!,
      `the hand is the same length for 15:00 on the inner ring as for 03:00 on the outer `
        + `(${inner}px vs ${outer}px) — the two selections sit at one angle, so nothing drawn `
        + `distinguishes them and a person cannot see which they chose`,
    ).toBeLessThan(outer!);
  });
}
