import type { EitherHost } from "./host-api";
import { expect, test } from "@playwright/test";

/**
 * A slider at its maximum, and a form holding three times that.
 *
 * UI-006 says a widget does not replace a value the model holds in order to make itself consistent,
 * and a slider does not: give the form `150` and `getValue()` still answers `150`. What it does
 * instead is show a different number. A native range input cannot render a position outside its own
 * bounds or off its own step, so it renders the nearest one it can — and nothing on the page says the
 * two disagree.
 *
 * This is that claim read as its mirror, and it is worth saying so plainly: the widget keeps the
 * model's value and displays another. The wording covers replacing; the purpose — the screen and the
 * payload agree, or somebody is told — is what fails.
 *
 * The number field is the shape that avoids it, in the same renderer, from the same document: `150`
 * against `validators: { max: 50 }` is held as `150`, *shown* as `150`, and carries "Maximum value is
 * 50" with `aria-invalid="true"`. So the mismatch is explained where it exists. On the slider the
 * same bound moves the rendered range instead, and the explanation never appears.
 *
 * Both renderers do it, so the repair belongs to the shared controller rather than to markup.
 *
 * Claims under attack: UI-006, UI-007.
 */

type Page = import("@playwright/test").Page;

const RENDERERS = [
  { name: "plain", page: "/index.html", ready: "battleReady", api: "battle" },
  { name: "lit", page: "/lit.html", ready: "battleLitReady", api: "battleLit" },
] as const;

/** Mount one field from a document and read back what the model holds and what the page shows. */
async function mountAndRead(page: Page, api: string, id: string, field: Record<string, unknown>) {
  await page.evaluate(
    ({ hostApi, mountId, declared }) => {
      const host = (window as never as Record<string, EitherHost>)[hostApi];
      host.mountFields(mountId, [{ name: "f", label: "F", ...declared }]);
    },
    { hostApi: api, mountId: id, declared: field },
  );
  await page.waitForTimeout(200);

  return page.evaluate(
    ({ hostApi, mountId }) => {
      const host = (window as never as Record<string, EitherHost>)[hostApi];
      const element = document.querySelector(`[data-form="${mountId}"]`) as HTMLElement;
      const input = element.querySelector("input") as HTMLInputElement | null;
      const errors = element.querySelector(".mdy-control__errors") as HTMLElement | null;
      return {
        held: (host.valueOf(mountId) as Record<string, unknown>).f,
        shows: input?.value ?? null,
        invalid: input?.getAttribute("aria-invalid") ?? null,
        errorText: (errors?.innerText ?? "").trim(),
      };
    },
    { hostApi: api, mountId: id },
  );
}

for (const renderer of RENDERERS) {
  test.describe(renderer.name, () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(renderer.page);
      await page.waitForFunction(
        (flag) => (window as never as Record<string, boolean>)[flag] === true,
        renderer.ready,
      );
    });

    test("a value inside the slider's range is the number it shows", async ({ page }) => {
      // The control. Without it every assertion below would also be true of a slider that shows
      // nothing useful at all, which is a different and larger finding.
      const seen = await mountAndRead(page, renderer.api, `ok-${renderer.name}`, {
        kind: "slider",
        initialValue: 30,
        max: 50,
      });
      expect({ held: seen.held, shows: seen.shows }, JSON.stringify(seen))
        .toEqual({ held: 30, shows: "30" });
    });

    test("a number field holds and shows the same value, and explains the bound", async ({ page }) => {
      // The second control, and the shape that avoids the finding: the same document, the same
      // renderer, the same bound — carried as a rule instead of as a range.
      const seen = await mountAndRead(page, renderer.api, `num-${renderer.name}`, {
        kind: "number",
        initialValue: 150,
        validators: { max: 50 },
      });
      expect({ held: seen.held, shows: seen.shows }, JSON.stringify(seen))
        .toEqual({ held: 150, shows: "150" });
      expect(seen.invalid === "true" || seen.errorText !== "", `the bound was not explained: ${JSON.stringify(seen)}`)
        .toBe(true);
    });

    test("a slider showing a number the form does not hold says so", async ({ page }) => {
      const cases = [
        { what: "past the declared maximum", field: { kind: "slider", initialValue: 150, max: 50 } },
        { what: "past the default maximum", field: { kind: "slider", initialValue: 150 } },
        { what: "off the declared step", field: { kind: "slider", initialValue: 7, step: 5 } },
      ];

      const silent: Array<Record<string, unknown>> = [];
      for (const [index, each] of cases.entries()) {
        const seen = await mountAndRead(page, renderer.api, `bad-${renderer.name}-${index}`, each.field);

        // The premise for each: the model kept what it was given, which is UI-006 holding. What is
        // in question is the number beside it.
        expect(seen.held, `the model did not keep the value it was given: ${JSON.stringify(seen)}`)
          .toBe(each.field.initialValue);

        const agrees = String(seen.held) === seen.shows;
        const explained = seen.invalid === "true" || seen.errorText !== "";
        if (!agrees && !explained) silent.push({ ...each, ...seen });
      }

      // Either repair closes it: show the number the form holds, or say that the two differ.
      expect(silent, JSON.stringify(silent, null, 1)).toEqual([]);
    });
  });
}
