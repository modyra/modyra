/**
 * A live region, and the announcement nobody would notice going missing.
 *
 * `createMdyAnnouncer(id)` is the visually hidden region every adapter announces through, shared by
 * id so a page has one rather than one per widget. Three things have to be true about it, and only
 * two are the kind a reviewer would check.
 *
 * It has to be hidden from sight and **not** from a reader — `display: none` or `aria-hidden` would
 * hide it from both, and a region nobody hears is worse than none because the code around it looks
 * finished.
 *
 * And the third: **the same message announced twice has to be announced twice.** A reader reacts to a
 * live region changing, so writing an identical string into it is silence — "three results" after one
 * search and "three results" after the next would be spoken once. The fix is to replace the text node
 * rather than assign the same text, and it is invisible in every way except this one: the rendered
 * text is identical either way, and only what the DOM did between them tells them apart.
 *
 * That is why this spec watches mutations rather than text. An earlier version compared `textContent`
 * across two announcements, found it unchanged, and was one step from filing a defect that does not
 * exist.
 */

import { expect, test } from "@playwright/test";

test("a live region is hidden from sight, not from a reader", async ({ page }) => {
  test.setTimeout(140_000);
  await page.goto("/index.html");
  await page.waitForFunction(() => (window as never as Record<string, boolean>).battleReady === true);

  const seen = await page.evaluate(async () => {
    const battle = (window as never as Record<string, { announce(id: string, message: string): void }>).battle;
    const before = document.getElementById("hidden-region") !== null;
    battle.announce("hidden-region", "a message");
    await new Promise((resolve) => setTimeout(resolve, 140));

    const region = document.getElementById("hidden-region");
    if (region === null) return null;
    const style = getComputedStyle(region);
    const box = region.getBoundingClientRect();
    return {
      existedBefore: before,
      live: region.getAttribute("aria-live"),
      ariaHidden: region.getAttribute("aria-hidden"),
      display: style.display,
      visibility: style.visibility,
      area: Math.round(box.width * box.height),
      inDocument: document.body.contains(region),
    };
  });

  expect(seen, "no region was created").not.toBeNull();

  // Lazy: nothing in the page until somebody announces.
  expect(seen?.existedBefore, "the region exists before anything is announced").toBe(false);

  // Heard.
  expect(seen?.live, "the region is not a live region").toBe("polite");
  expect(seen?.ariaHidden, "the region a reader is meant to hear is marked aria-hidden").toBeNull();
  expect(seen?.display, "the region is display:none, which hides it from readers too").not.toBe("none");
  expect(seen?.visibility, "the region is visibility:hidden, which hides it from readers too").not.toBe("hidden");
  expect(seen?.inDocument, "the region is not in the document").toBe(true);

  // Not seen: small enough to be nowhere on screen.
  expect(seen?.area, "the region takes up room on the page").toBeLessThanOrEqual(4);
});

test("the same thing said twice is said twice", async ({ page }) => {
  test.setTimeout(140_000);
  await page.goto("/index.html");
  await page.waitForFunction(() => (window as never as Record<string, boolean>).battleReady === true);

  const seen = await page.evaluate(async () => {
    const battle = (window as never as Record<string, { announce(id: string, message: string): void }>).battle;
    battle.announce("twice-region", "seed");
    await new Promise((resolve) => setTimeout(resolve, 140));

    const region = document.getElementById("twice-region")!;
    let records: string[] = [];
    const observer = new MutationObserver((list) => {
      records.push(...list.map((each) => each.type));
    });
    observer.observe(region, { childList: true, characterData: true, subtree: true, attributes: true });

    records = [];
    battle.announce("twice-region", "Three results");
    await new Promise((resolve) => setTimeout(resolve, 150));
    const changed = records.length;

    records = [];
    battle.announce("twice-region", "Three results");
    await new Promise((resolve) => setTimeout(resolve, 150));
    const repeated = records.length;

    observer.disconnect();
    return { changed, repeated, text: region.textContent };
  });

  // The control: a new message moves the region, so the count means something.
  expect(seen.changed, "announcing a new message changed nothing in the region").toBeGreaterThan(0);

  // And the one that matters: the text is identical, so only the DOM can tell a reader anything.
  expect(seen.text, "the region does not hold the message").toBe("Three results");
  expect(
    seen.repeated,
    "announcing the same message again left the region untouched, so a reader is told once and the second time is silence",
  ).toBeGreaterThan(0);
});
