/**
 * What the user is left looking at when a control gives up mid-write.
 *
 * The engine takes a value of the wrong shape and reports it: the model holds it, the field is
 * invalid, `canSubmit` is false. That is the documented layering — a wrong shape is a verdict rather
 * than a refused write, and the draft gate is built on top of it.
 *
 * The verdict only reaches anyone if the control is still drawing when it arrives. These two throw
 * on the way, and the state the page keeps is the one from before the write: a field wearing
 * `aria-invalid="false"` with an empty error region, on a form whose submit does nothing. The user
 * has nothing to read and nothing to fix.
 *
 * Each assertion carries its own control, because "the field says nothing" and "the field cannot say
 * anything" look identical from outside: the same field, required and empty, must mark itself and
 * name the problem. And the file field is asked of both renderers, because one of them already
 * survives the value the other does not.
 *
 * Reduced to a published function in
 * `adversarial/widgets/a-value-the-model-was-allowed-to-hold.battle.test.mjs`; this is the
 * consequence.
 */

import { expect, test } from "@playwright/test";

const HOSTS = [
  { name: "plain", page: "/index.html", ready: "battleReady", api: "battle" },
  { name: "lit", page: "/lit.html", ready: "battleLitReady", api: "battleLit" },
] as const;

type Api = Record<string, {
  mountFields(id: string, fields: unknown[]): unknown;
  setValue(id: string, patch: unknown): void;
  submit(id: string): unknown;
  canSubmitOf(id: string): boolean;
  dispose(id: string): void;
}>;

/** What the page says about one field, read the way a user would have to find it. */
async function verdictOn(page: import("@playwright/test").Page, id: string) {
  return page.evaluate((formId) => {
    const root = document.querySelector(`[data-form="${formId}"]`);
    return {
      marked: Array.from(root?.querySelectorAll('[aria-invalid="true"]') ?? []).length > 0,
      message: (root?.querySelector('[id$="__errors"]')?.textContent ?? "").trim() || null,
    };
  }, id);
}

for (const host of HOSTS) {
  for (const [kind, wrong] of [["multiselect", "not a list"], ["file", "a name"]] as const) {
    test(`a ${kind} handed a value the model reports, ${host.name}`, async ({ page }) => {
      test.setTimeout(180_000);

      const broke: string[] = [];
      page.on("pageerror", (error) => broke.push(String(error.message)));
      page.on("console", (message) => {
        if (message.type() === "error") broke.push(message.text().replace(/\s+/g, " "));
      });

      await page.goto(host.page);
      await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

      const mount = (id: string, validators: unknown) => page.evaluate(({ api, k, formId, rules }) => {
        (window as never as Api)[api].mountFields(formId, [{
          name: "x", kind: k, label: "X", validators: rules,
          options: [{ value: "a", label: "A" }, { value: "b", label: "B" }],
        }]);
      }, { api: host.api, k: kind, formId: id, rules: validators });

      // The control: the same field, with nothing wrong except that it is empty and required. A
      // field that cannot report anything at all would fail here, and the measurement below would
      // mean nothing.
      await mount("able", { required: true });
      await page.waitForTimeout(280);
      await page.evaluate(({ api }) => (window as never as Api)[api].submit("able"), { api: host.api });
      await page.waitForTimeout(360);

      const able = await verdictOn(page, "able");
      expect(able.marked, `a ${kind} could not mark itself wrong at all, so nothing below is a measurement`).toBe(true);
      expect(able.message, `a ${kind} showed no message for a rule it does enforce`).not.toBeNull();
      await page.evaluate(({ api }) => (window as never as Api)[api].dispose("able"), { api: host.api });

      // And now the value the engine takes, holds, and refuses to submit.
      await mount("given", {});
      await page.waitForTimeout(280);
      broke.length = 0;
      await page.evaluate(({ api, v }) => (window as never as Api)[api].setValue("given", { x: v }), { api: host.api, v: wrong });
      await page.waitForTimeout(400);
      await page.evaluate(({ api }) => (window as never as Api)[api].submit("given"), { api: host.api });
      await page.waitForTimeout(400);

      const canSubmit = await page.evaluate(({ api }) => (window as never as Api)[api].canSubmitOf("given"), { api: host.api });
      const given = await verdictOn(page, "given");

      // The premise: the form is holding the value and refusing to send it. Without that, there is
      // no verdict for the page to be failing to show.
      expect(canSubmit, `the form accepted a ${kind} holding ${JSON.stringify(wrong)}, so there is no verdict to show`).toBe(false);

      expect(
        broke,
        `drawing a ${kind} holding a value the form itself reports took the control out`,
      ).toEqual([]);

      expect(
        given.marked || given.message !== null,
        `a ${kind} the form will not send says nothing: not marked, no message, and the same field marks itself for a rule it does enforce`,
      ).toBe(true);
    });
  }
}
