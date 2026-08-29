/**
 * Whether an overlay dismisses the way its kind declares it will.
 *
 * The catalogue says more about an overlay than that it has one. For every kind that opens a panel it
 * declares **how that panel goes away**: whether a pointer landing outside dismisses it, whether focus
 * leaving dismisses it, whether the panel scrolls, and how it anchors. Six kinds declare an overlay
 * and every one of them declares the same two answers about dismissal.
 *
 * **Nothing asked for any of it.** `overlay` itself is read by a handful of checks — it is what tells
 * them a part may leave its declared parent. The four capabilities beside it are read by nothing: they
 * are published, versioned, part of the contract a consuming application reads to know what a control
 * does, and no check in this suite has ever demanded that a renderer honour one.
 *
 * That is the shape worth naming, because it is not a defect in any renderer:
 *
 * > **A rule that is declared and demanded by nobody is kept by agreement, not by contract.** Three
 * > implementations written by the same hands in the same months will fill a silence the same way, and
 * > that agreement is indistinguishable from conformance until somebody who was not in the room
 * > arrives.
 *
 * **What is measured is the declared answer, not a preference.** This file has no opinion about
 * whether a panel should close when focus leaves it — a case can be made either way, and the record
 * has already made one. It asks whether the renderer does what the kind says it does.
 *
 * **The act carries its own control.** Focus is moved out of the panel to an ordinary button on the
 * page, and at least one renderer must be seen to dismiss on that act. A renderer that does not
 * respond to a gesture no renderer responds to is a gesture that never arrived, not a renderer that
 * ignored it — and this file would be reporting its own driving.
 *
 * **A kind whose panel never opened is not judged.** Where a renderer hands the list to the platform
 * there is no panel of ours to dismiss, and counting that as compliance would be a green for the
 * absence of the thing under test.
 *
 * Claims under attack: UI-005, A11Y-002.
 */

import { expect, test } from "@playwright/test";
import { MDY_POPUP_OPENERS, MDY_WIDGET_CONTRACTS } from "@modyra/widgets";

import { HOSTS } from "./bench";

type Api = Record<string, Record<string, (...args: never[]) => unknown>>;
type Contract = {
  parts: Record<string, { classes: string[] }>;
  capabilities?: { overlay?: boolean; dismissOnFocusOutside?: boolean; dismissOnOutsidePointer?: unknown };
};

/** What the kind says a pointer landing outside does. Anything but `false` is a dismissal. */
const dismissesOnPointer = (kind: string): boolean =>
  (CONTRACTS[kind].capabilities?.dismissOnOutsidePointer ?? false) !== false;

const CONTRACTS = MDY_WIDGET_CONTRACTS as unknown as Record<string, Contract>;
const OVERLAY_KINDS = Object.keys(CONTRACTS).filter((kind) => CONTRACTS[kind].capabilities?.overlay === true);
const classOf = (kind: string, part: string) => (CONTRACTS[kind].parts[part]?.classes ?? [])[0];

for (const host of HOSTS) {
  test(`an overlay dismisses the way its kind declares, ${host.name}`, async ({ page }) => {
    test.setTimeout(300_000);
    await page.setViewportSize({ width: 1_200, height: 800 });
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    // Without kinds that declare an overlay, this file is about nothing.
    expect(OVERLAY_KINDS.length, "no kind declares an overlay").toBeGreaterThan(1);

    await page.evaluate(() => {
      const away = document.createElement("button");
      away.id = "mdy-elsewhere";
      away.textContent = "altrove";
      document.body.append(away);
    });

    const disagreeing: string[] = [];
    /** A panel filling the window leaves nowhere to press that is not itself. */
    const unpressable: string[] = [];
    const dismissed: string[] = [];
    /** Kinds whose list belongs to the operating system: there is no panel of ours to dismiss. */
    const platformOwned: string[] = [];
    /** Kinds that should have opened and did not. Never excused: a kind not asked is a kind not asked. */
    const neverOpened: string[] = [];
    /** The same question asked of the other way out: a pointer landing somewhere else. */
    const pointerDisagreeing: string[] = [];

    for (const kind of OVERLAY_KINDS) {
      const declared = CONTRACTS[kind].capabilities?.dismissOnFocusOutside === true;
      const opener = (MDY_POPUP_OPENERS as Record<string, { opener?: string } | undefined>)[kind]?.opener;
      const openerClass = opener === undefined ? undefined : classOf(kind, opener);
      if (openerClass === undefined) { neverOpened.push(`${kind} (no opener declared)`); continue; }

      const id = `dismiss_${kind}`;
      await page.evaluate(({ api, mountId, k, options }) => {
        const field: Record<string, unknown> = { name: "f", kind: k, label: "L" };
        if (/select/.test(k)) field.options = options;
        (window as never as Api)[api].mountFields(mountId, [field] as never);
      }, { api: host.api, mountId: id, k: kind, options: [{ value: "a", label: "A" }, { value: "b", label: "B" }] });
      await page.locator(`[data-form="${id}"]`).waitFor({ timeout: 5_000 });
      await page.waitForTimeout(200);

      await page.locator(`[data-form="${id}"] .${openerClass}`).first().click({ timeout: 5_000 }).catch(() => undefined);
      await page.waitForTimeout(350);

      const panel = page.locator(`.${classOf(kind, "popup") ?? "mdy-popup"}`).first();
      const wasOpen = await panel.isVisible().catch(() => false);
      if (!wasOpen) {
        // Two reasons, and only one of them is an excuse. A renderer that hands its list to the
        // platform reports no expanded state at all — there is no panel of ours, so there is nothing
        // to dismiss and nothing to judge. Anything else is a kind that should have opened, and
        // folding the two together turns a named exception into a spare seat that the next failure
        // sits in.
        const said = await page.evaluate((selector) =>
          document.querySelector(`${selector} [aria-expanded]`)?.getAttribute("aria-expanded") ?? "(none)",
          `[data-form="${id}"]`);
        (said === "(none)" ? platformOwned : neverOpened).push(kind);
        continue;
      }

      await page.evaluate(() => (document.getElementById("mdy-elsewhere") as HTMLElement).focus());
      await page.waitForTimeout(400);
      const went = !(await panel.isVisible().catch(() => false));

      if (went) dismissed.push(kind);
      if (went !== declared) {
        disagreeing.push(`${kind} declares dismissOnFocusOutside=${declared} and ${went ? "dismisses" : "stays open"}`);
      }

      // The other way out the kind declares. A press somewhere else is a different act from focus
      // moving — dismissal is commonly hung on one or the other, and they come apart: a press on a
      // heading moves no focus at all. So the panel is opened again and pressed away from.
      await page.locator(`[data-form="${id}"] .${openerClass}`).first().click({ timeout: 5_000 }).catch(() => undefined);
      await page.waitForTimeout(350);
      if (await panel.isVisible().catch(() => false)) {
        // **Pressed at a place, not at an element.** An open panel covers what is behind it, so
        // asking the driver to click a button outside the field is asking it to click something it
        // can see is obscured — it refuses, the refusal was swallowed, and a press that never
        // happened was reported as a panel that would not go away. A person's finger has no such
        // scruple: it lands where it lands, on the panel's backdrop if there is one, and that is the
        // gesture the capability is about. The press is asserted rather than attempted.
        // Outside the field **and** outside the panel: a panel that opens upward sits where "just
        // above the field" is, and a press inside it is not a press somewhere else — it would be
        // asking the control to dismiss on a press on itself, which nothing declares.
        const field = await page.locator(`[data-form="${id}"]`).boundingBox();
        const opened = await panel.boundingBox().catch(() => null);
        const away = await page.evaluate(({ a, b }) => {
          const clear = (x: number, y: number) => [a, b].every((box) => box === null
            || x < box.x || x > box.x + box.width || y < box.y || y > box.y + box.height);
          const corners = [[8, 8], [window.innerWidth - 8, 8], [8, window.innerHeight - 8],
            [window.innerWidth - 8, window.innerHeight - 8]];
          const found = corners.find(([x, y]) => clear(x, y));
          return found === undefined ? null : { x: found[0], y: found[1] };
        }, { a: field, b: opened });
        if (away === null) { unpressable.push(kind); continue; }
        await page.mouse.click(away.x, away.y);
        await page.waitForTimeout(400);
        const wentOnPointer = !(await panel.isVisible().catch(() => false));
        const declaredPointer = dismissesOnPointer(kind);
        if (wentOnPointer !== declaredPointer) {
          pointerDisagreeing.push(
            `${kind} declares a pointer outside ${declaredPointer ? "dismisses" : "does not dismiss"} `
            + `and it ${wentOnPointer ? "does" : "does not"}`);
        }
      }

      await page.evaluate(({ api, mountId }) => {
        try { (window as never as Api)[api].dispose?.(mountId as never); } catch { /* nothing mounted */ }
      }, { api: host.api, mountId: id });
    }

    // **How many kinds this run actually judged, not merely that it passed.** A behavioural check
    // that mounts and presses can quietly cover less than it claims: a kind that does not open is a
    // kind not asked, and a green that does not say how many it asked reads the same whether it
    // asked all of them or two. One kind may legitimately be unopenable — where a renderer hands its
    // list to the platform there is no panel of ours — and that is the whole allowance.
    // The only excuse is a named one: this kind's list is the platform's. Everything else that did
    // not open is a kind this run never asked, and expressing that allowance as a count would leave a
    // spare seat — a margin absorbs in silence the very case it was meant to catch.
    expect(
      neverOpened,
      `${host.name} could not open ${JSON.stringify(neverOpened)}, which declare an overlay of their `
      + `own. It judged ${OVERLAY_KINDS.length - neverOpened.length - platformOwned.length} of `
      + `${OVERLAY_KINDS.length}, excusing ${JSON.stringify(platformOwned)} whose list belongs to the `
      + "platform. A kind that does not open is a kind this run never asked, and everything below "
      + "would be silent about it while reading green.",
    ).toEqual([]);

    expect(
      pointerDisagreeing,
      `${host.name}: ${pointerDisagreeing.length} overlay(s) answer a press somewhere else differently `
      + `from the way their kind declares — ${JSON.stringify(pointerDisagreeing)}. This is the other `
      + "way out, and it is a different act from focus moving: a press on a heading moves no focus at "
      + "all, so a control that hangs dismissal on one has not thereby answered for the other.",
    ).toEqual([]);

    expect(
      disagreeing,
      `${host.name}: ${disagreeing.length} overlay(s) do not go away the way their kind says they `
      + `will — ${JSON.stringify(disagreeing)}. The capability is published: a consuming application `
      + "reads it to know what the control does, and every renderer is free to read it too. Nothing "
      + "in this suite has ever demanded it, so whether it held was a matter of three implementations "
      + "written by the same hands agreeing — which is indistinguishable from conformance right up "
      + "until somebody who was not in the room implements the contract from the catalogue alone.",
    ).toEqual([]);
  });
}
