/**
 * Whether the remedy can be given the way the record says it can, and what it costs to give it.
 *
 * When a value is taken out of the field, a remedy is offered: a control that puts it back. The
 * accepted decision that placed that control at the field's trailing edge also says how else it can be
 * reached — **the undo shortcut every application binds** — and says why: the remedy is what makes
 * discarding safe to offer without asking for confirmation, so it has to be as easy to reach as the
 * act it reverses. A person who removed the wrong value reaches for that shortcut before they look for
 * a button, because that is what they have done in every other application they have used.
 *
 * **A documented behaviour that does not happen is worse than one nobody wrote down.** A reader of the
 * record builds on it; a consumer of the library reads it and tells their own users the shortcut
 * works. Nothing on the page contradicts the record, because a shortcut that does nothing looks
 * exactly like a shortcut nobody pressed.
 *
 * **The button is the control, in the same run.** A remedy that no route reaches is a different defect
 * — the offer is a decoration — and blaming the shortcut for it would name the wrong thing. So the
 * same removal is undone by pressing the control, and the shortcut is only accused once the remedy is
 * known to work.
 *
 * **The reading position is not moved before the shortcut is sent.** A shortcut is pressed from
 * wherever a person happens to be, which after removing a value is wherever the removal left them.
 * Placing focus somewhere convenient first would test a shortcut nobody presses that way, and would
 * turn a shortcut that only works from one element into a passing check.
 *
 * **The second question is what the remedy costs when it is given.** A control that disappears the
 * moment it is used takes the reading position with it unless something catches it, and a person
 * walking the page with the keys is returned to the beginning of the document — the price of undoing
 * one value is finding their place again, which is the cost the remedy exists to avoid.
 *
 * **The fourth is the half of the declaration that is easy to leave unwritten.** The table now says
 * the gesture waits for the offer, and a renderer that keeps its own condition instead of reading that
 * one agrees with it today and drifts the moment either moves. What the declaration means from
 * outside is two things, not one: the gesture does nothing while the offer is absent, and something
 * once it is there. A control answering it unconditionally passes every check that only looks after a
 * removal, so the silence before one is asserted too — with the acting after one in the same run, so
 * that silence is known to be the state's doing and not a dead key's.
 *
 * **The third is the boundary the same gesture has to respect.** Inside a text box that gesture
 * belongs to the platform — it takes back the last thing typed — and a field that answered it there
 * would reach past the box a person is working in and change something else entirely, while the
 * letters they meant to remove stay where they are. The two undos are not competing conveniences: one
 * of them is the operating system's, and a component does not get to take it.
 *
 * Claims under attack: A11Y-001, A11Y-004.
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

/** Both modifiers the record names, because which one is the platform's is the platform's business. */
const SHORTCUTS = ["Control+z", "Meta+z"] as const;

/**
 * The one this platform actually binds, for the case that is about the platform's own undo rather
 * than about the field's. Sending the other would prove nothing: it is not the gesture here.
 */
const PLATFORM_UNDO = process.platform === "darwin" ? "Meta+z" : "Control+z";

for (const host of HOSTS) {
  const mount = async (page: import("@playwright/test").Page, id: string, searchable = false) => {
    await page.setViewportSize({ width: 1_200, height: 700 });
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);
    await page.evaluate(({ api, mountId, options, held, searchable }) => {
      (window as never as Api)[api].mountFields(mountId, [{
        name: "m", kind: "multiselect", label: "Scelte", clearable: true, searchable, options, initialValue: held,
      }] as never);
    }, { api: host.api, mountId: id, options: OPTIONS, held: [...HELD], searchable });
    await page.locator(`[data-form="${id}"]`).waitFor({ timeout: 5_000 });
    await page.evaluate(({ api }) => (window as never as Api)[api].settle?.(), { api: host.api }).catch(() => undefined);
    await page.waitForTimeout(350);
  };

  const value = (page: import("@playwright/test").Page, id: string) =>
    page.evaluate(({ api, mountId }) =>
      JSON.stringify(((window as never as Api)[api].valueOf as unknown as (one: string) => Record<string, unknown>)(mountId)?.m),
      { api: host.api, mountId: id });

  /** Removes the first value and checks the removal both happened and was offered a remedy. */
  const removeOne = async (page: import("@playwright/test").Page, id: string) => {
    const before = await value(page, id);
    await page.locator(`[data-form="${id}"] .${classOf("chipRemove")}`).first().click({ timeout: 5_000 });
    await page.waitForTimeout(500);
    const after = await value(page, id);
    expect(after, `${host.name}: removing a value changed nothing, so there is nothing to undo`).not.toBe(before);
    const offered = await page.locator(`[data-form="${id}"] .${classOf("wayBackAction")}`).count();
    expect(offered, `${host.name}: nothing was offered to undo the removal`).toBeGreaterThan(0);
    return { before, after };
  };

  test(`the undo shortcut the record promises reaches the remedy, ${host.name}`, async ({ page }) => {
    test.setTimeout(180_000);

    // The control: the remedy works when its control is pressed. Without this, a shortcut that does
    // nothing is indistinguishable from an offer that was never wired to anything.
    await mount(page, "promise_press");
    const pressed = await removeOne(page, "promise_press");
    await page.locator(`[data-form="promise_press"] .${classOf("wayBackAction")}`).first().click({ timeout: 5_000 });
    await page.waitForTimeout(500);
    expect(
      await value(page, "promise_press"),
      `${host.name}: pressing the remedy did not restore what the removal took, so the offer is a `
      + "decoration and the shortcut below is not what is missing",
    ).toBe(pressed.before);

    const deaf: string[] = [];
    for (const shortcut of SHORTCUTS) {
      const id = `promise_${shortcut.replace("+", "_")}`;
      await mount(page, id);
      const removed = await removeOne(page, id);
      // Pressed from wherever the removal left the reading position, which is where a person's is.
      await page.keyboard.press(shortcut);
      await page.waitForTimeout(600);
      if ((await value(page, id)) !== removed.before) deaf.push(shortcut);
    }

    expect(
      deaf.length,
      `${host.name}: the remedy answers its own control and answers neither ${deaf.join(" nor ")}. `
      + "The decision that placed it says the undo shortcut reaches it, and a person who removed the "
      + "wrong value reaches for that shortcut before they look for a button — so the record promises "
      + "a way in that is not there, and nothing on the page says otherwise.",
    ).toBeLessThan(SHORTCUTS.length);
  });

  test(`the gesture waits for something to undo, ${host.name}`, async ({ page }) => {
    test.setTimeout(180_000);
    await mount(page, "awaits");

    // The premise: nothing has been taken, so the state the gesture waits for is absent.
    //
    // **Asked as "is it on offer", not "is it there", and the two are told apart by what the control
    // announces.** Whether the remedy exists is a fact about the field's design and does not change as
    // somebody works; whether it can act right now is a fact about the moment. So the element is in
    // the document from the start — counting it finds one every time, and measuring its box finds one
    // too — and what says it has nothing to offer is that it announces itself unable to act.
    const offered = await page.locator(`[data-form="awaits"] .${classOf("wayBackAction")}`).first()
      .getAttribute("aria-disabled").catch(() => null);
    expect(
      offered,
      `${host.name}: a remedy is on offer before anything was removed, so the state the gesture waits `
      + "for is already here and its silence below would say nothing",
    ).toBe("true");

    const untouched = await value(page, "awaits");
    await page.keyboard.press(PLATFORM_UNDO);
    await page.waitForTimeout(600);
    const afterEarly = await value(page, "awaits");

    // The control, in the same run: once something has been taken, the same gesture acts. Without it
    // a gesture that does nothing ever satisfies the silence above for the wrong reason.
    const removed = await removeOne(page, "awaits");
    await page.keyboard.press(PLATFORM_UNDO);
    await page.waitForTimeout(600);
    expect(
      await value(page, "awaits"),
      `${host.name}: the gesture does nothing after a removal either, so it is not waiting for `
      + "anything — it is not answering at all, and the reading above is about a dead key",
    ).toBe(removed.before);

    expect(
      afterEarly,
      `${host.name}: the gesture changed what the field holds before anything had been taken out of `
      + "it. The table says it waits for the offer; a control that answers it whenever it is pressed "
      + "agrees with that only by coincidence, and the two part company the moment either moves.",
    ).toBe(untouched);
  });

  test(`the shortcut leaves the platform's own undo alone, ${host.name}`, async ({ page }) => {
    test.setTimeout(180_000);
    await mount(page, "typing", true);
    const removed = await removeOne(page, "typing");

    await page.locator(`[data-form="typing"] .${classOf("trigger")}`).click({ timeout: 5_000 });
    await page.waitForTimeout(500);
    const box = page.locator(`.${classOf("search")}`).first();
    // A field with no place to type cannot answer this question, and answering it anyway would be
    // reporting a boundary that this arrangement does not have.
    expect(await box.count(), `${host.name} drew no place to type, so there is no platform undo here`)
      .toBeGreaterThan(0);

    await box.click({ timeout: 5_000 });
    await page.keyboard.type("Gam");
    await page.waitForTimeout(250);
    const typed = await box.inputValue();
    expect(typed, `${host.name}: nothing was typed, so the gesture below would be pressed in an empty box`)
      .not.toBe("");

    await page.keyboard.press(PLATFORM_UNDO);
    await page.waitForTimeout(500);

    // The premise: the gesture reached the box. If the letters are untouched the key went somewhere
    // else, and the field having kept its value would say nothing about who answered.
    expect(
      await box.inputValue().catch(() => typed),
      `${host.name}: the letters are unchanged after the platform's own undo, so the gesture did not `
      + "reach the box and this reads about a key that landed somewhere else",
    ).not.toBe(typed);

    expect(
      await value(page, "typing"),
      `${host.name}: the gesture typed inside a text box put a removed value back into the field. `
      + "That gesture is the platform's there — it belongs to the letters a person is typing — and "
      + "answering it reaches past the box they are working in to change something they were not "
      + "looking at.",
    ).toBe(removed.after);
  });

  test(`giving the remedy does not cost a person their place, ${host.name}`, async ({ page }) => {
    test.setTimeout(180_000);
    await mount(page, "place");
    await removeOne(page, "place");

    const remedy = page.locator(`[data-form="place"] .${classOf("wayBackAction")}`).first();
    await remedy.focus();
    await page.waitForTimeout(150);
    const landed = await page.evaluate((one) => document.activeElement?.matches(one) ?? false,
      `.${classOf("wayBackAction")}`);
    expect(landed, `${host.name}: the remedy could not be focused, so this reads about something else`).toBe(true);

    await page.keyboard.press("Enter");
    await page.waitForTimeout(600);

    const at = await page.evaluate(() => {
      const active = document.activeElement;
      if (active === null || active === document.body) return "nowhere";
      const named = active.closest("[class*='mdy-']");
      return named === null ? active.tagName.toLowerCase()
        : Array.from(named.classList).find((one) => one.startsWith("mdy-")) ?? active.tagName.toLowerCase();
    });

    expect(
      at,
      `${host.name}: after undoing a removal from the keyboard the reading position is ${at}. The `
      + "control was used and then withdrawn, and it took the person's place in the document with it "
      + "— so undoing one value costs finding their way back to the field, which is the cost the "
      + "remedy exists to save them.",
    ).not.toBe("nowhere");
  });
}
