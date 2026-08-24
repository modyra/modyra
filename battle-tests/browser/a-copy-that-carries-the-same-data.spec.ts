/**
 * A value that holds what an option holds is that option, whichever copy it is.
 *
 * [ADR 0051](../../docs/architecture/0051-an-option-is-compared-by-what-it-holds.md) settles how a
 * held value is matched against the declared list: **an object by its members, recursively — two
 * values are the same option when they carry the same data, whichever copy they are.** Reference
 * equality is not the test, and it cannot be: the values a form holds arrive from a draft rehydrated
 * out of storage, a refetch, a JSON import, a server round trip. None of those returns the object the
 * option list was built from.
 *
 * That decision exists so a form restored from a draft shows what it holds. This asks whether the
 * **field** honours it, which is a different question from whether the reconciler does — the
 * reconciler is unit-tested, and a widget can still label the chip from the wrong place.
 *
 * Measured with an option list built from one pair of objects and a value that is a **fresh object
 * with the same members**:
 *
 *     plain      chip "Alfa"
 *     angular    chip "Alfa"
 *     lit        chip "[object Object]"
 *
 * So two renderers resolve the copy to its option and read its label, and one stringifies the raw
 * value into the interface. `[object Object]` is not a degraded label — it is the shape of a value
 * that was never recognised, printed where a person reads.
 *
 * **This does not assert the mechanism, and deliberately.** Whether the fix is in how the field keys
 * its held values or in what a renderer falls back to is a decision for whoever owns the package; a
 * spec that named one would be choosing it here. What it asserts is the property ADR 0051 states: the
 * copy is the option, so it wears the option's label.
 *
 * **The strongest form of the check is that no renderer prints a raw object anywhere**, and that is
 * asserted too — a value reaching a person as `[object Object]` is a defect whatever produced it, and
 * the general form outlives this particular route to it.
 *
 * Claims under attack: UI-011, ADP-001.
 */

import { expect, test } from "@playwright/test";

import { HOSTS } from "./bench";

type Api = Record<string, Record<string, (...args: never[]) => unknown>>;

/** What a value looks like when nothing recognised it and something printed it anyway. */
const RAW_OBJECT = /\[object \w+\]/;

for (const host of HOSTS) {
  test(`a fresh copy of an option's value wears that option's label, ${host.name}`, async ({ page }) => {
    await page.setViewportSize({ width: 1_000, height: 600 });
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    await page.evaluate(({ api }) => {
      // The list is built from these two objects; the value below is neither of them.
      const alfa = { id: 1, nome: "Alfa" };
      const beta = { id: 2, nome: "Beta" };
      (window as never as Api)[api].mountFields("copy", [{
        name: "m", kind: "multiselect", label: "Scelte", mode: "multi", clearable: true,
        options: [{ value: alfa, label: "Alfa" }, { value: beta, label: "Beta" }],
        // Same members, different object — a draft out of storage, a refetch, a JSON import.
        initialValue: [{ id: 1, nome: "Alfa" }],
      }] as never);
    }, { api: host.api });

    await page.locator('[data-form="copy"]').waitFor({ timeout: 5_000 });
    await page.evaluate(({ api }) => (window as never as Api)[api].settle?.(), { api: host.api }).catch(() => undefined);
    await page.waitForTimeout(600);

    const seen = await page.evaluate(({ api }) => {
      const scope = document.querySelector('[data-form="copy"]');
      return {
        held: JSON.stringify((window as never as Api)[api].valueOf("copy" as never)),
        chips: Array.from(scope?.querySelectorAll(".mdy-chip") ?? [])
          .map((chip) => (chip.getAttribute("aria-label") ?? chip.textContent ?? "").trim()),
        everything: (scope?.textContent ?? "").trim(),
      };
    }, { api: host.api });

    // The premise: the form kept the value. Without it there is no chip to label and every assertion
    // below is about an empty field.
    expect(
      seen.held,
      `${host.name} did not keep the value it was given, so nothing here is about how it is labelled`,
    ).toContain('"nome":"Alfa"');

    expect(
      seen.chips.length,
      `${host.name} holds a value and drew no chip for it. The model keeps something the widget does `
      + "not show, which is the one state a person cannot act on: it submits and it is invisible.",
    ).toBeGreaterThan(0);

    expect(
      seen.chips,
      `${host.name} labelled the held value ${JSON.stringify(seen.chips)}. ADR 0051 says a value `
      + "carrying an option's members *is* that option, whichever copy it is — so it wears that "
      + "option's label. A copy is what a form restored from a draft always holds.",
    ).toEqual(["Alfa"]);

    // The general form, which outlives this route to it.
    expect(
      RAW_OBJECT.test(seen.everything),
      `${host.name} printed a raw object where a person reads: "${seen.everything.slice(0, 80)}". `
      + "Whatever failed to recognise it, the result reached the interface.",
    ).toBe(false);
  });
}
