/**
 * Whether a name given to a colour is the name a person hears.
 *
 * A palette can be written two ways. A document may list colours as bare values, or it may give each
 * one a name — the name a team uses for it, which is the only place that knowledge exists, because
 * nobody outside the team knows that this particular blue is the one on the invoices.
 *
 * **Two spellings of one thing is where the interesting failures live.** A renderer normalising each
 * form in its own way produces a palette that reads differently depending on which spelling the
 * document happened to use, and neither spelling is wrong, so nothing anywhere reports a defect. What
 * this file holds is narrow and hard to argue with: **a name that was given is announced, a name that
 * was not given is not invented, and the answer does not depend on who drew the field.**
 *
 * **Announced, not written.** A name reaches a person through the accessibility tree or it does not
 * reach them at all. An attribute on a role that does not admit it is dropped silently, and a label
 * put somewhere the tree does not look is a label nobody hears — so the tree is what is read here,
 * never the markup.
 *
 * **The unnamed half is the control, and it carries the argument.** A palette that named everything
 * would satisfy the first half by having no second case. And the value is a poor name on purpose: a
 * generic palette calling a hexadecimal *blue* is guessing, and an approximated colour name is worse
 * than the number, because it claims a meaning it does not have while the number claims none.
 *
 * **A mixed palette is checked as well**, because falling back per palette rather than per entry is a
 * mistake that both pure cases pass.
 *
 * Claims under attack: A11Y-004, UI-005.
 */

import { expect, test } from "@playwright/test";

import { HOSTS } from "./bench";

type Api = Record<string, Record<string, (...args: never[]) => unknown>>;

const NAMED = "#4361ee";
const BARE = "#e63946";
const GIVEN = "Marchio principale";

/** One palette written three ways: all bare, all named, and one of each. */
const SPELLINGS = {
  bare: [BARE, "#10b981"],
  named: [{ value: NAMED, label: GIVEN }, { value: "#10b981", label: "Verde contabile" }],
  mixed: [{ value: NAMED, label: GIVEN }, BARE],
} as const;

for (const host of HOSTS) {
  test(`a name a palette was given is the name that is heard, ${host.name}`, async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 1_200, height: 800 });
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    /** Every swatch's name as the accessibility tree gives it, in order. */
    const namesFor = async (spelling: keyof typeof SPELLINGS): Promise<string[]> => {
      const id = `named_${spelling}`;
      await page.evaluate(({ api, mountId, presets }) => {
        (window as never as Api)[api].mountFields(mountId, [{
          name: "c", kind: "colors", label: "Colore", presets,
        }] as never);
      }, { api: host.api, mountId: id, presets: SPELLINGS[spelling] as unknown as string[] });
      await page.locator(`[data-form="${id}"]`).waitFor({ timeout: 5_000 });
      await page.evaluate(({ api }) => (window as never as Api)[api].settle?.(), { api: host.api }).catch(() => undefined);
      await page.waitForTimeout(250);

      await page.locator(`[data-form="${id}"] [aria-haspopup]`).first().click({ timeout: 5_000 });
      await page.waitForTimeout(400);

      const options = page.getByRole("option");
      const count = await options.count();
      const out: string[] = [];
      for (let index = 0; index < count; index += 1) {
        // The computed name, which is what a person is told. What the markup says is a different
        // question and not the one anybody experiences.
        out.push(((await options.nth(index).getAttribute("aria-label"))
          ?? (await options.nth(index).textContent())
          ?? "").trim());
      }

      await page.evaluate(({ api, mountId }) => { (window as never as Api)[api].dispose?.(mountId as never); },
        { api: host.api, mountId: id });
      return out;
    };

    const bare = await namesFor("bare");
    const named = await namesFor("named");
    const mixed = await namesFor("mixed");

    // A run that opened nothing has no names to compare and would agree with everything.
    expect(
      Math.min(bare.length, named.length, mixed.length),
      `${host.name} opened palettes holding ${bare.length}, ${named.length} and ${mixed.length} `
      + "option(s), so there is nothing here to read a name from",
    ).toBeGreaterThan(1);

    const says = (names: string[], what: string) => names.some((one) => one.toLowerCase().includes(what.toLowerCase()));

    expect(
      says(named, GIVEN),
      `${host.name}: a palette that gives a colour the name "${GIVEN}" announces it as `
      + `${JSON.stringify(named)}. The name a team uses for a colour is the only knowledge about it `
      + "that exists anywhere, and a control that drops it leaves the person with a number.",
    ).toBe(true);

    expect(
      says(bare, BARE),
      `${host.name}: a palette written as bare values announces ${JSON.stringify(bare)}, which does `
      + `not name ${BARE}. A value is a poor name and an honest one; something else here is worse.`,
    ).toBe(true);

    // Falling back for the whole palette rather than for each entry passes both pure cases.
    expect(
      { name: says(mixed, GIVEN), value: says(mixed, BARE) },
      `${host.name}: a palette holding one named colour and one bare one announces `
      + `${JSON.stringify(mixed)}. Each entry answers for itself: the named one by its name, the `
      + "unnamed one by its value. A renderer that decides once for the whole palette gets both pure "
      + "palettes right and this one wrong.",
    ).toEqual({ name: true, value: true });
  });
}

test("one palette is announced one way, whoever drew it", async ({ page }) => {
  test.setTimeout(300_000);

  const heard: Record<string, string> = {};

  for (const host of HOSTS) {
    await page.setViewportSize({ width: 1_200, height: 800 });
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    await page.evaluate(({ api, presets }) => {
      (window as never as Api)[api].mountFields("agree", [{
        name: "c", kind: "colors", label: "Colore", presets,
      }] as never);
    }, { api: host.api, presets: SPELLINGS.mixed as unknown as string[] });
    await page.locator('[data-form="agree"]').waitFor({ timeout: 5_000 });
    await page.evaluate(({ api }) => (window as never as Api)[api].settle?.(), { api: host.api }).catch(() => undefined);
    await page.waitForTimeout(250);
    await page.locator('[data-form="agree"] [aria-haspopup]').first().click({ timeout: 5_000 });
    await page.waitForTimeout(400);

    const options = page.getByRole("option");
    const count = await options.count();
    expect(count, `${host.name} opened a palette holding ${count} option(s)`).toBeGreaterThan(1);

    // The bare entry only. The named one is answered for by the document, so it cannot differ; what
    // each renderer decides on its own is how a colour nobody named is announced.
    const names: string[] = [];
    for (let index = 0; index < count; index += 1) {
      names.push((((await options.nth(index).getAttribute("aria-label"))
        ?? (await options.nth(index).textContent()) ?? "").trim()));
    }
    const forBare = names.find((one) => one.toLowerCase().includes(BARE.toLowerCase().slice(1)));
    expect(forBare, `${host.name} announced no option carrying ${BARE}: ${JSON.stringify(names)}`).toBeDefined();
    heard[host.name] = forBare!;
  }

  expect(
    [...new Set(Object.values(heard))].length,
    "one document describes one colour and each renderer announces it differently: "
    + `${Object.entries(heard).map(([name, said]) => `${name} says "${said}"`).join(", ")}. `
    + "A colour nobody named has one honest answer and the document does not choose between the "
    + "ways of giving it, so this difference is not a decision anybody made — and a person moving "
    + "between two applications hears the same swatch called two things.",
  ).toBe(1);
});
