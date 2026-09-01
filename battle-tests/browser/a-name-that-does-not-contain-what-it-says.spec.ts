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
 * **A single mark is not a visible label.** Asked outside: nobody says "click multiplication sign",
 * so a button drawn as one glyph carries no words for the criterion to bite on, and requiring its
 * name to contain the mark would demand a name nobody can speak. What such a button owes instead is
 * that its words are reachable some other way — a title carrying the same words as its name — which
 * is a different claim and not this one.
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

import { HOSTS, SETTLES } from "./bench";

type Api = Record<string, Record<string, (...args: never[]) => unknown>>;

const OPTIONS = [{ value: "a", label: "Alfa" }, { value: "b", label: "Beta" }];

for (const host of HOSTS) {
  test(`every control answers to the words written on it, ${host.name}`, async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 900, height: 500 });
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    const unreachable: string[] = [];
    const valued: string[] = [];
    let compared = 0;
    let chosen = 0;

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
          // **`aria-labelledby` first.** The naming rules put the reference before the literal, so an
          // element carrying both has the referenced text as its name and reading the literal first
          // reports the markup rather than what a screen reader says. The inversion survived because
          // every assertion under it asks whether a name *exists*, and a wrong precedence still finds
          // a non-empty string — latent in the assertion rather than absent from the code.
          const by = element.getAttribute("aria-labelledby");
          if (by !== null) {
            const joined = by.split(/\s+/)
              .map((id) => document.getElementById(id)?.textContent ?? "")
              .join(" ").trim();
            if (joined !== "") return joined;
          }
          const label = element.getAttribute("aria-label");
          if (label !== null && label.trim() !== "") return label;
          const title = element.getAttribute("title");
          if (title !== null && title.trim() !== "") return title;
          // A native control is named by its label element, which is the ordinary route for the two
          // renderers that build their chooser from `select` rather than from a button.
          if (element.id !== "") {
            const tag = document.querySelector(`label[for="${CSS.escape(element.id)}"]`);
            if (tag !== null && (tag.textContent ?? "").trim() !== "") return tag.textContent ?? "";
          }
          const wrapping = element.closest("label");
          if (wrapping !== null && (wrapping.textContent ?? "").trim() !== "") return wrapping.textContent ?? "";
          // Named by its own content, which is the ordinary case and the one that passes trivially.
          return element.textContent ?? "";
        };
        /**
         * Whether what a control shows is its label or its value.
         *
         * **A button shows its name; a control that opens a list shows its value.** The rule being
         * checked here is about the *label* presented visually, and the grey word inside a closed
         * chooser is neither label nor value — it stands in the value's place until there is one.
         * Asking such a control to answer to it would be asking it to answer to a word that may
         * appear in six fields on the same page, which identifies nothing.
         */
        const showsAValue = (element: Element) =>
          element.tagName === "SELECT"
          || element.getAttribute("role") === "combobox"
          || element.hasAttribute("aria-haspopup")
          || element.getAttribute("aria-expanded") !== null;

        /**
         * What a chooser shows, which for a native one is the option standing selected — its whole
         * text content is every option it has, which nobody sees at once and which would make the
         * comparison below meaningless.
         */
        const showing = (element: Element) => element instanceof HTMLSelectElement
          ? (element.selectedOptions[0]?.textContent ?? "")
          : (element.textContent ?? "");

        const out: string[] = [];
        const named: string[] = [];
        let seen = 0;
        let choosers = 0;
        // **A native `select` is a chooser too.** Two of the three renderers build one, and leaving
        // them out meant the direction below compared nothing in those two and said so — which was
        // the guard working, not the renderers being clean.
        document.querySelectorAll(`${selector} button, ${selector} [role='button'], ${selector} a[href], ${selector} select`).forEach((control) => {
          const box = control.getBoundingClientRect();
          if (box.width === 0 || box.height === 0) return;
          const visible = normalise(showing(control));
          const name = normalise(nameOf(control));

          if (showsAValue(control)) {
            // Counted when it is met, not when it has something written in it. Two renderers build a
            // chooser whose selected option is blank until a choice is made, so the reading below is
            // empty and there is nothing to compare — but the chooser was still met, and a run that
            // called that "nothing to measure" reported the guard instead of the renderers.
            choosers += 1;
            if (visible === "" || name === "") return;
            // The other direction, and it is the one that catches the defect this file was written
            // for. A chooser built as a button is named from its own contents unless something
            // overrode that, so its name becomes the placeholder — and then it answers to a word
            // that says nothing about what it is for, while the label beside it reaches nothing.
            if (name.includes(visible)) {
              named.push(`a chooser answers to what it currently shows, "${visible}", rather than to what it is for`);
            }
            return;
          }

          if (visible === "" || name === "") return;
          // One mark is a glyph, not a caption: `×`, `+`, `‹`. A word, or several, is a label.
          if (/^[^\p{L}\p{N}]$/u.test(visible)) return;
          seen += 1;
          if (!name.includes(visible)) out.push(`a control reads "${visible}" and answers to "${name}"`);
        });
        return { out: [...new Set(out)], seen, named: [...new Set(named)], choosers };
      }, root);

      await page.evaluate(({ api, id }) => { (window as never as Api)[api].dispose?.(id as never); }, { api: host.api, id });

      compared += found.seen;
      chosen += found.choosers;
      for (const one of found.out) unreachable.push(`${kind}: ${one}`);
      for (const one of found.named) valued.push(`${kind}: ${one}`);
    }

    // A run comparing nothing would report no mismatch for the wrong reason.
    expect(compared, `${host.name} found no control carrying both visible text and a name`).toBeGreaterThan(0);

    expect(
      unreachable,
      `${host.name}: ${unreachable.length} control(s) cannot be reached by reading them aloud — `
      + `${unreachable.join("; ")}. Someone driving by voice says the word they can see, and the match is `
      + "made against a name that does not contain it.",
    ).toEqual([]);

    // A run that met no chooser cannot say anything about the direction below.
    expect(chosen, `${host.name} met no control that opens a list, so the check below compared nothing`)
      .toBeGreaterThan(0);

    expect(
      valued,
      `${host.name}: ${valued.length} chooser(s) answer to what they show instead of to what they are for — `
      + `${valued.join("; ")}. A name that follows the value cannot identify the field: it is not unique `
      + "while it is a placeholder, and once a choice is made the only way back to the control is to say "
      + "the answer one is trying to replace.",
    ).toEqual([]);
  });

  test(`a chooser's name does not follow its value, ${host.name}`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    // The check above compares a name against what a control shows, and two renderers show nothing
    // until a choice is made — so it can pass there without having compared anything that matters.
    // This one makes the choice.
    await page.evaluate(({ api, options }) => {
      (window as never as Api)[api].mountFields("named", [{
        name: "f", kind: "select", label: "Scelte", options,
      }] as never);
    }, { api: host.api, options: OPTIONS });

    const chooser = page.locator('[data-form="named"] select, [data-form="named"] [role="combobox"]').first();
    await chooser.waitFor({ timeout: 5_000 });

    const reading = () => chooser.evaluate((element) => {
      const normalise = (text: string) => text.replace(/\s+/g, " ").trim().toLowerCase();
      const named = element.getAttribute("aria-label")
        ?? (element.id !== "" ? document.querySelector(`label[for="${CSS.escape(element.id)}"]`)?.textContent : null)
        ?? element.closest("label")?.textContent
        ?? element.textContent
        ?? "";
      const shown = element instanceof HTMLSelectElement
        ? (element.selectedOptions[0]?.textContent ?? "")
        : (element.textContent ?? "");
      return { name: normalise(named), shown: normalise(shown) };
    });

    const before = await reading();
    await page.evaluate(({ api }) =>
      (window as never as Api)[api].setValue("named", { f: "b" } as never), { api: host.api });
    // Contained rather than equal: one renderer keeps the placeholder in the page beside the chosen
    // value and shows one of the two, so the text under the chooser reads "betaselect…". What this
    // line has to establish is only that the choice arrived.
    await expect
      .poll(async () => (await reading()).shown, { message: "the choice never reached the page, so the name below had nothing to follow", ...SETTLES })
      .toContain("beta");
    const after = await reading();

    // **The name is what the field is for; the value is what it currently holds.** If the name
    // followed the value, then choosing "Beta" would make this control answer to "Beta" and stop
    // answering to "Scelte" — so the only way back to a field one has just filled in would be to say
    // aloud the very answer one is trying to replace.
    expect(
      after.name,
      `${host.name}: choosing a value changed what this control answers to, from "${before.name}" to `
      + `"${after.name}". A name that follows the value cannot be used to reach the field again.`,
    ).toBe(before.name);

    expect(
      after.name.includes("beta"),
      `${host.name}: the name carries the chosen value, so it is not unique on a page where another `
      + "field offers the same choice, and it stops naming what the field is for",
    ).toBe(false);
  });
}
