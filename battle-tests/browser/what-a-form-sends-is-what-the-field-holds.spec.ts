/**
 * Whether what a form sends for a field is what that field holds.
 *
 * A control that carries a value has two audiences that never meet: the application, which asks the
 * field what it holds, and the server, which receives whatever the browser puts in the request. In
 * almost every control those are the same string and nobody has occasion to notice that they are two
 * facts. Where they part company, only one of them is ever read at a time — the application looks
 * healthy in the browser, and the wrong thing arrives on the other side.
 *
 * **A date is where they part.** A field can hold `2026-01-02` and send `01/02/2026`, which is the
 * text a person reads rather than the value the model keeps. Nothing on the page is wrong: the box
 * shows the right day, the field returns the right value to anyone who asks it, and the form posts a
 * date a receiver has to guess the format of — and guess it differently depending on whose browser
 * filled it in, because that text follows the reader's own conventions and the value does not.
 *
 * **It is silent in the direction that matters.** A receiver given `01/02/2026` cannot tell the second
 * of January from the first of February, and neither can anything on the sending side, because the
 * sending side is looking at a field that holds the right answer.
 *
 * **The check is agreement, not format.** This file does not say which spelling a date should travel
 * in — that is a decision, and one worth making once. It says that the two answers a control gives
 * about itself are one answer, whichever it is. A renderer that sent the displayed text *and* returned
 * the displayed text would satisfy this, and would be a different discussion.
 *
 * **The other kinds are the control.** A number and a time travel in the same submission, from the
 * same form, through the same mechanism. If they agree and one kind does not, the mechanism works and
 * the disagreement belongs to that kind; if none of them agree, this file is measuring the way it
 * builds the submission rather than anything about the controls.
 *
 * **On building the form.** Where the bench does not already put the controls inside one, this wraps
 * them in a form of its own — which is what a consuming page does, and which changes no control's own
 * name or value. What a browser sends comes from the controls; the element around them decides only
 * when.
 *
 * Claims under attack: UI-005, A11Y-004.
 */

import { expect, test } from "@playwright/test";

import { HOSTS } from "./bench";

type Api = Record<string, Record<string, (...args: never[]) => unknown>>;

/** One kind under test and two beside it that travel the same way, as the control. */
const FIELDS = [
  { name: "d", kind: "datepicker", label: "Data", initialValue: "2026-01-02" },
  { name: "t", kind: "timepicker", label: "Ora", initialValue: "09:30" },
  { name: "n", kind: "number", label: "Numero", initialValue: 7 },
] as const;

for (const host of HOSTS) {
  test(`a form sends the value each field holds, ${host.name}`, async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 1_200, height: 700 });
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    await page.evaluate(({ api, fields }) => {
      (window as never as Api)[api].mountFields("sends", fields as never);
    }, { api: host.api, fields: FIELDS.map((one) => ({ ...one })) });
    await page.locator('[data-form="sends"]').waitFor({ timeout: 5_000 });
    await page.evaluate(({ api }) => (window as never as Api)[api].settle?.(), { api: host.api }).catch(() => undefined);
    await page.waitForTimeout(500);

    const sent = await page.evaluate(() => {
      const root = document.querySelector('[data-form="sends"]');
      if (root === null) return null;
      let owner = root.closest("form") ?? root.querySelector("form");
      if (owner === null) {
        const made = document.createElement("form");
        root.parentNode?.insertBefore(made, root);
        made.appendChild(root);
        owner = made;
      }
      const out: Record<string, string> = {};
      for (const [key, value] of new FormData(owner as HTMLFormElement).entries()) {
        out[key] = String(value);
      }
      return out;
    });
    expect(sent, `${host.name} drew nothing to submit`).not.toBeNull();

    const held = await page.evaluate(({ api }) =>
      ((window as never as Api)[api].valueOf as unknown as (one: string) => Record<string, unknown>)("sends"),
      { api: host.api });

    // The premise: the submission carried these fields at all. A form that sends nothing agrees with
    // nothing, and would satisfy every comparison below by having no answers to compare.
    const missing = FIELDS.map((one) => one.name).filter((name) => !(name in sent!));
    expect(
      missing,
      `${host.name}: the submission carries nothing for ${missing.join(", ")}, so there is no second `
      + `answer to compare against what the field holds. It sent ${JSON.stringify(sent)}`,
    ).toEqual([]);

    const disagreeing = FIELDS
      .map((one) => ({ name: one.name, kind: one.kind, sent: sent![one.name], held: String(held?.[one.name] ?? "") }))
      .filter((one) => one.sent !== one.held);

    expect(
      disagreeing.map((one) => `${one.kind} sends "${one.sent}" and holds "${one.held}"`),
      `${host.name}: a control gives two different answers about itself in the same moment — the `
      + "application asks it and gets one, the browser posts the other. Nothing on the page looks "
      + "wrong: the box shows the right thing and the field returns the right value to anyone who "
      + "asks. What arrives on the other side is text a receiver has to guess the format of, and "
      + "guess differently depending on whose browser filled the form in. The other kinds in this "
      + "same submission agree, so the mechanism carrying them is not what differs.",
    ).toEqual([]);
  });
}
