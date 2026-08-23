/**
 * Whether a control answers to the words written on it.
 *
 * Someone driving a browser by voice says what they see. The command is matched against the control's
 * **accessible name**, so a control whose visible text is absent from its name cannot be reached by
 * reading it aloud — the person is looking straight at a word the control does not answer to, with
 * nothing to indicate that the word is not its name.
 *
 * This is the one thing about voice control that a document can be asked. It is not a substitute for
 * running the software: it will not catch a grammar a recogniser mishears, or a phrase two controls
 * both match. It catches the failure that actually strands people, and it costs a string comparison
 * between two readings this suite already takes.
 *
 * **Taken from rendered text, not from `textContent`.** The two differ, and the difference has already
 * produced one wrong answer here: a chip's label and its count are adjacent nodes, so `textContent`
 * glues them into a token nobody sees, and a comparison made on that string reports a control that
 * reads correctly as failing. What a person says is what the browser drew.
 *
 * **The name is the computed one, not the attribute.** A control named by its own content has a name
 * equal to its text and passes trivially; read through `aria-label` alone it looks nameless and drops
 * out of the comparison, taking every renderer that names its controls that way with it. That reading
 * is how an earlier version of this file compared nothing at all in two of three renderers and said so
 * as a failure.
 *
 * Only controls that carry both are compared: a control with no visible text has nothing to be said
 * to it, and one with no name is a different defect that a different file reports.
 *
 * The comparison normalises whitespace and case and asks for **containment**, not equality — a name
 * may say more than the control shows, and usually should. It may not say less.
 *
 * Claims under attack: A11Y-004, UI-005.
 */

import { expect, test } from "@playwright/test";
import { MDY_WIDGET_KINDS } from "@modyra/widgets";

import { HOSTS } from "./bench";

type Api = Record<string, Record<string, (...args: never[]) => unknown>>;

const OPTIONS = [{ value: "a", label: "Alfa" }, { value: "b", label: "Beta" }];

for (const host of HOSTS) {
  test(`every control answers to the words written on it, ${host.name}`, async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 900, height: 500 });
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    const unreachable: string[] = [];
    let compared = 0;

    for (const kind of MDY_WIDGET_KINDS) {
      const id = `spoken_${kind}`;
      await page.evaluate(({ api, id, kind, options }) => {
        (window as never as Api)[api].mountFields(id, [{
          name: "f", kind, label: "Scelte", clearable: true, mode: "multi", options,
          initialValue: kind === "multiselect" ? ["a", "a"] : undefined,
        }] as never);
      }, { api: host.api, id, kind, options: OPTIONS });

      const root = `[data-form="${id}"]`;
      await page.locator(root).waitFor({ timeout: 5_000 });
      await page.evaluate(({ api }) => (window as never as Api)[api].settle?.(), { api: host.api }).catch(() => undefined);
      await page.waitForTimeout(150);

      const found = await page.evaluate((selector) => {
        const normalise = (text: string) => text.replace(/\s+/g, " ").trim().toLowerCase();
        /** The accessible name as it is computed, by the routes a control may be named through. */
        const nameOf = (element: Element): string => {
          const label = element.getAttribute("aria-label");
          if (label !== null && label.trim() !== "") return label;
          const by = element.getAttribute("aria-labelledby");
          if (by !== null) {
            const joined = by.split(/\s+/)
              .map((id) => document.getElementById(id)?.textContent ?? "")
              .join(" ").trim();
            if (joined !== "") return joined;
          }
          const title = element.getAttribute("title");
          if (title !== null && title.trim() !== "") return title;
          // Named by its own content, which is the ordinary case and the one that passes trivially.
          return element.textContent ?? "";
        };
        const out: string[] = [];
        let seen = 0;
        document.querySelectorAll(`${selector} button, ${selector} [role='button'], ${selector} a[href]`).forEach((control) => {
          const box = control.getBoundingClientRect();
          if (box.width === 0 || box.height === 0) return;
          const visible = normalise(control.textContent ?? "");
          const name = normalise(nameOf(control));
          if (visible === "" || name === "") return;
          seen += 1;
          if (!name.includes(visible)) out.push(`a control reads "${visible}" and answers to "${name}"`);
        });
        return { out: [...new Set(out)], seen };
      }, root);

      await page.evaluate(({ api, id }) => { (window as never as Api)[api].dispose?.(id as never); }, { api: host.api, id });

      compared += found.seen;
      for (const one of found.out) unreachable.push(`${kind}: ${one}`);
    }

    // A run comparing nothing would report no mismatch for the wrong reason.
    expect(compared, `${host.name} found no control carrying both visible text and a name`).toBeGreaterThan(0);

    expect(
      unreachable,
      `${host.name}: ${unreachable.length} control(s) cannot be reached by reading them aloud — `
      + `${unreachable.join("; ")}. Someone driving by voice says the word they can see, and the match is `
      + "made against a name that does not contain it.",
    ).toEqual([]);
  });
}
