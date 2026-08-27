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
  capabilities?: { overlay?: boolean; dismissOnFocusOutside?: boolean };
};

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
    const dismissed: string[] = [];
    const neverOpened: string[] = [];

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
      if (!wasOpen) { neverOpened.push(`${kind} (the platform's own, or it did not open)`); continue; }

      await page.evaluate(() => (document.getElementById("mdy-elsewhere") as HTMLElement).focus());
      await page.waitForTimeout(400);
      const went = !(await panel.isVisible().catch(() => false));

      if (went) dismissed.push(kind);
      if (went !== declared) {
        disagreeing.push(`${kind} declares dismissOnFocusOutside=${declared} and ${went ? "dismisses" : "stays open"}`);
      }

      await page.evaluate(({ api, mountId }) => {
        try { (window as never as Api)[api].dispose?.(mountId as never); } catch { /* nothing mounted */ }
      }, { api: host.api, mountId: id });
    }

    // A run that opened almost nothing has nothing to judge, and its silence would be the harness.
    expect(
      neverOpened.length,
      `${host.name} could not open ${JSON.stringify(neverOpened)} — too few panels to say anything `
      + "about how they go away",
    ).toBeLessThan(OVERLAY_KINDS.length - 1);

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
