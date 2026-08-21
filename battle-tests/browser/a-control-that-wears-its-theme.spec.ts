/**
 * Whether a control takes its colour from the theme the page is wearing.
 *
 * `@modyra/styles` ships five sheets and this tier loaded one, so **four of them were never rendered
 * anywhere a measurement could reach**. A theme could stop styling a control and every check would stay
 * green: `test:themes` compares class parity *between renderers*, not what a theme paints, and the only
 * thing that read the other four was a person looking at them (finding 325).
 *
 * The build copies all five now and this swaps the `<link>`, so what is measured is the page a consumer
 * would have rather than two themes cascading over each other.
 *
 * The property is the one worth holding and it is not "every theme styles every control": a theme
 * inheriting the foundation for a control is legitimate layering, and forbidding it would invent a
 * contract nobody agreed. What must be true is narrower — **whatever a control ends up wearing, it is
 * this theme's colour and not another theme's.**
 *
 * That distinction is not academic. Counting rules per control says `ionic` styles the slider with
 * nothing at all, which reads as an omission until it is rendered:
 *
 *     ionic     --mdy-primary #6458ef   slider active #6458ef   toggle track ionic green
 *     ios       --mdy-primary #007aff   slider active #007aff
 *     material  --mdy-primary #18181b   slider active #18181b
 *
 * `ionic`'s own primary *is* that purple. The slider inherits the foundation, the foundation reads the
 * theme's token, and the result is correct — the rule count was measuring the wrong thing and this
 * measures the right one.
 *
 * Claims under attack: UI-009.
 */

import { expect, test } from "@playwright/test";

const THEMES = ["modern", "material", "ios", "ionic"];

test("a slider is painted in the theme's own accent, whichever theme is loaded", async ({ page }) => {
  test.setTimeout(150_000);
  await page.goto("/index.html");
  await page.waitForFunction(() => (window as never as Record<string, boolean>).battleReady === true);
  await page.evaluate(async () => {
    await (window as never as Record<string, { mountFields(i: string, f: unknown[]): unknown }>).battle
      .mountFields("s", [{ name: "v", kind: "slider", label: "V", min: 0, max: 100, initialValue: 40 }]);
  });
  await page.waitForTimeout(300);

  const seen: string[] = [];
  for (const theme of THEMES) {
    const swapped = await page.evaluate((name) => {
      const link = document.querySelector('link[rel="stylesheet"]') as HTMLLinkElement | null;
      if (link === null) return false;
      link.href = `./modyra-${name}.css`;
      return new Promise<boolean>((resolve) => {
        link.onload = () => resolve(true);
        setTimeout(() => resolve(true), 800);
      });
    }, theme);
    expect(swapped, `the host page has no stylesheet link to swap, so no theme could be loaded`).toBe(true);
    await page.waitForTimeout(300);

    const painted = await page.evaluate(() => {
      const slider = document.querySelector(".mdy-slider") as HTMLElement | null;
      if (slider === null) return null;
      // Resolved, not read as text. A token's *value* is whatever the sheet wrote — `#18181b` in one
      // theme and `oklch(from #18181b …)` in another can paint the same pixel and compare unequal, and
      // an earlier draft of this spec failed on exactly that. Painting the expression onto a probe and
      // reading `color` back gives what a person sees.
      const probe = document.createElement("span");
      slider.parentElement!.appendChild(probe);
      const resolve = (expression: string) => {
        probe.style.color = "";
        probe.style.color = expression;
        return getComputedStyle(probe).color;
      };
      const out = {
        themeAccent: resolve("var(--mdy-primary)"),
        sliderAccent: resolve("var(--mdy-slider-active-color)"),
      };
      probe.remove();
      return out;
    });

    expect(painted, `the slider vanished under ${theme}, so nothing could be read from it`).not.toBeNull();
    seen.push(`${theme}: theme ${painted!.themeAccent || "(unset)"} / slider ${painted!.sliderAccent || "(unset)"}`);

    // The premise: this theme declares an accent at all. A sheet that sets nothing would make the
    // comparison below pass by having two empty strings agree.
    expect(
      painted!.themeAccent,
      `${theme} declares no --mdy-primary, so "the slider matches the theme" would compare nothing to nothing`,
    ).not.toBe("");

    expect(
      painted!.sliderAccent,
      `under ${theme} the slider is painted ${painted!.sliderAccent || "(nothing)"} where the theme's own ` +
        `accent is ${painted!.themeAccent} — it is wearing a colour from somewhere else. ${seen.join(" | ")}`,
    ).toBe(painted!.themeAccent);
  }
});
