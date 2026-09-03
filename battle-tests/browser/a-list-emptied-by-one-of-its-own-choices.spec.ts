/**
 * A select with nothing in it, because of what one of its choices is called.
 *
 * An option's value is whatever the option list holds, and a document is where option lists come
 * from — a CMS, a model, a saved project, a POST. `adversarial/security/a-choice-named-like-a-prototype.battle.test.mjs`
 * establishes the premise: a well-formed list is kept whatever its values say, and only a malformed
 * one loses the field. So a list carrying the word `__proto__` is a list a renderer is asked to draw.
 *
 * One renderer draws it. The other renders **no options at all** and its effect stops running, which
 * means the control keeps whatever it was showing before and stops answering. A user looking at that
 * select sees a field with nothing to choose and no reason given.
 *
 * The reduction matters as much as the failure: `constructor`, `prototype`, `toString` and `valueOf`
 * are all fine. It is one word, and it is the one that means something to an object used as a
 * lookup — `packages/plain/src/fields/select-field.ts:307` reads `view.parts[key]` with the option's
 * key, and `defaultOptionKey("__proto__")` is `"__proto__"`.
 *
 * Every case carries the same list with an ordinary value in place of the word, because a probe that
 * cannot open a popup and a renderer that draws nothing look identical from outside.
 *
 * Claims under attack: SEC-001, UI-003.
 */

import { expect, test } from "@playwright/test";

// **Every renderer, from the shared list.** The local list this replaced was not a scope
// decision: the angular host published six of the twenty-two doors these specs need, so a
// spec wanting one it lacked left the renderer out and the next reader copied the list.
import { HOSTS } from "./bench";

type Api = Record<string, { mountFields(id: string, fields: unknown[]): unknown }>;

/**
 * Words every plain object answers to.
 *
 * The one that fails is last on purpose: the four before it are the reduction, and a run that stops
 * at the first word never establishes that the other four are fine.
 */
const INHERITED = ["constructor", "prototype", "toString", "valueOf", "__proto__"] as const;

async function mountWith(
  page: import("@playwright/test").Page,
  host: (typeof HOSTS)[number],
  kind: string,
  first: string,
  id: string,
) {
  await page.evaluate(({ api, k, value, formId }) => {
    (window as never as Api)[api].mountFields(formId, [{
      name: "x", kind: k, label: "X",
      options: [{ value, label: "First" }, { value: "a", label: "Alpha" }],
    }]);
  }, { api: host.api, k: kind, value: first, formId: id });
  await page.waitForTimeout(300);
  const trigger = page.locator(`[data-form="${id}"] button, [data-form="${id}"] [role="combobox"]`).first();
  if (await trigger.count() > 0) {
    await trigger.click({ timeout: 4000 }).catch(() => {
      // A kind without this control has nothing to press. The read below reports what is on the
      // page, so a press that finds nothing leaves the finding to it.
    });
    await page.waitForTimeout(300);
  }
  // Options may be portalled outside the form, so the read is not scoped to it — which is why each
  // mount uses its own page rather than its own id: a second form leaves the first one's options in
  // the document and every list afterwards reads as twice as long.
  return page.evaluate(() =>
    Array.from(document.querySelectorAll('[role="option"], option')).map((each) => (each.textContent ?? "").trim()));
}

for (const host of HOSTS) {
  for (const kind of ["select", "multiselect"]) {
    test(`a ${kind} whose option list carries an inherited name, ${host.name}`, async ({ page }) => {
      test.setTimeout(240_000);

      const broke: string[] = [];
      page.on("pageerror", (error) => broke.push(String(error.message)));
      page.on("console", (message) => {
        if (message.type() === "error") broke.push(message.text().replace(/\s+/g, " "));
      });

      await page.goto(host.page);
      await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

      // The control: the same list, one ordinary value. Whatever this renderer shows here is what it
      // is able to show, and the assertions below are measured against it rather than against an
      // expectation this suite invented.
      const ordinary = await mountWith(page, host, kind, "z", "control");
      expect(broke, `a ${kind} with an ordinary option list broke, so nothing below is a measurement`).toEqual([]);

      for (const word of INHERITED) {
        // A fresh page each time: the previous mount's options are portalled into the document and
        // would be counted again.
        await page.goto(host.page);
        await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);
        broke.length = 0;
        const shown = await mountWith(page, host, kind, word, "p");

        expect(
          broke,
          `drawing a ${kind} whose option list carries ${JSON.stringify(word)} took the control out`,
        ).toEqual([]);

        expect(
          shown,
          `a ${kind} offering ${JSON.stringify(word)} shows ${JSON.stringify(shown)} where the same list with an ordinary value shows ${JSON.stringify(ordinary)}`,
        ).toEqual(ordinary);
      }
    });
  }
}
