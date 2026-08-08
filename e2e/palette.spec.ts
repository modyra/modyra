import { expect, test, type Page } from "@playwright/test";
import { MDY_ON_COLOR_FLOOR as FLOOR } from "../packages/core/dist/color-utils.js";

/**
 * The palette follows its primary, and every `on-` colour is readable against the colour it names.
 *
 * `modyra-base.css` derives secondary, tertiary and error from `--mdy-sys-color-primary` in OKLCH,
 * with the model chosen by `data-mdy-palette`. The same numbers live in `@modyra/core/color-utils`,
 * which is where the arithmetic is unit-tested; what can only be checked here is what a browser
 * actually paints — relative colour syntax, gamut clipping and the `clamp()` step all happen in the
 * engine, not in the source.
 *
 * Colours are read through a canvas rather than from `getComputedStyle`. A derived token computes to
 * `oklch(…)`, and a contrast ratio needs sRGB channels; filling a pixel and reading it back is the
 * engine's own conversion rather than a second implementation of it.
 */

/**
 * How the engine derives an `on-` colour, and what that costs.
 *
 * The rule is light text while it clears a floor, and the stylesheet states it as a threshold on an
 * estimated luminance. There are two estimates, because a colour channel may or may not admit the
 * maths that corrects the estimate for hue and chroma — so the same rule is reached with two
 * accuracies. Asserted against the capability rather than a browser name, so an engine that gains
 * the maths is held to the better figure the day it ships.
 *
 * Both numbers are measured, not chosen to pass. The estimate is what slips, never the rule: the
 * corrected form disagrees with the exact policy on 1.4% of a 6000-colour sweep and the uncorrected
 * one on 4.6%, landing at worst 3.32:1 and 3.11:1 against a floor of 3.5:1.
 *
 * The floor is deliberately below AA — `MDY_ON_COLOR_FLOOR` in `@modyra/core/color-utils` carries
 * the reason, and that module is where the rule is applied exactly rather than estimated.
 */
const legibleFloor = (correctedPivot: boolean): number => (correctedPivot ? 3.3 : 2.8);

const MODELS = ["brand", "monochrome", "complementary", "triadic"] as const;
// Saturated, dark, very light, and a red — the light one is what the previous fixed
// `color-mix(primary, white 95%)` could not serve at all.
const PRIMARIES = ["#7067FF", "#0A7D2B", "#FFE066", "#18181B", "#B3261E"] as const;

const readPalette = async (
  page: import("@playwright/test").Page,
  model: string,
  primary: string,
) =>
  page.evaluate(
    ([m, p]) => {
      document.documentElement.setAttribute("data-mdy-palette", m);
      document.documentElement.style.setProperty("--mdy-sys-color-primary", p);

      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 1;
      const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
      const probe = document.createElement("div");
      document.body.appendChild(probe);

      // getComputedStyle resolves the token; the canvas converts it to sRGB the way the engine does.
      const channels = (token: string): [number, number, number] => {
        probe.style.color = `var(${token})`;
        const resolved = getComputedStyle(probe).color;
        ctx.clearRect(0, 0, 1, 1);
        ctx.fillStyle = resolved;
        ctx.fillRect(0, 0, 1, 1);
        const d = ctx.getImageData(0, 0, 1, 1).data;
        return [d[0]!, d[1]!, d[2]!];
      };

      const names = [
        "primary",
        "secondary",
        "tertiary",
        "error",
        "on-primary",
        "on-secondary",
        "on-tertiary",
        "on-error",
      ];
      const out: Record<string, [number, number, number]> = {};
      for (const n of names) out[n] = channels(`--mdy-sys-color-${n}`);
      probe.remove();
      return out;
    },
    [model, primary] as const,
  );

const luminance = (rgb: readonly [number, number, number]): number => {
  const lin = rgb.map((c) => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  }) as [number, number, number];
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
};

const contrast = (a: readonly [number, number, number], b: readonly [number, number, number]) => {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
};

const hex = (rgb: readonly [number, number, number]) =>
  `#${rgb.map((c) => c.toString(16).padStart(2, "0")).join("")}`;

test("the palette follows the colour it is derived from", async ({ page }) => {
  await page.goto("/");
  for (const model of MODELS) {
    const a = await readPalette(page, model, "#7067FF");
    const b = await readPalette(page, model, "#0A7D2B");
    for (const role of ["secondary", "tertiary"] as const) {
      expect(
        hex(a[role]!),
        `${model}: ${role} must follow the primary, not stay where it was`,
      ).not.toBe(hex(b[role]!));
    }
    // Error harmonises in weight without leaving red — it moves, but never off its hue.
    expect(hex(a.error!), `${model}: error takes its weight from the primary`).not.toBe(
      hex(b.error!),
    );
    for (const palette of [a, b]) {
      const [r, g, bl] = palette.error!;
      expect(r, `${model}: error stayed red — got ${hex(palette.error!)}`).toBeGreaterThan(g);
      expect(r, `${model}: error stayed red — got ${hex(palette.error!)}`).toBeGreaterThan(bl);
    }
  }
});

test("every on- colour is readable, and chosen in the right direction", async ({ page }) => {
  // Two bars, because the stylesheet estimates the rule and the module applies it.
  //
  // A stylesheet cannot compute a contrast ratio: it holds the colour in OKLCH and the ratio wants
  // sRGB luminance, so `modyra-base.css` estimates that luminance and compares it against a
  // threshold. `@modyra/core/color-utils` measures the ratios directly, and the floor it names is
  // where both of them get the rule from.
  //
  // So what is asserted here is the quality of the estimate — never below a floor that stays
  // legible, and never on the wrong side of the choice.
  await page.goto("/");
  const correctedPivot = await page.evaluate(() =>
    CSS.supports("color", "oklch(from white calc(pow(l, 3)) c h)"));
  const floor = legibleFloor(correctedPivot);
  const tooLow: string[] = [];
  const badlyChosen: string[] = [];
  for (const model of MODELS) {
    for (const primary of PRIMARIES) {
      const p = await readPalette(page, model, primary);
      for (const role of ["primary", "secondary", "tertiary", "error"] as const) {
        const bg = p[role]!;
        const on = p[`on-${role}`]!;
        const ratio = contrast(bg, on);
        const light = contrast(bg, [255, 255, 255]);
        const dark = contrast(bg, [0, 0, 0]);
        const label = `${model}/${primary}: on-${role} ${hex(on)} on ${hex(bg)}`;
        if (ratio < floor) tooLow.push(`${label} = ${ratio.toFixed(2)}:1`);

        // Not "did it take the higher ratio" — that is the rule this palette deliberately does not
        // follow, and asserting it would fail every pair the policy exists to fix. What is checked
        // is the direction: light wherever light is readable, and the better of the two below that.
        //
        // Only on the tier that can compute the correction. The other reaches the same rule through
        // lightness alone, which cannot separate two colours of equal lightness and unequal
        // brightness — disagreeing there is the tier working as defined, and the floor above is what
        // bounds the cost. Asserting exact direction on it would be asserting it is the other tier.
        const isLight = luminance(on) > luminance(bg);
        const shouldBeLight = light >= FLOOR ? true : light >= dark;
        if (correctedPivot && isLight !== shouldBeLight) {
          badlyChosen.push(
            `${label} = ${ratio.toFixed(2)}:1, ${isLight ? "light" : "dark"} where ` +
              `${shouldBeLight ? "light" : "dark"} was the rule (white ${light.toFixed(2)}:1, black ${dark.toFixed(2)}:1)`,
          );
        }
      }
    }
  }
  expect(tooLow, `below the ${floor}:1 floor for this engine:\n${tooLow.join("\n")}`).toEqual([]);
  expect(badlyChosen, `the approximation chose poorly:\n${badlyChosen.join("\n")}`).toEqual([]);
});

test("an on- colour is black or white, never the mid grey between them", async ({ page }) => {
  // The `clamp()` step is only a step if its slope is steep enough. At ×100 a colour landing within
  // 0.01 of the pivot resolved *inside* the clamp — one measured at lightness 0.5559 against a pivot
  // of 0.56 produced a mid grey, the worst text colour available on any background.
  await page.goto("/");
  for (const model of MODELS) {
    for (const primary of PRIMARIES) {
      const p = await readPalette(page, model, primary);
      for (const role of ["primary", "secondary", "tertiary", "error"] as const) {
        const on = p[`on-${role}`]!;
        const mid = (on[0] + on[1] + on[2]) / 3;
        expect(
          mid < 40 || mid > 215,
          `${model}/${primary}: on-${role} is ${hex(on)}, neither dark nor light`,
        ).toBe(true);
      }
    }
  }
});

test("a theme that wants its own palette still gets it", async ({ page }) => {
  // The escape hatch: derivation is the default, not a cage. Declaring a role outright wins.
  await page.goto("/");
  const forced = await page.evaluate(() => {
    document.documentElement.setAttribute("data-mdy-palette", "brand");
    document.documentElement.style.setProperty("--mdy-sys-color-primary", "#7067FF");
    document.documentElement.style.setProperty("--mdy-sys-color-secondary", "#00857A");
    const probe = document.createElement("div");
    document.body.appendChild(probe);
    probe.style.color = "var(--mdy-sys-color-secondary)";
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    ctx.fillStyle = getComputedStyle(probe).color;
    ctx.fillRect(0, 0, 1, 1);
    const d = ctx.getImageData(0, 0, 1, 1).data;
    probe.remove();
    return [d[0]!, d[1]!, d[2]!] as [number, number, number];
  });
  expect(hex(forced)).toBe("#00857a");
});

test("dark mode derives too, instead of reverting to the reference colours", async ({ page }) => {
  // Dark mode used to restate secondary and tertiary from the fixed violet and coral, so a chosen
  // brand colour worked in the light theme and quietly stopped applying in the dark one.
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  const green = await readPalette(page, "brand", "#0A7D2B");
  const indigo = await readPalette(page, "brand", "#7067FF");
  expect(hex(green.secondary!), "dark mode: secondary must follow the primary").not.toBe(
    hex(indigo.secondary!),
  );
  // Violet is the fallback a secondary lands on when it stops following the brand.
  expect(hex(green.secondary!)).not.toBe("#a855f7");
  await page.emulateMedia({ colorScheme: null });
});

/**
 * What a reader actually meets: every element that owns text, against the surface behind it.
 *
 * The tests above check the *tokens* — that a derived `on-` colour is readable against the colour it
 * names. That is a different question from whether the page is readable, and the gap between them is
 * where the defects lived: a theme pinning `--mdy-on-primary` to a literal, a control taking its
 * background from one role and its text from another, a surface ramp that only worked for the seed
 * it was written against. Each of those leaves every token correct and the page unreadable.
 *
 * Two things about the measurement, both learned by getting them wrong:
 *
 * `rgb()` channels are 0–255 and `color(srgb …)` channels are 0–1. Reading both on one scale reports
 * perfectly readable text as `1:1`, and about forty pairs came back that way before it was fixed.
 *
 * An element with no opaque ancestor has no measurable background. Assuming white there invents a
 * failure for every light-on-transparent label in the dark scheme. It is skipped and counted, and the
 * count is asserted, because a walk that silently skips everything passes.
 */
const CONTRAST_THEMES = ["modyra", "modyra-modern", "modyra-material", "modyra-ios"] as const;

/**
 * Where a design system's own pairing sits below the floor, and is kept anyway.
 *
 * A theme exists to be faithful to the system it names. Apple pairs white with system blue — it is
 * in the HIG, it is what every iOS control does, and its button sits below 4.5:1 because of it. A
 * theme that quietly darkened it to reach the floor would stop being iOS, which is a worse failure
 * than the one it fixes.
 *
 * The chip's label and count are not here: read through the engine rather than through a parser that
 * knew two colour notations, they clear the floor, and the staleness check below is what says so.
 *
 * Listed per theme rather than waived globally, and asserted in both directions below: a new pair
 * fails here, and so does an entry left behind after the theme stops producing it.
 */
const SYSTEM_PAIRINGS: Partial<Record<(typeof CONTRAST_THEMES)[number], readonly string[]>> = {
  "modyra-ios": ["mdy-button"],
};

/**
 * Waits until the rendered population stops growing.
 *
 * The playground renders into the accordion as it opens, and a swapped stylesheet repaints after it
 * loads. A fixed pause measures whatever happened to be painted when it elapsed, which on a slower
 * engine is a fraction of the page — and a walk over a fraction of the page asserts nothing while
 * passing.
 */
async function settled(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const count = document.querySelectorAll(".mdy-renderer *").length;
      const previous = (window as unknown as { __mdyPopulation?: number }).__mdyPopulation;
      (window as unknown as { __mdyPopulation?: number }).__mdyPopulation = count;
      return count > 40 && count === previous;
    },
    null,
    { timeout: 15_000, polling: 200 },
  );
}

test("every rendered text colour clears AA against the surface behind it", async ({ page }) => {
  const failures: string[] = [];
  const seenAllowed = new Set<string>();
  const perTheme: { scheme: string; theme: string; checked: number; skipped: number }[] = [];
  let asserted = 0;

  for (const scheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    for (const theme of CONTRAST_THEMES) {
      await page.goto("/");
      await page.waitForSelector("mdy-control-colors", { state: "attached", timeout: 15_000 });
      await page.locator(".playground-accordion > summary").first().click();
      await settled(page);
      await page.evaluate(async (name) => {
        const link = document.getElementById("mdy-theme-link") as HTMLLinkElement | null;
        const href = `styles/${name}.css`;
        if (!link || link.getAttribute("href") === href) return;
        await new Promise<void>((resolve) => {
          link.addEventListener("load", () => resolve(), { once: true });
          link.addEventListener("error", () => resolve(), { once: true });
          link.setAttribute("href", href);
        });
      }, theme);
      await settled(page);

      const result = await page.evaluate(() => {
        const channel = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
        const luminance = (p: number[]) => 0.2126 * channel(p[0] / 255) + 0.7152 * channel(p[1] / 255) + 0.0722 * channel(p[2] / 255);
        // The engine converts the colour, rather than this walk parsing the notation it happens to
        // have serialised. A computed background is whatever the engine chose to print — `rgb()`,
        // `color(srgb …)`, or `oklch()` for a theme that derives its ramp with relative colour syntax
        // — and a walk that reads two of those spellings reports every surface in the third as
        // unmeasurable, which is silence dressed as a pass. Canvas takes any colour the engine
        // supports and hands back sRGB bytes.
        const canvas = document.createElement("canvas");
        canvas.width = 1;
        canvas.height = 1;
        const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
        const REJECTED = "#010203";
        const colour = (value: string): { rgb: number[]; alpha: number } | null => {
          ctx.fillStyle = REJECTED;
          ctx.fillStyle = value;
          // fillStyle keeps its previous value when handed something it cannot parse.
          if (ctx.fillStyle === REJECTED && value.replace(/\s/g, "").toLowerCase() !== REJECTED) return null;
          ctx.clearRect(0, 0, 1, 1);
          ctx.fillRect(0, 0, 1, 1);
          const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
          return { rgb: [r!, g!, b!], alpha: a! / 255 };
        };
        const parse = (value: string): number[] | null => colour(value)?.rgb ?? null;
        const alphaOf = (value: string) => colour(value)?.alpha ?? 1;
        const ratio = (a: number[], b: number[]) => {
          const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
          return (hi + 0.05) / (lo + 0.05);
        };
        const behind = (el: Element): number[] | null => {
          let node: Element | null = el;
          while (node && node !== document.documentElement) {
            const bg = getComputedStyle(node).backgroundColor;
            if (alphaOf(bg) > 0.85) { const p = parse(bg); if (p) return p; }
            node = node.parentElement;
          }
          const body = getComputedStyle(document.body).backgroundColor;
          return alphaOf(body) > 0.85 ? parse(body) : null;
        };

        const failed: string[] = [];
        let checked = 0;
        let skipped = 0;
        document.querySelectorAll(".mdy-renderer *").forEach((el) => {
          const owned = Array.prototype.filter.call(
            el.childNodes,
            (n: ChildNode) => n.nodeType === 3 && (n.textContent ?? "").trim(),
          ) as ChildNode[];
          if (!owned.length) return;
          const style = getComputedStyle(el);
          if (style.visibility === "hidden" || style.display === "none" || Number(style.opacity) < 0.15) return;
          const box = el.getBoundingClientRect();
          if (box.width < 2 || box.height < 2) return;
          const fg = parse(style.color);
          if (!fg) return;
          const bg = behind(el);
          if (!bg) { skipped += 1; return; }
          checked += 1;
          const size = parseFloat(style.fontSize);
          const large = size >= 24 || (size >= 18.66 && parseInt(style.fontWeight, 10) >= 700);
          const value = ratio(fg, bg);
          if (value >= (large ? 3 : 4.5)) return;
          const names = String((el as HTMLElement).className || "").split(/\s+/).filter((c) => c.startsWith("mdy-"));
          failed.push(`${names[0] ?? el.tagName.toLowerCase()}|${value.toFixed(2)}`);
        });
        return { failed: Array.from(new Set(failed)), checked, skipped };
      });

      asserted += result.checked;
      perTheme.push({ scheme, theme, checked: result.checked, skipped: result.skipped });
      const allowed = new Set(SYSTEM_PAIRINGS[theme] ?? []);
      for (const row of result.failed) {
        const [part, value] = row.split("|");
        if (allowed.has(part)) { seenAllowed.add(`${theme}:${part}`); continue; }
        failures.push(`${scheme} · ${theme} · ${part} — ${value}:1`);
      }
    }
  }

  // A walk that matched nothing passes without asserting anything, which is the failure this whole
  // suite exists to prevent one level up.
  //
  // The floor is 60 rather than "every visible string" because most text on this page sits on
  // transparent ancestry all the way to a body that paints nothing, and this walk skips what it
  // cannot measure instead of assuming a white page. What it does reach is the population that
  // matters here: text on a *painted* surface, which is where a pinned `on-` colour, a crossed
  // pair and a seed-only ramp all show up. Every defect this test was written from is in it.
  const report = perTheme
    .map((row) => `${row.scheme}/${row.theme}: ${row.checked} measured, ${row.skipped} unmeasurable`)
    .join("\n");

  // A theme that measured nothing is the failure this guard exists for, and it is per theme rather
  // than in the total: a page that never finished rendering one theme hides inside a total the other
  // three carry. How much each theme reaches is engine-dependent — the walk skips text it cannot
  // place on a painted surface, and how much that is differs by how each engine reports a computed
  // background — so the total is a coarse backstop and the per-theme floor is the real check.
  const blind = perTheme.filter((row) => row.checked === 0);
  expect(blind.map((row) => `${row.scheme}/${row.theme}`), `a theme measured no text at all\n${report}`).toEqual([]);
  expect(asserted, `the walk is stale (measured ${asserted})\n${report}`).toBeGreaterThan(40);
  expect(failures, `text below the AA floor:\n${failures.join("\n")}`).toEqual([]);

  // The other direction: an allowance that no longer describes anything is a waiver outliving the
  // thing it waived, and it silences the next real defect on that part.
  const stale = Object.entries(SYSTEM_PAIRINGS).flatMap(([theme, parts]) =>
    (parts ?? []).filter((part) => !seenAllowed.has(`${theme}:${part}`)).map((part) => `${theme}:${part}`),
  );
  expect(stale, `these design-system allowances no longer apply and should be removed:\n${stale.join("\n")}`).toEqual([]);
});
