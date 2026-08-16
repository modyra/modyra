/**
 * One letter more in a kind, and a password is on the screen.
 *
 * `kind` is not decoration: `MDY_FIELD_KINDS` makes `password` a kind of its own precisely because
 * what it means is how the control behaves, and an adapter is where that is read. A kind nobody
 * declared has no behaviour to read.
 *
 * One renderer refuses a field list containing one, by name. The other substitutes a text field —
 * so `kind: "passwordd"`, a typo a person makes once, renders as a visible box holding what the user
 * types, and the page looks finished.
 *
 * The parser refuses an unknown kind (`MDY_DYNAMIC_UNKNOWN_KIND`), so a consumer following the
 * documented flow never arrives here. A field list built by hand and handed to the renderer does, and
 * one of the two renderers treats guarding it as its own job.
 *
 * Every declared kind is checked first, in the same run: all seventeen map to their own element, so
 * this is about the ones nobody declared and not about a renderer that falls back often.
 *
 * Claims under attack: SEC-005, DYN-001.
 */

import { expect, test } from "@playwright/test";

import { MDY_WIDGET_KINDS } from "@modyra/widgets";

const HOSTS = [
  { name: "plain", page: "/index.html", ready: "battleReady", api: "battle" },
  { name: "lit", page: "/lit.html", ready: "battleLitReady", api: "battleLit" },
] as const;

type Api = Record<string, {
  mountFields(id: string, fields: unknown[]): { mounted: boolean; message?: string };
  dispose(id: string): void;
}>;

for (const host of HOSTS) {
  test(`a kind nobody declared, ${host.name}`, async ({ page }) => {
    test.setTimeout(300_000);

    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    // The control: every kind the catalog declares renders as something of its own. A renderer that
    // fell back to a text field often would make the assertion below meaningless.
    const fellBack: string[] = [];
    for (const kind of MDY_WIDGET_KINDS) {
      await page.evaluate(({ api, k }) => {
        (window as never as Api)[api].mountFields("k", [{
          name: "x", kind: k, label: "X",
          options: [{ value: "a", label: "A" }],
        }]);
      }, { api: host.api, k: kind });
      await page.waitForTimeout(90);
      const looksLikeText = await page.evaluate(() => {
        const input = document.querySelector('[data-form="k"] input') as HTMLInputElement | null;
        return input !== null && input.type === "text";
      });
      if (looksLikeText && kind !== "text" && kind !== "datepicker" && kind !== "daterange" && kind !== "timepicker") {
        fellBack.push(kind);
      }
      await page.evaluate(({ api }) => (window as never as Api)[api].dispose("k"), { api: host.api });
      await page.waitForTimeout(40);
    }
    expect(fellBack, "declared kinds are rendering as plain text boxes, which is a larger finding than this one").toEqual([]);

    // And a kind nobody declared: one letter more than a real one.
    const outcome = await page.evaluate(({ api }) =>
      (window as never as Api)[api].mountFields("u", [{ name: "secret", kind: "passwordd", label: "Secret" }]),
      { api: host.api });
    await page.waitForTimeout(240);

    if (outcome.mounted === false) {
      expect(outcome.message, "the mount was refused without naming the kind").toContain("kind");
      return;
    }

    const shown = await page.evaluate(() => {
      const input = document.querySelector('[data-form="u"] input') as HTMLInputElement | null;
      return input === null ? null : input.type;
    });

    expect(
      shown,
      `a field whose kind nobody declared rendered as an input of type ${JSON.stringify(shown)}: one letter more than "password" and the value is on the screen`,
    ).toBeNull();
  });
}
