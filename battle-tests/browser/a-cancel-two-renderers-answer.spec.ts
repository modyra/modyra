/**
 * Pressing Cancel returns the field to what it held, whichever renderer drew it.
 *
 * A `<form>` with a `type="reset"` button is the oldest undo on the web, and a person who presses it
 * expects every field inside to go back to how it arrived. [ADR
 * 0149](../../docs/architecture/0149-answer-a-form-reset.md) makes the widgets answer it: a browser's
 * reset restores a control to its `value` **attribute**, which these renderers never write — they
 * write the property — so without the binding the box empties and the model does not know.
 *
 * This asks the question from the consumer's side, and about **all three renderers at once**, because
 * that is where they stop agreeing.
 *
 * Measured, with a `<form>` that exists **before** the field is mounted into it:
 *
 *     plain      model and boxes return to their initial values
 *     lit        model and boxes return
 *     angular    nothing returns — model, boxes and chips all keep the changed values
 *
 * **Angular renders a `<form>` of its own**, so a consumer's form contains it, and a reset on the
 * outer one never reaches the controls in the inner. ADR 0149 records that as a consequence and leaves
 * the semantics open, which is honest — but the consequence is not symmetric. **The same document, the
 * same gesture, and two renderers undo while the third does nothing.**
 *
 * That asymmetry is what this file is about rather than the reset itself. Which semantics a consumer
 * wants is a decision; that a contract's three implementations answer differently is not.
 *
 * ## The fixture, and why it is built this way
 *
 * **Both arrangements are asserted, and the second one used to be a mistake.**
 *
 * A field can be mounted *into* a form that already exists, or mounted elsewhere and moved in. The
 * first is what a consumer does; the second is what this file did by accident, and it measured
 * something real: a binding resolved once, at bind time, answers the form that was there then. lit
 * re-bound when reconnected and plain never did, so the two disagreed about a page a consumer rarely
 * builds.
 *
 * That is repaired — the binding now asks, at the moment of the event, whether the resetting form
 * *contains* the element, so the form is resolved every time rather than once. Which means the two
 * arrangements are no longer different questions, and the way to keep them that way is to ask both.
 *
 * A fixture that rearranges the page is normally asking about the rearrangement. Here it is asking
 * whether rearranging still matters, and the answer must be no.
 *
 * The model and what is drawn are read **together**, because the defect ADR 0149 repaired was exactly
 * the two disagreeing — a box that looks empty over a model that still holds the old value. Either
 * one alone reports half of it.
 *
 * Claims under attack: ADP-001, API-001.
 */

import { expect, test } from "@playwright/test";

import { HOSTS } from "./bench";

type Api = Record<string, Record<string, (...args: never[]) => unknown>>;

/** The mounting point becomes a form, so what is mounted is built inside one. */
const formAroundTheStage = (page: import("@playwright/test").Page) =>
  page.evaluate(() => {
    const stage = document.querySelector("#stage");
    if (stage === null) throw new Error("[battle] no #stage to put a form around");
    const form = document.createElement("form");
    stage.append(form);
    stage.id = "stage-parked";
    form.id = "stage";
    const cancel = document.createElement("button");
    cancel.type = "reset";
    cancel.id = "cancel";
    cancel.textContent = "Annulla";
    form.appendChild(cancel);
  });

/**
 * How the field and the form come to be in the same page.
 *
 * `built-in` is what a consumer does: the form is there, the field is mounted into it. `moved-in` is
 * the arrangement this file once produced by accident — mounted elsewhere and moved in afterwards —
 * and it is asserted because a binding that resolved its form once would answer only the first.
 */
const ARRANGEMENTS = ["built-in", "moved-in"] as const;

for (const host of HOSTS) {
  for (const arrangement of ARRANGEMENTS) {
  test(`pressing Cancel returns the field to what it held, ${arrangement}, ${host.name}`, async ({ page }) => {
    await page.setViewportSize({ width: 1_200, height: 900 });
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);
    if (arrangement === "built-in") await formAroundTheStage(page);

    // A string-valued kind and a composite one, because the repair was measured on the first and the
    // second is where a renderer keeps a second copy of the value in what it draws.
    await page.evaluate(({ api }) => {
      (window as never as Api)[api].mountFields("cancel", [
        { name: "t", kind: "text", label: "Testo", initialValue: "Ada" },
        {
          name: "m", kind: "multiselect", label: "Scelte", mode: "multi", clearable: true,
          options: [{ value: "a", label: "Alfa" }, { value: "b", label: "Beta" }],
          initialValue: ["a"],
        },
        // Two more whose value is least like a string: a range is a pair and a colour is drawn as
        // well as typed. Both keep a second copy of the value in what they draw.
        { name: "dr", kind: "daterange", label: "Periodo", initialValue: { start: "2026-01-01", end: "2026-01-10" } },
        { name: "co", kind: "colors", label: "Colore", initialValue: "#112233" },
      ] as never);
    }, { api: host.api });
    await page.locator('[data-form="cancel"]').waitFor({ timeout: 5_000 });

    // The other arrangement: the field exists first and the form arrives around it. A binding that
    // asked "which form was here when I bound?" answers this one wrongly, and a binding that asks
    // "does the resetting form contain me?" cannot tell the two apart.
    if (arrangement === "moved-in") {
      // The premise of this arrangement: the field really was mounted outside a form. If a later
      // edit puts the form in place first, this case silently becomes a copy of the other one and
      // stops asking its own question — which is a green nobody would ever suspect.
      expect(
        await page.evaluate(() => document.querySelector('[data-form="cancel"]')?.closest("form") !== null),
        `${host.name}: the field was already inside a form before being moved into one, so this case `
        + "is measuring the same arrangement as the other and not the one it is named for",
      ).toBe(false);

      await formAroundTheStage(page);
      await page.evaluate(() => {
        const field = document.querySelector('[data-form="cancel"]');
        const form = document.querySelector("#stage");
        if (field !== null && form !== null) form.prepend(field);
      });
      await page.waitForTimeout(300);
    }
    await page.evaluate(({ api }) => (window as never as Api)[api].settle?.(), { api: host.api }).catch(() => undefined);
    await page.waitForTimeout(600);

    const read = () => page.evaluate(({ api }) => {
      const scope = document.querySelector('[data-form="cancel"]');
      return {
        model: JSON.stringify((window as never as Api)[api].valueOf("cancel" as never)),
        typed: (scope?.querySelector('input[type="text"], input:not([type])') as HTMLInputElement | null)?.value ?? null,
        chips: Array.from(scope?.querySelectorAll(".mdy-chip") ?? [])
          .map((chip) => (chip.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 10)),
        // Every box that shows a value, so a range's two halves and a colour's field are compared
        // as well as the model that holds them.
        boxes: Array.from(scope?.querySelectorAll("input") ?? [])
          .map((input) => (input as HTMLInputElement).value).filter((value) => value !== ""),
      };
    }, { api: host.api });

    const started = await read();

    // The premise: the field arrived holding what it was given. Everything below compares against
    // this reading, so a field that never took its initial value would make the comparison vacuous.
    expect(
      started.model,
      `${host.name} (${arrangement}) did not take the values it was given — it holds ${started.model}`,
    ).toContain('"Ada"');

    await page.evaluate(({ api }) => {
      ((window as never as Api)[api] as unknown as { setValue?: (id: string, v: unknown) => void })
        .setValue?.("cancel", {
          t: "Grace", m: ["a", "b"],
          dr: { start: "2026-06-06", end: "2026-06-20" }, co: "#ff0000",
        });
    }, { api: host.api }).catch(() => undefined);
    await page.waitForTimeout(500);

    const changed = await read();

    // And the second premise: something actually changed. A reset that restores nothing looks the
    // same as a field that never moved.
    expect(
      JSON.stringify(changed),
      `${host.name} (${arrangement}): the value did not change, so pressing Cancel cannot be shown to restore anything`,
    ).not.toEqual(JSON.stringify(started));

    await page.locator("#cancel").click({ timeout: 4_000 });
    await page.waitForTimeout(700);

    const after = await read();

    expect(
      after,
      `${host.name} (${arrangement}): Cancel was pressed in the form that holds this field and it kept the changed `
      + `values.\n  started ${JSON.stringify(started)}\n  changed ${JSON.stringify(changed)}\n  after   `
      + `${JSON.stringify(after)}\n\nA renderer that draws a form of its own puts the field in an `
      + "inner one, and a reset on the outer never reaches it. Two of the three answer this gesture "
      + "and the third does not — the same document, the same press, two behaviours.",
    ).toEqual(started);
  });
  }
}
