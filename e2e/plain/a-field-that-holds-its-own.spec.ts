import { expect, test } from "@playwright/test";

/**
 * What a field contains, and what sits on its centre line.
 *
 * Two properties of a themed page, both of which a person reads before they read anything else: the
 * field's border describes where the field ends, and the things standing in a row inside it share a
 * line.
 *
 * **Neither can be measured on a stage with no theme**, which is why they arrived here late and
 * through somebody looking at a screen. A bare page gives every box the size its content asks for, so
 * nothing is ever squeezed past an edge and nothing is ever pushed off a centre line — the theme is
 * where a width and a height come from, and therefore where both of these can go wrong.
 *
 * **Containment.** A part painted past its field's border is not a cosmetic overshoot: it is over the
 * top of whatever the form draws next, it captures the presses aimed there, and the border stops
 * telling a sighted person where one control ends and the next begins. Measured against what is
 * *painted*, so a part clipped by a scrolling row is contained and a part hanging over the edge is
 * not.
 *
 * **The centre line.** Controls of different heights in one row can only share a centre by
 * arithmetic, and until their heights come from one scale that arithmetic is a coincidence. A chip
 * eight pixels above the middle of its own field is what a person means when they say a control looks
 * unfinished, and it is the reading that says whether the cause is the heights or the padding: an
 * off-centre part whose own content is centred inside it has been placed wrongly, and one whose
 * content is off-centre too has asymmetric padding.
 *
 * A pixel of tolerance each way, because a half-pixel from an odd height is not a defect and rounding
 * one is not a finding.
 */

/** A part may sit this far from its field's centre, and no further. */
const TOLERANCE = 1;

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("nothing a field draws is painted outside it", async ({ page }) => {
  const escaping = await page.evaluate(() => {
    const found: string[] = [];
    for (const renderer of document.querySelectorAll(".mdy-renderer")) {
      const kind = [...renderer.classList].find((one) => one.startsWith("mdy-renderer--"))
        ?.replace("mdy-renderer--", "") ?? "?";
      const field = renderer.querySelector(".mdy-input-wrapper");
      if (!(field instanceof HTMLElement)) continue;
      const box = field.getBoundingClientRect();
      if (box.width === 0) continue;

      for (const part of field.querySelectorAll("*")) {
        const own = part.getBoundingClientRect();
        // Something not drawn cannot be drawn outside anything.
        if (own.width === 0 || own.height === 0) continue;
        const past = Math.max(
          Math.round(own.bottom - box.bottom),
          Math.round(box.top - own.top),
          Math.round(own.right - box.right),
        );
        if (past <= 1) continue;
        const name = (part.className || "").toString().split(/\s+/).find((one) => one.startsWith("mdy-"))
          ?? part.tagName.toLowerCase();
        found.push(`${kind}: ${name} by ${past}px`);
      }
    }
    return [...new Set(found)];
  });

  const fields = await page.locator(".mdy-input-wrapper").count();
  expect(fields, "the themed page drew no field, so this measured nothing").toBeGreaterThan(3);

  expect(
    escaping,
    `${escaping.length} part(s) are painted past their own field's border: ${escaping.join(", ")}. `
    + "Each sits over whatever the form draws next and takes the presses aimed there.",
  ).toEqual([]);
});

test("the things in a field's row share its centre line", async ({ page }) => {
  const off = await page.evaluate((tolerance) => {
    const found: string[] = [];
    for (const renderer of document.querySelectorAll(".mdy-renderer")) {
      const kind = [...renderer.classList].find((one) => one.startsWith("mdy-renderer--"))
        ?.replace("mdy-renderer--", "") ?? "?";
      const field = renderer.querySelector(".mdy-input-wrapper");
      if (!(field instanceof HTMLElement)) continue;
      const box = field.getBoundingClientRect();
      if (box.height === 0) continue;
      const centre = box.y + box.height / 2;

      const inRow = Array.from(field.querySelectorAll(
        '[class*="__trigger"], [class*="chip"], [class*="__toggle"], [class*="clear"], [class*="__arrow"]',
      )).filter((part) => {
        const own = part.getBoundingClientRect();
        // A part taller than its field is a containment question, not a centring one.
        return own.width > 0 && own.height > 0 && own.height <= box.height;
      });

      for (const part of inRow) {
        const own = part.getBoundingClientRect();
        const away = Math.round(own.y + own.height / 2 - centre);
        if (Math.abs(away) <= tolerance) continue;
        const name = (part.className || "").toString().split(/\s+/).find((one) => one.startsWith("mdy-"))
          ?? part.tagName.toLowerCase();
        found.push(`${kind}: ${name} sits ${Math.abs(away)}px ${away < 0 ? "above" : "below"} the middle`);
      }
    }
    return [...new Set(found)];
  }, TOLERANCE);

  const parts = await page.locator('.mdy-input-wrapper [class*="__trigger"], .mdy-input-wrapper [class*="chip"]').count();
  expect(parts, "the themed page drew nothing that stands in a row").toBeGreaterThan(0);

  expect(
    off,
    `${off.length} part(s) do not share their field's centre line: ${off.join(", ")}. Controls of `
    + "different heights in one row can only share a centre by arithmetic, and until the heights come "
    + "from one scale that arithmetic is a coincidence.",
  ).toEqual([]);
});
