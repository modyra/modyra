/**
 * The other half of the keyboard, and the half where nearly all of it is declared.
 *
 * `a-key-a-renderer-claims-and-nobody-declared` mounts a field fresh for every key, so the field is
 * always closed and every binding declared `when: "open"` goes unpressed. That is most of the table:
 * a chooser declares two or three keys closed and eight open.
 *
 * **Why the first attempt at this was thrown away.** Reaching the open phase means opening the panel,
 * and the first version pressed the opening key at the control the label names. For a date range that
 * is the text box beside the toggle, and pressing Enter into it opens nothing — so the panel was open
 * on some kinds and not others, focus landed in different places depending on how fast a renderer
 * moved it, and the sweep reported a claim on one run in three with nothing changed. A check that
 * flaps teaches people to re-run.
 *
 * What fixes it is the same thing that fixed the calendar spec: **the contract names the part that
 * opens**. `MDY_POPUP_OPENERS[kind].opener` is asked rather than guessed, the panel is waited for
 * rather than assumed, and the focus is given a moment to finish moving — because the attribute flips
 * before the focus lands, and pressing into that gap measures the control instead of the panel.
 *
 * Perimeter:
 *
 *   kinds      only those the contract says open from a pointer or a key; the rest have no open phase
 *   state      the panel open, focus wherever the renderer put it — which is the state a person is in
 *   signal     `defaultPrevented`; a renderer that acts without claiming is invisible here, as in the
 *              closed sweep, and for the same reason
 *
 * Claims under attack: ADP-001, UI-002.
 */
import { expect, test } from "@playwright/test";
import {
  MDY_POPUP_OPENERS, MDY_WIDGET_CONTRACTS, MDY_WIDGET_KEYBOARD, MDY_WIDGET_KINDS, keyBindingFor,
} from "@modyra/widgets";
import { HOSTS, panelsHome } from "./bench";

type Api = Record<string, Record<string, (...args: never[]) => unknown>>;
const CONTRACTS = MDY_WIDGET_CONTRACTS as unknown as Record<string, { parts: Record<string, { classes: string[] }> }>;
const OPENERS = MDY_POPUP_OPENERS as unknown as Record<string, { opener?: string }>;
const KEYBOARD = MDY_WIDGET_KEYBOARD as unknown as Record<string, { key: string; when?: string; intent?: string }[]>;
const resolve = keyBindingFor as (kind: string, key: string, open: boolean, on?: string) => unknown;

const PRESSED = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End", "PageUp", "PageDown",
  "Enter", " ", "Escape", "Backspace", "Delete", "a", "1", "+", "-"];

const shown = (key: string): string => (key === " " ? "Space" : key);

/** Every part of the kind with the classes that identify it, innermost-first is the caller's job. */
const partClassMap = (kind: string): Array<[string, string[]]> =>
  Object.entries(CONTRACTS[kind].parts).map(([name, part]) => [name, [...(part.classes ?? [])]]);

/** The keys the kind declares open it, from the table rather than named here. */
const openingKeys = (kind: string): string[] =>
  (KEYBOARD[kind] ?? []).filter((one) => one.when === "closed" && one.intent === "open").map((one) => one.key);

/** The classes of the part the contract says opens this kind. */
const openerClasses = (kind: string): string[] => {
  const opener = OPENERS[kind]?.opener;
  return opener === undefined ? [] : CONTRACTS[kind].parts[opener]?.classes ?? [];
};

for (const only of HOSTS) {
test(`a key in an open panel nobody declared, ${only.name}`, async ({ page }) => {
  test.setTimeout(1_200_000);
  const undeclared: string[] = [];
  /** A key stopped where nothing moved: the platform lost it and the widget did not take it. */
  const refused: string[] = [];
  /** Presses made with a panel from an earlier key still standing, which this could not send home. */
  let stillOpen = 0;
  /** Kinds whose open phase could not be reached: printed, so a green is not read as coverage. */
  const unopened: string[] = [];
  let pressed = 0;

  for (const host of [only]) {
    for (const kind of MDY_WIDGET_KINDS) {
      const keys = openingKeys(kind);
      const classes = openerClasses(kind);
      if (keys.length === 0 || classes.length === 0) continue;

      // One page per kind, and a **fresh field** per key. The state a previous key left — a panel it
      // closed, a choice it made — belongs to the field, so a new field is enough to be rid of it;
      // reloading the page as well cost this sweep 264 seconds of a 455-second suite, one worker held
      // for more than half the run, to discard a document that was never dirty.
      await page.goto(host.page);
      await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

      /** The declared opener that actually works here, learned on the first key and reused. */
      let opensWith: string | null | undefined = undefined;

      for (const [index, key] of PRESSED.entries()) {
        const mountId = `open-${kind}-${index}`;
        await page.evaluate(
          ({ door, id, k }) => (window as never as Api)[door].mountFields(id, [{
            name: "campo", kind: k, label: "Etichetta",
            options: [{ value: "a", label: "A" }, { value: "b", label: "B" }],
          }] as never),
          { door: host.api, id: mountId, k: kind },
        );
        await page.locator(`[data-form="${mountId}"]`).waitFor({ timeout: 5_000 }).catch(() => undefined);

        // The panel the previous key opened is still standing, and where a renderer draws it outside
        // the field it is over this one too: the reading position is inside it, and a key pressed now
        // is answered by the field before rather than the field under test. Sent home first, and the
        // page is asked whether anything is still open rather than assumed shut.
        if (!(await panelsHome(page))) stillOpen += 1;

        const focused = await page.evaluate(({ id, opener }) => {
          const root = document.querySelector(`[data-form="${id}"]`) as HTMLElement | null;
          if (root === null) return false;
          const element = root.querySelector<HTMLElement>((opener as string[]).map((one) => `.${one}`).join(""));
          if (element === null) return false;
          element.focus();
          return true;
        }, { id: mountId, opener: classes });
        if (!focused) { unopened.push(`${kind} in ${host.name}: no ${OPENERS[kind]?.opener ?? "opener"} to focus`); continue; }

        /**
         * Whether *this* field is open, asked of its own opener.
         *
         * A page-wide `[aria-expanded="true"]` answers about whichever panel an earlier kind left
         * behind — every kind here mounts a field of its own and none is taken down, so the first
         * one that opens makes every later one look open. The opener states its own phase, and
         * where it states none the link it declares to its panel is followed.
         */
        const opened = async (id: string) => {
          // Polled, not read once: the panel arrives a frame or two after the key, and a single look
          // taken immediately measures how fast this file is rather than whether the field opened.
          const reads = async () => await page.evaluate(({ mountId }) => {
            const root = document.querySelector(`[data-form="${mountId}"]`);
            if (root === null) return false;
            // Inside this field, not across the page: any part of it may carry the statement, and a
            // renderer that portals its panel still leaves the opener behind saying so.
            if (root.querySelector('[aria-expanded="true"]') !== null) return true;
            const named = root.querySelector("[aria-controls]")?.getAttribute("aria-controls");
            const panel = named === null || named === undefined ? null : document.getElementById(named);
            return panel !== null && panel.getBoundingClientRect().height > 0;
          }, { mountId: id });
          for (let waited = 0; waited < 1_200; waited += 100) {
            if (await reads()) return true;
            await page.waitForTimeout(100);
          }
          return false;
        };

        // **Which key opens this kind is asked once, not once per key pressed.** Trying every declared
        // opener for every one of the seventeen keys means paying the failed ones' timeout seventeen
        // times over — and a kind that opens for none of them pays all of it to learn nothing new.
        // That single line was most of a four-minute spec.
        if (opensWith === undefined) {
          opensWith = null;
          for (const opener of keys) {
            await page.keyboard.press(opener === " " ? "Space" : opener);
            const worked = await opened(mountId);
            if (worked) { opensWith = opener; break; }
          }
          // Learning which key opens it leaves it open, and the same key pressed again is a toggle:
          // the run that followed closed the panel it had just opened and reported a kind that opens
          // for nothing. What is learned here is the key, not a phase — so the phase is put back.
          if (opensWith !== null) {
            await page.keyboard.press("Escape");
            await page.waitForTimeout(120);
            // Escape hands the reading position back to wherever the panel borrowed it from, and in
            // two renderers that is not the opener — so the key that follows lands somewhere with no
            // opinion about it. The opener is taken again before the phase is asked for.
            await page.evaluate(({ id, opener }) => {
              const root = document.querySelector(`[data-form="${id}"]`) as HTMLElement | null;
              root?.querySelector<HTMLElement>((opener as string[]).map((one) => `.${one}`).join(""))?.focus();
            }, { id: mountId, opener: classes });
            await page.waitForTimeout(60);
          }
        }
        let open = false;
        if (opensWith !== null) {
          await page.keyboard.press(opensWith === " " ? "Space" : opensWith);
          open = await opened(mountId);
        }
        if (!open) { unopened.push(`${kind} in ${host.name}: [${keys.map(shown).join(" ")}] opened nothing`); continue; }

        // The attribute flips before the focus finishes moving, and a key pressed into that gap is
        // answered by the control rather than by the panel — which is what made the first version of
        // this report a claim on one run and not the next.
        await page.waitForFunction(() => {
          const panel = document.querySelector('[role="grid"], [role="listbox"], [role="dialog"]');
          return panel === null || panel.contains(document.activeElement) || document.activeElement !== document.body;
        }, undefined, { timeout: 600 }).catch(() => undefined);
        await page.waitForTimeout(80);

        const claimed = await page.evaluate(({ id }) => {
          const store = window as never as Record<string, unknown>;
          store.__claimed = [];
          const root = document.querySelector(`[data-form="${id}"]`) as HTMLElement;
          const parts = new Map<string, string[]>();
          window.addEventListener("keydown", (event) => {
            if (event.defaultPrevented) (store.__claimed as string[]).push(event.key);
          });
          return { ready: root !== null, parts: [...parts.keys()] };
        }, { id: mountId });
        if (!claimed.ready) continue;

        // A binding declared on a part is invisible from the control, so a key answered while the
        // person stands on that part has to be asked about from there. Which part that is comes from
        // the contract's own classes rather than from a role, because `on` names a part.
        //
        // Read before the press, never after: a key doing exactly what it is declared to do moves
        // the person off the part that answered it. Space on a calendar cell commits the date, the
        // panel closes and the reading position goes back to the control — so asked afterwards, every
        // key that worked looks like a key answered somewhere it was never declared.
        const standingOn = await page.evaluate(({ map }) => {
          // A grid that moves a marker rather than the focus leaves the focus on the container and
          // names the current cell in an attribute. The person is on the cell either way, so the walk
          // starts where the control says they are rather than where the platform put the focus.
          const focused = document.activeElement;
          const named = focused?.getAttribute("aria-activedescendant") ?? null;
          let node: Element | null = named === null ? focused : (document.getElementById(named) ?? focused);
          while (node !== null && node !== document.body) {
            for (const [name, classes] of map) {
              if (classes.length > 0 && classes.every((one) => node?.classList.contains(one) === true)) return name;
            }
            node = node.parentElement;
          }
          return node === null || node === document.body
            ? `?${focused?.tagName?.toLowerCase() ?? "none"}`
            : `?${node.tagName.toLowerCase()}.${node.className.split(/\s+/)[0] ?? ""}`;
        }, { map: partClassMap(kind) });

        // What the field is, before the key. A claim is a key that *did* something, and the only way
        // to tell that from a key merely taken away from the platform is to look at what changed.
        const shapeOf = () => page.evaluate(({ id }) => {
          const root = document.querySelector(`[data-form="${id}"]`);
          if (root === null) return "";
          const values = [...root.querySelectorAll<HTMLInputElement>("input, select, textarea")]
            .map((box) => `${box.value}/${box.checked}`).join("|");
          const marker = root.querySelector("[aria-activedescendant]")?.getAttribute("aria-activedescendant") ?? "";
          const open = root.querySelector("[aria-expanded]")?.getAttribute("aria-expanded") ?? "";
          // The reading position by identity, not by class: two options in one group wear the same
          // class, so a focus that moved between them would read as a focus that did not move — and
          // a key that moves the reading position is answering, not refusing.
          const here = document.activeElement;
          const at = here === null ? -1 : [...document.querySelectorAll("*")].indexOf(here);
          return `${values}~${marker}~${open}~${here?.id ?? ""}~${at}~${(root.textContent ?? "").length}`;
        }, { id: mountId });
        const before = await shapeOf();

        pressed += 1;
        await page.keyboard.press(key === " " ? "Space" : key);
        await page.waitForTimeout(60);
        const taken = await page.evaluate(() => [...new Set((window as never as Record<string, string[]>).__claimed)]);
        const after = await shapeOf();
        const didSomething = before !== after;


        for (const one of taken) {
          if (resolve(kind, one, true) !== null) continue;
          if (standingOn !== null && !standingOn.startsWith("?")
            && resolve(kind, one, true, standingOn) !== null) continue;
          // **Prevented is not claimed.** A control that stops a character the platform would have
          // inserted — `e` and `+` in a box that holds an hour — has taken a key away from the
          // platform and given it to nobody, which is a legitimate act and not a gesture. Answering
          // one is: the value moves, the phase changes, the marker or the reading position moves.
          // Measured against the keyboard vocabulary they are the same event and they are not the
          // same act, and reporting a refusal as an undeclared binding sends somebody to declare a
          // key that does nothing.
          if (!didSomething) {
            refused.push(`${kind} in ${host.name}: refuses ${shown(one)} on ${standingOn ?? "nothing"}, and nothing moved`);
            continue;
          }
          // Where the person stood is part of the report: a key answered by nobody is one finding at
          // the control and another on a part, and the two are closed in different places.
          undeclared.push(`${kind} in ${host.name}: claims ${shown(one)} with the panel open, standing on ${standingOn ?? "nothing"}`);
        }
      }
    }
  }

  // The premise: a sweep that never opened a panel presses into closed fields and finds the closed
  // sweep's answer, which is already asserted elsewhere.
  expect(pressed, "no key was pressed into an open panel, so this measured the other half again").toBeGreaterThan(30);
  if (stillOpen > 0) console.log(`[a panel would not close before ${stillOpen} press(es)]`);
  if (refused.length > 0) {
    console.log(`[stopped, and nothing moved] ${refused.length}: ${[...new Set(refused)].slice(0, 8).join(" | ")}`);
  }
  if (unopened.length > 0) console.log(`[open phase unreached] ${unopened.length}: ${[...new Set(unopened)].slice(0, 6).join(" | ")}`);

  expect(
    [...new Set(undeclared)].sort(),
    `${new Set(undeclared).size} key(s) are taken inside an open panel and declared by nobody:\n` +
      `${[...new Set(undeclared)].sort().join("\n")}\n\n` +
      "Most of the keyboard is declared for the open phase, so a key answered there and named nowhere " +
      "is a gesture the other renderers do not owe and no check asks for.",
  ).toEqual([]);
});
}
