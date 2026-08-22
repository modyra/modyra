/**
 * The dimmed stretches: whether they appear at all, and whether they sit behind the face or on it.
 *
 * `MDY_WIDGET_CONTRACTS.timepicker` declares `dialUnavailable` — a layer — and `dialUnavailableArc`
 * for the slices inside it. Two separate properties are asserted here, because one renderer fails
 * both and a single test would report them as one thing.
 *
 * **That they appear.** `timepickerDialUnavailableArcs` returns `[]` for a hand length of zero, which
 * is right: with no geometry there are no angles to describe. A renderer that measures the face while
 * deciding what to put in it asks before the answer exists, and the empty result is indistinguishable
 * from "this face has nothing to dim".
 *
 * **That they are behind.** The stylesheet says what the layer is for:
 *
 *     .mdy-timepicker-dial__unavailable-layer
 *     /* The layer the dimmed stretches sit in. Behind the numbers, which is what `z-index: 0` on
 *        the slices does not achieve on its own once the hand is positioned. *​/
 *
 * Neither `__hand` nor `__number` carries a `z-index` and the slices carry `z-index: 0`, so positioned
 * siblings paint in **document order**. Being behind is a fact about where the layer is appended and
 * about nothing else — the one thing the CSS cannot enforce for itself. It shows whenever the hand
 * points into a dimmed stretch, which is a value off the granularity: set before the steps narrowed,
 * or set by a host that does not consult them. That is exactly when a person needs to see both.
 *
 * Asserted as document order rather than as a screenshot, because paint order is the property and a
 * pixel diff would also go red for a colour change.
 *
 * Angular has a browser host now (finding 325), but it is not driven here yet: its picker opens on the
 * dial where the other two open on the segments, so the shared opening sequence puts it in the view
 * this spec is not about. Adding it needs that sequence to ask what state it is in rather than assume
 * one, which is a change to how every spec opens a picker and not a line in this file.
 *
 * Claims under attack: UI-009.
 */

import { expect, test } from "@playwright/test";

const HOSTS = [
  { name: "plain", page: "/index.html", ready: "battleReady", api: "battle" },
  { name: "lit", page: "/lit.html", ready: "battleLitReady", api: "battleLit" },
];

/**
 * Opens a picker whose granularity removes most of a 24-hour face — on **both** rings, the case where
 * one set of arcs drawn for one ring would be wrong on the other — and switches to the dial.
 */
async function openDimmedDial(page: import("@playwright/test").Page, host: (typeof HOSTS)[number]) {
  await page.goto(host.page);
  await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

  // `showUnavailable` is off by default; the flag is the whole point of the feature.
  // Awaited, because the Angular host renders through a scheduled zoneless pass and returns a promise
  // where the other two return a value. `await` on a non-promise is a no-op, so one call fits all three.
  await page.evaluate(async ({ api }) => {
    await (window as never as Record<string, { mountFields(i: string, f: unknown[]): unknown }>)[api]
      .mountFields("dim", [
        // Six, not five. A step must divide the face it is applied to — the parser refuses
        // `hourStep: 5` outright, saying it "does not divide 24", and hands back a field with no
        // granularity at all. This spec asked for one the contract does not accept and then reported
        // the renderer that obeyed the contract as the broken one.
        { name: "t", kind: "timepicker", label: "T", granularity: { hourStep: 6 }, showUnavailable: true },
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

  // Into the dial, clicked through the element rather than the page hit test — that lands on whatever
  // is painted on top, which is the very thing under examination here.
  await page.evaluate(() => {
    if (document.querySelector(".mdy-timepicker-dial__face")) return;
    // The picker opens on the dial now, so a toggle sent unconditionally leaves the view
    // this spec is about — the default changed under the spec, not the renderer.
    (document.querySelector(".mdy-timepicker-mode-toggle") as HTMLElement | null)?.click();
  });
  await page.waitForTimeout(300);
}

/** What the face is made of, in the order a browser will paint it. */
async function readFace(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const face = document.querySelector(".mdy-timepicker-dial__face");
    if (!face) return { face: false, numbers: 0, arcs: 0, layers: 0, hand: false, behind: null as boolean | null };
    const arcs = Array.from(face.querySelectorAll(".mdy-timepicker-dial__unavailable"));
    const hand = Array.from(face.querySelectorAll(".mdy-timepicker-dial__hand")).find(
      (element) => !element.classList.contains("mdy-timepicker-dial__hand--ghost"),
    );
    return {
      face: true,
      numbers: face.querySelectorAll(".mdy-timepicker-dial__number").length,
      arcs: arcs.length,
      layers: face.querySelectorAll(".mdy-timepicker-dial__unavailable-layer").length,
      hand: hand !== undefined,
      // DOCUMENT_POSITION_PRECEDING: the arc comes before the hand, so the hand paints over it.
      behind:
        hand === undefined
          ? null
          : arcs.every((arc) => (hand.compareDocumentPosition(arc) & Node.DOCUMENT_POSITION_PRECEDING) !== 0),
    };
  });
}

for (const host of HOSTS) {
  test(`a face asked to dim its dead stretches has dimmed them, ${host.name}`, async ({ page }) => {
    test.setTimeout(150_000);
    await openDimmedDial(page, host);
    const face = await readFace(page);

    // The premise: the dial opened, and the granularity really did take positions away. A face drawing
    // every hour has nothing to dim and would pass this by having nothing to fail.
    expect(face.face, "no dial face was rendered, so nothing could be dimmed").toBe(true);
    expect(
      face.numbers,
      "the dial drew no numbers, so the granularity under test never reached the face",
    ).toBeGreaterThan(0);
    expect(
      face.numbers,
      `a six-hour step leaves four of twenty-four hours, and the face drew ${face.numbers}`,
    ).toBeLessThan(24);

    expect(
      face.arcs,
      `the face drew ${face.numbers} of 24 hours and dimmed none of the ${24 - face.numbers} positions ` +
        `the granularity removed (${face.layers} layer element(s) present). A renderer that measures ` +
        `the face to decide what to put in it asks before the face exists: the hand length is zero, ` +
        `the contract correctly returns no arcs, and nothing schedules the second pass that would ` +
        `find them`,
    ).toBeGreaterThan(0);
  });

  test(`the dimmed stretches are painted behind the hand, ${host.name}`, async ({ page }) => {
    test.setTimeout(150_000);
    await openDimmedDial(page, host);
    const face = await readFace(page);

    expect(face.face, "no dial face was rendered, so nothing could be ordered").toBe(true);
    expect(face.hand, "the dial drew no hand, so there is nothing for the dimming to cover").toBe(true);
    expect(
      face.arcs,
      "the face dimmed nothing, so paint order cannot be read here — that is the sibling test in this " +
        "file, and this one says nothing until it passes",
    ).toBeGreaterThan(0);

    expect(
      face.behind,
      `the dimmed stretches paint over the hand instead of behind it — ${face.arcs} slice(s), ` +
        `${face.layers} layer element(s). The stylesheet's own note says document order is what puts ` +
        `them behind, since neither the hand nor the numbers carry a z-index`,
    ).toBe(true);
  });
}
