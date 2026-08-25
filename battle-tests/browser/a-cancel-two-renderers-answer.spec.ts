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
 * The form takes the mounting point's place **before** anything is mounted, so the field is built
 * inside it. An earlier version created the form and moved the field in afterwards, and that measured
 * something else entirely: lit re-binds when it is reconnected and plain binds once at mount, so the
 * move produced a difference between them that a consumer never meets. A fixture that rearranges the
 * page is asking about the rearrangement.
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

for (const host of HOSTS) {
  test(`pressing Cancel returns the field to what it held, ${host.name}`, async ({ page }) => {
    await page.setViewportSize({ width: 1_200, height: 900 });
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);
    await formAroundTheStage(page);

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
      ] as never);
    }, { api: host.api });
    await page.locator('[data-form="cancel"]').waitFor({ timeout: 5_000 });
    await page.evaluate(({ api }) => (window as never as Api)[api].settle?.(), { api: host.api }).catch(() => undefined);
    await page.waitForTimeout(600);

    const read = () => page.evaluate(({ api }) => {
      const scope = document.querySelector('[data-form="cancel"]');
      return {
        model: JSON.stringify((window as never as Api)[api].valueOf("cancel" as never)),
        typed: (scope?.querySelector('input[type="text"], input:not([type])') as HTMLInputElement | null)?.value ?? null,
        chips: Array.from(scope?.querySelectorAll(".mdy-chip") ?? [])
          .map((chip) => (chip.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 10)),
      };
    }, { api: host.api });

    const started = await read();

    // The premise: the field arrived holding what it was given. Everything below compares against
    // this reading, so a field that never took its initial value would make the comparison vacuous.
    expect(
      started.model,
      `${host.name} did not take the values it was given — it holds ${started.model}`,
    ).toContain('"Ada"');

    await page.evaluate(({ api }) => {
      ((window as never as Api)[api] as unknown as { setValue?: (id: string, v: unknown) => void })
        .setValue?.("cancel", { t: "Grace", m: ["a", "b"] });
    }, { api: host.api }).catch(() => undefined);
    await page.waitForTimeout(500);

    const changed = await read();

    // And the second premise: something actually changed. A reset that restores nothing looks the
    // same as a field that never moved.
    expect(
      JSON.stringify(changed),
      `${host.name}: the value did not change, so pressing Cancel cannot be shown to restore anything`,
    ).not.toEqual(JSON.stringify(started));

    await page.locator("#cancel").click({ timeout: 4_000 });
    await page.waitForTimeout(700);

    const after = await read();

    expect(
      after,
      `${host.name}: Cancel was pressed in the form that holds this field and it kept the changed `
      + `values.\n  started ${JSON.stringify(started)}\n  changed ${JSON.stringify(changed)}\n  after   `
      + `${JSON.stringify(after)}\n\nA renderer that draws a form of its own puts the field in an `
      + "inner one, and a reset on the outer never reaches it. Two of the three answer this gesture "
      + "and the third does not — the same document, the same press, two behaviours.",
    ).toEqual(started);
  });
}
