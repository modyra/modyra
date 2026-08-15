/**
 * Leaving a form half-filled and coming back to it.
 *
 * The engine's draft battles run against a storage this suite owns, in one process. What a draft is
 * *for* is the other thing: a person types, the tab closes, the browser restarts, and the page they
 * open is a new JavaScript context reading storage that outlived the last one. Nothing in this suite
 * had crossed that boundary.
 *
 * Two promises meet there. The half-filled form comes back — in the model *and* in the controls,
 * which are different things and only one of them is what the user sees. And a field named in
 * `exclude` never went to storage in the first place, which is the documented way to keep a password
 * out of a place `docs/guides/security.md` describes as writable by every script on the origin.
 *
 * The second is the one worth a real reload rather than a second form instance: a value that was
 * never written cannot come back, and proving it was never written means reading the storage a
 * browser actually kept.
 *
 * Asked of the renderer that can be given a draft at all — see finding 148 for the one that cannot.
 */

import { expect, test } from "@playwright/test";

const FIELDS = [
  { name: "who", kind: "text", label: "Who" },
  { name: "note", kind: "textarea", label: "Note" },
  { name: "secret", kind: "password", label: "Secret" },
];

test("a half-filled form comes back, without the field kept out of it", async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto("/lit.html");
  await page.waitForFunction(() => (window as never as Record<string, boolean>).battleLitReady === true);

  const mount = () => page.evaluate((fields) => {
    (window as never as Record<string, { mountFields(i: string, f: unknown[], o?: unknown): { mounted: boolean } }>)
      .battleLit.mountFields("d", fields, { draft: { key: "kept", exclude: ["secret"] } });
  }, FIELDS);

  await page.evaluate(() => window.localStorage.clear());
  await mount();
  await page.waitForTimeout(320);

  const inputs = page.locator('[data-form="d"] input');
  await inputs.nth(0).fill("lorenzo");
  await inputs.nth(1).fill("sk-live-DEADBEEF");
  await page.locator('[data-form="d"] textarea').first().fill("half a sentence");
  await inputs.nth(0).blur();
  // The engine debounces before it writes.
  await page.waitForTimeout(900);

  const stored = await page.evaluate(() => window.localStorage.getItem("kept"));

  // The premise: a draft was written at all, so what is missing from it means something.
  expect(stored, "nothing was written, so nothing below is about what a draft keeps").not.toBeNull();
  expect(stored, "the draft does not hold what was typed into an ordinary field").toContain("lorenzo");
  expect(stored, "the draft holds a field the form was told to keep out of it").not.toContain("sk-live-DEADBEEF");

  // A real reload: a new JavaScript context reading storage that outlived the last one.
  await page.reload();
  await page.waitForFunction(() => (window as never as Record<string, boolean>).battleLitReady === true);
  await mount();
  await page.waitForTimeout(700);

  const back = await page.evaluate(() => {
    const root = document.querySelector('[data-form="d"]');
    return {
      model: (window as never as Record<string, { valueOf(i: string): Record<string, unknown> }>).battleLit.valueOf("d"),
      shown: (root?.querySelector("input") as HTMLInputElement | null)?.value ?? null,
      note: (root?.querySelector("textarea") as HTMLTextAreaElement | null)?.value ?? null,
    };
  });

  expect(back.model, "the form did not come back holding what was left in it")
    .toEqual({ who: "lorenzo", note: "half a sentence", secret: "" });

  // The controls, which is the half the user sees. A model restored behind a blank box is a form
  // that looks empty and submits something.
  expect(back.shown, "the model was restored and the control was left blank").toBe("lorenzo");
  expect(back.note, "a second field was restored in the model and not on the page").toBe("half a sentence");
});
