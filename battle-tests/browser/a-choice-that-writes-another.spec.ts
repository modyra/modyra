/**
 * Choosing the second option writes the second option.
 *
 * The two checks beside this one ask what a control **shows**. This one asks what it **writes**, and
 * that is a different severity: a control showing the wrong thing misreports a model that is right,
 * while a control writing the wrong thing puts a choice into the form that nobody made. The person
 * sees the field they picked and the value underneath is another one — there is no reading of the
 * page that reveals it.
 *
 * The exposure is specific to a `<select>` and comes from HTML rather than from anyone's code: an
 * `<option>`'s `value` **is a string**. Two object-valued options both become `"[object Object]"`
 * there, so the browser cannot tell them apart, and a change handler that looks the chosen string back
 * up in the list finds whichever comes first.
 *
 * **Both shapes are exercised, and that is the point of this file rather than a detail of it.**
 * [ADR 0139](../../docs/architecture/0139-a-select-has-two-shapes.md) records that `select` is two
 * controls: a native `<select>` where nothing asks for search, and a combobox where something does.
 * The native one is where a value has to survive a round trip through a string, so a check that only
 * drove the combobox would miss the whole mechanism — and with `searchable` unset the three renderers
 * do not even draw the same control.
 *
 * So the option is chosen the way a person would, in whichever shape the renderer drew, and the
 * assertion is on the **model**: what the form holds afterwards.
 *
 * The string case is mounted first as the control, as in the two files beside this. `String(v)` and
 * the contract's key are the same function on every primitive and part company only on an object, so
 * a fixture holding strings cannot distinguish a working control from a broken one.
 *
 * Claims under attack: UI-011, ADP-001.
 */

import { expect, test } from "@playwright/test";

import { HOSTS } from "./bench";

type Api = Record<string, Record<string, (...args: never[]) => unknown>>;

const mount = async (
  page: import("@playwright/test").Page,
  host: (typeof HOSTS)[number],
  id: string,
  useObjects: boolean,
) => {
  await page.evaluate(({ api, id, useObjects }) => {
    const alfa = useObjects ? { id: 1, nome: "Alfa" } : "a";
    const beta = useObjects ? { id: 2, nome: "Beta" } : "b";
    (window as never as Api)[api].mountFields(id, [{
      name: "f", kind: "select", label: "Scelte",
      options: [{ value: alfa, label: "Alfa" }, { value: beta, label: "Beta" }],
      initialValue: alfa,
    }] as never);
  }, { api: host.api, id, useObjects });
  await page.locator(`[data-form="${id}"]`).waitFor({ timeout: 5_000 });
  await page.evaluate(({ api }) => (window as never as Api)[api].settle?.(), { api: host.api }).catch(() => undefined);
  await page.waitForTimeout(450);
};

/**
 * Choose the option reading `label`, in whichever of the two shapes this renderer drew.
 *
 * Returns how it was chosen, so a failure says which control was driven — a spec that reported "Beta
 * was not written" without saying whether it drove a listbox or a native select sends a reader to the
 * wrong file.
 */
const choose = async (page: import("@playwright/test").Page, form: string, label: string) => {
  const native = page.locator(`[data-form="${form}"] select`);
  if (await native.count() > 0) {
    await native.first().selectOption({ label });
    await page.waitForTimeout(350);
    return "native <select>";
  }
  await page.locator(`[data-form="${form}"] [aria-haspopup], [data-form="${form}"] [role="combobox"]`)
    .first().click({ timeout: 4_000 });
  await page.waitForTimeout(350);
  // By role and name rather than by text: `:has-text` matches an ancestor that merely contains the
  // word, so it can resolve to the list instead of the option in it.
  await page.getByRole("option", { name: label }).first().click({ timeout: 4_000 });
  await page.waitForTimeout(350);
  return "combobox";
};

const held = (page: import("@playwright/test").Page, host: (typeof HOSTS)[number], id: string) =>
  page.evaluate(({ api, id }) =>
    JSON.stringify((window as never as Api)[api].valueOf(id as never)), { api: host.api, id });

for (const host of HOSTS) {
  test(`choosing the second option writes the second option, ${host.name}`, async ({ page }) => {
    await page.setViewportSize({ width: 1_000, height: 700 });
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    // The control. With strings the two key derivations agree exactly, so this passing is what makes
    // the object reading below a statement about object values rather than about the fixture.
    await mount(page, host, "write-strings", false);
    const stringShape = await choose(page, "write-strings", "Beta");
    const afterStrings = await held(page, host, "write-strings");
    expect(
      afterStrings,
      `${host.name}: choosing Beta through a ${stringShape} with string values wrote ${afterStrings}. `
      + "The control failed, so nothing below is about how an object value survives being chosen.",
    ).toContain('"b"');

    await mount(page, host, "write-objects", true);

    // The premise: the field started on the first option. Without it, "it holds Alfa" afterwards
    // could mean nothing was written at all rather than the wrong thing being written.
    const before = await held(page, host, "write-objects");
    expect(
      before,
      `${host.name}: the field did not start on the first option — it holds ${before}`,
    ).toContain('"id":1');

    const shape = await choose(page, "write-objects", "Beta");
    const after = await held(page, host, "write-objects");

    expect(
      after,
      `${host.name}: Beta was chosen through a ${shape} and the form holds ${after}. A person sees the `
      + "option they picked and the value underneath is another one, so no reading of the page reveals "
      + "it — the form submits a choice nobody made.",
    ).toContain('"id":2');
  });
}
