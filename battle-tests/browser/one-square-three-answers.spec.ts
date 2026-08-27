/**
 * Whether the coloured square beside a colour field does one thing.
 *
 * The field shows a small square filled with the colour currently chosen. It is the most recognisable
 * shape in this whole control: every operating system ships one, and a person has pressed it in every
 * drawing program and settings panel they have ever used. What it does when pressed is the question,
 * and there is a defensible answer either way — it can open the platform's own chooser, which is what
 * the shape has always meant, or it can open the field's own list of ready colours, which is nearer
 * and cheaper.
 *
 * **This file does not choose between them.** It says that a document describing a colour field gets
 * one answer, not one per renderer. Today the same square opens the platform's wheel in one and the
 * field's own list in the other two, and an application that changes renderer changes what the most
 * recognisable control on the field does — from a document that says nothing on the matter.
 *
 * **The square is the wrapper, not the tint.** The part that carries the colour sits inside the part
 * that takes the press, and reading the inner one measures an element nobody presses: it reports no
 * chooser and no list and looks like a square that does nothing at all. This cost two sessions an
 * afternoon of disagreeing about a measurement they had each taken correctly of different things.
 *
 * **Both doors are counted**, because a page can open the platform's chooser by asking it directly or
 * by pressing the element it listens to, and a press that was cancelled reached nothing.
 *
 * **The premise is that the square was pressed at all.** A renderer that draws no such square, or one
 * whose square cannot be reached, has no answer here and is reported rather than counted as agreeing.
 *
 * Claims under attack: UI-005, A11Y-004.
 */

import { expect, test } from "@playwright/test";
import { MDY_WIDGET_CONTRACTS } from "@modyra/widgets";

import { HOSTS } from "./bench";

type Api = Record<string, Record<string, (...args: never[]) => unknown>>;

const classOf = (part: string): string => {
  const parts = (MDY_WIDGET_CONTRACTS as unknown as Record<string, { parts: Record<string, { classes: string[] }> }>)
    .colors.parts;
  return (parts[part]?.classes ?? [])[0] ?? "";
};

/** Watch both ways a page can open the platform's chooser, and discount a cancelled press. */
const watchTheDoors = (page: import("@playwright/test").Page, nativeClass: string) => page.evaluate((cls) => {
  const store = window as never as Record<string, number>;
  store.mdyAsked = 0;
  const asked = HTMLInputElement.prototype.showPicker;
  if (typeof asked === "function") {
    HTMLInputElement.prototype.showPicker = function patched(this: HTMLInputElement) {
      store.mdyAsked += 1;
      try { return asked.call(this); } catch { return undefined; }
    };
  }
  document.addEventListener("click", (event) => {
    const target = event.target as Element | null;
    if (target === null || !target.matches(`.${cls}, input[type="color"]`)) return;
    if (event.defaultPrevented) return;
    store.mdyAsked += 1;
  });
}, nativeClass);

test("one coloured square is one act, whoever drew it", async ({ page }) => {
  test.setTimeout(300_000);

  const did: Record<string, string> = {};

  for (const host of HOSTS) {
    await page.setViewportSize({ width: 1_200, height: 800 });
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    await page.evaluate(({ api }) => {
      (window as never as Api)[api].mountFields("square", [{
        name: "c", kind: "colors", label: "Colore", initialValue: "#4361ee",
      }] as never);
    }, { api: host.api });
    await page.locator('[data-form="square"]').waitFor({ timeout: 5_000 });
    await page.evaluate(({ api }) => (window as never as Api)[api].settle?.(), { api: host.api }).catch(() => undefined);
    await page.waitForTimeout(250);

    await watchTheDoors(page, classOf("control"));

    // The element that takes the press, not the one that carries the colour.
    const square = page.locator(`[data-form="square"] .${classOf("nativePicker")}`).first();
    expect(
      await square.count(),
      `${host.name} draws no square beside the field, so it has no answer to give here`,
    ).toBeGreaterThan(0);

    const listWasOpen = await page.locator(`.${classOf("popup")}`).first().isVisible().catch(() => false);
    expect(listWasOpen, `${host.name} had its list of ready colours already open before anything was pressed`).toBe(false);

    await square.click({ timeout: 5_000 }).catch(() => undefined);
    await page.waitForTimeout(450);

    const list = await page.locator(`.${classOf("popup")}`).first().isVisible().catch(() => false);
    const chooser = await page.evaluate(() => (window as never as Record<string, number>).mdyAsked);

    did[host.name] = chooser > 0 && list ? "opens both"
      : chooser > 0 ? "opens the platform's chooser"
      : list ? "opens the field's own list"
      : "opens nothing";

    expect(
      did[host.name],
      `${host.name}: pressing the square opened nothing at all — neither the platform's chooser nor `
      + "the field's list. A square that looks like the most recognisable control on the page and "
      + "answers no press is the one outcome nobody could defend",
    ).not.toBe("opens nothing");
  }

  expect(
    [...new Set(Object.values(did))].length,
    "one document, one square, and each renderer does something different with it: "
    + `${Object.entries(did).map(([name, what]) => `${name} ${what}`).join(", ")}. `
    + "Either answer is defensible and the document chooses neither, so this is not a decision — it "
    + "is the absence of one. An application that changes renderer changes what the most recognisable "
    + "control on the field does, and a person who learned it in one is wrong in the other.",
  ).toBe(1);
});

test("one name does not sit on two different acts", async ({ page }) => {
  test.setTimeout(300_000);

  /** For each renderer, the name of the square and the name of the command beside it. */
  const named: Record<string, { square: string; beside: string }> = {};

  for (const host of HOSTS) {
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);
    await page.evaluate(({ api }) => {
      (window as never as Api)[api].mountFields("naming", [{
        name: "c", kind: "colors", label: "Colore", initialValue: "#4361ee",
      }] as never);
    }, { api: host.api });
    await page.locator('[data-form="naming"]').waitFor({ timeout: 5_000 });
    await page.waitForTimeout(250);

    const nameOf = (part: string) => page.evaluate(({ cls }) => {
      const found = document.querySelector(`[data-form="naming"] .${cls}`) as HTMLElement | null;
      if (found === null) return "(absent)";
      const inner = found.querySelector("input, button") as HTMLElement | null;
      return (found.getAttribute("aria-label")
        ?? inner?.getAttribute("aria-label")
        ?? found.textContent
        ?? "").trim() || "(unnamed)";
    }, { cls: classOf(part) });

    named[host.name] = { square: await nameOf("nativePicker"), beside: await nameOf("toggle") };
  }

  // Whether any one name is used for the square in one renderer and for the command beside it in
  // another. That is worse than a vague name: a vague name is unhelpful everywhere, and this one is
  // helpful and wrong.
  const collisions: string[] = [];
  for (const [oneName, one] of Object.entries(named)) {
    for (const [otherName, other] of Object.entries(named)) {
      if (oneName === otherName) continue;
      const shared = one.square.toLowerCase();
      if (shared === "(unnamed)" || shared === "(absent)") continue;
      if (shared === other.beside.toLowerCase()) {
        collisions.push(`"${one.square}" names the square in ${oneName} and the command beside it in ${otherName}`);
      }
    }
  }

  expect(
    [...new Set(collisions)],
    "the same words name two different acts depending on who drew the field: "
    + `${JSON.stringify(named)}. A person who learns what a command is called in one application `
    + "hears the same words in another and gets something else. A vague name is unhelpful "
    + "everywhere; this one is helpful and wrong.",
  ).toEqual([]);
});
