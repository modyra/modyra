/**
 * The hand's length is read from the hand, and the hand is shorter on the inner ring.
 *
 * Every angle-at-a-radius on the dial is computed against `handLength`: which ring a pointer claims,
 * how far off a number still counts as being on it, where the dimmed stretches fall. All three
 * renderers obtain it the same way, introduced together when the unresolved `calc()` was fixed:
 *
 *     Number.parseFloat(getComputedStyle(hand).height)
 *
 * The real hand carries `--inner` when it points into the inner ring, and the stylesheet draws that
 * one at `handLength × MDY_TIMEPICKER_INNER_RING`. So the measurement is taken from an element whose
 * size is a function of the answer the measurement is used to produce:
 *
 *     hand on inner (14)  → drawn 60  → thresholds derived from 60 → r=60 reads outer → value 2
 *     hand on outer (2)   → drawn 100 → thresholds 70/90           → r=60 reads inner → value 14
 *
 * The two states are each other's cause, so the value alternates on every pointer event — not a
 * tremor, a feedback loop. Reported by the user resting on the 14: *"se mi muovo appena scatta sul 2
 * anche se sono sul 14"*, which is the same angular position one ring out.
 *
 * The ring hysteresis of 338 cannot damp it. Hysteresis compares a distance against thresholds, and
 * here the thresholds are what is moving.
 *
 * Asserted where a person stands: the pointer is put on the **centre** of an inner number — as
 * unambiguous a position as the face has, 20px inside the nearest boundary — pressed, and moved by a
 * pixel or two. The hour the header shows must not change. Reading the header rather than an internal
 * is deliberate: 338's battle asserted the ring and went green while the displayed hour still flipped.
 *
 * Claims under attack: UI-011, A11Y-001.
 */

import { expect, test } from "@playwright/test";

const HOSTS = [
  { name: "angular", page: "/angular.html", ready: "battleAngularReady", api: "battleAngular" },
];

for (const host of HOSTS) {
  test(`the hour does not change while the pointer rests on a number, ${host.name}`, async ({ page }) => {
    test.setTimeout(150_000);
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    // 14:30 puts the hand on the inner ring, which is where the shortened hand is drawn.
    await page.evaluate(async ({ api }) => {
      await (window as never as Record<string, { mountFields(i: string, f: unknown[]): unknown }>)[api]
        .mountFields("d", [{ name: "t", kind: "timepicker", label: "T", format: "24h", initialValue: "14:30" }]);
    }, { api: host.api });
    await page.waitForTimeout(400);

    await page.locator(".mdy-timepicker__toggle").first().click({ force: true });
    await page.waitForTimeout(400);
    await page.evaluate(() => {
      if (!document.querySelector(".mdy-timepicker-dial__face")) {
        (document.querySelector(".mdy-timepicker-mode-toggle") as HTMLElement | null)?.click();
      }
    });
    await page.waitForTimeout(300);

    const spot = await page.evaluate(() => {
      const face = document.querySelector(".mdy-timepicker-dial__face");
      if (!face) return null;
      const number = Array.from(face.querySelectorAll(".mdy-timepicker-dial__number"))
        .find((element) => element.textContent?.trim() === "14");
      if (!number) return null;
      const box = number.getBoundingClientRect();
      const rect = face.getBoundingClientRect();
      return {
        x: box.left + box.width / 2,
        y: box.top + box.height / 2,
        reach: Math.hypot(box.left + box.width / 2 - (rect.left + rect.width / 2),
                          box.top + box.height / 2 - (rect.top + rect.height / 2)),
      };
    });

    // The premise: the face is laid out and the 14 is really on the inner ring. Without it a pointer
    // "on the 14" is a pointer at the middle of an unpositioned face, and every assertion is vacuous.
    expect(spot, "the dial drew no 14, so there is nothing to rest on").not.toBeNull();
    expect(
      spot!.reach,
      `the 14 is ${Math.round(spot!.reach)}px from the centre, which is not an inner ring`,
    ).toBeGreaterThan(20);

    const shownHour = () =>
      page.evaluate(
        () => (document.querySelector(".mdy-timepicker-segment--hour input") as HTMLInputElement | null)?.value ?? "?",
      );

    const seen: string[] = [];
    await page.mouse.move(spot!.x, spot!.y);
    await page.mouse.down();
    for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [-1, 0], [1, 1], [0, -1], [2, 0], [0, 0]]) {
      await page.mouse.move(spot!.x + dx, spot!.y + dy);
      await page.waitForTimeout(60);
      seen.push(await shownHour());
    }
    await page.mouse.up();

    const changes = seen.filter((value, index) => index > 0 && value !== seen[index - 1]).length;
    expect(
      changes,
      `the hour changed ${changes} time(s) while the pointer sat on the centre of the 14 and moved by ` +
        `at most two pixels — ${seen.join(" ")}. The length every threshold is derived from is read ` +
        `from the hand, and the hand is drawn shorter on the inner ring, so the measurement and the ` +
        `answer are each other's cause`,
    ).toBe(0);
  });
}
