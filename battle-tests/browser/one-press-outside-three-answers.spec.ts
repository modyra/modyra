/**
 * Whether pressing somewhere else does the same thing in all three.
 *
 * A palette is open. A person presses something else on the page — another field, a heading, the
 * background. What should happen is a real question with a defensible answer either way: a panel that
 * dismisses keeps the page uncluttered and matches almost every menu a person has used; a panel that
 * stays lets someone consult the rest of the form while choosing. Products ship both.
 *
 * **This file does not answer it.** It says the answer must not depend on which renderer drew the
 * field. One document, one act, three different outcomes is the one state nobody chose: an application
 * that changes renderer changes what a press does, and an organisation running two of them has two
 * behaviours in the same building — from a document that says nothing on the matter.
 *
 * **The act is a press, not a focus.** Dismissal is commonly hung on a pointer landing outside rather
 * than on focus moving, and the two come apart: a press on a heading moves no focus at all. Driving
 * this with `focus()` measures a different mechanism and can find agreement where a person would find
 * none.
 *
 * **Separate from the window losing focus.** A platform's own colour chooser opening in its own window
 * blurs the page without moving anything inside it, and a panel is required to survive that — a
 * different act with a different right answer, checked elsewhere.
 *
 * **The premise is that each renderer opened a panel to press away from.** A renderer whose panel
 * never appeared agrees with everyone by having no behaviour, and this reports that instead.
 *
 * Claims under attack: UI-005.
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

test("a press outside an open palette does one thing, whoever drew it", async ({ page }) => {
  test.setTimeout(300_000);

  const answer: Record<string, string> = {};

  for (const host of HOSTS) {
    await page.setViewportSize({ width: 1_200, height: 800 });
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    await page.evaluate(({ api }) => {
      (window as never as Api)[api].mountFields("outside", [{
        name: "c", kind: "colors", label: "Colore",
      }] as never);
      // Somewhere plainly outside the field, and nothing a person could mistake for part of it.
      const away = document.createElement("p");
      away.id = "mdy-away";
      away.textContent = "altrove";
      away.style.cssText = "position:fixed;bottom:8px;left:8px;padding:16px;background:#eee;z-index:1";
      document.body.appendChild(away);
    }, { api: host.api });
    await page.locator('[data-form="outside"]').waitFor({ timeout: 5_000 });
    await page.evaluate(({ api }) => (window as never as Api)[api].settle?.(), { api: host.api }).catch(() => undefined);
    await page.waitForTimeout(250);

    await page.locator(`[data-form="outside"] .${classOf("toggle")}`).first().click({ timeout: 5_000 });
    await page.waitForTimeout(350);

    const panel = page.locator(`.${classOf("popup")}`).first();
    expect(
      await panel.isVisible().catch(() => false),
      `${host.name} pressed the toggle and no panel appeared, so there was nothing to press away from`,
    ).toBe(true);

    await page.locator("#mdy-away").click({ timeout: 5_000 });
    await page.waitForTimeout(450);

    answer[host.name] = await panel.isVisible().catch(() => false) ? "stays open" : "dismisses";
  }

  expect(
    [...new Set(Object.values(answer))].length,
    "one act on one document gets two different answers: "
    + `${Object.entries(answer).map(([name, what]) => `${name} ${what}`).join(", ")}. `
    + "Which of the two is right is a real question with a defensible answer either way, and this is "
    + "not an answer to it — it is the absence of one. An application that changes renderer changes "
    + "what pressing elsewhere does, from a document that takes no position.",
  ).toBe(1);
});
