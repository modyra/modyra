import { expect, test } from "@playwright/test";

import { THEMES } from "../support/visual";

/**
 * Three properties that are each reasonable and cannot all three hold.
 *
 * A strip of chosen values may **wrap**, so it can be taller than one line. The field it sits in has a
 * **fixed height**, so it cannot grow to hold a second line. And the field's overflow is **visible**,
 * so nothing clips what does not fit.
 *
 * Any two of those are a design. All three is a control that paints its own contents into whatever the
 * form draws underneath — the second row of chips outside the border, the placeholder printed over
 * them, the count and the affordances pushed below the box that was supposed to contain them.
 *
 * **The contradiction is asserted, not the consequence.** How many values it takes to reach the second
 * line depends on the labels, the theme, the font and the width — none of which this library controls,
 * and all of which a check written in terms of *when it happens* would have to guess at. A field
 * holding one short value looks perfectly correct and is the same defect. Reading the three properties
 * instead is content-independent: it is true today with one chip, and it says what is wrong rather
 * than that something looks wrong.
 *
 * That is also why the defect survived a suite that runs on every theme and takes pictures of all of
 * them: **the fixture holds one value.** One chip cannot wrap, so no picture could contain the second
 * row, and every reading agreed the control was fine.
 *
 * The repair is a choice between the three, and the check does not make it: let the field grow, cap
 * the strip to one line and scroll it, or clip. Each is defensible; keeping all three is not.
 */

/** A field whose height is stated cannot grow to hold a second line. */
const fixedHeight = (value: string) => value !== "auto" && value !== "" && !value.endsWith("%");

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

for (const theme of THEMES) {
  test(`no row may wrap inside a box that cannot grow, under ${theme}`, async ({ page }) => {
    await page.evaluate(async (name) => {
      const link = document.querySelector('link[href*="themes/"]') as HTMLLinkElement | null;
      if (link === null) throw new Error("the demo has no theme stylesheet to swap");
      const href = `./themes/${name}.css`;
      if (link.getAttribute("href") !== href) {
        await new Promise<void>((resolve) => {
          link.addEventListener("load", () => resolve(), { once: true });
          link.addEventListener("error", () => resolve(), { once: true });
          link.setAttribute("href", href);
        });
      }
      await document.fonts.ready;
    }, theme);
    await page.waitForTimeout(200);

    const trapped = await page.evaluate(() => {
      const found: string[] = [];
      for (const renderer of document.querySelectorAll(".mdy-renderer")) {
        const kind = [...renderer.classList].find((one) => one.startsWith("mdy-renderer--"))
          ?.replace("mdy-renderer--", "") ?? "?";
        const field = renderer.querySelector(".mdy-input-wrapper");
        if (!(field instanceof HTMLElement)) continue;
        const outer = getComputedStyle(field);

        for (const row of renderer.querySelectorAll("*")) {
          if (!(row instanceof HTMLElement)) continue;
          if (!field.contains(row)) continue;
          const inner = getComputedStyle(row);
          if (inner.flexWrap !== "wrap") continue;
          const name = row.className.split(/\s+/).find((one) => one.startsWith("mdy-")) ?? row.tagName.toLowerCase();
          found.push(
            `${kind}: ${name} may wrap, its field's height is ${outer.height} and its overflow is `
            + `${outer.overflowY}`,
          );
        }
      }
      return { found: [...new Set(found)] };
    });

    const fields = await page.locator(".mdy-input-wrapper").count();
    expect(fields, "the themed page drew no field, so this measured nothing").toBeGreaterThan(3);

    // Only the arrangements where all three hold: a wrapping row in a field that is both stated and
    // unclipped. A wrapping row in a field that grows is fine, and so is one that is clipped.
    const both = trapped.found.filter((one) => {
      const height = /height is ([^ ]+)/.exec(one)?.[1] ?? "auto";
      const overflow = /overflow is ([^ ]+)/.exec(one)?.[1] ?? "visible";
      return fixedHeight(height) && overflow === "visible";
    });

    expect(
      both,
      `${both.length} row(s) may wrap inside a field that can neither grow nor clip: ${both.join("; ")}. `
      + "The second line is painted over whatever the form draws underneath, and how many values it "
      + "takes to reach it depends on the labels rather than on anything this library decides.",
    ).toEqual([]);
  });
}
