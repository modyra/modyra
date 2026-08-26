/**
 * Whether one press does one thing.
 *
 * The field opens the list. Not a mark at its edge — the field: the space between the chosen values
 * and the trailing edge is the command, and the drawing that looks like a command takes no pointer
 * events so that a press aimed at it falls through to the field behind. That arrangement is deliberate
 * and it has a cost that has to be paid explicitly.
 *
 * **A control that answers everything inside it answers the controls inside it too.** The field holds
 * several: a remove on every chip, a clear-all, a way back. Each has its own act, and a press on one
 * of them travels outwards through the field on its way to nowhere. If the field answers that press as
 * well, one gesture removes a value *and* opens the list — two acts for one press, one of which the
 * person did not ask for, and the one they did ask for now hidden behind a panel that just appeared.
 *
 * The distinction that makes it work is narrow and easy to get wrong: the field must answer a press
 * that **landed on the field**, not one that merely **passed through it**. A chip is not a button, so
 * a test of the form *did this press come from a button?* lets it through — and the control that most
 * needs to be excluded is the one that fails that test.
 *
 * So this file presses each control in turn and asks two questions of every press:
 *
 *   1. **did its own act happen?** A press that did nothing satisfies *the list did not open* for the
 *      wrong reason, and every negative below would pass on a field that answers nothing at all;
 *   2. **did anything else happen?**
 *
 * And the caret, from the other side: the list opens and the value does not move.
 *
 * **Two arrangements keep the acts apart, and they cover different presses.** A press on a control
 * that has a handler of its own stops there and never travels out to the field at all. A press on the
 * body of a chip has no handler to stop it — a label is not a control — so it does reach the field,
 * and what keeps the field from answering is that the field asks whether the press *landed* on it.
 *
 *     the remove on a chip, the steppers   stopped at the control; the field never sees it
 *     the body of a chip                   reaches the field; only the landing test holds it back
 *
 * Neither one covers both, which is why both presses are made here. Reading either arrangement as the
 * general rule leaves the other path guarded by nothing, and both are invisible from a green run: a
 * field that lost either protection looks, from the outcome alone, exactly like one that kept it.
 *
 * **Where the press lands is asserted, not assumed.** Each press is aimed by coordinate, because the
 * question is what happens to a person aiming at what they can see, and a press by coordinate can miss
 * — a control scrolled out of view, a neighbour overhanging it, a layout that moved between the
 * reading and the click. So the element under the point is read first and named in the failure. A file
 * that presses and attributes the result to the renderer, without saying what it hit, reports the
 * renderer for its own aim.
 *
 * Claims under attack: A11Y-004, UI-007.
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
const HELD = ["a", "b"];

/**
 * Each control that has an act of its own, and what its act does to the value.
 *
 * `afterRemoval` marks the one that is only offered once something has been taken away, so the field
 * has to be disturbed before it can be pressed at all.
 */
const CONTROLS = [
  { name: "the remove on a chip", part: "chipRemove", expect: ["b"], afterRemoval: false },
  { name: "clear-all", part: "clearAll", expect: [] as string[], afterRemoval: false },
  { name: "the way back", part: "wayBackAction", expect: HELD, afterRemoval: true },
] as const;

for (const host of HOSTS) {
  const mount = async (page: import("@playwright/test").Page) => {
    await page.setViewportSize({ width: 1_200, height: 700 });
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);
    await page.evaluate(({ api, options, held }) => {
      (window as never as Api)[api].mountFields("act", [{
        name: "m", kind: "multiselect", label: "Scelte", clearable: true, options, initialValue: held,
      }] as never);
    }, { api: host.api, options: OPTIONS, held: [...HELD] });
    await page.locator('[data-form="act"]').waitFor({ timeout: 5_000 });
    await page.evaluate(({ api }) => (window as never as Api)[api].settle?.(), { api: host.api }).catch(() => undefined);
    await page.waitForTimeout(350);
  };

  const held = (page: import("@playwright/test").Page) =>
    page.evaluate(({ api }) =>
      ((window as never as Api)[api].valueOf as unknown as (id: string) => Record<string, unknown>)("act")?.m ?? null,
      { api: host.api });

  const open = (page: import("@playwright/test").Page) =>
    page.evaluate(() =>
      document.querySelector('[data-form="act"] [aria-expanded]')?.getAttribute("aria-expanded") ?? "(none)");

  /** Presses the centre of a part by coordinate, and says what the point actually resolved to. */
  const press = async (page: import("@playwright/test").Page, part: string) => {
    const box = await page.locator(`[data-form="act"] .${classOf(part)}`).first().boundingBox();
    if (box === null) return { landed: "(nothing was drawn)" };
    const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    const landed = await page.evaluate(({ x, y }) => {
      const element = document.elementFromPoint(x, y);
      if (element === null) return "(nothing)";
      const named = element.closest("[class*='mdy-']");
      return named === null ? element.tagName.toLowerCase()
        : Array.from(named.classList).find((one) => one.startsWith("mdy-")) ?? named.tagName.toLowerCase();
    }, point);
    await page.mouse.click(point.x, point.y);
    await page.waitForTimeout(450);
    return { landed };
  };

  for (const control of CONTROLS) {
    test(`pressing ${control.name} does not also open the list, ${host.name}`, async ({ page }) => {
      test.setTimeout(120_000);
      await mount(page);

      if (control.afterRemoval) {
        await press(page, "chipRemove");
        await expect.poll(() => held(page), { message: "nothing was removed, so no way back is owed" })
          .not.toEqual(HELD);
      }

      const selector = classOf(control.part);
      expect(selector, `the contract declares no class for ${control.part}`).not.toBe("");

      const before = await open(page);
      const { landed } = await press(page, control.part);

      // The press reached the control it was aimed at. Everything below is about what that control
      // did, and a press that landed elsewhere would attribute another control's behaviour to it.
      expect(
        landed,
        `${host.name}: the press aimed at ${control.name} landed on ${landed}`,
      ).toBe(classOf(control.part));

      // Its own act happened. Without this, "the list did not open" is satisfied by a field that
      // answers nothing at all, which is the failure this file would then be blind to.
      expect(
        await held(page),
        `${host.name}: pressing ${control.name} left the value unchanged, so it did nothing and the `
        + "question below has no subject",
      ).toEqual(control.expect);

      expect(
        await open(page),
        `${host.name}: pressing ${control.name} also opened the list. One press did two things — the `
        + "act the person asked for, and a panel over the result of it that they now have to dismiss.",
      ).toBe(before);
    });
  }

  test(`pressing the body of a chip does nothing at all, ${host.name}`, async ({ page }) => {
    test.setTimeout(120_000);
    await mount(page);

    // Aimed a few pixels in from the leading edge: the label, not the control at the far end of it.
    const box = await page.locator(`[data-form="act"] .${classOf("chip")}`).first().boundingBox();
    expect(box, `${host.name} drew no chip, so there is no body here to press`).not.toBeNull();
    const point = { x: box!.x + 6, y: box!.y + box!.height / 2 };
    const landed = await page.evaluate(({ x, y }) => {
      const element = document.elementFromPoint(x, y);
      if (element === null) return "(nothing)";
      const named = element.closest("[class*='mdy-']");
      return named === null ? element.tagName.toLowerCase()
        : Array.from(named.classList).find((one) => one.startsWith("mdy-")) ?? named.tagName.toLowerCase();
    }, point);

    // A press on the label is what this asks about. Landing on the remove instead would ask the
    // question already asked above, and would answer it with the wrong control's protection.
    expect(
      landed,
      `${host.name}: a press aimed at the body of a chip landed on ${landed}, which is a control `
      + "rather than the label, so this is not the press this file is about",
    ).toBe(classOf("chip"));

    const before = await open(page);
    await page.mouse.click(point.x, point.y);
    await page.waitForTimeout(450);

    expect(
      await held(page),
      `${host.name}: pressing the body of a chip changed what the field holds`,
    ).toEqual(HELD);

    expect(
      await open(page),
      `${host.name}: pressing the body of a chip opened the list. A label is not a control, so this `
      + "press reaches the field, and the field answered a press that landed on something else.",
    ).toBe(before);

    // The field is alive. Without this the two negatives above are satisfied by a control that
    // answers nothing at all, and the press that reaches the field furthest is the one this file
    // would then be least able to see.
    const { landed: onCaret } = await press(page, "arrow");
    expect(onCaret, `${host.name}: the control case landed on ${onCaret}`).toBe(classOf("box"));
    expect(
      await open(page),
      `${host.name}: the field did not open on a press of its own either, so it answers nothing and `
      + "the two readings above are about a control that was never listening",
    ).toBe("true");
  });

  test(`pressing the caret opens the list and moves nothing, ${host.name}`, async ({ page }) => {
    test.setTimeout(120_000);
    await mount(page);

    const { landed } = await press(page, "arrow");
    // The caret takes no pointer events, so the press is expected to reach the field behind it. What
    // is asserted is that it reached the field and not some third thing overhanging the caret.
    expect(
      landed,
      `${host.name}: a press at the centre of the caret landed on ${landed}, which is neither the `
      + "caret nor the field it is drawn in",
    ).toBe(classOf("box"));

    expect(
      await held(page),
      `${host.name}: pressing the caret changed the value. The mark that means "this opens" is `
      + "covered by something that acts on what the field holds.",
    ).toEqual(HELD);

    expect(
      await open(page),
      `${host.name}: pressing the caret opened nothing. The caret takes no pointer events, so the `
      + "press reached the field, and the field is the command that opens.",
    ).toBe("true");
  });
}
