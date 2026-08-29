/**
 * `MDY_WIDGET_KEYBOARD` is the list of keys a kind answers to. A renderer that answers to a key which
 * is not on the list has taken a gesture nobody wrote down: the other two renderers do not owe it, no
 * check asks for it, and a person who learns it on one adapter loses it on the next.
 *
 * Claiming is read as `defaultPrevented` — the renderer told the platform the key was its own. That is
 * the one signal that separates the widget from the platform: a text box moving a caret with Home does
 * not claim anything, and `text` declaring no keys is correct rather than a gap.
 *
 * **The converse is deliberately not asserted.** A renderer can honour a declared key without claiming
 * it — a native radio group moves the selection on ArrowDown and leaves the event alone — so a declared
 * key that appears unclaimed here is not evidence of a missing gesture, and asserting it would report
 * the platform as a defect.
 *
 * Perimeter, because it is the whole meaning of a green:
 *
 *   keys pressed    the seventeen below, and only those
 *   state           a field mounted fresh for every key, at rest, its own control focused, caret at
 *                   each end of it; no key has been pressed into it before. The phase is read from
 *                   the page rather than assumed, and with a fresh field it is always the closed
 *                   one — so every binding declared `when: "open"` is **not measured here**, and a
 *                   pass that opens the panel first is owed.
 *   signal          `defaultPrevented`; a renderer that acts without claiming is invisible here
 *
 * Claims under attack: ADP-001, UI-002.
 */
import { expect, test } from "@playwright/test";
import { MDY_WIDGET_CONTRACTS, MDY_WIDGET_KINDS, keyBindingFor } from "@modyra/widgets";
import { HOSTS } from "./bench";

type Api = Record<string, Record<string, (...args: never[]) => unknown>>;
/**
 * The library's own resolver, not a copy of its table. A binding may name one key, or admit that it
 * has no key at all — type-ahead is declared as `*printable*` — and a check that compared key strings
 * would call every letter undeclared while the contract declares them all. It also answers per phase:
 * the same key can be owed with the panel open and unowed with it closed.
 */
const resolve = keyBindingFor as (kind: string, key: string, open: boolean, on?: string) => { on?: string } | null;

/**
 * Asked at the control **and** where the key actually landed. A binding declared on a part is
 * invisible from the control on purpose, so that one key can mean two things without either
 * declaration shadowing the other — so a check that only asks the control reports a key declared on a
 * chip as declared by nobody. Asking only the part is wrong the other way: a binding with no `on` is
 * the control's, and it still answers when the key lands on a radio inside it.
 */
const declares = (kind: string, key: string, open: boolean, on: string | null): boolean =>
  resolve(kind, key, open) !== null || (on !== null && resolve(kind, key, open, on) !== null);

/**
 * Where and when the contract does declare this key, so the message says what to compare against.
 * The phase belongs in it: "claimed with the panel closed, declared on the control" reads as a
 * contradiction when what it means is that the same key is owed only once the panel is open.
 */
const declaredOn = (kind: string, key: string): string[] => {
  const parts = Object.keys((MDY_WIDGET_CONTRACTS as unknown as Record<string, { parts: Record<string, unknown> }>)[kind].parts);
  return [undefined, ...parts].flatMap((part) => {
    const phases = ([["open", true], ["closed", false]] as const).filter(([, open]) => resolve(kind, key, open, part) !== null);
    return phases.length === 0 ? [] : [`${part ?? "the control"} when ${phases.map(([name]) => name).join(" or ")}`];
  });
};

/** The parts of a kind, by class, so an element can say which part it is. */
const partClassesOf = (kind: string): Record<string, string[]> => Object.fromEntries(
  Object.entries((MDY_WIDGET_CONTRACTS as unknown as Record<string, { parts: Record<string, { classes: string[] }> }>)[kind].parts)
    .map(([part, def]) => [part, def.classes ?? []]));

const PRESSED = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End", "PageUp", "PageDown",
  "Enter", " ", "Escape", "Backspace", "Delete", "a", "1", "+", "-"];

const shown = (key: string): string => (key === " " ? "Space" : key);

test("a key a renderer claims and nobody declared", async ({ page }) => {
  test.setTimeout(900_000);

  /** kind → renderer → the keys that renderer claimed, or null where its control was never reached. */
  /** A key stopped where nothing moved: the platform lost it and the widget did not take it. */
  const refused: string[] = [];
  const claimed = new Map<string, Record<string, string[] | null>>();

  for (const host of HOSTS) {
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    for (const kind of MDY_WIDGET_KINDS) {
      // One page per kind, and one freshly mounted field per key. Pressing seventeen keys into one
      // field measures the first key at rest and the rest in whatever state its predecessors left:
      // Enter opens a panel, and every key after it is answered by an open field. That made this
      // report two claims on one run in three and none on the others, with nothing changing.
      await page.goto(host.page);
      await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

      if (!claimed.has(kind)) claimed.set(kind, {});
      /** Each claim carries the phase of the field it was made in: a binding is declared per phase. */
      const taken = new Set<string>();
      let reachable = false;

      for (const [index, key] of PRESSED.entries()) {
        const mountId = `key-${kind}-${index}`;
        await page.evaluate(
          ({ door, id, k }) => (window as never as Api)[door].mountFields(id, [{
            name: "campo", kind: k, label: "Etichetta",
            options: [{ value: "a", label: "A" }, { value: "b", label: "B" }],
          }] as never),
          { door: host.api, id: mountId, k: kind },
        );
        await page.locator(`[data-form="${mountId}"]`).waitFor({ timeout: 5_000 }).catch(() => undefined);

        const reached = await page.evaluate(
          ({ id, k, partClasses }) => {
            const form = document.querySelector(`[data-form="${id}"]`);
            const root = (form?.querySelector(`.mdy-renderer--${k}`) ?? form) as HTMLElement | null;
            if (root === null) return null;

            let control: HTMLElement | null = null;
            for (const label of root.querySelectorAll<HTMLLabelElement>("label[for]")) {
              const target = label.htmlFor ? document.getElementById(label.htmlFor) : null;
              if (target !== null) { control = target; break; }
            }
            // A group labels itself rather than one control, so the first thing a Tab would land on
            // is what a person actually types into.
            control ??= [...root.querySelectorAll<HTMLElement>("*")].find((element) => element.tabIndex >= 0) ?? null;
            if (control === null) return null;

            const store = window as never as Record<string, unknown>;
            store.__claimed = [];
            store.__control = control;
            // Sixteen other fields are on this page. A claim made by one of them would otherwise be
            // recorded against the kind being measured, so the listener asks who the event was for.
            const previous = store.__listener as ((event: KeyboardEvent) => void) | undefined;
            if (previous) window.removeEventListener("keydown", previous);
            const partOf = (node: Node): string | null => {
              for (let element = node instanceof Element ? node : node.parentElement; element !== null && element !== root.parentElement; element = element.parentElement) {
                for (const [part, classes] of Object.entries(partClasses as Record<string, string[]>)) {
                  if (classes.length > 0 && classes.every((one) => element!.classList.contains(one))) return part;
                }
              }
              return null;
            };
            const listener = (event: KeyboardEvent): void => {
              const target = event.target;
              if (!(target instanceof Node) || !root.contains(target)) return;
              if (event.defaultPrevented) (store.__claimed as string[]).push(`${event.key}\u0001${partOf(target) ?? ""}`);
            };
            store.__listener = listener;
            window.addEventListener("keydown", listener);
            control.focus();
            return root.querySelector('[aria-expanded="true"]') !== null;
          },
          { id: mountId, k: kind, partClasses: partClassesOf(kind) },
        );
        if (reached === null) continue;
        reachable = true;

        // Pressed from each end of the control's text: a field made of segments answers ArrowLeft
        // from inside a segment and not from its first character, and a run that only ever starts
        // from one end never sees the claim.
        // What the field is, before the key. A renderer that stops a character the platform would
        // have inserted has taken a key away from the platform and given it to nobody — legitimate,
        // and not a gesture. Answering one is: the value moves, the phase changes, the marker or the
        // reading position moves. Both come back as `defaultPrevented` and they are not the same act.
        const shapeOf = () => page.evaluate(({ id }) => {
          const root = document.querySelector(`[data-form="${id}"]`);
          if (root === null) return "";
          const values = [...root.querySelectorAll<HTMLInputElement>("input, select, textarea")]
            .map((box) => `${box.value}/${box.checked}`).join("|");
          const marker = root.querySelector("[aria-activedescendant]")?.getAttribute("aria-activedescendant") ?? "";
          const open = root.querySelector("[aria-expanded]")?.getAttribute("aria-expanded") ?? "";
          return `${values}~${marker}~${open}~${document.activeElement?.className ?? ""}`;
        }, { id: mountId });
        const shapeBefore = await shapeOf();

        for (const caret of ["start", "end"] as const) {
          await page.evaluate((where) => {
            const control = (window as never as Record<string, HTMLElement>).__control;
            control.focus();
            if (control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement) {
              const at = where === "start" ? 0 : control.value.length;
              try { control.setSelectionRange(at, at); } catch { /* a type with no caret to place */ }
            }
          }, caret);
          await page.keyboard.press(key === " " ? "Space" : key);
        }
        // The phase belongs to this mount, not to the kind: a field is freshly mounted for every key,
        // and one of them opening a panel says nothing about the state the next key went into.
        const moved = (await shapeOf()) !== shapeBefore;
        for (const seen of await page.evaluate(() => (window as never as Record<string, string[]>).__claimed)) {
          if (moved) taken.add(`${seen}\u0000${reached}`);
          else refused.push(`${kind} in ${host.name}: refuses ${key === " " ? "Space" : key}, and nothing moved`);
        }
      }

      claimed.get(kind)![host.name] = reachable ? [...taken] : null;
    }
  }

  // The premise, in two halves. A control that was never focused claims nothing, and a recorder that
  // was never wired records nothing; both look exactly like a renderer that takes no keys.
  if (refused.length > 0) {
    console.log(`[stopped, and nothing moved] ${refused.length}: `
      + [...new Set(refused)].slice(0, 8).join(" | "));
  }

  const unreached = [...claimed.entries()]
    .flatMap(([kind, byHost]) => HOSTS.filter((h) => byHost[h.name] === null).map((h) => `${kind} in ${h.name}`));
  expect(unreached, "no control was reached for these, so nothing was measured there").toEqual([]);

  const everClaimed = [...claimed.values()].flatMap((byHost) => Object.values(byHost).flatMap((records) => records ?? []));
  expect(everClaimed.length, "no renderer claimed a single key, so the recorder is measuring nothing").toBeGreaterThan(0);

  const undeclared = [...claimed.entries()].flatMap(([kind, byHost]) =>
    HOSTS.flatMap((host) => (byHost[host.name] ?? [])
      .map((record) => {
        const [head, open] = record.split("\u0000");
        const [key, part] = head.split("\u0001");
        return { key, part: part === "" ? null : part, open: open === "true" };
      })
      .filter(({ key, open, part }) => !declares(kind, key, open, part))
      .map(({ key, open, part }) => {
        const elsewhere = declaredOn(kind, key);
        return `${kind} in ${host.name}: claims ${shown(key)} at ${part ?? "no declared part"} with the panel ` +
          `${open ? "open" : "closed"}${elsewhere.length > 0 ? `, declared on ${elsewhere.join(" and ")}` : ""}`;
      })));

  expect(
    undeclared,
    `${undeclared.length} key(s) are taken by a renderer and declared by nobody:\n${undeclared.join("\n")}\n\n` +
      "A gesture that works in one adapter and not the others is not a feature, it is a difference a " +
      "person discovers by losing it. Either the vocabulary owes the key or the renderer owes it back.",
  ).toEqual([]);
});
