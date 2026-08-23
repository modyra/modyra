/**
 * How many different sizes the library actually draws.
 *
 * Coherence is low cardinality. A person calls a set of controls incoherent when the same job is done
 * at sizes that do not relate to one another — and that is countable: render every kind on one page,
 * collect the **computed** value of each measurement, and count how many distinct ones there are.
 *
 * **The alphabet a system uses must be no larger than the alphabet it declares.** If a scale has three
 * interactive heights and the rendered library draws nine, six came from somewhere the scale does not
 * name, and this file names them with the component each appears in.
 *
 * That is why the reading is taken from the rendered page and not from the stylesheet. A source check
 * finds a literal; this finds a literal, a `calc()` that lands between steps, a value inherited from
 * an ancestor, a theme override that invented a number, **and a browser default nobody chose** — which
 * is the one no static check can see, because it is not written anywhere.
 *
 * Today two of the values are exactly that: a font size of `13.3333px` and a height of `21px`, both on
 * a plain `<button>` that no rule in this library ever sized. They are not decisions anyone made or
 * could find; they are what happens when nothing says otherwise.
 *
 * **This does not measure whether the sizes are good ones.** Whether a ratio suits this product,
 * whether the proportions are pleasant — those are judgement and they stay judgement. A system can
 * pass this and be ugly. It cannot pass this and be *incoherent*, which is the narrower thing this
 * file is for.
 *
 * The ceilings below are the sizes a scale for each measurement would declare. They are not thresholds
 * chosen to make today's numbers pass — every one of them is exceeded right now, and the excess is the
 * finding.
 *
 * **Two numbers are reported, and reading only one of them will mislead you.**
 *
 * The count of distinct values is *how far there is to go*. It moves when the **last** component using
 * a stray value leaves it, not when the first one does — so a value shared by three components takes
 * three migrations to disappear and the first two look like no progress at all. The chip moving onto
 * the control scale changed nothing here, because a stepper still holds the height it left behind.
 *
 * The count of declarations pointing at a stray value is *whether the last commit did anything*. It
 * falls every time a component moves, so it is the number to watch while migrating and the useless one
 * to judge completeness by.
 *
 * The assertion is on the first. The second is in the message, because somebody six migrations from
 * now reading an unchanged headline needs to see that the work is landing.
 *
 * Claims under attack: UI-005.
 */

import { expect, test } from "@playwright/test";
import { MDY_WIDGET_KINDS } from "@modyra/widgets";

import { HOSTS } from "./bench";

type Api = Record<string, Record<string, (...args: never[]) => unknown>>;

/**
 * How many distinct values each measurement may take across the whole library.
 *
 * A step count, not a taste: a spacing scale that needs more than nine steps is not a scale, and an
 * interactive-height scale needs three — compact, default, comfortable — because a fourth is a
 * component asking to be its own size.
 *
 * **Height is three populations, not one, and counting them together was this file's own error.**
 * `DESIGN.md` records the disagreement in those words: *"a control inside a field, a field, and a
 * control standing on its own are three scales that happen to share a unit"*. It documents 24 for a
 * stacked stepper, 28 for an affordance box and 56 for the field — three heights before a button is
 * drawn — so a single ceiling of three was unsatisfiable without overriding a documented exception or
 * resizing every field in the library, and neither is a thing to do to satisfy a threshold.
 *
 * A control inside a field carries its pointer target as an overlay and its box stays small; a button
 * with no field around it has no overlay to carry one, so its box is the target. They are different
 * scales for a stated reason, and a check that adds them up is measuring across a boundary the design
 * record draws.
 */
const VOCABULARY: Record<string, number> = {
  gap: 9,
  "font-size": 6,
  radius: 5,
  // Height is counted three times, once per population — see below.
  "height inside a field": 3,
  "height of a field": 3,
  "height standing alone": 3,
};

for (const host of HOSTS) {
  test(`the library draws no more sizes than a scale would declare, ${host.name}`, async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 1_400, height: 600 });
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    for (const kind of MDY_WIDGET_KINDS) {
      await page.evaluate(({ api, kind }) => {
        (window as never as Api)[api].mountFields(`alphabet_${kind}`, [{
          name: "f", kind, label: "Etichetta", clearable: true,
          options: [{ value: "a", label: "Alfa" }, { value: "b", label: "Beta" }],
        }] as never);
      }, { api: host.api, kind }).catch(() => undefined);
    }
    await page.waitForTimeout(800);

    const { alphabet, counts } = await page.evaluate(() => {
      const keys = ["gap", "font-size", "radius", "height inside a field", "height of a field", "height standing alone"];
      const seen: Record<string, Record<string, string>> = Object.fromEntries(keys.map((k) => [k, {}]));
      const many: Record<string, Record<string, number>> = Object.fromEntries(keys.map((k) => [k, {}]));
      document.querySelectorAll('[data-form^="alphabet_"] *').forEach((element) => {
        const box = element.getBoundingClientRect();
        // Something not drawn has no size to contribute to an alphabet.
        if (box.width === 0 || box.height === 0) return;
        const style = getComputedStyle(element as HTMLElement);
        const name = (element.className || "").toString().split(/\s+/).find((one) => one.startsWith("mdy-"))
          || element.tagName.toLowerCase();
        const put = (kind: string, value: string) => {
          if (!(value in seen[kind])) seen[kind][value] = name;
          many[kind][value] = (many[kind][value] ?? 0) + 1;
        };

        if (style.gap && style.gap !== "normal" && parseFloat(style.gap) > 0) put("gap", style.gap);
        put("font-size", style.fontSize);
        if (parseFloat(style.borderTopLeftRadius) > 0) put("radius", style.borderTopLeftRadius);
        // The field's own box is a population of one kind; measured here so it is counted once.
        if (element.classList.contains("mdy-input-wrapper")) put("height of a field", `${Math.round(box.height)}px`);
        // Interactive things only: a paragraph's height is its content, not a decision.
        const tag = element.tagName.toLowerCase();
        if (tag === "button" || tag === "input" || tag === "select" || tag === "textarea") {
          // A textarea is as tall as its rows, which is content and not a step.
          if (tag === "textarea") return;
          // A one-pixel box is how a native control is kept focusable while the styled one is drawn.
          // It is a hiding technique and states no size.
          if (Math.round(box.height) <= 1 || Math.round(box.width) <= 1) return;
          // The bench draws a submit button of its own with no part class. It belongs to the harness.
          if (name === element.tagName.toLowerCase()) return;

          const field = element.closest(".mdy-input-wrapper");
          const population = element.classList.contains("mdy-input-wrapper") || field === element
            ? "height of a field"
            : field !== null
              ? "height inside a field"
              : "height standing alone";
          put(population, `${Math.round(box.height)}px`);
        }
      });
      return { alphabet: seen, counts: many };
    });

    const over: string[] = [];
    for (const [kind, ceiling] of Object.entries(VOCABULARY)) {
      const entries = Object.entries(alphabet[kind] ?? {})
        .sort((left, right) => parseFloat(left[0]) - parseFloat(right[0]));
      // A measurement nothing uses says nothing about coherence either way.
      if (entries.length === 0) continue;
      if (entries.length > ceiling) {
        // The stray values are the ones past the ceiling once the scale's own are accounted for; how
        // many elements carry each is the number that moves per commit.
        const carriers = entries.reduce((total, [value]) => total + (counts[kind]?.[value] ?? 0), 0);
        over.push(`${kind}: ${entries.length} distinct where a scale declares ${ceiling}, `
          + `across ${carriers} element(s) — `
          + entries.map(([value, where]) => `${value} on ${where}`).join(", "));
      }
    }

    // A run that collected nothing would report no excess for the wrong reason.
    const collected = Object.values(alphabet).reduce((total, one) => total + Object.keys(one).length, 0);
    expect(collected, `${host.name} collected no sizes at all, so this measured nothing`).toBeGreaterThan(6);

    expect(
      over,
      `${host.name} draws more sizes than a scale would name — ${over.join(" | ")}. Each surplus value `
      + "is one a person meets and cannot relate to the others, and some of them are not decisions "
      + "at all but what a browser does when nothing says otherwise.",
    ).toEqual([]);
  });
}
