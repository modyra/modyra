/**
 * Every operable thing inside an open panel can be reached from a keyboard.
 *
 * A panel is opened to be operated. An action drawn inside one that no key reaches is invisible to
 * anybody not using a pointer, and invisible to the suite too: every other check asks whether an
 * element is present, styled, named or announced. None presses a key inside an open panel and asks
 * where it can get to. That is how a colours panel shipped a custom-entry action for years that Tab
 * closed the panel before reaching and the arrows could not leave the grid to touch.
 *
 * **Reachable is decided against the declarations, and the first of the three is the one that lies.**
 *
 *   tab order    — only where the kind's `Tab@open` intent is `move`. Where it is `cancel`, the first
 *                  press takes the panel away, so a bare `<button>` inside is focusable in sequence
 *                  and unreachable in fact. The first version of this file counted the tag alone and
 *                  therefore absolved every button in every panel — including the one the whole
 *                  guardian was written for.
 *   roving index — the panel owns focus and names an active descendant across its children.
 *   declared key — `MDY_WIDGET_KEYBOARD` carries a binding, `when: "open"`, naming this part in `on`.
 *                  A **repeated** part cannot be a tab stop at all: a Tab cannot say *which* row it
 *                  means, so `structure.nodes` deciding `repeated` is what makes a declared key the
 *                  only honest answer for one, and a tab stop the wrong demand.
 *
 * Two things the browser had to teach this file, and neither is visible from jsdom or from a green:
 * the panels are portalled and positioned, so they have no `offsetParent` and read as shut unless
 * visibility comes from their rects; and `mountFields` creates a `section[data-form]`, not an element
 * carrying that id — a selector that matches nothing mounts nothing, and a spec that mounts nothing
 * passes every claim about what it never opened.
 */
import { expect, test } from "@playwright/test";
import { MDY_WIDGET_CONTRACTS, MDY_WIDGET_KEYBOARD } from "@modyra/widgets";
import { HOSTS } from "./bench";

const OPTIONS = ["Roma", "Milano", "Napoli", "Torino"].map((label) => ({ value: label.toLowerCase(), label }));

/** Every kind that declares what Tab does while its panel is open. */
const KINDS = Object.entries(MDY_WIDGET_KEYBOARD)
  .filter(([, keys]) => keys.some((each) => each.key === "Tab" && each.when === "open"))
  .map(([kind]) => kind);

/** What a key already names for this kind while open, as the classes those parts carry. */
function classesAKeyNames(kind: string): string[] {
  const named = new Set(
    (MDY_WIDGET_KEYBOARD[kind] ?? [])
      .filter((binding) => binding.when === "open" && typeof binding.on === "string")
      .map((binding) => String(binding.on)),
  );
  const parts = MDY_WIDGET_CONTRACTS[kind]?.parts ?? {};
  return [...named].flatMap((part) => parts[part]?.classes ?? []);
}

/**
 * The classes of parts a Tab could never name, whatever the kind's intent.
 *
 * A repeated part is drawn once per row, so "the tab order reaches it" is not a claim a person can
 * act on: it reaches *one* of them, and which one is not something a Tab can be asked. Absence of
 * the flag reads as false, which is the safe direction — a part that is not declared repeated is
 * treated as singular and therefore allowed a tab stop.
 */
function repeatedClasses(kind: string): string[] {
  const nodes = MDY_WIDGET_CONTRACTS[kind]?.structure?.nodes ?? [];
  const parts = MDY_WIDGET_CONTRACTS[kind]?.parts ?? {};
  return nodes
    .filter((node) => node.repeated === true)
    .flatMap((node) => parts[String(node.part)]?.classes ?? []);
}

/**
 * Panel actions this guardian finds and does not fail on, per renderer, with the question they wait
 * for.
 *
 * Recorded rather than excluded: the list prints, it may only shrink, and an entry that stops being
 * a finding fails so it cannot outlive its reason. The calendar's header buttons move the month and
 * switch the view, and the datepicker declares `PageUp`/`PageDown` and the arrows for exactly those
 * acts — so the *function* is reachable by key while the *button* is not. Whether a pointer-only
 * control duplicating a key-reachable action is a defect is an interaction decision, and this file
 * is not the place it gets taken.
 */
const AWAITING_A_DECISION: Record<string, string[]> = {
  plain: [
    "datepicker: button.mdy-datepicker__header-label",
    "datepicker: button.mdy-datepicker__nav-btn",
  ],
  lit: [
    "datepicker: button.mdy-datepicker__nav-btn",
    "datepicker: button.mdy-datepicker__view-toggle",
    "daterange: button.mdy-datepicker__nav-btn",
    "daterange: button.mdy-datepicker__view-toggle",
  ],
  angular: [
    "datepicker: button.mdy-datepicker__nav-btn",
    "datepicker: button.mdy-datepicker__view-toggle",
  ],
};

for (const host of HOSTS) {
  test(`every action in an open panel can be reached, ${host.name}`, async ({ page }) => {
    test.setTimeout(300_000);
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    expect(KINDS.length, "no kind declares a panel, so this test measured nothing").toBeGreaterThan(3);

    const unreachable: string[] = [];
    const opened: string[] = [];
    const inspected: string[] = [];

    for (const kind of KINDS) {
      const id = `nk-${kind}`;
      await page.evaluate(({ mountId, k, api, options }) => {
        (window as never as Record<string, { mountFields(i: string, f: unknown[]): unknown }>)[api]
          .mountFields(mountId, [{ name: "x", kind: k, label: "X", options }]);
      }, { mountId: id, k: kind, api: host.api, options: OPTIONS });
      await page.waitForTimeout(280);
      await page.locator(`[data-form="${id}"] [aria-haspopup]`).first().click({ timeout: 5_000 }).catch(() => undefined);
      await page.waitForTimeout(320);

      const popupClasses = MDY_WIDGET_CONTRACTS[kind]?.parts?.popup?.classes ?? [];
      const tabStaysInside = (MDY_WIDGET_KEYBOARD[kind] ?? []).some(
        (binding) => binding.key === "Tab" && binding.when === "open" && binding.intent === "move",
      );

      const found = await page.evaluate(({ declaredClasses, repeated, popups, tabCounts, movesWithArrows }) => {
        const panel = popups.map((cls) => document.querySelector(`.${cls}`)).find((node) => node !== null) ?? null;
        if (panel === null || panel.getClientRects().length === 0) return null;

        const operable = [...panel.querySelectorAll<HTMLElement>(
          'button, [role="button"], input, select, textarea, a[href], [role="option"], [role="switch"], [tabindex]',
        )].filter((element) => element.getClientRects().length > 0);

        const owner = document.querySelector("[aria-activedescendant]");
        const roving = owner === null ? null : owner.getAttribute("aria-activedescendant");

        const mute: string[] = [];
        for (const element of operable) {
          const index = element.getAttribute("tabindex");
          const focusableInSequence = index === null
            ? /^(button|input|select|textarea|a)$/i.test(element.tagName)
            : Number(index) >= 0;
          const isRepeated = repeated.some((cls) => element.classList.contains(cls));
          if (tabCounts && focusableInSequence && !isRepeated) continue;
          // A repeated part inside a panel whose kind declares arrow movement while open is reached
          // by that movement. Colours moves *real focus* between swatches rather than naming an
          // active descendant, so the aria check below cannot see it — and reporting ten swatches as
          // unreachable would be this guardian inventing the defect it exists to find.
          if (isRepeated && movesWithArrows) continue;
          if (roving !== null && element.id !== "" && panel.querySelector(`#${CSS.escape(roving)}`) !== null) continue;
          if (declaredClasses.some((cls) => element.classList.contains(cls))) continue;
          mute.push(`${element.tagName.toLowerCase()}.${element.className || "(no class)"}`);
        }
        return { count: operable.length, mute };
      }, {
        movesWithArrows: (MDY_WIDGET_KEYBOARD[kind] ?? []).some(
          (binding) => binding.when === "open" && binding.intent === "move" && binding.key.startsWith("Arrow"),
        ),
        declaredClasses: classesAKeyNames(kind),
        repeated: repeatedClasses(kind),
        popups: popupClasses,
        tabCounts: tabStaysInside,
      });

      await page.keyboard.press("Escape").catch(() => undefined);
      if (found === null) continue;
      opened.push(kind);
      if (found.count > 0) inspected.push(kind);
      for (const one of found.mute) unreachable.push(`${kind}: ${one}`);
    }

    // The premise, per kind and before the claim. A panel that never opened, or opened holding
    // nothing operable, passes every assertion below by having no subject — and the first version of
    // this file did exactly that for all six kinds while reporting three green renderers.
    expect(
      opened.length,
      `no panel opened for any kind (tried ${KINDS.join(", ")}), so this measured nothing`,
    ).toBeGreaterThan(3);
    expect(
      inspected.length,
      `panels opened for ${opened.join(", ")} but only ${inspected.join(", ") || "none"} held anything operable`,
    ).toBeGreaterThan(2);

    // Recorded per renderer, because the evidence is: the three do not draw the same header, so a
    // single list would report an entry as stale in one renderer while it is live in another.
    const recorded = AWAITING_A_DECISION[host.name] ?? [];
    const open = unreachable.filter((one) => !recorded.includes(one));
    const stale = recorded.filter((one) => !unreachable.includes(one));
    expect(
      stale,
      `recorded as awaiting a decision and no longer found — prune it, or the record outlives its `
        + `reason: ${JSON.stringify(stale)}`,
    ).toEqual([]);

    expect(
      open,
      `drawn inside an open panel and reached by no key — not the tab order (or the kind's Tab `
        + `closes the panel, or the part is repeated so a Tab cannot name which one), not a roving `
        + `index, and no binding names their part while open: ${JSON.stringify(open)}`,
    ).toEqual([]);
  });
}
