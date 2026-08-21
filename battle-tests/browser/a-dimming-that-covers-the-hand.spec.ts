/**
 * The dimmed stretches are the surface the face sits on, and in two renderers they sit on top of it.
 *
 * `MDY_WIDGET_CONTRACTS.timepicker` declares `dialUnavailable` — a layer — and `dialUnavailableArc`
 * for the slices inside it. The stylesheet says plainly what the layer is for:
 *
 *     .mdy-timepicker-dial__unavailable-layer
 *     /* The layer the dimmed stretches sit in. Behind the numbers, which is what `z-index: 0` on
 *        the slices does not achieve on its own once the hand is positioned. *​/
 *
 * Neither `__hand` nor `__number` carries a `z-index`, and the slices carry `z-index: 0`. Positioned
 * elements at the same level paint in **document order**, so being behind is a fact about where the
 * layer is appended and about nothing else. The comment says so; it is the one thing the CSS cannot
 * enforce for itself.
 *
 * Plain appends the layer before the hand. Lit renders the hand and then the layer. Angular has no
 * layer element at all and emits the slices directly, after the hand — so in both the dimming paints
 * over the hand that shows the chosen value.
 *
 * When it shows: whenever the hand points into a dimmed stretch, which is a value off the granularity
 * — a value set before the steps were narrowed, or set by a host that does not consult them. That is
 * exactly the moment a person needs to see the hand and be told the position is not offered, and it is
 * the moment two of three renderers hide it.
 *
 * Asserted as document order rather than as a screenshot, because paint order is the property and a
 * pixel comparison would also go red for a colour change. Angular is not here — the browser tier has
 * no Angular host (finding 325) — so its half is reported from source and stays unmeasured.
 *
 * Claims under attack: UI-009.
 */

import { expect, test } from "@playwright/test";

const HOSTS = [
  { name: "plain", page: "/index.html", ready: "battleReady", api: "battle" },
  { name: "lit", page: "/lit.html", ready: "battleLitReady", api: "battleLit" },
];

for (const host of HOSTS) {
  test(`the dimmed stretches are painted behind the hand, ${host.name}`, async ({ page }) => {
    test.setTimeout(150_000);
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    // A quarter-hour minute step, so eight of the twelve positions are removed and there is something
    // to dim at all. `showUnavailable` is off by default — the flag is the whole point of the feature.
    await page.evaluate(({ api }) => {
      (window as never as Record<string, { mountFields(i: string, f: unknown[]): unknown }>)[api]
        .mountFields("dim", [
          {
            name: "t",
            kind: "timepicker",
            label: "T",
            granularity: { minuteStep: 15 },
            showUnavailable: true,
          },
        ]);
    }, { api: host.api });
    await page.waitForTimeout(300);

    for (const selector of ['[data-form="dim"] [aria-haspopup]', '[data-form="dim"] button', '[data-form="dim"] input']) {
      const opener = page.locator(selector).first();
      if (await opener.count() === 0) continue;
      await opener.click({ force: true }).catch(() => undefined);
      await page.waitForTimeout(250);
      if (await page.locator('[data-form="dim"] [aria-expanded="true"]').count() > 0) break;
    }

    // The dial is the minute face's business, so switch to it if the picker opened on hours, then
    // focus the minute segment — a quarter-hour step removes nothing from an hour face, and the dial
    // draws whichever field is focused. Both clicked through the element rather than the page hit
    // test, which lands on whatever is painted on top: the very thing under examination here.
    await page.evaluate(() => {
      (document.querySelector(".mdy-timepicker-mode-toggle") as HTMLElement | null)?.click();
    });
    await page.waitForTimeout(200);
    await page.evaluate(() => {
      const minute = document.querySelector(
        ".mdy-timepicker-segment--minute .mdy-timepicker-segment-input, .mdy-timepicker-segment--minute",
      ) as HTMLElement | null;
      minute?.focus();
      minute?.click();
    });
    await page.waitForTimeout(250);

    const order = await page.evaluate(() => {
      const face = document.querySelector(".mdy-timepicker-dial__face");
      if (!face) return { face: false };
      const arcs = Array.from(face.querySelectorAll(".mdy-timepicker-dial__unavailable"));
      const hand = Array.from(face.querySelectorAll(".mdy-timepicker-dial__hand")).find(
        (element) => !element.classList.contains("mdy-timepicker-dial__hand--ghost"),
      );
      if (!hand) return { face: true, hand: false, arcs: arcs.length };
      // DOCUMENT_POSITION_PRECEDING: the arc comes before the hand, so the hand paints over it.
      const behind = arcs.every(
        (arc) => (hand.compareDocumentPosition(arc) & Node.DOCUMENT_POSITION_PRECEDING) !== 0,
      );
      return {
        face: true,
        hand: true,
        arcs: arcs.length,
        layer: face.querySelectorAll(".mdy-timepicker-dial__unavailable-layer").length,
        behind,
      };
    });

    // The premise: the face opened and the flag produced slices. Without them "the order is right"
    // would be a statement about an empty face — the shape that made a stale host read as a pass.
    expect(order.face, "no dial face was rendered, so nothing could be ordered").toBe(true);
    expect(order.hand, "the dial drew no hand, so there is nothing for the dimming to cover").toBe(true);
    expect(
      order.arcs,
      "the granularity removed eight of twelve positions and the face dimmed none of them",
    ).toBeGreaterThan(0);

    expect(
      order.behind,
      `the dimmed stretches paint over the hand instead of behind it — ${order.arcs} slice(s), ` +
        `${order.layer} layer element(s); the stylesheet's own note says document order is what puts ` +
        `them behind, since neither the hand nor the numbers carry a z-index`,
    ).toBe(true);
  });
}
