/**
 * Which ring a press lands on, asked of the page rather than of the function that decides it.
 *
 * `timepickerDialRing` is battled as arithmetic and it answers correctly: the edge is where the two
 * number boxes meet, and `a-ring-that-cannot-make-up-its-mind` holds it steady under a tremor. What
 * nothing asked is whether a renderer's press *arrives* at that function with the geometry it has.
 *
 * Pressing straight up at four radii on a 24-hour face, releasing without moving — the outer numbers
 * are centred at 100 and the inner at 60, so the edge is 80:
 *
 *     plain     r100→12  r85→12  r75→00  r60→00
 *     angular   r100→12  r85→12  r75→00  r60→00
 *     lit       r100→00  r85→00  r75→00  r60→00
 *
 * **Lit answers the inner ring everywhere**, including at 100 — the outer numbers' own centre. So on
 * that renderer a 24-hour face has twelve hours a pointer cannot reach at all: tapping the 3 gives 15,
 * tapping the 12 gives midnight. The contract is right, the arithmetic is right, and the answer never
 * gets there.
 *
 * This is the shape three findings in this batch already had — a contract that decides and a renderer
 * that decides again — and it is invisible to every tier but this one. A unit test hands the radius in;
 * only a real press measures whether the renderer knew what the radius was.
 *
 * Asserted at four radii rather than at the edge: a renderer that is wrong *everywhere* and one that is
 * wrong *near the boundary* are different defects, and the pair of readings at 100 and 60 tells them
 * apart. The two inner readings are the control — a renderer that answered "outer" everywhere would
 * pass an outer-only check.
 *
 * Claims under attack: UI-011, A11Y-001.
 */

import { expect, test } from "@playwright/test";

const HOSTS = [
  { name: "plain", page: "/index.html", ready: "battleReady", api: "battle" },
  { name: "lit", page: "/lit.html", ready: "battleLitReady", api: "battleLit" },
  { name: "angular", page: "/angular.html", ready: "battleAngularReady", api: "battleAngular" },
];

/** Straight up at `reach` px from the centre: the outer face reads 12 there, the inner reads 00. */
async function hourAfterPressingAt(
  page: import("@playwright/test").Page,
  host: (typeof HOSTS)[number],
  id: string,
  reach: number,
) {
  await page.evaluate(async ({ api, id }) => {
    await (window as never as Record<string, { mountFields(i: string, f: unknown[]): unknown }>)[api]
      .mountFields(id, [{ name: "t", kind: "timepicker", label: "T", format: "24h", initialValue: "09:30" }]);
  }, { api: host.api, id });
  await page.waitForTimeout(250);
  await page.locator(`[data-form="${id}"] .mdy-timepicker__toggle`).first().click({ force: true });
  await page.waitForTimeout(300);

  const centre = await page.evaluate(() => {
    const face = document.querySelector(".mdy-timepicker-dial__face");
    if (!face) return null;
    const box = face.getBoundingClientRect();
    return { cx: box.left + box.width / 2, cy: box.top + box.height / 2, radius: box.width / 2 };
  });
  if (centre === null) return { hour: null, radius: null };

  await page.mouse.move(centre.cx, centre.cy - reach);
  await page.mouse.down();
  await page.mouse.up();
  await page.waitForTimeout(300);

  const hour = await page.evaluate(
    () => (document.querySelectorAll(".mdy-timepicker-segment-input")[0] as HTMLInputElement | undefined)?.value ?? null,
  );
  await page.evaluate(({ api, id }) => (window as never as Record<string, { dispose(i: string): void }>)[api].dispose(id), { api: host.api, id });
  await page.waitForTimeout(100);
  return { hour, radius: centre.radius };
}

for (const host of HOSTS) {
  test(`both rings of a 24-hour face can be reached with a pointer, ${host.name}`, async ({ page }) => {
    test.setTimeout(150_000);
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    const readings: Record<number, string | null> = {};
    for (const reach of [100, 85, 75, 60]) {
      const { hour, radius } = await hourAfterPressingAt(page, host, `ring-${reach}`, reach);
      readings[reach] = hour;
      // The premise: the face is the size this spec's radii were chosen for. A differently sized face
      // would make every number below meaningless rather than wrong.
      expect(radius, "no dial face was rendered, so no press could land on one").not.toBeNull();
      expect(radius, `the face is ${radius}px across, not the 256 these radii assume`).toBe(128);
    }

    const trail = Object.entries(readings).map(([r, h]) => `r${r}→${h}`).join("  ");

    expect(
      readings[100],
      `pressing at the outer numbers' own centre gave hour ${readings[100]} rather than 12 — the outer ` +
        `ring cannot be reached with a pointer at all, so twelve of the face's hours are unreachable. ${trail}`,
    ).toBe("12");

    expect(
      readings[85],
      `pressing outside the edge gave hour ${readings[85]} rather than 12. ${trail}`,
    ).toBe("12");

    // The control: a renderer that answered "outer" at every radius would pass the two above and be
    // just as broken, one ring over.
    expect(
      readings[60],
      `pressing at the inner numbers' own centre gave hour ${readings[60]} rather than 00. ${trail}`,
    ).toBe("00");

    expect(
      readings[75],
      `pressing inside the edge gave hour ${readings[75]} rather than 00. ${trail}`,
    ).toBe("00");
  });
}
