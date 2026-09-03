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
import { MDY_WIDGET_CONTRACTS, MDY_WIDGET_KEYBOARD, timepickerTabOrder } from "@modyra/widgets";
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
/**
 * Classes of repeated parts the arrows move *among* — the roving subject, not something inside it.
 *
 * A repeated part is not one thing: `swatch` and `gridcell` are the choices an arrow lands on, while
 * `optionStep` is a button drawn once per row *inside* the choice. Absolving both because the kind
 * declares arrow movement was how this guardian stayed green through the whole of the optionStep
 * defect — the arrows move between options and never reach the stepper.
 *
 * The contract already separates them and the repair predicate uses the same split: a choice element
 * is what the movement traverses, a `button` is an action reached some other way.
 */
function rovingSubjectClasses(kind: string): string[] {
  const CHOICE = new Set(["option", "gridcell", "row", "listitem"]);
  const nodes = MDY_WIDGET_CONTRACTS[kind]?.structure?.nodes ?? [];
  const parts = MDY_WIDGET_CONTRACTS[kind]?.parts ?? {};
  return nodes
    .filter((node) => node.repeated === true && CHOICE.has(String(node.element)))
    .flatMap((node) => parts[String(node.part)]?.classes ?? []);
}

/**
 * Classes of parts a declared key reaches, counting the row a per-row control acts through.
 *
 * `ArrowRight` carries `intent: "step"` and `on: "option"`: it names the row, and the stepper is the
 * control that row steps with. Asking only for a binding naming `optionStep` itself would find none
 * and call a declared, reachable action mute.
 */
function reachedByADeclaredKey(kind: string): string[] {
  const open = (MDY_WIDGET_KEYBOARD[kind] ?? []).filter((binding) => binding.when === "open");
  const namedDirectly = new Set(open.filter((b) => typeof b.on === "string").map((b) => String(b.on)));
  // A binding may also reach a control *through* the row it names. `ArrowRight` carries
  // `intent: "step"` and `on: "option"`: stepping a row is done with the row's stepper, so the
  // stepper is what that key operates.
  //
  // Only `step`, and that narrowness is the whole value. Taking any binding that names the parent
  // would absolve the stepper through the space bar, which names the same row to **toggle** it —
  // and then removing the step keys would change nothing here, which is exactly the check that
  // failed when this read every intent.
  const throughTheRow = new Set(
    open.filter((b) => b.intent === "step" && typeof b.on === "string").map((b) => String(b.on)),
  );
  const nodes = MDY_WIDGET_CONTRACTS[kind]?.structure?.nodes ?? [];
  const parts = MDY_WIDGET_CONTRACTS[kind]?.parts ?? {};
  const reached = new Set<string>();
  for (const node of nodes) {
    const part = String(node.part);
    const viaParent = node.parent !== undefined
      && throughTheRow.has(String(node.parent))
      && String(node.element) === "button";
    if (namedDirectly.has(part) || viaParent) {
      for (const cls of parts[part]?.classes ?? []) reached.add(cls);
    }
  }
  return [...reached];
}

/**
 * Classes a kind's own declared tab order reaches, for the kinds that declare one.
 *
 * A kind whose `Tab@open` intent is `move` keeps the keyboard and walks its panel itself, so the
 * elements on that walk carry `tabindex="-1"` and are unreachable by the browser's own order — while
 * being perfectly reachable by the ring the kind implements. Reading native focusability there is the
 * surrogate again, one turn along: it says no where a person gets there on the first press.
 *
 * `timepickerTabOrder` is that declaration, and today it is the only one: colours retains Tab and
 * declares no order, which is why this map has one entry rather than a general accessor. The map is
 * the honest shape — it names who declares, and shrinks to nothing the day the contract offers the
 * order for every kind that keeps Tab.
 */
const DECLARED_TAB_ORDER: Record<string, () => readonly string[]> = {
  timepicker: () => timepickerTabOrder({}),
};

function orderedClasses(kind: string): string[] {
  const order = DECLARED_TAB_ORDER[kind];
  if (order === undefined) return [];
  const parts = MDY_WIDGET_CONTRACTS[kind]?.parts ?? {};
  return order().flatMap((part) => parts[part]?.classes ?? [String(part)]);
}

function repeatedClasses(kind: string): string[] {
  const nodes = MDY_WIDGET_CONTRACTS[kind]?.structure?.nodes ?? [];
  const parts = MDY_WIDGET_CONTRACTS[kind]?.parts ?? {};
  return nodes
    .filter((node) => node.repeated === true)
    .flatMap((node) => parts[String(node.part)]?.classes ?? []);
}

/**
 * Panel actions this guardian finds and does not fail on, per renderer, each naming the declared key
 * that makes its act reachable — or saying that no key does.
 *
 * ADR 0198 decides the first kind: WCAG 2.1.1 asks that the **function** be operable from a
 * keyboard, not that every control be. A pointer-only button duplicating an act a declared key
 * already performs is an affordance, not a barrier. So an entry names that key, and **fails when the
 * key leaves the contract** rather than only when the button does — an exemption that outlives the
 * reason it was granted for is the stale entry this suite's other gates already refuse.
 *
 * The second kind is the finding that rule produces. `view-toggle` and `header-label` open the
 * months and years views, and **no binding declares a view change**: the arrows move *within* a
 * view, `PageUp`/`PageDown` move the month. Applying the rule honestly, the act behind those two has
 * no keyboard path at all — which is the same species as the colours entry, not an affordance. They
 * are recorded as an open defect rather than as an exemption, because calling them exempt would be
 * the guardian granting itself the decision it was told to ask for.
 */
interface PanelAction { readonly at: string; readonly reachableBy: string | null; readonly why: string }

const RECORDED: Record<string, PanelAction[]> = {
  plain: [
    { at: "datepicker: button.mdy-datepicker__nav-btn", reachableBy: "PageUp", why: "the month moves on PageUp and PageDown" },
    { at: "datepicker: button.mdy-datepicker__header-label", reachableBy: null, why: "opens the months view, and no key declares a view change" },
  ],
  lit: [
    { at: "datepicker: button.mdy-datepicker__nav-btn", reachableBy: "PageUp", why: "the month moves on PageUp and PageDown" },
    { at: "datepicker: button.mdy-datepicker__view-toggle", reachableBy: null, why: "opens the months view, and no key declares a view change" },
    { at: "daterange: button.mdy-datepicker__nav-btn", reachableBy: "PageUp", why: "the month moves on PageUp and PageDown" },
    { at: "daterange: button.mdy-datepicker__view-toggle", reachableBy: null, why: "opens the months view, and no key declares a view change" },
  ],
  angular: [
    { at: "datepicker: button.mdy-datepicker__nav-btn", reachableBy: "PageUp", why: "the month moves on PageUp and PageDown" },
    { at: "datepicker: button.mdy-datepicker__view-toggle", reachableBy: null, why: "opens the months view, and no key declares a view change" },
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

    // One mount per declared variant, read from the contract rather than chosen.
    //
    // Mounting each kind once takes its default, and a part that exists only in another variant is
    // never drawn: `optionStep` lives in the multiselect's `multi` and the default is `single`, so
    // this guardian passed through the whole of that defect with the button absent from the page.
    // An exemption granted by the absence of the subject is the frozen roster again, and deriving
    // the roster from `variants` is what makes it fall for every kind, not only this one.
    const subjects = KINDS.flatMap((kind) => {
      const variants = Object.keys(MDY_WIDGET_CONTRACTS[kind]?.variants ?? {});
      return variants.length === 0
        ? [{ kind, variant: null as string | null }]
        : variants.map((variant) => ({ kind, variant }));
    });

    for (const { kind, variant } of subjects) {
      const id = `nk-${kind}${variant === null ? "" : `-${variant}`}`;
      await page.evaluate(({ mountId, k, api, options, mode }) => {
        const field: Record<string, unknown> = { name: "x", kind: k, label: "X", options };
        if (mode !== null) field.mode = mode;
        (window as never as Record<string, { mountFields(i: string, f: unknown[]): unknown }>)[api]
          .mountFields(mountId, [field]);
      }, { mountId: id, k: kind, api: host.api, options: OPTIONS, mode: variant });
      await page.waitForTimeout(280);
      await page.locator(`[data-form="${id}"] [aria-haspopup]`).first().click({ timeout: 5_000 }).catch(() => undefined);
      await page.waitForTimeout(320);

      const popupClasses = MDY_WIDGET_CONTRACTS[kind]?.parts?.popup?.classes ?? [];
      const tabStaysInside = (MDY_WIDGET_KEYBOARD[kind] ?? []).some(
        (binding) => binding.key === "Tab" && binding.when === "open" && binding.intent === "move",
      );

      const found = await page.evaluate(({ declaredClasses, repeated, popups, tabCounts, movesWithArrows, rovingSubjects, byDeclaredKey, ordered }) => {
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
          if (isRepeated && movesWithArrows && rovingSubjects.some((cls) => element.classList.contains(cls))) continue;
          if (roving !== null && element.id !== "" && panel.querySelector(`#${CSS.escape(roving)}`) !== null) continue;
          if (declaredClasses.some((cls) => element.classList.contains(cls))) continue;
          if (byDeclaredKey.some((cls) => element.classList.contains(cls))) continue;
          if (ordered.some((cls) => element.classList.contains(cls))) continue;
          mute.push(`${element.tagName.toLowerCase()}.${element.className || "(no class)"}`);
        }
        return { count: operable.length, mute };
      }, {
        movesWithArrows: (MDY_WIDGET_KEYBOARD[kind] ?? []).some(
          (binding) => binding.when === "open" && binding.intent === "move" && binding.key.startsWith("Arrow"),
        ),
        declaredClasses: classesAKeyNames(kind),
        rovingSubjects: rovingSubjectClasses(kind),
        byDeclaredKey: reachedByADeclaredKey(kind),
        ordered: orderedClasses(kind),
        repeated: repeatedClasses(kind),
        popups: popupClasses,
        tabCounts: tabStaysInside,
      });

      await page.keyboard.press("Escape").catch(() => undefined);
      if (found === null) continue;
      opened.push(id);
      if (found.count > 0) inspected.push(id);
      for (const one of found.mute) unreachable.push(`${kind}: ${one}`);
    }

    // The premise, per kind and before the claim. A panel that never opened, or opened holding
    // nothing operable, passes every assertion below by having no subject — and the first version of
    // this file did exactly that for all six kinds while reporting three green renderers.
    expect(
      opened.length,
      `no panel opened for any subject (tried ${subjects.map((s) => s.kind).join(", ")}), so this measured nothing`,
    ).toBeGreaterThan(3);
    expect(
      inspected.length,
      `panels opened for ${opened.join(", ")} but only ${inspected.join(", ") || "none"} held anything operable`,
    ).toBeGreaterThan(2);

    // Recorded per renderer, because the evidence is: the three do not draw the same header, so a
    // single list would report an entry as stale in one renderer while it is live in another.
    const recorded = RECORDED[host.name] ?? [];
    const open = unreachable.filter((one) => !recorded.some((entry) => entry.at === one));
    const stale = recorded.filter((entry) => !unreachable.includes(entry.at)).map((entry) => entry.at);

    // An exemption dies with the key that justified it, not only with the element it excused.
    const withdrawn = recorded
      .filter((entry) => entry.reachableBy !== null)
      .filter((entry) => !(MDY_WIDGET_KEYBOARD[entry.at.split(":")[0]] ?? [])
        .some((binding) => binding.key === entry.reachableBy && binding.when === "open"))
      .map((entry) => `${entry.at} was excused by ${entry.reachableBy}, which the contract no longer declares`);
    expect(withdrawn, `an exemption outlived its reason: ${JSON.stringify(withdrawn)}`).toEqual([]);
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
