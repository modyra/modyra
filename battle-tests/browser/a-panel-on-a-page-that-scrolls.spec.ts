/**
 * A panel opened near the foot of a long page lands against its control.
 *
 * Every other fixture in this suite mounts one field at the top of an empty page. There the control
 * is already in view and nothing has scrolled, so a panel positioned against the wrong origin lands
 * where it should by arithmetic accident: the mistake is worth zero pixels and no assertion can see
 * it. A page a consumer writes stacks fields, and the first panel opened near its foot is where the
 * error finally costs something.
 *
 * The Vue demo showed exactly that — four kinds opening their panel between 490 and 3246 pixels above
 * the window — while the browser tier, driving the same renderers, reported nothing. The suite was not
 * disagreeing; it was measuring a page nobody writes.
 *
 * **The premise is asserted before the measurement**: the control must be in view after scrolling, or
 * what follows describes the scroll position rather than the anchoring.
 *
 * The criterion is what a person meets: the panel is **inside the window**, and it **hangs off its
 * control** rather than landing somewhere else on the page. Where a renderer flips the panel above,
 * that is still hanging off it — the check accepts either side and refuses only distance.
 *
 * Claims under attack: UI-001, ADP-001.
 */
import { expect, test } from "@playwright/test";
import { MDY_POPUP_OPENERS, MDY_WIDGET_CONTRACTS } from "@modyra/widgets";
import { HOSTS, farDownThePage } from "./bench";

const partSelector = (kind: string, part: string) =>
  ((MDY_WIDGET_CONTRACTS as never as Record<string, { parts: Record<string, { classes?: readonly string[] }> }>)[kind]
    ?.parts[part]?.classes ?? []).map((c) => `.${c}`).join("");

const EXTRA: Record<string, Record<string, unknown>> = {
  select: { options: [{ value: "a", label: "A" }] },
  multiselect: { options: [{ value: "a", label: "A" }] },
};

/** How far a panel may sit from the control it hangs off, in either direction. */
const REACH = 240;

for (const host of HOSTS) {
  for (const [kind, opener] of Object.entries(MDY_POPUP_OPENERS as never as Record<string, { opener: string; controls: string; alsoOpensFrom?: string }>)) {
    test(`a panel opened far down the page lands against its control, ${kind}, ${host.name}`, async ({ page }) => {
      test.setTimeout(90_000);
      await page.goto(host.page);
      await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);
      await page.evaluate(({ api, kind, extra }) => {
        (window as never as Record<string, { mountFields(i: string, f: unknown[]): unknown }>)[api]
          .mountFields("deep", [{ name: "f", kind, label: "F", ...extra }] as never);
      }, { api: host.api, kind, extra: EXTRA[kind] ?? {} });
      await page.waitForTimeout(300);

      const root = '[data-form="deep"]';
      await farDownThePage(page, root);

      const panel = partSelector(kind, opener.controls);
      test.skip(panel === "", `the contract gives ${kind} no class for its ${opener.controls}`);

      for (const part of [opener.opener, opener.alsoOpensFrom].filter(Boolean) as string[]) {
        const door = partSelector(kind, part);
        if (door === "") continue;
        await page.locator(root).locator(door).first().click({ timeout: 2_500 }).catch(() => {});
        await page.waitForTimeout(350);
        if (await page.locator(panel).first().isVisible({ timeout: 300 }).catch(() => false)) break;
      }

      const opened = await page.locator(panel).first().isVisible({ timeout: 500 }).catch(() => false);
      // A panel that never opened cannot be mispositioned, and calling that a pass would report the
      // silence as anchoring. It is a skip with its reason, not a green.
      test.skip(!opened, `${host.name} did not open ${kind} from any door the contract names`);

      const placed = await page.evaluate(({ panel, root }) => {
        const p = [...document.querySelectorAll(panel)].find((n) => n.getClientRects().length > 0);
        const control = document.querySelector(root);
        if (p === undefined || control === null) return null;
        const a = p.getBoundingClientRect();
        const c = control.getBoundingClientRect();
        return {
          insideWindow: a.top >= 0 && a.left >= 0 && a.bottom <= window.innerHeight && a.right <= window.innerWidth,
          below: Math.round(a.top - c.bottom),
          above: Math.round(c.top - a.bottom),
          sideways: Math.round(Math.min(Math.abs(a.left - c.left), Math.abs(a.right - c.right))),
        };
      }, { panel, root });

      expect(placed, "the panel was open and then could not be measured").not.toBeNull();
      const hangs = Math.min(Math.abs(placed!.below), Math.abs(placed!.above));
      expect(
        placed!.insideWindow,
        `${host.name}: the ${kind} panel opened outside the window — ${hangs}px from its control`,
      ).toBe(true);
      expect(
        hangs,
        `${host.name}: the ${kind} panel is ${hangs}px from the control it opened from, which is not hanging off it`,
      ).toBeLessThanOrEqual(REACH);
    });
  }
}
