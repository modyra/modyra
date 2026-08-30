import { expect, test } from "@playwright/test";

/**
 * The caption names the group; each choice names itself. ADR 0175.
 *
 * A group's words belong to the container, and the imperative naming that gives a control its name
 * finds the first `input` in the element — which inside a set of choices is the first radio. So the
 * field's caption landed on it, and a group of choices was announced "Plan", "Pro", "Enterprise":
 * the person who most needed to hear the first option's own name heard the question instead, and
 * heard the question twice.
 *
 * Only the first, which is what made it survive: every other option was right, so the group read
 * correctly from the second choice onward.
 */
const GROUPS = [".mdy-radio-group", ".mdy-segmented"];

for (const group of GROUPS) {
  test(`${group}: the caption is the group's and no option wears it`, async ({ page }) => {
    await page.goto("/");
    const host = page.locator(group).first();
    await expect(host, `no ${group} on the page, so this asserts nothing`).toBeVisible();

    // The premise: a group named by nothing would satisfy the assertion below without meaning it.
    const named = await host.evaluate((el) => el.getAttribute("aria-labelledby") ?? el.getAttribute("aria-label"));
    expect(named, "the group is named by neither its caption nor any words").toBeTruthy();

    const carried = await host.evaluate((el) =>
      [...el.querySelectorAll("input")].map((one) => one.getAttribute("aria-label")).filter((one) => one !== null));
    expect(carried, "an option carries a name of its own beside the group's, so it is announced by "
      + "the field's question rather than by the choice it offers").toEqual([]);
  });
}
