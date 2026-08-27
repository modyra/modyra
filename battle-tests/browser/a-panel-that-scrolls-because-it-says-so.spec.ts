/**
 * Whether a panel scrolls inside itself, against what its kind declares.
 *
 * A panel holding sixty options and one holding a calendar are different problems. The list has to
 * stop growing and start scrolling, or it runs off the bottom of the window and the last option is
 * unreachable; the calendar has a size of its own and scrolling inside it would cut a month in half.
 * The catalogue decides which is which, per kind, and every kind that opens a panel says so.
 *
 * **Nothing read it.** Of the properties the catalogue declares, this was among the last with no
 * check demanding it — seventeen kinds carry the flag and no renderer was ever asked to honour it.
 *
 * **The control is free, as it is for the rest of this capability.** The declaration splits the kinds
 * in two, so a renderer that scrolls everything fails on the pickers and one that scrolls nothing
 * fails on the lists. There is no single behaviour that passes both by accident — which is what makes
 * a check worth writing even when it is green, because a green here says the declaration was read
 * rather than that one guess happened to be right.
 *
 * **A list has to be long enough to overflow before scrolling means anything.** A panel of two options
 * does not scroll however it was built, and a check that mounted two would report a renderer honouring
 * the flag when it had merely never been asked. Sixty is well past any panel's height.
 *
 * **What is asked is whether something scrolls, not what.** A renderer may put the overflow on the
 * panel or on the list inside it; both leave a person able to reach the sixtieth option, which is the
 * thing the flag is about. Naming the element would be a rule about arrangement that the catalogue
 * does not make.
 *
 * **A kind whose list belongs to the platform is excused by name.** Where a renderer hands the list
 * to the operating system there is no panel of ours to scroll, and the excuse is that named case
 * rather than a count of how many were missed.
 *
 * Claims under attack: UI-005, A11Y-002.
 */

import { expect, test } from "@playwright/test";
import { MDY_POPUP_OPENERS, MDY_WIDGET_CONTRACTS } from "@modyra/widgets";

import { HOSTS } from "./bench";

type Api = Record<string, Record<string, (...args: never[]) => unknown>>;
type Contract = {
  parts: Record<string, { classes: string[] }>;
  capabilities?: { overlay?: boolean; overlayScrolls?: boolean };
};

const CONTRACTS = MDY_WIDGET_CONTRACTS as unknown as Record<string, Contract>;
const OVERLAY_KINDS = Object.keys(CONTRACTS).filter((kind) => CONTRACTS[kind].capabilities?.overlay === true);
const classOf = (kind: string, part: string) => (CONTRACTS[kind].parts[part]?.classes ?? [])[0];

/** Well past any panel's height, so a list that can scroll has to. */
const MANY = Array.from({ length: 60 }, (_, index) => ({ value: `v${index}`, label: `Opzione ${index}` }));

for (const host of HOSTS) {
  test(`a panel scrolls inside itself when its kind says it does, ${host.name}`, async ({ page }) => {
    test.setTimeout(300_000);
    await page.setViewportSize({ width: 1_200, height: 700 });
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    expect(OVERLAY_KINDS.length, "no kind declares an overlay").toBeGreaterThan(1);

    const disagreeing: string[] = [];
    const platformOwned: string[] = [];
    const neverOpened: string[] = [];

    for (const kind of OVERLAY_KINDS) {
      const declared = CONTRACTS[kind].capabilities?.overlayScrolls === true;
      const opener = (MDY_POPUP_OPENERS as Record<string, { opener?: string } | undefined>)[kind]?.opener;
      const openerClass = opener === undefined ? undefined : classOf(kind, opener);
      if (openerClass === undefined) { neverOpened.push(`${kind} (no opener declared)`); continue; }

      const id = `scroll_${kind}`;
      await page.evaluate(({ api, mountId, k, options }) => {
        const field: Record<string, unknown> = { name: "f", kind: k, label: "L" };
        if (/select/.test(k)) field.options = options;
        (window as never as Api)[api].mountFields(mountId, [field] as never);
      }, { api: host.api, mountId: id, k: kind, options: MANY });
      await page.locator(`[data-form="${id}"]`).waitFor({ timeout: 5_000 });
      await page.waitForTimeout(200);

      await page.locator(`[data-form="${id}"] .${openerClass}`).first().click({ timeout: 5_000 }).catch(() => undefined);
      await page.waitForTimeout(400);

      const seen = await page.evaluate(({ popupClass, mountId }) => {
        const panel = (Array.from(document.querySelectorAll(`.${popupClass}`)) as HTMLElement[])
          .find((one) => one.getBoundingClientRect().width >= 1);
        if (panel === undefined) {
          const root = document.querySelector(`[data-form="${mountId}"]`);
          return { open: false, expanded: root?.querySelector("[aria-expanded]")?.getAttribute("aria-expanded") ?? "(none)", scrollers: 0, which: [] as string[] };
        }
        // Anything inside the panel, the panel included, that both may scroll and has somewhere to
        // scroll to. Which element carries it is the renderer's to choose.
        const inside = [panel, ...Array.from(panel.querySelectorAll("*")) as HTMLElement[]];
        const scrollers = inside.filter((one) => {
          const style = getComputedStyle(one);
          return /auto|scroll/.test(style.overflowY) && one.scrollHeight > one.clientHeight + 2;
        });
        return { open: true, expanded: "true", scrollers: scrollers.length,
                 which: scrollers.slice(0, 2).map((one) => (one.className || "").toString().split(" ")[0]) };
      }, { popupClass: classOf(kind, "popup") ?? "mdy-popup", mountId: id });

      await page.evaluate(({ api, mountId }) => {
        try { (window as never as Api)[api].dispose?.(mountId as never); } catch { /* nothing mounted */ }
      }, { api: host.api, mountId: id });

      if (!seen.open) {
        (seen.expanded === "(none)" ? platformOwned : neverOpened).push(kind);
        continue;
      }

      const scrolls = seen.scrollers > 0;
      if (scrolls !== declared) {
        disagreeing.push(declared
          ? `${kind} declares its panel scrolls and nothing inside it does, with ${MANY.length} options`
          : `${kind} declares its panel does not scroll and ${JSON.stringify(seen.which)} does`);
      }
    }

    expect(
      neverOpened,
      `${host.name} could not open ${JSON.stringify(neverOpened)}, which declare an overlay of their `
      + `own. It excused ${JSON.stringify(platformOwned)}, whose list belongs to the platform. A kind `
      + "that does not open is a kind this run never asked, and the assertion below would be silent "
      + "about it while reading green.",
    ).toEqual([]);

    expect(
      disagreeing,
      `${host.name}: ${JSON.stringify(disagreeing)}. A list of sixty has to stop growing and start `
      + "scrolling or its last option is below the window and cannot be reached; a calendar has a "
      + "size of its own and scrolling inside it would cut a month in half. The catalogue says which "
      + "a kind is, and a renderer that answers the same way for both has not read it — it has picked "
      + "one and been right about some of the kinds.",
    ).toEqual([]);
  });
}
