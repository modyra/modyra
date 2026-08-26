/**
 * Whether what a control says happened is the size of what happened.
 *
 * Some acts move one value and some move all of them, and a person who cannot see the field learns
 * which from a sentence the control speaks the moment it happens. That sentence is the only account
 * they get at the time: the field itself has gone quiet, the values are no longer there to be walked,
 * and nothing else will volunteer what became of them.
 *
 * **Naming one value for an act that moved several is not a shorter way of saying it — it is a
 * different statement.** A person who hears one name has been told about one value. If they were
 * holding three, two of them left without being mentioned, and the sentence they heard gives them no
 * reason to suspect it. The number beside the name is right, which makes it worse: *removed, nothing
 * selected* invites them to reconcile the two themselves, and the reconciliation that fits is the one
 * where they had only ever chosen the value they heard.
 *
 * **The same control says it correctly elsewhere in the same moment.** The remedy offered alongside is
 * named for the whole act. So this is not a limit of what the control knows, nor of the words
 * available to it: one of its two reports uses the plural form and the other reaches for a singular
 * one and fills it in with whichever value came first.
 *
 * **The check is about size, not wording.** Any sentence is allowed. What is asked is that the values
 * a sentence names are either all of the ones that moved or none of them — a list, or a count. Naming
 * one of three is the only shape refused, and it is refused because it is the only one that describes
 * a different act than the one that happened.
 *
 * **The control is a single removal**, in the same run: it must name the value it moved. Without it a
 * control that never names anything satisfies the rule by saying nothing, and the sentence this file
 * is about would be missing for a reason it would never report.
 *
 * Claims under attack: A11Y-002, A11Y-004.
 */

import { expect, test } from "@playwright/test";
import { MDY_WIDGET_CONTRACTS } from "@modyra/widgets";

import { HOSTS } from "./bench";

type Api = Record<string, Record<string, (...args: never[]) => unknown>>;

/** The contract's own class for a part, so a rename moves this file with it. */
const classOf = (part: string): string => {
  const parts = (MDY_WIDGET_CONTRACTS as unknown as Record<string, { parts: Record<string, { classes: string[] }> }>)
    .multiselect.parts;
  return (parts[part]?.classes ?? [])[0] ?? "";
};

const OPTIONS = [
  { value: "a", label: "Alfa" },
  { value: "b", label: "Beta" },
  { value: "c", label: "Gamma" },
];
const LABELS = OPTIONS.map((one) => one.label);

for (const host of HOSTS) {
  const mount = async (page: import("@playwright/test").Page, id: string) => {
    await page.setViewportSize({ width: 1_200, height: 700 });
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);
    await page.evaluate(({ api, mountId, options }) => {
      (window as never as Api)[api].mountFields(mountId, [{
        name: "m", kind: "multiselect", label: "Scelte", clearable: true, options,
        initialValue: (options as { value: string }[]).map((one) => one.value),
      }] as never);
    }, { api: host.api, mountId: id, options: OPTIONS });
    await page.locator(`[data-form="${id}"]`).waitFor({ timeout: 5_000 });
    await page.evaluate(({ api }) => (window as never as Api)[api].settle?.(), { api: host.api }).catch(() => undefined);
    await page.waitForTimeout(350);
  };

  const held = (page: import("@playwright/test").Page, id: string) =>
    page.evaluate(({ api, mountId }) =>
      ((window as never as Api)[api].valueOf as unknown as (one: string) => Record<string, unknown>)(mountId)?.m as string[] ?? [],
      { api: host.api, mountId: id });

  /** Everything the control is saying aloud, joined as a reader would meet it. */
  const spoken = (page: import("@playwright/test").Page, id: string) =>
    page.evaluate((mountId) =>
      Array.from(document.querySelectorAll(`[data-form="${mountId}"] [aria-live]`))
        .map((one) => (one.textContent ?? "").trim())
        .filter((one) => one !== "")
        .join(" "), id);

  test(`an act that moved several values is not announced as one, ${host.name}`, async ({ page }) => {
    test.setTimeout(180_000);

    // The control: an act that moves one value names that value. It proves the control speaks at all,
    // and that naming a value is something it does — so silence below would be a finding of its own.
    await mount(page, "said_one");
    const oneBefore = await held(page, "said_one");
    await page.locator(`[data-form="said_one"] .${classOf("chipRemove")}`).first().click({ timeout: 5_000 });
    await page.waitForTimeout(700);
    const oneAfter = await held(page, "said_one");
    const oneMoved = oneBefore.filter((one) => !oneAfter.includes(one));
    expect(oneMoved, `${host.name}: removing one chip moved ${oneMoved.length} values`).toHaveLength(1);

    const aboutOne = await spoken(page, "said_one");
    const namedOne = LABELS.filter((label) => aboutOne.includes(label));
    expect(
      namedOne.length,
      `${host.name}: after removing a single value the control said "${aboutOne}", which names no `
      + "value at all — so it does not name values, and the reading below would be about a control "
      + "that never had anything to get wrong",
    ).toBe(1);

    // The act under test: everything leaves at once.
    await mount(page, "said_all");
    const allBefore = await held(page, "said_all");
    expect(allBefore.length, `${host.name}: the field holds too little for a bulk act to differ from a single one`)
      .toBeGreaterThan(1);
    await page.locator(`[data-form="said_all"] .${classOf("clearAll")}`).click({ timeout: 5_000 });
    await page.waitForTimeout(700);
    const allAfter = await held(page, "said_all");
    const allMoved = allBefore.filter((one) => !allAfter.includes(one));
    expect(
      allMoved.length,
      `${host.name}: clearing moved ${allMoved.length} of ${allBefore.length} values, so this is not `
      + "the bulk act this file is about",
    ).toBe(allBefore.length);

    const aboutAll = await spoken(page, "said_all");
    expect(
      aboutAll,
      `${host.name}: the control said nothing when every value left the field`,
    ).not.toBe("");

    const named = LABELS.filter((label) => aboutAll.includes(label));
    expect(
      named.length === 0 || named.length === allMoved.length,
      `${host.name}: ${allMoved.length} values left the field and the control said "${aboutAll}", `
      + `which names ${named.length} of them — ${named.join(", ")}. A person who cannot see the field `
      + "has been told about one value while the others went without mention, and the number beside "
      + "the name gives them no reason to suspect it. The remedy offered in the same moment is named "
      + "for the whole act, so the words for saying this exist and one of the two reports is not "
      + "using them.",
    ).toBe(true);
  });
}
