import { expect, test } from "@playwright/test";

/**
 * The mark at a field's trailing edge turns when the list it opens is showing, in every renderer.
 *
 * Which way a caret points is the only thing a **closed** control shows about the state of its list.
 * A person who has just opened one and looked away has nothing else on screen to come back to: the
 * panel may be below the fold, behind a scroll, or drawn over something else entirely.
 *
 * Asked of both kinds that draw one, in one file, because the defect this catches is not a defect of
 * either kind alone. Each was internally consistent — one declared an `open` state on its caret and
 * turned it, the other declared none and turned nothing — and consistency with itself is exactly
 * what a per-kind test measures. The same mark answering two vocabularies is only visible when the
 * two are put side by side.
 *
 * The transform is read from the computed style rather than compared as a picture: a screenshot of
 * an open list photographs the list, and the caret is eight pixels of it.
 *
 * **A field that renders the platform's own chooser is exempt, and says so out loud.** A native
 * `<select>` draws its own mark and opens a list this page cannot see; there is nothing here to turn
 * and nothing to measure. Skipping it silently would leave a renderer that stopped drawing a caret
 * at all looking exactly like one that draws the platform's — so the reason is printed either way.
 */

const KINDS = ["select", "multiselect"] as const;

/**
 * The caret's rotation, read inside the field that was pressed.
 *
 * The **located** field, never a fresh `document.querySelector` for the same kind: a demo that draws
 * a kind twice hands the two calls two different elements, and the one that is read is the one
 * nobody touched. It then reports a caret that never turns — a true statement about the wrong
 * control, and it fails in the direction that invents a defect.
 */
async function caretTransform(field: import("@playwright/test").Locator): Promise<string> {
  return field.evaluate((element) => {
    const caret = element.querySelector('[class*="__arrow"]');
    return caret === null ? "(no caret)" : getComputedStyle(caret).transform;
  });
}

for (const kind of KINDS) {
  test(`the ${kind} caret turns while its list is open`, async ({ page }) => {
    await page.goto("/");
    // `:visible` and then the first, not the first and then a wait for it to become visible: a demo
    // that draws the kind twice with the first one inside something collapsed would otherwise time
    // out on an element nobody can see while a perfectly measurable one sits below it.
    const field = page.locator(`.mdy-renderer--${kind}:visible`).first();
    await field.waitFor({ state: "visible" });

    // The platform's chooser owns its own mark. Reported rather than passed over in silence.
    const native = await field.locator("select").count();
    test.skip(native > 0, `this renderer draws ${kind} as the platform's own chooser, which draws its own mark`);

    const closed = await caretTransform(field);
    expect(closed, `${kind} draws no caret, so this file measured nothing`).not.toBe("(no caret)");

    // The declared opener is pressed, not a point on the field. Whether a press on the field's own
    // empty space reaches the opener is a different question with a different answer per renderer,
    // and asking it here would report that difference as a caret that does not turn.
    const opener = field.locator("[aria-expanded]").first();
    await opener.click();
    await expect(
      opener,
      `pressing the ${kind}'s opener did not open its list, so the caret was never asked to turn`,
    ).toHaveAttribute("aria-expanded", "true");

    const open = await caretTransform(field);
    expect(
      open,
      `the ${kind} caret is drawn "${open}" whether the list is open or shut. A mark that does not `
      + "change is a mark that says nothing, and it is the only thing a closed control shows about "
      + "its list.",
    ).not.toBe(closed);
  });
}
