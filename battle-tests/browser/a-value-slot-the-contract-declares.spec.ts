/**
 * Every field has a place where its value shows. The contract now says what kind of place that is:
 * `valueSlot` is `"container"` where a person looks *into* a surface to read the value, and `"shape"`
 * where the slot **is** the value — a position on a track, an on or off.
 *
 * The distinction is about how a value is *read*, never about how it is entered. A checkbox is pressed
 * and a file arrives from outside, and neither fact bears on it.
 *
 * This asks the stylesheet, in a real browser, in all three renderers. A surface is a background that
 * is not transparent, or a border that is drawn — the two things that make a rectangle read as
 * something you look inside. It is asked of the elements **above the control the field's own label
 * names**, which is the one element a page itself designates as where the value lives; asking about
 * every value-bearing element instead makes a kind that shows a dial at rest look boxless, because the
 * dial's spinbuttons have no painted ancestor in common with the text box.
 *
 * Two claims, and a third this deliberately does not make:
 *
 *   container ⇒ a surface        a declared container drawn without one has nowhere to look into
 *   shape ⇒ no surface           a declared shape wearing the field shell reads as a box that is empty
 *   the three agree              whatever the answer, one document is one anatomy
 *
 * **What this cannot see**: paint is read above the labelled control, so a kind whose own chrome wraps
 * that control would read as a container on chrome alone. No kind does today; one that did would need
 * this measured from the part the contract names rather than from the label.
 *
 * Claims under attack: ADP-001, UI-011.
 */
import { expect, test } from "@playwright/test";
import { MDY_WIDGET_CONTRACTS, MDY_WIDGET_KINDS } from "@modyra/widgets";
import { HOSTS } from "./bench";

type Api = Record<string, Record<string, (...args: never[]) => unknown>>;
const SLOT = MDY_WIDGET_CONTRACTS as unknown as Record<string, { valueSlot: "container" | "shape" }>;

test("a value slot the contract declares", async ({ page }) => {
  test.setTimeout(600_000);

  /** kind → renderer → the painted ancestors above the labelled control, or null where none was found. */
  const seen = new Map<string, Record<string, string[] | null>>();

  for (const host of HOSTS) {
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    for (const kind of MDY_WIDGET_KINDS) {
      const mountId = `slot-${kind}`;
      await page.evaluate(
        ({ door, id, k }) => {
          (window as never as Api)[door].mountFields(id, [{
            name: "campo", kind: k, label: "Etichetta",
            options: [{ value: "a", label: "A" }, { value: "b", label: "B" }],
          }] as never);
        },
        { door: host.api, id: mountId, k: kind },
      );
      await page.locator(`[data-form="${mountId}"]`).waitFor({ timeout: 5_000 }).catch(() => undefined);

      const above = await page.evaluate(
        ({ id, k }) => {
          const form = document.querySelector(`[data-form="${id}"]`);
          const root = (form?.querySelector(`.mdy-renderer--${k}`) ?? form) as HTMLElement | null;
          if (root === null) return null;

          let control: HTMLElement | null = null;
          for (const label of root.querySelectorAll<HTMLLabelElement>("label[for]")) {
            const target = document.getElementById(label.htmlFor);
            if (target !== null) { control = target; break; }
          }
          control ??= root.querySelector<HTMLElement>("[aria-labelledby]");
          if (control === null) return null;

          const paints = (element: HTMLElement): boolean => {
            const style = getComputedStyle(element);
            const background = style.backgroundColor;
            const opaque = background.startsWith("rgba") ? Number(background.split(",")[3]) > 0 : background !== "transparent";
            const bordered = ["top", "right", "bottom", "left"].some((side) =>
              parseFloat(style.getPropertyValue(`border-${side}-width`)) > 0 &&
              style.getPropertyValue(`border-${side}-style`) !== "none");
            return opaque || bordered;
          };

          const painted: string[] = [];
          for (let parent = control.parentElement; parent !== null && parent !== root.parentElement; parent = parent.parentElement) {
            if (paints(parent)) painted.push(String(parent.className).split(/\s+/)[0] || parent.tagName.toLowerCase());
          }
          return painted;
        },
        { id: mountId, k: kind },
      );

      if (!seen.has(kind)) seen.set(kind, {});
      seen.get(kind)![host.name] = above;
      await page.evaluate(
        ({ door, id }) => {
          try {
            (window as never as Api)[door].dispose?.(id as never);
          } catch {
            /* a host with no door to close leaves the form standing; the next mount has its own id */
          }
        },
        { door: host.api, id: mountId },
      );
    }
  }

  // The premise: a control was found and paint was read. A selector that matched nothing would report
  // every kind boxless, which is a conforming answer for five of seventeen and a lie about twelve.
  const unreadable = [...seen.entries()].filter(([, byHost]) => Object.values(byHost).some((a) => a === null));
  expect(unreadable.map(([kind]) => kind), "no control the label names, so nothing was measured for these kinds").toEqual([]);

  const boxed = (byHost: Record<string, string[] | null>, host: string): boolean => (byHost[host] ?? []).length > 0;

  const disagree = [...seen.entries()]
    .filter(([, byHost]) => new Set(HOSTS.map((h) => boxed(byHost, h.name))).size > 1)
    .map(([kind, byHost]) => `${kind} (${SLOT[kind].valueSlot}): ` +
      HOSTS.map((h) => `${h.name}=${boxed(byHost, h.name) ? (byHost[h.name] ?? []).join("+") : "no surface"}`).join(", "));

  const wrong = [...seen.entries()]
    .flatMap(([kind, byHost]) => HOSTS
      .filter((h) => boxed(byHost, h.name) !== (SLOT[kind].valueSlot === "container"))
      .map((h) => SLOT[kind].valueSlot === "container"
        ? `${kind} in ${h.name}: declared a container and drawn with no surface to look into`
        : `${kind} in ${h.name}: declared a shape and drawn inside ${(byHost[h.name] ?? []).join("+")}`));

  expect(
    wrong,
    `${wrong.length} field(s) draw a value slot the contract does not declare:\n${wrong.join("\n")}\n\n` +
      "`valueSlot` says how the value is read: a container is a surface a person looks into, a shape " +
      "is a value that is its own slot. A shape wearing the field shell reads as a box standing empty.",
  ).toEqual([]);

  expect(
    disagree,
    `${disagree.length} kind(s) sit on a surface in one renderer and not in another:\n${disagree.join("\n")}\n\n` +
      "One document, one anatomy. Which answer is right is the contract's to state and it has stated it; " +
      "that the three read it differently is what this refuses.",
  ).toEqual([]);
});
