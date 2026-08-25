/**
 * A value arriving from somewhere that is not the keyboard.
 *
 * Almost everything a browser battle does drives the page and reads the model. The other direction is
 * the one an application uses most: a fetch answers, a related field is chosen, a reset button is
 * pressed, a draft is restored. The model changes underneath, and every control showing part of it
 * has to follow.
 *
 * A control that does not follow is the worst kind of stale, because the page and the form disagree
 * about the same field and only the page is visible. The user reads one value and submits another.
 *
 * The check is deliberately loose about *how* a kind shows its value — a chip, a checked box, a text
 * box, a swatch — and strict about two things: the model takes what it was given, and something the
 * user could see changed. Pinning the exact rendering would pin an implementation; pinning "nothing
 * changed" catches the defect.
 *
 * `file` is not swept: a File cannot be constructed from a value in the page, so there is nothing to
 * hand it that is not already what it holds.
 *
 * Claims under attack: UI-011, UI-006.
 */

import { expect, test } from "@playwright/test";
import { MDY_WIDGET_KINDS } from "@modyra/widgets";

// **Every renderer, from the shared list.** The local list this replaced was not a scope
// decision: the angular host published six of the twenty-two doors these specs need, so a
// spec wanting one it lacked left the renderer out and the next reader copied the list.
import { became, HOSTS, SETTLES, stops } from "./bench";

/** A value each kind can hold, different from what it starts with. */
const ARRIVING: Record<string, unknown> = {
  text: "set", textarea: "set", email: "a@b.co", password: "s3cret",
  number: 7, slider: 8, checkbox: true, toggle: true,
  select: "b", radio: "b", segmented: "b", multiselect: ["b"],
  datepicker: "2026-04-03", daterange: { start: "2026-04-03", end: "2026-04-09" },
  timepicker: "14:30", colors: "#ff0000",
};

for (const host of HOSTS) {
  test(`every kind follows a value it was given, ${host.name}`, async ({ page }) => {
    test.setTimeout(300_000);
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    const swept = MDY_WIDGET_KINDS.filter((kind) => kind in ARRIVING);
    expect(swept.length, "the value table has drifted away from the vocabulary").toBeGreaterThan(14);

    const stale: string[] = [];

    for (const kind of swept) {
      const id = `f-${kind}`;
      await page.evaluate(({ mountId, k, api }) => {
        (window as never as Record<string, { mountFields(i: string, f: unknown[]): unknown }>)[api]
          .mountFields(mountId, [{ name: "x", kind: k, label: "X", options: [{ value: "a", label: "A" }, { value: "b", label: "B" }] }]);
      }, { mountId: id, k: kind, api: host.api });

      /** Everything about this field a person could see. */
      const visible = () => page.evaluate((sel) => {
        const root = document.querySelector(sel);
        const controls = Array.from(root?.querySelectorAll("input, select, textarea") ?? []) as HTMLInputElement[];
        return JSON.stringify({
          values: controls.map((each) => each.type === "checkbox" || each.type === "radio" ? String(each.checked) : each.value),
          marked: (root?.querySelectorAll('[aria-pressed="true"], [aria-selected="true"], [aria-checked="true"]') ?? []).length,
          text: (root?.textContent ?? "").replace(/\s+/g, " ").trim(),
        });
      }, `[data-form="${id}"]`);

      // The field has to have been drawn before "what a person could see" means anything, and it has
      // to have stopped moving before it can be compared against a later reading of the same thing.
      await became(() => page.evaluate(
        (sel) => (document.querySelector(sel)?.querySelectorAll("input, select, textarea").length ?? 0) > 0,
        `[data-form="${id}"]`,
      ));
      const before = await stops(visible);

      await page.evaluate(({ mountId, api, value }) =>
        (window as never as Record<string, { setValue(i: string, p: unknown): void }>)[api].setValue(mountId, { x: value }),
        { mountId: id, api: host.api, value: ARRIVING[kind] });

      // Read as one settled snapshot rather than as two samples. What is judged below is the pair —
      // the model took the value *and* the page moved — so a model read before a page that had not
      // finished redrawing reports a control that followed as one that did not.
      const arrived = await stops(async () => ({
        held: await page.evaluate(({ mountId, api }) =>
          JSON.stringify((window as never as Record<string, { valueOf(i: string): Record<string, unknown> }>)[api].valueOf(mountId).x),
          { mountId: id, api: host.api }),
        after: await visible(),
      }));
      const { held, after } = arrived;

      if (held !== JSON.stringify(ARRIVING[kind])) stale.push(`${kind}: the model refused it, holding ${held}`);
      else if (before === after) stale.push(`${kind}: the model took it and nothing on the page changed`);

      await page.evaluate(({ mountId, api }) =>
        (window as never as Record<string, { dispose(i: string): void }>)[api].dispose(mountId),
        { mountId: id, api: host.api });
    }

    expect(stale, "a control did not follow the value its form was given").toEqual([]);
  });

  test(`a reset puts the page back, ${host.name}`, async ({ page }) => {
    test.setTimeout(180_000);
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    await page.evaluate(({ api }) => {
      (window as never as Record<string, { mountFields(i: string, f: unknown[]): unknown }>)[api]
        .mountFields("r", [
          { name: "who", kind: "text", label: "Who", initialValue: "start" },
          { name: "many", kind: "checkbox", label: "Many" },
          { name: "when", kind: "datepicker", label: "When" },
        ]);
    }, { api: host.api });

    const shown = () => page.evaluate(() => {
      // **The controls a person meets, not every input on the page.** A field may carry a hidden
      // input alongside its visible control so that a native submit sends the value; that one is
      // never typed into and never seen, and counting it shifts every position after it — reading
      // the third input got the checkbox's hidden partner and called it a date.
      const inputs = Array.from(document.querySelectorAll('[data-form="r"] input'))
        .filter((each) => (each as HTMLInputElement).type !== "hidden") as HTMLInputElement[];
      return { who: inputs[0]?.value ?? null, many: inputs[1]?.checked ?? null, when: inputs[2]?.value ?? null };
    });

    await expect
      .poll(shown, { message: "the form did not start where it was told to", ...SETTLES })
      .toEqual({ who: "start", many: false, when: "" });
    const start = await shown();

    await page.evaluate(({ api }) =>
      (window as never as Record<string, { setValue(i: string, p: unknown): void }>)[api]
        .setValue("r", { who: "from a fetch", many: true, when: "2026-04-03" }), { api: host.api });

    // The control: the page moved. A reset that puts nothing back would otherwise pass.
    //
    // The date is read from the model and only counted as *changed* in the page. A date box shows a
    // date in the reader's language, so the characters in it are one renderer's rendering of the
    // value rather than the value — pinning them here would make this a test of date formatting
    // wearing a reset test's name, and it would fail the one renderer that follows the reader.
    await expect
      .poll(async () => { const seen = await shown(); return { who: seen.who, many: seen.many }; },
        { message: "the page did not follow the values it was given", ...SETTLES })
      .toEqual({ who: "from a fetch", many: true });
    // The box starts empty, so waiting for it to stop being empty is a wait for something to arrive
    // rather than a claim that is already true — which is the only shape in which a negative may be
    // waited on at all.
    await expect
      .poll(async () => (await shown()).when,
        { message: "the date box shows nothing after the model was given a date", ...SETTLES })
      .not.toBe("");
    expect(
      await page.evaluate(({ api }) =>
        (window as never as Record<string, { valueOf(i: string): Record<string, unknown> }>)[api].valueOf("r").when,
        { api: host.api }),
      "the form does not hold the date it was given",
    ).toBe("2026-04-03");

    await page.evaluate(({ api }) => (window as never as Record<string, { reset(i: string): void }>)[api].reset("r"), { api: host.api });

    await expect
      .poll(shown, { message: "a reset left the page showing what the form no longer holds", ...SETTLES })
      .toEqual(start);
  });
}
