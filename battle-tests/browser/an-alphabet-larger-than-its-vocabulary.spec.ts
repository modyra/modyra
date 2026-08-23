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
 */
const VOCABULARY: Record<string, number> = {
  gap: 9,
  "font-size": 6,
  radius: 5,
  height: 3,
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

    const alphabet = await page.evaluate(() => {
      const seen: Record<string, Record<string, string>> = { gap: {}, "font-size": {}, radius: {}, height: {} };
      document.querySelectorAll('[data-form^="alphabet_"] *').forEach((element) => {
        const box = element.getBoundingClientRect();
        // Something not drawn has no size to contribute to an alphabet.
        if (box.width === 0 || box.height === 0) return;
        const style = getComputedStyle(element as HTMLElement);
        const name = (element.className || "").toString().split(/\s+/).find((one) => one.startsWith("mdy-"))
          || element.tagName.toLowerCase();
        const put = (kind: string, value: string) => { if (!(value in seen[kind])) seen[kind][value] = name; };

        if (style.gap && style.gap !== "normal" && parseFloat(style.gap) > 0) put("gap", style.gap);
        put("font-size", style.fontSize);
        if (parseFloat(style.borderTopLeftRadius) > 0) put("radius", style.borderTopLeftRadius);
        // Interactive things only: a paragraph's height is its content, not a decision.
        const tag = element.tagName.toLowerCase();
        if (tag === "button" || tag === "input" || tag === "select" || tag === "textarea") {
          put("height", `${Math.round(box.height)}px`);
        }
      });
      return seen;
    });

    const over: string[] = [];
    for (const [kind, ceiling] of Object.entries(VOCABULARY)) {
      const entries = Object.entries(alphabet[kind] ?? {})
        .sort((left, right) => parseFloat(left[0]) - parseFloat(right[0]));
      // A measurement nothing uses says nothing about coherence either way.
      if (entries.length === 0) continue;
      if (entries.length > ceiling) {
        over.push(`${kind}: ${entries.length} distinct where a scale declares ${ceiling} — `
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
