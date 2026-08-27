/**
 * Two things a screen reader needs, asked of the browser rather than of the markup.
 *
 * **Every id a field points at exists.** `aria-labelledby`, `aria-describedby`, `aria-controls`,
 * `aria-activedescendant`, `aria-errormessage` and `label[for]` are promises about another element;
 * a promise to an id nothing carries is not read as an error by anything, it simply leaves the control
 * unnamed or undescribed with the markup still looking correct.
 *
 * **Every control a person can reach has a name.** Not the label written beside it — the name the
 * platform computes, which is what is spoken. A hand-written rule for that is wrong in both
 * directions: it called a `<button>Submit</button>` nameless because it has no label element, and it
 * called two inputs nameless that the browser names perfectly well. So the rule here is used only to
 * *suspect*, and the accessibility tree is asked to judge.
 *
 * **Only what is drawn is judged.** A control with no box is not on the screen and the platform
 * ignores it: an undo button that appears after a destructive action is 0×0 until then, and demanding
 * a name for it reports a defect about something nobody can reach. Presence is not availability.
 *
 * The fixture has to be able to produce the state it judges, too — an overflow chip judged in a field
 * with two options is judged while it holds nothing, and reads as unnamed because there is nothing
 * yet for it to be named after.
 *
 * Claims under attack: A11Y-001, A11Y-004.
 */
import { expect, test } from "@playwright/test";
import { MDY_WIDGET_KINDS } from "@modyra/widgets";
import { HOSTS } from "./bench";

type Api = Record<string, Record<string, (...args: never[]) => unknown>>;

/** Attributes whose value is one or more ids of other elements. */
const POINTERS = ["aria-labelledby", "aria-describedby", "aria-controls", "aria-activedescendant",
  "aria-owns", "aria-errormessage", "aria-details", "for"];

/** Enough options, and enough taken, that a strip has to overflow and a counter has something to count. */
const MANY = Array.from({ length: 12 }, (_, index) => ({ value: `v${index}`, label: `Opzione lunga numero ${index}` }));

test("a name the platform computes", async ({ page }) => {
  test.setTimeout(600_000);
  const dangling: string[] = [];
  const suspected: Array<{ kind: string; host: string; selector: string; what: string }> = [];
  let pointers = 0;
  let judged = 0;

  for (const host of HOSTS) {
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);
    // Narrow, so a strip of chips has to overflow rather than fitting and leaving the counter empty.
    await page.setViewportSize({ width: 360, height: 700 });

    for (const kind of MDY_WIDGET_KINDS) {
      const mountId = `name-${kind}`;
      await page.evaluate(
        ({ door, id, k, options }) => (window as never as Api)[door].mountFields(id, [{
          name: "campo", kind: k, label: "Etichetta Unica", options,
          initialValue: k === "multiselect" ? options.map((one) => one.value) : undefined,
        }] as never),
        { door: host.api, id: mountId, k: kind, options: MANY },
      );
      await page.locator(`[data-form="${mountId}"]`).waitFor({ timeout: 5_000 }).catch(() => undefined);

      const read = await page.evaluate(({ id, pointerAttributes }) => {
        const root = document.querySelector(`[data-form="${id}"]`) as HTMLElement | null;
        if (root === null) return null;

        const broken: string[] = [];
        let counted = 0;
        for (const element of root.querySelectorAll<HTMLElement>("*")) {
          for (const attribute of pointerAttributes) {
            const value = element.getAttribute(attribute);
            if (value === null || value === "") continue;
            for (const wanted of value.split(/\s+/).filter(Boolean)) {
              counted += 1;
              if (document.getElementById(wanted) === null) {
                broken.push(`${attribute}="${wanted}" on ${element.tagName.toLowerCase()}.${String(element.className).split(/\s+/)[0]}`);
              }
            }
          }
        }

        // A rule that only suspects. Name from content is allowed for a button and forbidden for a
        // text box, and the cases it cannot see are handed to the platform below.
        const FROM_CONTENT = new Set(["BUTTON", "A", "SUMMARY", "LABEL"]);
        const ROLES_FROM_CONTENT = new Set(["button", "link", "option", "gridcell", "tab", "menuitem", "checkbox", "radio", "switch"]);
        const named = (element: HTMLElement): boolean => {
          const by = element.getAttribute("aria-labelledby");
          if (by && by.split(/\s+/).some((one) => (document.getElementById(one)?.textContent ?? "").trim() !== "")) return true;
          if ((element.getAttribute("aria-label") ?? "").trim() !== "") return true;
          if (element.id && (document.querySelector(`label[for="${CSS.escape(element.id)}"]`)?.textContent ?? "").trim() !== "") return true;
          if ((element.closest("label")?.textContent ?? "").trim() !== "") return true;
          if ((FROM_CONTENT.has(element.tagName) || ROLES_FROM_CONTENT.has(element.getAttribute("role") ?? ""))
            && (element.textContent ?? "").trim() !== "") return true;
          return (element.getAttribute("title") ?? "").trim() !== "";
        };

        const nameless: string[] = [];
        let reachable = 0;
        for (const element of root.querySelectorAll<HTMLElement>("*")) {
          if (element.tabIndex < 0) continue;
          const box = element.getBoundingClientRect();
          if (box.width < 1 || box.height < 1) continue;
          reachable += 1;
          if (!named(element)) {
            const mark = `mdy-suspect-${nameless.length}`;
            element.setAttribute("data-suspect", mark);
            nameless.push(mark);
          }
        }
        return { broken, counted, nameless, reachable };
      }, { id: mountId, pointerAttributes: POINTERS });

      if (read === null) continue;
      pointers += read.counted;
      judged += read.reachable;
      for (const line of read.broken) dangling.push(`${kind} in ${host.name}: ${line}`);
      for (const mark of read.nameless) {
        suspected.push({ kind, host: host.name, selector: `[data-form="${mountId}"] [data-suspect="${mark}"]`, what: mark });
      }
    }

    // The platform decides. Asked once per suspect, because the rule above is allowed to be wrong.
    if (suspected.length > 0) {
      const session = await page.context().newCDPSession(page);
      await session.send("DOM.enable");
      await session.send("Accessibility.enable");
      const document_ = await session.send("DOM.getDocument", { depth: -1 }) as { root: { nodeId: number } };
      for (const suspect of [...suspected]) {
        if (suspect.host !== host.name) continue;
        const found = await session.send("DOM.querySelector", { nodeId: document_.root.nodeId, selector: suspect.selector }) as { nodeId: number };
        if (found.nodeId === 0) { suspected.splice(suspected.indexOf(suspect), 1); continue; }
        const tree = await session.send("Accessibility.getPartialAXTree", { nodeId: found.nodeId, fetchRelatives: false }) as
          { nodes: Array<{ name?: { value?: string }; ignored?: boolean }> };
        const node = tree.nodes[0];
        // Ignored by the platform is not nameless: it is not in the tree a screen reader walks.
        if (node?.ignored === true || (node?.name?.value ?? "").trim() !== "") {
          suspected.splice(suspected.indexOf(suspect), 1);
        }
      }
      await session.detach().catch(() => undefined);
    }
  }

  // The premise, both halves: a page with no pointers and no reachable controls satisfies everything
  // below while describing nothing.
  expect(pointers, "no field pointed at another element at all, so nothing was checked").toBeGreaterThan(20);
  expect(judged, "no reachable control was drawn, so no name was judged").toBeGreaterThan(20);

  expect(
    dangling,
    `${dangling.length} reference(s) point at an id nothing carries:\n${dangling.join("\n")}\n\n` +
      "A pointer to a missing id is not an error anything reports: the control is simply left unnamed " +
      "or undescribed while the markup still reads as correct.",
  ).toEqual([]);

  expect(
    suspected.map((one) => `${one.kind} in ${one.host}: a reachable control the platform gives no name`),
    `${suspected.length} control(s) can be reached and have no name the platform can compute`,
  ).toEqual([]);
});
