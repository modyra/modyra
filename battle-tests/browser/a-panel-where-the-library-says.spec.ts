/**
 * Whether a panel opens on the side the library's own function chose.
 *
 * Where a panel goes when there is not room below it is not a renderer's decision. The package
 * publishes the policy as a pure function — *«framework-independent overlay collision policy. Hosts
 * only measure and apply coordinates.»* — so a renderer's whole job here is to measure the anchor and
 * put the panel where the answer says.
 *
 * **This file does not model that policy, it calls it.** Every earlier attempt at this measured a
 * threshold and guessed what it meant: `minSpace` looked like *«flip when there is less than this
 * below»*, and it is not — it is the room a side must have to be **eligible**, weighed against a
 * preference, a desired height, and whether the content scrolls. A check built on the guess would
 * report a renderer for obeying a rule the checker had invented.
 *
 * **The confound that made the guess unfalsifiable.** A panel four hundred pixels tall cannot open
 * below when three hundred remain, whatever any threshold says. So *«it flipped»* has two causes —
 * the policy chose the other side, or the panel simply did not fit — and no arrangement of the field
 * separates them from outside. Calling the function removes the question: it answers with both the
 * side and whether it fits.
 *
 * **The one input this file supplies is the preference**, because the geometry does not carry it. So
 * the decision is computed for **both** preferences and the panel has to match one of them; a
 * renderer is only reported when it sits somewhere the policy would not have put it under either.
 * Judging against a single assumed preference would make this file's own choice look like a defect.
 *
 * **The policy has three answers, not two.** When neither side has room it answers `overlay`, and
 * that is not a side — the panel centres on the window instead of anchoring. Judged as above-or-below
 * it reads as *above* whenever the field is low on the screen, which is a renderer reported for doing
 * exactly what the policy asked. So a third answer is checked as a third thing: centred, not anchored.
 *
 * **The control is that both sides are seen.** A run where every panel opened downward agrees
 * perfectly with a policy that always said downward, and would say nothing about either.
 *
 * Claims under attack: UI-005.
 */

import { expect, test } from "@playwright/test";
import {
  decideOverlayPlacement,
  MDY_POPUP_OPENERS,
  MDY_WIDGET_CONTRACTS,
  overlayAnchoringFor,
} from "@modyra/widgets";

import { HOSTS } from "./bench";

type Api = Record<string, Record<string, (...args: never[]) => unknown>>;
type Contract = { parts: Record<string, { classes: string[] }>; capabilities?: { overlay?: boolean } };

const CONTRACTS = MDY_WIDGET_CONTRACTS as unknown as Record<string, Contract>;
const OVERLAY_KINDS = Object.keys(CONTRACTS).filter((kind) => CONTRACTS[kind].capabilities?.overlay === true);
const classOf = (kind: string, part: string) => (CONTRACTS[kind].parts[part]?.classes ?? [])[0];

/** Distances from the bottom of the window, chosen to fall on both sides of every declared threshold. */
const PLACES = [40, 160, 520];

for (const host of HOSTS) {
  test(`a panel opens where the library's own policy says, ${host.name}`, async ({ page }) => {
    test.setTimeout(300_000);
    await page.setViewportSize({ width: 1_200, height: 700 });
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    const disagreeing: string[] = [];
    const seen = new Set<string>();
    let judged = 0;

    for (const kind of OVERLAY_KINDS) {
      const anchoring = overlayAnchoringFor(kind as never) as { minSpace: number; minWidth?: number; scrolls?: boolean };
      const opener = (MDY_POPUP_OPENERS as Record<string, { opener?: string } | undefined>)[kind]?.opener;
      const openerClass = opener === undefined ? undefined : classOf(kind, opener);
      if (openerClass === undefined) continue;

      for (const fromBottom of PLACES) {
        const id = `policy_${kind}_${fromBottom}`;
        await page.evaluate(({ api, mountId, k, bottom, options }) => {
          const field: Record<string, unknown> = { name: "f", kind: k, label: "L" };
          if (/select/.test(k)) field.options = options;
          (window as never as Api)[api].mountFields(mountId, [field] as never);
          const root = document.querySelector(`[data-form="${mountId}"]`) as HTMLElement | null;
          if (root !== null) {
            root.style.position = "fixed";
            root.style.left = "40px";
            root.style.right = "40px";
            root.style.bottom = `${bottom}px`;
            root.style.zIndex = "5";
          }
        }, { api: host.api, mountId: id, k: kind, bottom: fromBottom,
             options: [{ value: "a", label: "A" }, { value: "b", label: "B" }] });
        await page.locator(`[data-form="${id}"]`).waitFor({ timeout: 5_000 });
        await page.waitForTimeout(180);

        await page.locator(`[data-form="${id}"] .${openerClass}`).first().click({ timeout: 5_000 }).catch(() => undefined);
        await page.waitForTimeout(350);

        const measured = await page.evaluate(({ selector, popupClass, anchorClass }) => {
          const anchor = document.querySelector(`${selector} .${anchorClass}`) as HTMLElement | null;
          // This field's panel, followed from the link this field declares to it. A renderer may draw
          // the panel outside the field, so it cannot be found by containment — but a page-wide search
          // by class finds whichever panel any earlier field left standing, and measures that one
          // against this one's anchor. The relation is what says which panel is whose.
          const named = document.querySelector(`${selector} [aria-controls]`)?.getAttribute("aria-controls");
          // The relation names the thing inside the panel a reader is sent to — a grid, a list — and
          // not the panel itself, so the panel is the one holding it. Measuring the grid would answer
          // a question about the panel with a box that is nearly but not the same.
          const controlled = named === null || named === undefined ? null : document.getElementById(named);
          const linked = controlled === null
            ? null
            : (controlled.classList.contains(popupClass) ? controlled : controlled.closest(`.${popupClass}`) as HTMLElement | null);
          const showing = (Array.from(document.querySelectorAll(`.${popupClass}`)) as HTMLElement[])
            .filter((one) => one.getBoundingClientRect().width >= 1);
          // Without a link, only an unambiguous page answers: two panels showing and no way to say
          // which is this field's is a measurement that cannot be made, not one to guess at.
          const panel = linked !== null && linked.getBoundingClientRect().width >= 1
            ? linked
            : (showing.length === 1 ? showing[0] : undefined);
          if (anchor === null || panel === undefined) return null;
          const a = anchor.getBoundingClientRect();
          const p = panel.getBoundingClientRect();
          return {
            viewportWidth: window.innerWidth, viewportHeight: window.innerHeight,
            anchorTop: a.top, anchorBottom: a.bottom, anchorLeft: a.left, anchorRight: a.right,
            anchorWidth: a.width, panelHeight: p.height,
            // Where it actually went, judged against the anchor and not against the mount wrapper —
            // the wrapper spans the page and every panel is "inside" it.
            where: p.bottom <= a.top + 6 ? "above" : p.top >= a.bottom - 6 ? "below" : "overlapping",
            // For the third answer: how far the panel's middle is from the window's, as a share of
            // the window. A centred panel sits near zero however low its field is.
            offCentre: Math.abs((p.top + p.bottom) / 2 - window.innerHeight / 2) / window.innerHeight,
          };
        }, { selector: `[data-form="${id}"]`, popupClass: classOf(kind, "popup") ?? "mdy-popup",
             anchorClass: classOf(kind, "inputWrapper") ?? "mdy-input-wrapper" });

        await page.evaluate(({ api, mountId }) => {
          try { (window as never as Api)[api].dispose?.(mountId as never); } catch { /* nothing mounted */ }
        }, { api: host.api, mountId: id });

        if (measured === null) continue;

        const base = {
          viewportWidth: measured.viewportWidth, viewportHeight: measured.viewportHeight,
          anchorTop: measured.anchorTop, anchorBottom: measured.anchorBottom,
          anchorLeft: measured.anchorLeft, anchorRight: measured.anchorRight,
          anchorWidth: measured.anchorWidth,
          minSpace: anchoring.minSpace, minWidth: anchoring.minWidth ?? 0,
          scrolls: anchoring.scrolls, desiredHeight: measured.panelHeight,
        };
        const allowed = new Set(["below", "above"].map((preferred) =>
          (decideOverlayPlacement({ ...base, preferred } as never) as { placement: string }).placement));

        judged += 1;
        seen.add(measured.where);

        // Every answer the policy can give is `overlay`: the panel is not on a side at all, and the
        // only thing to check is that it centred rather than anchored.
        if ([...allowed].every((one) => one === "overlay")) {
          // Not a distance: a fact. A panel flush to one side of its anchor is anchored, whatever
          // fraction of the window it happens to sit at — and a threshold in percent would be a
          // number this file invented, with a finding resting on where I happened to put it.
          if (measured.where !== "overlapping") {
            disagreeing.push(`${kind} ${Math.round(measured.anchorTop)}px down: the policy answers `
              + `overlay — neither side had room, so it centres — and the panel is flush ${measured.where} `
              + `the field, ${Math.round(measured.offCentre * 100)}% of the window off centre`);
          }
          continue;
        }

        if (measured.where !== "overlapping" && !allowed.has(measured.where)) {
          disagreeing.push(`${kind} ${Math.round(measured.anchorTop)}px down: the policy answers `
            + `${[...allowed].join(" or ")} and the panel is ${measured.where}`);
        }
      }
    }

    // A run that judged almost nothing would agree with any policy by having nothing to compare.
    expect(judged, `${host.name} opened too few panels to compare against the policy`).toBeGreaterThan(4);

    // And a run where every panel went the same way agrees perfectly with a policy that always says
    // that way. Both sides have to be seen before the comparison means anything.
    expect(
      [...seen].filter((one) => one !== "overlapping").sort(),
      `${host.name} only ever placed panels ${[...seen].join(" and ")}, so agreeing with the policy `
      + "says nothing — it would agree with one that always answered the same",
    ).toEqual(["above", "below"]);

    expect(
      disagreeing,
      `${host.name}: ${JSON.stringify(disagreeing)}. Where a panel goes is not a renderer's decision — `
      + "the package publishes the policy as a pure function and says a host's job is to measure the "
      + "anchor and apply what comes back. A renderer that puts it somewhere the policy would not is "
      + "answering a question it was not asked.",
    ).toEqual([]);
  });
}
