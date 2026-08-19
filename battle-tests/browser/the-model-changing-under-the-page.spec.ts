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
 */

import { expect, test } from "@playwright/test";
import { MDY_WIDGET_KINDS } from "@modyra/widgets";

const HOSTS = [
  { name: "plain", page: "/index.html", ready: "battleReady", api: "battle" },
  { name: "lit", page: "/lit.html", ready: "battleLitReady", api: "battleLit" },
];

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
      await page.waitForTimeout(200);

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

      const before = await visible();

      await page.evaluate(({ mountId, api, value }) =>
        (window as never as Record<string, { setValue(i: string, p: unknown): void }>)[api].setValue(mountId, { x: value }),
        { mountId: id, api: host.api, value: ARRIVING[kind] });
      await page.waitForTimeout(320);

      const held = await page.evaluate(({ mountId, api }) =>
        JSON.stringify((window as never as Record<string, { valueOf(i: string): Record<string, unknown> }>)[api].valueOf(mountId).x),
        { mountId: id, api: host.api });
      const after = await visible();

      if (held !== JSON.stringify(ARRIVING[kind])) stale.push(`${kind}: the model refused it, holding ${held}`);
      else if (before === after) stale.push(`${kind}: the model took it and nothing on the page changed`);

      await page.evaluate(({ mountId, api }) =>
        (window as never as Record<string, { dispose(i: string): void }>)[api].dispose(mountId),
        { mountId: id, api: host.api });
      await page.waitForTimeout(50);
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
    await page.waitForTimeout(320);

    const shown = () => page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('[data-form="r"] input')) as HTMLInputElement[];
      return { who: inputs[0]?.value ?? null, many: inputs[1]?.checked ?? null, when: inputs[2]?.value ?? null };
    });

    const start = await shown();
    expect(start, "the form did not start where it was told to").toEqual({ who: "start", many: false, when: "" });

    await page.evaluate(({ api }) =>
      (window as never as Record<string, { setValue(i: string, p: unknown): void }>)[api]
        .setValue("r", { who: "from a fetch", many: true, when: "2026-04-03" }), { api: host.api });
    await page.waitForTimeout(360);

    // The control: the page moved. A reset that puts nothing back would otherwise pass.
    expect(await shown(), "the page did not follow the values it was given")
      .toEqual({ who: "from a fetch", many: true, when: "2026-04-03" });

    await page.evaluate(({ api }) => (window as never as Record<string, { reset(i: string): void }>)[api].reset("r"), { api: host.api });
    await page.waitForTimeout(380);

    expect(await shown(), "a reset left the page showing what the form no longer holds").toEqual(start);
  });
}
