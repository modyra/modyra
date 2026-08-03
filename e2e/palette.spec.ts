import { expect, test } from "@playwright/test";
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
