/**
 * Every operable thing inside an open panel can be reached from a keyboard.
 *
 * A panel is opened to be operated. An action drawn inside one that no key reaches is invisible to
 * anybody not using a pointer — and it stays invisible to the suite too, because every other check
 * asks whether an element is *present*, styled, named or announced. None of them presses a key
 * inside an open panel and asks where it can get to. That is how a colours panel shipped a custom
 * entry action for years that Tab closed the panel before reaching and the arrows could not leave
 * the grid to touch.
 *
 * **Reachable is decided against the declarations, not against the DOM alone.** There are three
 * legitimate ways for an action to be operable, and only one of them leaves a mark a DOM scan would
 * accept:
 *
 *   tab order      — the element is focusable in sequence, so Tab arrives at it;
 *   roving index   — the panel owns focus and moves an active descendant across its children, so the
 *                    element is reached by an arrow while focus never leaves the owner;
 *   declared key   — `MDY_WIDGET_KEYBOARD` carries a binding for this kind, `when: "open"`, naming
 *                    this part in `on`. A per-row action cannot be a tab stop — a Tab cannot say
 *                    *which* row it means — so a declared key is the only honest answer for one.
 *
 * A check that demanded a tab stop would be wrong for the third case and would push a renderer to
 * make every row's button tabbable, which is a worse page. A check that read only the DOM cannot see
 * the third at all. So it reads both, and what it fails is an element with **none** of the three.
 *
 * It reads `MDY_WIDGET_KEYBOARD` through the package's own door, as a consumer would. Whether a
 * declaration exists is a fact no rendered page carries: a button reached by a declared key looks
 * exactly like one reached by nothing, so the DOM alone cannot tell the two apart.
 */
import { expect, test } from "@playwright/test";
import { MDY_WIDGET_CONTRACTS, MDY_WIDGET_KEYBOARD } from "@modyra/widgets";
import { HOSTS, bench, open } from "./bench";



const CITIES = ["Roma", "Milano", "Napoli", "Torino"].map((label) => ({ value: label.toLowerCase(), label }));

/** Parts of this kind a key already names while the panel is open, by the class each part carries. */
function partsAKeyNames(kind: string): string[] {
  const named = new Set(
    (MDY_WIDGET_KEYBOARD[kind] ?? [])
      .filter((binding: { when?: string; on?: string }) => binding.when === "open" && typeof binding.on === "string")
      .map((binding: { on: string }) => binding.on),
  );
  const parts = MDY_WIDGET_CONTRACTS[kind]?.parts ?? {};
  return [...named].flatMap((part) => (parts as Record<string, { classes?: string[] }>)[part]?.classes ?? []);
}

for (const host of HOSTS) {
  test(`every action in an open panel can be reached, ${host.name}`, async ({ page }, testInfo) => {
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    const { root } = await bench(page, host, "empty", { options: CITIES, searchable: false });
    await open(page, root);

    const covered = partsAKeyNames("multiselect");

    const unreachable = await page.evaluate(({ declaredClasses }) => {
      const panel = document.querySelector(".mdy-multiselect__dropdown, .mdy-multiselect-overlay__panel, .mdy-popup");
      if (panel === null) return { panel: false, found: [] as string[] };

      // What a person can operate: the things a browser or an author made interactive. Read from the
      // element rather than from a class list, because the question is what a user agent will do
      // with it, not what a renderer called it.
      const operable = [...panel.querySelectorAll<HTMLElement>(
        'button, [role="button"], input, select, textarea, a[href], [role="option"], [role="switch"], [tabindex]',
      )].filter((element) => element.offsetParent !== null || element.getClientRects().length > 0);

      const owner = document.querySelector("[aria-activedescendant]");
      const roving = owner === null ? null : owner.getAttribute("aria-activedescendant");

      const found: string[] = [];
      for (const element of operable) {
        const index = element.getAttribute("tabindex");
        const inTabOrder = index === null
          ? /^(button|input|select|textarea|a)$/i.test(element.tagName)
          : Number(index) >= 0;
        if (inTabOrder) continue;

        // A roving index reaches anything the owner can name, which is any child carrying an id the
        // owner's `aria-activedescendant` could point at. One of them is named right now; the rest
        // are its siblings by construction.
        const named = roving !== null && element.id !== "" && panel.querySelector(`#${CSS.escape(roving)}`) !== null;
        if (named && element.id !== "") continue;

        const byDeclaredKey = declaredClasses.some((cls) => element.classList.contains(cls));
        if (byDeclaredKey) continue;

        found.push(`${element.tagName.toLowerCase()}.${element.className || "(no class)"}`);
      }
      return { panel: true, found, inspected: operable.length, roving };
    }, { declaredClasses: covered });

    expect(unreachable.panel, "no panel was open, so this test measured nothing").toBe(true);
    // The premise, asserted before the claim: a panel with nothing operable in it passes this test
    // by having nothing to fail, which is the shape of a check that never performs its act.
    expect(
      unreachable.inspected,
      "the open panel held nothing operable, so a green here says nothing about reachability",
    ).toBeGreaterThan(1);
    expect(
      unreachable.found,
      `these are drawn inside an open panel and no key reaches them — not in the tab order, not `
        + `named by a roving index, and no MDY_WIDGET_KEYBOARD binding for this kind names their `
        + `part while open. A per-row action is legitimately not a tab stop, but then it needs a `
        + `declared key: ${JSON.stringify(unreachable.found)}`,
    ).toEqual([]);
    void testInfo;
  });
}
