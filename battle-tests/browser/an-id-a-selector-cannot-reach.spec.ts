/**
 * An id a contract publishes can be reached by the selector a consumer would write.
 *
 * The parts a widget publishes carry ids, and an id exists to be used: an `aria-controls` points at
 * one, a stylesheet selects one, a consumer's own `aria-describedby` names one. Two of those are exact
 * string matches and survive anything; **a selector is not**, and `#` , `.` , `"` and a space each
 * mean something to a CSS parser.
 *
 * An option's id embeds the option's value, so a value with ordinary punctuation in it produces an id
 * that `document.getElementById` resolves and `document.querySelector("#" + id)` cannot — and for two
 * of the four characters below, **throws** rather than returning nothing, so a caller that handles
 * *not found* still gets an exception.
 *
 * **This asserts the property and not the repair, which is why it can exist before the repair is
 * chosen.** Hashing the value, numbering the options and escaping the punctuation are three different
 * contracts and this file is satisfied by all three: it never looks at what the id contains, only at
 * whether the selector a consumer would write reaches the element the id names. A spec that pinned one
 * of the three would be choosing for whoever fixes it — which is the mistake that nearly cost a
 * renderer a button built to satisfy a regular expression.
 *
 * Nothing an assistive technology does is broken by this, and that is exactly why it needs a check.
 * `aria-activedescendant` resolves, `getElementById` resolves, every reader is served — so it survives
 * review, and the only path it breaks is the one a person writes by hand.
 *
 * Claims under attack: API-001, UI-011.
 */

import { expect, test } from "@playwright/test";
import { HOSTS } from "./bench";

/** Ordinary values, each carrying one character a CSS parser reads as syntax. */
const PUNCTUATED = [
  { value: "with space", label: "With space" },
  { value: "hash#one", label: "Hash" },
  { value: "dot.two", label: "Dot" },
  { value: "quote\"three", label: "Quote" },
  { value: "plain", label: "Plain" },
];

for (const host of HOSTS) {
  test(`every id a control publishes is reachable by a selector, ${host.name}`, async ({ page }) => {
    test.setTimeout(150_000);
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    await page.evaluate(({ api, options }) => {
      (window as never as Record<string, Record<string, (...a: never[]) => unknown>>)[api]
        .mountFields("ids", [{ name: "pick", kind: "select", label: "S", options }] as never);
    }, { api: host.api, options: PUNCTUATED });
    await page.waitForTimeout(400);
    // Open it: the option ids do not exist until the list is built.
    await page.locator('[data-form="ids"] button, [data-form="ids"] [aria-haspopup]')
      .first().click({ timeout: 4_000 }).catch(() => undefined);
    await page.waitForTimeout(350);

    const read = await page.evaluate(() => {
      const ids = Array.from(document.querySelectorAll("[id]"))
        .map((element) => element.id)
        .filter((id) => id.startsWith("pick__"));
      return ids.map((id) => {
        let reached: boolean | "throws";
        try {
          reached = document.querySelector(`#${id}`) !== null;
        } catch {
          reached = "throws";
        }
        return { id, byId: document.getElementById(id) !== null, reached };
      });
    });

    // The premise: this control published ids at all. A renderer that publishes none has a different
    // defect and a different file — nothing here would be measuring it.
    expect(read.length, `${host.name} published no ids for a select, so nothing here is being reached for`).toBeGreaterThan(2);

    // And the premise behind the premise: the values really did carry punctuation into the ids. If a
    // renderer numbered its options the ids would be plain, this would pass, and it would be right.
    expect(
      read.every((entry) => entry.byId),
      `an id this control published does not resolve by \`getElementById\` either, which is a broken ` +
        `id rather than an unreachable one`,
    ).toBe(true);

    const unreachable = read.filter((entry) => entry.reached !== true);
    expect(
      unreachable.map((entry) => `${entry.id} → ${entry.reached === "throws" ? "throws" : "no match"}`),
      `${unreachable.length} of ${read.length} published ids cannot be reached by \`querySelector\`, ` +
        `and ${unreachable.filter((entry) => entry.reached === "throws").length} of those throw rather ` +
        `than miss — so a consumer who handles "not found" still gets an exception. Every reader is ` +
        `served, which is why this survives review: the only path it breaks is the one a person writes`,
    ).toEqual([]);
  });
}
