/**
 * How big the things you press are, and how far apart.
 *
 * A pointer target has a floor: 24×24 CSS pixels. Under it, a target passes only if a 24px circle
 * centred on it reaches no other target's circle — the size may be traded for space, but not for
 * nothing. Both halves are here because a control can fail either one, and this control fails both:
 * the remove button is two pixels short on height, and the nearest pair of targets in the field are
 * closer than the exemption allows.
 *
 * **This became measurable the day the chips left the opener.** While the ✕ sat inside the control it
 * shrinks, "the distance to the nearest other target" included its own ancestor, and a distance from a
 * thing to its container is not a distance. The spacing exemption was not failing — it was
 * unevaluable, which is a different thing and a worse one, because nothing reported it.
 *
 * Who this is for is not an abstraction. Aim-for-the-middle is the only strategy available to someone
 * using a head pointer, a switch, or a finger on a moving train, and it is the strategy a tremor makes
 * unreliable. Two pixels is not a rounding error to them; it is the difference between the control
 * they meant and the one beside it. In this field the one beside it deletes a value.
 *
 * **The measurement is over the field's own pressable controls, in their rendered geometry**, rather
 * than against a list of parts written here: a kind that gains a control gains it in this check too,
 * and a renderer that draws one nobody declared is measured all the same.
 *
 * The floor is stated once, as a constant, because it is a published number and not a preference.
 *
 * Claims under attack: A11Y-002, UI-005.
 */

import { expect, test } from "@playwright/test";

import { HOSTS } from "./bench";

type Api = Record<string, Record<string, (...args: never[]) => unknown>>;

/** WCAG 2.5.8 Target Size (Minimum), in CSS pixels. */
const FLOOR = 24;

/**
 * The root text sizes this runs at, and the reason the small one is here.
 *
 * A target expressed in `rem` grows with the reader's text, which is the point — and it **shrinks**
 * with it too. An application that installs this library is free to write `html { font-size: 62.5% }`,
 * the old ten-pixel trick, and it is still common. Every `rem` in the sheet is then five eighths of
 * what it was, and a floor stated as `1.5rem` lands at 15 CSS pixels.
 *
 * **Nothing here controls that declaration and nothing can see it.** It is the same shape as the
 * browser floor: the decision belongs to somebody else, arrives without warning, and the sheet stays
 * "proportional and correct" while the rendered result stops conforming.
 *
 * 200% is the direction everybody tests, and a target only grows there. **62.5% is the one direction
 * in which a rem-sized target falls below its floor, and it is the one nobody runs.**
 */
const ROOT_SIZES = ["62.5%", "100%", "200%"] as const;

const OPTIONS = Array.from({ length: 4 }, (_, index) => ({ value: `v${index}`, label: `Scelta ${index}` }));

for (const host of HOSTS) {
  for (const root of ROOT_SIZES) {
  test(`every target is big enough or far enough at root ${root}, ${host.name}`, async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 700 });
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    // Set before mounting, so the field is built under the text size rather than reflowed into it.
    await page.evaluate((size) => { document.documentElement.style.fontSize = size; }, root);

    await page.evaluate(({ api, options }) => {
      (window as never as Api)[api].mountFields("targets", [{
        name: "m", kind: "multiselect", label: "Scelte", clearable: true,
        options, initialValue: [options[0].value, options[1].value],
      }] as never);
    }, { api: host.api, options: OPTIONS });

    await page.locator('[data-form="targets"]').waitFor({ timeout: 5_000 });
    await page.evaluate(({ api }) => (window as never as Api)[api].settle?.(), { api: host.api }).catch(() => undefined);
    await page.waitForTimeout(700);

    const measured = await page.evaluate((floor) => {
      // Scoped to the field, not to the form: the page around it carries controls of its own — a
      // submit button among them — and they are the host's, not the widget's.
      const scope = '[data-form="targets"] .mdy-input-wrapper';
      const targets = Array.from(document.querySelectorAll(`${scope} button, ${scope} [role='button'], ${scope} a[href]`))
        .map((element) => ({
          name: element.className.split(/\s+/).find((one) => one.startsWith("mdy-")) ?? element.tagName.toLowerCase(),
          box: element.getBoundingClientRect(),
        }))
        .filter((target) => target.box.width > 0 && target.box.height > 0);

      const undersized = targets.filter((target) => target.box.width < floor || target.box.height < floor);

      // The exemption: an undersized target passes if no other target comes within the floor of it.
      const crowded: string[] = [];
      for (const target of undersized) {
        for (const other of targets) {
          if (other === target) continue;
          const horizontal = Math.max(0, Math.max(target.box.x - other.box.right, other.box.x - target.box.right));
          const vertical = Math.max(0, Math.max(target.box.y - other.box.bottom, other.box.y - target.box.bottom));
          const gap = Math.round(Math.hypot(horizontal, vertical));
          if (gap < floor) {
            crowded.push(`${target.name} is ${Math.round(target.box.width)}×${Math.round(target.box.height)} and ${gap}px from ${other.name}`);
            break;
          }
        }
      }
      return {
        count: targets.length,
        undersized: undersized.map((target) => `${target.name} ${Math.round(target.box.width)}×${Math.round(target.box.height)}`),
        crowded,
      };
    }, FLOOR);

    // Nothing pressable means nothing measured, and an empty list of failures would say so wrongly.
    expect(
      measured.count,
      `${host.name} drew no pressable control in the field at root ${root}`,
    ).toBeGreaterThan(1);

    expect(
      measured.crowded,
      `${host.name} at root ${root}: ${measured.undersized.length} target(s) are under `
      + `${FLOOR}×${FLOOR} — ${measured.undersized.join(", ")} — and the spacing that would excuse `
      + `them is not there: ${measured.crowded.join("; ")}.`
      + (root === "62.5%"
        ? " This is the reduced text size an application may set on its own root, which shrinks every "
          + "rem in the sheet without anything here being able to see it."
        : ""),
    ).toEqual([]);
  });
  }
}
