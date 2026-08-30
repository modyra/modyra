/**
 * Where a panel sits and how wide it is, against what its kind declares.
 *
 * A panel that opens from a field has to decide two things nobody sees decided: how wide it is, and
 * which edge of the field it lines up with. The catalogue decides them, per kind, in numbers —
 * whether the panel takes the field's width, how narrow it may get, which side it aligns to.
 *
 * **Nothing has ever demanded any of it.** Four capabilities sit beside `overlay` in every kind that
 * has one, and this is the last of them no check reads. They are published: an application chooses a
 * control partly on what it does, and this is part of what it does.
 *
 * **The control is free here, and that is what makes this capability the strongest of the four.** The
 * declaration splits the kinds in two: a list takes the field's width, a picker does not. So a
 * renderer that ignores the capability entirely fails on one side or the other **whatever it does** —
 * force every panel to the field and the pickers break; leave every panel free and the lists break.
 * There is no behaviour that satisfies both by accident, which is what a control case is for and
 * here it costs nothing to arrange.
 *
 * **Taking the field's width is a relationship, not an equality.** Every renderer insets its panel
 * a few pixels inside the field, identically and to the pixel — three independent violations do not
 * land on the same number, so that inset is a decision the design took and not a rule anybody broke.
 * What the declaration is about is whether the panel's width is **a function of the field's**: narrow
 * the field and a panel that takes its width narrows with it, while a panel sized by its own contents
 * does not move. That comparison survives any inset, and it is the thing the words actually promise.
 *
 * **A narrow field is where a floor means anything.** `minWidth` does nothing on a wide field: a
 * renderer that has never read it looks identical to one that honours it. So the floor is measured
 * against a field deliberately narrower than the number, which is the only arrangement where the two
 * come apart — and it is also where the contract's own precedence shows, since a panel cannot both
 * take an 80px field's width and be 160px wide.
 *
 * **What this does not measure**, said rather than left to be assumed: `minSpace` is the room a panel
 * needs below before it flips above, and measuring it means putting the field near the bottom of the
 * window. That is a different arrangement with a premise of its own — *the field is where I think it
 * is* — and it belongs in its own file rather than riding along in this one.
 *
 * **A kind whose list belongs to the platform is excused by name**, not by a count. Where a renderer
 * hands the list to the operating system there is no panel of ours to measure. Anything else that did
 * not open is a kind this run never asked, and is never excused: an allowance written as a number is
 * a spare seat, and the next failure sits in it.
 *
 * Claims under attack: UI-005.
 */

import { expect, test } from "@playwright/test";
import { MDY_POPUP_OPENERS, MDY_WIDGET_CONTRACTS } from "@modyra/widgets";

import { HOSTS } from "./bench";

type Api = Record<string, Record<string, (...args: never[]) => unknown>>;
type Anchoring = { matchAnchorWidth?: boolean; minWidth?: number; alignment?: string };
type Contract = {
  parts: Record<string, { classes: string[] }>;
  capabilities?: { overlay?: boolean; anchoring?: Anchoring };
};

const CONTRACTS = MDY_WIDGET_CONTRACTS as unknown as Record<string, Contract>;
const OVERLAY_KINDS = Object.keys(CONTRACTS).filter((kind) => CONTRACTS[kind].capabilities?.overlay === true);
const classOf = (kind: string, part: string) => (CONTRACTS[kind].parts[part]?.classes ?? [])[0];
const anchoringOf = (kind: string): Anchoring => CONTRACTS[kind].capabilities?.anchoring ?? {};

/** Narrower than every floor the catalogue declares, so the floor is the only thing that can lift it. */
/**
 * Narrow enough that a panel following the field's width is visibly different from one that is not,
 * and wide enough that the field is still a field.
 *
 * Below about a hundred pixels a field is not merely small: its trailing affordance reaches across
 * the box and covers the control that opens the panel, so a press aimed at the declared opener lands
 * on the affordance and nothing opens. The measurement that comes back is then about the arrangement
 * rather than about the anchoring, and it arrives as a kind that "never opened" — which reads like a
 * renderer with a broken panel and is a field squeezed past the width its own parts fit in.
 */
const NARROW = 100;
/** A pixel of slack on a floor, which is a number the panel must clear rather than match. */
const SLACK = 2;
/** Every renderer insets its panel inside the field by a few pixels; the edge is judged past that. */
const EDGE_SLACK = 8;

for (const host of HOSTS) {
  test(`a panel is anchored the way its kind declares, ${host.name}`, async ({ page }) => {
    test.setTimeout(300_000);
    await page.setViewportSize({ width: 1_200, height: 800 });
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    expect(OVERLAY_KINDS.length, "no kind declares an overlay").toBeGreaterThan(1);

    const wrongWidth: string[] = [];
    const wrongFloor: string[] = [];
    const wrongEdge: string[] = [];
    const platformOwned: string[] = [];
    const neverOpened: string[] = [];
    /** Kinds that opened normally and not under the narrowing this file imposes. Its condition, not theirs. */
    const notUnderNarrowing: string[] = [];

    /** Open one kind at a time and read the field's box and the panel's. */
    const measure = async (kind: string, fieldWidth: number | null) => {
      // A failure to open while the field is squeezed to a width no page would use is a failure of
      // this file's own arrangement, not of the renderer. Folding the two into one list would report
      // a kind as never asked when it answered perfectly under the conditions anybody actually has.
      const imposed = fieldWidth !== null;
      const opener = (MDY_POPUP_OPENERS as Record<string, { opener?: string } | undefined>)[kind]?.opener;
      const openerClass = opener === undefined ? undefined : classOf(kind, opener);
      if (openerClass === undefined) { neverOpened.push(`${kind} (no opener declared)`); return null; }

      const id = `anchor_${kind}`;
      await page.evaluate(({ api, mountId, k, options, width }) => {
        const field: Record<string, unknown> = { name: "f", kind: k, label: "L" };
        if (/select/.test(k)) field.options = options;
        (window as never as Api)[api].mountFields(mountId, [field] as never);
        const root = document.querySelector(`[data-form="${mountId}"]`) as HTMLElement | null;
        // A field narrowed on purpose: a floor is invisible on a wide one.
        if (root !== null && width !== null) { root.style.width = `${width}px`; root.style.maxWidth = `${width}px`; }
      }, { api: host.api, mountId: id, k: kind, width: fieldWidth,
           options: [{ value: "a", label: "A" }, { value: "b", label: "B" }] });
      await page.locator(`[data-form="${id}"]`).waitFor({ timeout: 5_000 });
      await page.waitForTimeout(220);

      await page.locator(`[data-form="${id}"] .${openerClass}`).first().click({ timeout: 5_000 }).catch(() => undefined);
      await page.waitForTimeout(400);

      const boxes = await page.evaluate(({ mountId, popupClass, anchorClass }) => {
        const root = document.querySelector(`[data-form="${mountId}"]`) as HTMLElement | null;
        const panels = (Array.from(document.querySelectorAll(`.${popupClass}`)) as HTMLElement[])
          .filter((one) => one.getBoundingClientRect().width >= 1);
        const anchor = (root?.querySelector(`.${anchorClass}`) ?? root) as HTMLElement | null;
        if (root === null || anchor === null || panels.length === 0) {
          return { panels: panels.length, expanded: root?.querySelector("[aria-expanded]")?.getAttribute("aria-expanded") ?? "(none)" };
        }
        const field = anchor.getBoundingClientRect();
        const panel = panels[0].getBoundingClientRect();
        return { panels: panels.length, expanded: "true",
                 field: { left: field.left, right: field.right, width: field.width },
                 panel: { left: panel.left, right: panel.right, width: panel.width } };
      }, { mountId: id, popupClass: classOf(kind, "popup") ?? "mdy-popup",
           anchorClass: classOf(kind, "inputWrapper") ?? classOf(kind, "root") ?? "mdy-renderer" });

      await page.evaluate(({ api, mountId }) => {
        try { (window as never as Api)[api].dispose?.(mountId as never); } catch { /* nothing mounted */ }
      }, { api: host.api, mountId: id });

      if (boxes.field === undefined) {
        // Two reasons, one excuse. A renderer that hands its list to the platform reports no expanded
        // state at all; anything else should have opened and did not.
        if (imposed) notUnderNarrowing.push(kind);
        else (boxes.expanded === "(none)" ? platformOwned : neverOpened).push(kind);
        return null;
      }
      // More than one panel on the page makes "the panel" ambiguous, and the reading would be of
      // whichever came first in the document.
      expect(boxes.panels, `${host.name}: ${boxes.panels} panels were open at once for ${kind}`).toBe(1);
      return boxes as { field: { left: number; right: number; width: number }; panel: { left: number; right: number; width: number } };
    };

    for (const kind of OVERLAY_KINDS) {
      const declared = anchoringOf(kind);

      const wide = await measure(kind, null);
      if (wide === null) continue;

      if (declared.alignment === "right" && Math.abs(wide.panel.right - wide.field.right) > EDGE_SLACK) {
        wrongEdge.push(`${kind} declares it aligns right and its right edge is ${Math.round(wide.panel.right - wide.field.right)}px from the field's`);
      }

      // The same kind beside a much narrower field. Whether the panel follows is the declaration:
      // a width that is a function of the field's moves with it, one that is not stays put.
      const narrow = await measure(kind, NARROW);
      if (narrow === null) continue;
      const followed = wide.panel.width - narrow.panel.width;
      const fieldShrank = wide.field.width - narrow.field.width;

      // Without a field that really did get narrower, neither half below says anything.
      expect(
        fieldShrank,
        `${host.name}: narrowing ${kind} did not narrow the field — it went from `
        + `${Math.round(wide.field.width)}px to ${Math.round(narrow.field.width)}px, so nothing here `
        + "compares a panel beside a wide field with one beside a narrow one",
      ).toBeGreaterThan(200);

      if (declared.matchAnchorWidth === true && followed < fieldShrank / 2) {
        wrongWidth.push(`${kind} declares it takes the field's width and stayed ${Math.round(narrow.panel.width)}px `
          + `while the field went from ${Math.round(wide.field.width)}px to ${Math.round(narrow.field.width)}px`);
      }
      if (declared.matchAnchorWidth === false && followed > fieldShrank / 2 && typeof declared.minWidth !== "number") {
        wrongWidth.push(`${kind} declares its width is its own and followed the field down from `
          + `${Math.round(wide.panel.width)}px to ${Math.round(narrow.panel.width)}px`);
      }

      // The floor, on the narrow field: the only arrangement where a renderer that honours it and one
      // that never read it look different.
      if (typeof declared.minWidth === "number" && narrow.panel.width + SLACK < declared.minWidth) {
        wrongFloor.push(`${kind} declares a floor of ${declared.minWidth}px and is ${Math.round(narrow.panel.width)}px beside a ${Math.round(narrow.field.width)}px field`);
      }
    }

    expect(
      neverOpened,
      `${host.name} could not open ${JSON.stringify(neverOpened)}, which declare an overlay of their `
      + `own. It excused ${JSON.stringify(platformOwned)}, whose list belongs to the platform. A kind `
      + "that does not open is a kind this run never asked, and everything below would be silent "
      + "about it while reading green.",
    ).toEqual([]);

    // Named, not silent: a floor unmeasured because the arrangement could not be set up is a hole in
    // the coverage, and a green that does not mention it reads as a floor that was checked.
    expect(
      notUnderNarrowing.length,
      `${host.name}: ${JSON.stringify(notUnderNarrowing)} opened beside an ordinary field and not `
      + `beside one squeezed to ${NARROW}px, so their floor and their following were not measured. `
      + "That is this file's arrangement failing, not theirs — but the coverage is missing either way "
      + "and it cannot be missing for most of them.",
    ).toBeLessThan(OVERLAY_KINDS.length / 2);

    expect(
      wrongWidth,
      `${host.name}: ${JSON.stringify(wrongWidth)}. The catalogue splits the kinds in two here — a `
      + "list takes the field's width so the options line up under what they belong to, a picker does "
      + "not because its contents have a size of their own. A renderer answering the same way for "
      + "both has not read the declaration; it has picked one and been right about half the kinds. "
      + "What is compared is the same kind beside a wide field and beside a narrow one, so the few "
      + "pixels every renderer insets its panel by are not what this is about.",
    ).toEqual([]);

    expect(
      wrongFloor,
      `${host.name}: ${JSON.stringify(wrongFloor)}. The floor exists for the field that is too narrow `
      + "to be worth matching, and that is the only place it does anything — on a wide field a "
      + "renderer that honours it and one that never read it are indistinguishable.",
    ).toEqual([]);

    expect(
      wrongEdge,
      `${host.name}: ${JSON.stringify(wrongEdge)}. Which edge a panel lines up with is declared, and `
      + "it is what makes a panel read as belonging to the field beneath it rather than floating near "
      + "it.",
    ).toEqual([]);
  });
}
