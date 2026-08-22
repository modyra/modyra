/**
 * A control on the screen for a field the form decided not to have.
 *
 * A field list with two entries of one name is a mistake a consumer makes by hand — a copied block, a
 * generated list, a name typed twice — and the contract's stance on it is not in doubt:
 * `parseDynamicFields` drops the duplicate with a diagnostic, and one renderer refuses the whole mount
 * by name:
 *
 *     [modyra] Duplicate field name "x": every field needs its own identity.
 *
 * The other notices it too — it says `Dropped duplicate dynamic field name "x"` — and then draws a
 * control for the entry it dropped. The model has one `x`; the page has two boxes labelled for two
 * different fields, and the second one writes into the first.
 *
 * Typing `42` into the box labelled "Second", a number field, leaves the text field `x` holding the
 * number 42 and the user's own text gone. Nothing on the page says which of the two boxes owns the
 * value, because the answer is that one of them should not be there.
 *
 * What is asserted is the part both renderers can agree on without deciding whose policy wins: **no
 * control writes into a field it was not declared for.** Refusing the mount satisfies it; rendering
 * one control satisfies it; rendering two and binding both does not.
 *
 * Claims under attack: SUB-001, COL-002.
 */

import { expect, test } from "@playwright/test";

// **Every renderer, from the shared list.** The local list this replaced was not a scope
// decision: the angular host published six of the twenty-two doors these specs need, so a
// spec wanting one it lacked left the renderer out and the next reader copied the list.
import { HOSTS } from "./bench";

type Api = Record<string, {
  mountFields(id: string, fields: unknown[]): { mounted: boolean; message?: string };
  setValue(id: string, patch: unknown): void;
  valueOf(id: string): Record<string, unknown>;
}>;

const DUPLICATED = [
  { name: "x", kind: "text", label: "First" },
  { name: "x", kind: "number", label: "Second" },
  { name: "y", kind: "text", label: "Other" },
];

for (const host of HOSTS) {
  test(`a control for a field that was dropped, ${host.name}`, async ({ page }) => {
    test.setTimeout(180_000);

    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    const mounted = await page.evaluate(({ api, fields }) =>
      (window as never as Api)[api].mountFields("d", fields), { api: host.api, fields: DUPLICATED });
    await page.waitForTimeout(320);

    // Refusing the whole mount is one of the two ways to be right, and it ends the test.
    if (mounted.mounted === false) {
      expect(mounted.message, "the mount was refused without saying why").toContain("Duplicate field name");
      return;
    }

    // Otherwise the form exists, and the user types into the field that survived.
    await page.evaluate(({ api }) => (window as never as Api)[api].setValue("d", { x: "what the user typed" }), { api: host.api });
    await page.waitForTimeout(260);

    const before = await page.evaluate(({ api }) => (window as never as Api)[api].valueOf("d").x, { api: host.api });
    expect(before, "the surviving field did not take the value, so nothing below is a measurement").toBe("what the user typed");

    // And types into the control drawn for the entry the form dropped.
    const orphan = page.locator('[data-form="d"] input[type="number"]').first();
    const drawn = await orphan.count();
    if (drawn > 0) {
      await orphan.fill("42");
      await page.waitForTimeout(260);
    }

    const after = await page.evaluate(({ api }) => (window as never as Api)[api].valueOf("d").x, { api: host.api });

    expect(
      after,
      `a control drawn for a dropped entry wrote ${JSON.stringify(after)} into the field that survived, over the user's own ${JSON.stringify(before)}`,
    ).toBe(before);
  });
}
