/**
 * Every target a pointer must hit is at least the floor, or is excused by the rule's own exceptions.
 *
 * **This asks a different question from everything else in this tier, and that is the point.** The
 * other sweeps compare the three renderers to each other, and the visual baselines compare each
 * renderer to its own past. Both are blind to the same thing: a property all three get wrong
 * together, and a property no baseline ever had. This one interrogates a published threshold instead
 * — so a floor the whole library sits under is visible for the first time.
 *
 * WCAG 2.2 §2.5.8 is **24 by 24 CSS pixels**, and its exceptions are not footnotes:
 *
 *   spacing   a smaller target conforms if a 24px circle centred on it meets no other target's
 *             circle. Measured against neighbours rather than assumed — without it a checkbox whose
 *             pressable label is 28×20 reads as a violation, and it is not: nothing sits within 24px
 *             of it. A check that skipped this would file twenty rows it could not defend.
 *   inline    a target whose size is constrained by the line height of the text around it. A field's
 *             caption is 20px tall because that is one line at the field's line height — nobody chose
 *             a target size, and demanding 24 would demand a larger typeface. Decided by measuring
 *             the element's own text nodes: an element with no text has no line constraining it, and
 *             a button drawn around an icon is the size somebody chose for it.
 *
 * A control the page hides from sight is not a target either — the one-pixel `<input>` behind a
 * checkbox takes its press through the label, which is the box a thumb aims at and the box measured
 * here. Counting the hidden control and then excusing it inflates both the population and the
 * exceptions, and a floor is only as good as the honesty of what it excuses.
 *
 * **What is excused is counted and reported**, because an exception that quietly swallows everything
 * looks exactly like a page that conforms.
 *
 * The row names the box and the distance to the nearest neighbour rather than a verdict alone: a
 * target under the floor is repaired by growing it or by moving what is beside it, and which of the
 * two is cheaper is not readable from "too small".
 *
 * Claims under attack: A11Y-002, UI-011.
 */
import { expect, test } from "@playwright/test";
import { MDY_WIDGET_KINDS } from "@modyra/widgets";

import { HOSTS } from "./bench";

type Api = Record<string, Record<string, (...args: never[]) => unknown>>;

/** The floor, in CSS pixels, and the radius the spacing exception measures. */
const FLOOR = 24;

/** What a pointer is asked to hit. A container is not a target because nothing acts on pressing it. */
const TARGETS = [
  "button", '[role="button"]', '[role="switch"]', '[role="checkbox"]', '[role="radio"]',
  '[role="option"]', '[role="gridcell"]', "a[href]", "summary", "label",
].join(", ");

for (const host of HOSTS) {
  test(`every target is at least the floor or excused by the rule, ${host.name}`, async ({ page }) => {
    test.setTimeout(300_000);

    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);
    await page.evaluate(({ api, kinds }) => {
      (window as never as Api)[api].mountFields("targets", kinds.map((kind, index) => ({
        name: `f${index}`, kind, label: `L ${kind}`,
        options: [{ value: "a", label: "A" }, { value: "b", label: "B" }],
      })) as never);
    }, { api: host.api, kinds: [...MDY_WIDGET_KINDS] });
    await page.waitForTimeout(700);

    const measured = await page.evaluate(({ selector, floor }) => {
      const root = document.querySelector('[data-form="targets"]');
      if (root === null) return null;
      // **A control nobody can see is not a target.** The visually hidden `<input>` behind a checkbox
      // is one pixel square by design and takes the press through its label — counting it and then
      // excusing it by an exception is the wrong road to the right answer, and it hides how much the
      // exceptions are actually doing. What a pointer hits is what is painted.
      const painted = (element: HTMLElement, box: DOMRect) => {
        if (box.width <= 2 && box.height <= 2) return false;
        const style = getComputedStyle(element);
        return style.clipPath === "none" && style.clip === "auto" && style.opacity !== "0";
      };
      const targets = [...root.querySelectorAll<HTMLElement>(selector)]
        .map((element) => ({ element, box: element.getBoundingClientRect() }))
        .filter((one) => one.box.width >= 1 && one.box.height >= 1 && painted(one.element, one.box));

      const under: string[] = [];
      let excusedInline = 0;
      let excusedSpacing = 0;

      for (const { element, box } of targets) {
        if (box.width >= floor && box.height >= floor) continue;

        const part = [...element.classList].find((one) => one.startsWith("mdy-"))
          ?? element.tagName.toLowerCase();

        // **The exception is for a target whose size nobody chose, not for a target that is small.**
        // The rule constrains the size to the *line height of non-target text*, so the text is what
        // decides it: an element whose box is the box of its own text was sized by the writing it
        // sits in, and an element carrying no text cannot claim the exception however short it is.
        // Comparing the box to a line height instead inverts the rule — the smaller a target, the
        // more readily it is forgiven, which is the one direction an accessibility floor must not
        // fail in.
        // Text nodes, not contents: a range over an element's children measures the icon inside a
        // button as though it were a line of prose, and a button drawn around an icon then excuses
        // itself for being the size of its own icon.
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
        let line = 0;
        for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
          if ((node.textContent ?? "").trim() === "") continue;
          const span = document.createRange();
          span.selectNode(node);
          line = Math.max(line, span.getBoundingClientRect().height);
        }
        if (line > 0 && box.height <= line + 2) { excusedInline += 1; continue; }

        const x = box.x + box.width / 2;
        const y = box.y + box.height / 2;
        let nearest = Number.POSITIVE_INFINITY;
        for (const other of targets) {
          if (other.element === element) continue;
          nearest = Math.min(nearest, Math.hypot(
            other.box.x + other.box.width / 2 - x,
            other.box.y + other.box.height / 2 - y,
          ));
        }
        if (nearest >= floor) { excusedSpacing += 1; continue; }

        under.push(`${part} is ${Math.round(box.width)}×${Math.round(box.height)} with its nearest `
          + `neighbour ${Math.round(nearest)}px away`);
      }

      return { counted: targets.length, under: [...new Set(under)].sort(), excusedInline, excusedSpacing };
    }, { selector: TARGETS, floor: FLOOR });

    expect(measured, `${host.name} drew no field to measure`).not.toBeNull();

    // The premise: a page with no targets has none under the floor, and so does a selector that
    // matches nothing. What is excused is reported for the same reason — an exception that swallows
    // every case looks exactly like a page that conforms.
    expect(measured!.counted, "no target was found, so this measured nothing").toBeGreaterThan(10);
    console.log(`[${host.name}] ${measured!.counted} targets · excused inline ${measured!.excusedInline}`
      + ` · excused by spacing ${measured!.excusedSpacing}`);

    expect(
      measured!.under,
      `${measured!.under.length} target(s) are under the ${FLOOR}px floor and excused by neither `
      + `exception:\n${measured!.under.join("\n")}\n\n`
      + "A target smaller than the floor is reached by aiming rather than by pointing, which is the "
      + "difference between using a control and being careful with it. Repaired by growing the target "
      + "or by moving what is beside it — the distance above says which is nearer.",
    ).toEqual([]);
  });
}
