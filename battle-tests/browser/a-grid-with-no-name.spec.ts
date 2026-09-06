/**
 * The roles the package says must be named, and the ones that are not.
 *
 * `MDY_SEMANTICS_REQUIRING_NAME` publishes three: `listbox`, `dialog`, `grid`. A role on that list
 * with no accessible name is announced by what it is and not by what it holds — "grid" and nothing
 * else — which for a calendar is the difference between knowing you are in a date picker and knowing
 * you are somewhere.
 *
 * One battle cited the table before this and none checked a page against it.
 *
 * Each openable kind is mounted alone, opened, read, and then disposed of before the next: the popups
 * of some kinds live outside the field and some renderers leave them in the document, so a role found
 * after two mounts belongs to neither of them in particular. A first pass without the disposal counted
 * seven roles by the sixth kind and could not say whose they were.
 *
 * A name is `aria-label` with something in it, or `aria-labelledby` pointing at an element that has
 * text. Pointing at an empty element is not a name, which is why the target's text is read rather
 * than its existence.
 *
 * Claims under attack: A11Y-004.
 */

import { expect, test } from "@playwright/test";
import { MDY_SEMANTICS_REQUIRING_NAME } from "@modyra/widgets";

// **Every renderer, from the shared list.** This file kept one of its own with plain and lit
// in it. That was never a scope decision: the angular host published six of the twenty-two
// doors these specs need, so a spec that wanted one it lacked left the renderer out, and the
// next reader copied the list. Sixty-eight files came to exclude it that way. The doors are
// open now.
import { HOSTS, announcedName } from "./bench";

const OPENABLE = ["select", "multiselect", "datepicker", "daterange", "timepicker", "colors"];

for (const host of HOSTS) {
  test(`${host.name}: a role that must be named has a name`, async ({ page }) => {
    test.setTimeout(180_000);
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    // The premise: the table still names roles for this spec to look for.
    expect(MDY_SEMANTICS_REQUIRING_NAME.length, JSON.stringify(MDY_SEMANTICS_REQUIRING_NAME)).toBeGreaterThan(0);

    const nameless: Array<Record<string, unknown>> = [];
    let named = 0;
    // Counted rather than ignored: a suite that silently skips what it cannot read looks like one
    // that found nothing wrong, and the number is how a reader tells those apart.
    let unexposed = 0;

    for (const kind of OPENABLE) {
      const id = `n-${kind}`;
      await page.evaluate(
        ({ mountId, k, api }) => {
          const field: Record<string, unknown> = { name: "f", kind: k, label: "L" };
          if (/select/.test(k)) field.options = [{ value: "a", label: "A" }, { value: "b", label: "B" }];
          (window as never as Record<string, { mountFields(id: string, f: unknown[]): unknown }>)[api]
            .mountFields(mountId, [field]);
        },
        { mountId: id, k: kind, api: host.api },
      );
      await page.waitForTimeout(140);

      const toggle = page.locator(`[data-form="${id}"] button`).first();
      if (await toggle.count() > 0) await toggle.click({ timeout: 2000 }).catch(() => undefined);
      await page.waitForTimeout(250);

      // **The announced name, not the attributes that were meant to produce it.** This file used to
      // rebuild the naming algorithm here — `aria-label` if non-empty, else `aria-labelledby`
      // pointing at something with text — and that copy was wrong in both directions at once. It
      // missed every name that comes from an element's own text or a wrapping caption, so a
      // correctly named control read as nameless; and it counted an `aria-label` written on a role
      // that forbids naming, which the platform drops, so a control with no name at all read as
      // named. A reader that can err both ways cannot be corrected by adjusting it in one.
      //
      // A popup may live outside the field it belongs to, so the whole document is read.
      // **Three outcomes, not two.** A role can be named, unnamed, or absent from the accessibility
      // tree entirely — a datepicker keeps its month and year grids in the document with
      // `display:none` while the days grid is showing. Folding the third into "unnamed" reports
      // three grids where a person meets one, and sends a repair to a control that is behaving.
      // The reader refuses the third rather than answering it, so it is counted here by name.
      const found: Array<{ role: string; named: boolean; name: string | null }> = [];
      for (const role of MDY_SEMANTICS_REQUIRING_NAME) {
        const nodes = page.locator(`[role="${role}"]`);
        for (let at = 0, total = await nodes.count(); at < total; at += 1) {
          try {
            const name = await announcedName(nodes.nth(at));
            found.push({ role, named: name !== null && name.trim() !== "", name });
          } catch {
            unexposed += 1;
          }
        }
      }

      for (const each of found) {
        if (each.named) named += 1;
        else nameless.push({ kind, ...each });
      }

      await page.keyboard.press("Escape");
      await page.waitForTimeout(110);
      await page.evaluate(
        ({ mountId, api }) => {
          (window as never as Record<string, { dispose?: (id: string) => void }>)[api].dispose?.(mountId);
        },
        { mountId: id, api: host.api },
      );
      await page.waitForTimeout(120);

      // The disposal has to have worked, or the next kind inherits this one's roles.
      const left = await page.evaluate(
        (roles) => roles.reduce((total, role) => total + document.querySelectorAll(`[role="${role}"]`).length, 0),
        MDY_SEMANTICS_REQUIRING_NAME,
      );
      expect(left, `${kind} left roles in the document, so a later kind would inherit them`).toBe(0);
    }

    // The control: this renderer does name some of them, so a nameless one is that widget rather
    // than a page where nothing is named.
    expect(named, JSON.stringify({ named, nameless })).toBeGreaterThan(0);

    expect(nameless, JSON.stringify({ nameless, unexposed }, null, 1)).toEqual([]);
  });
}
