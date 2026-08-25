/**
 * A number the user deleted, and a zero on its way to the server.
 *
 * `MDY_VALUE_CONTRACTS.number` is `{ shape: "number", nullable: true }`: empty is a value a number
 * field may hold, and it is what an untouched one starts as. Both renderers agree on that, and both
 * take a typed 7.
 *
 * They part when the user deletes it. One puts the field back to empty. The other writes **zero** —
 * into the box, into the model, and into what is sent:
 *
 *     typed 7, then cleared      →  { "qty": 0 }
 *
 * For a quantity that is an order line of none; for a price it is free; for a discount it is a
 * hundred per cent of nothing. The user deleted a number and the form supplied one, and the box shows
 * it, so noticing means reading a field you have just emptied.
 *
 * The severity model has a phrase for this exactly — *a renderer invents submitted data* — and the
 * other renderer is the proof that inventing is a choice: the same clearing on the same kind leaves
 * `null` there.
 *
 * Claims under attack: SUB-001, UI-006.
 */

import { expect, test } from "@playwright/test";

import { MDY_VALUE_CONTRACTS } from "@modyra/core";

// **Every renderer, from the shared list.** The local list this replaced was not a scope
// decision: the angular host published six of the twenty-two doors these specs need, so a
// spec wanting one it lacked left the renderer out and the next reader copied the list.
import { HOSTS , SETTLES} from "./bench";

type Api = Record<string, {
  mountFields(id: string, fields: unknown[]): unknown;
  valueOf(id: string): Record<string, unknown>;
  submit(id: string): unknown;
  submittedBy(id: string): Array<Record<string, unknown>>;
}>;

for (const host of HOSTS) {
  test(`a quantity nobody asked for, ${host.name}`, async ({ page }) => {
    test.setTimeout(180_000);

    // The premise, read from the contract: empty is something a number field may hold.
    expect(MDY_VALUE_CONTRACTS.number.nullable, "a number field may no longer be empty, so this spec is asking for the wrong thing").toBe(true);

    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);
    await page.evaluate(({ api }) => {
      (window as never as Api)[api].mountFields("n", [{ name: "qty", kind: "number", label: "Quantity" }]);
    }, { api: host.api });
    await page.waitForTimeout(300);

    const box = page.locator('[data-form="n"] input').first();
    const held = () => page.evaluate(({ api }) => (window as never as Api)[api].valueOf("n").qty, { api: host.api });

    // Two controls: an untouched field is empty, and a typed number is that number. Without them, a
    // renderer that always said zero and one that always said null would be indistinguishable here.
    expect(await held(), "an untouched number field does not start empty").toBeNull();
    await box.fill("7");
    await expect.poll(() => held(), { message: "a number field did not take a number", ...SETTLES }).toBe(7);

    // And what the user does when they change their mind.
    await box.fill("");
    await page.waitForTimeout(260);

    const afterClearing = await held();
    const shown = await box.inputValue();

    await page.evaluate(({ api }) => (window as never as Api)[api].submit("n"), { api: host.api });
    await page.waitForTimeout(320);
    const sent = await page.evaluate(({ api }) => (window as never as Api)[api].submittedBy("n").at(-1) ?? {}, { api: host.api });

    expect(
      afterClearing,
      `the user cleared the box and the form holds ${JSON.stringify(afterClearing)}, the box shows ${JSON.stringify(shown)}, and it sent ${JSON.stringify(sent)}`,
    ).toBeNull();
  });
}
