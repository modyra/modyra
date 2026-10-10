/**
 * A required field is called by its caption's words, and the asterisk beside them is not one of them.
 *
 * The caption names the control, and on a required field the caption also holds the mark that says
 * it must be filled. The mark is decoration: `aria-required` is what tells a reader the same fact.
 * Left readable, the mark becomes part of the computed name, and a field whose caption reads
 * "Email address" is announced as "Email address *" — a name nobody sees and nobody would say, which
 * a voice command or a find-by-name then misses. ADR 0214.
 *
 * Read as the platform computes it, through `announcedName`, on the element that carries
 * `aria-required`. Reading an attribute would let a renderer pass by copying the caption onto the
 * control, which is the second naming channel the record retires.
 *
 * Claims under attack: A11Y-004.
 */
import { expect, test } from "@playwright/test";

import { HOSTS, announcedName } from "./bench";

/** Kinds whose caption names a control directly, each drawn required. */
const KINDS = ["text", "textarea", "email", "password", "number", "select", "datepicker", "timepicker", "checkbox", "toggle"];

const OPTIONS = [{ value: "a", label: "A" }, { value: "b", label: "B" }];

for (const host of HOSTS) {
  test(`a required field is named by its caption alone, ${host.name}`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    const heard: Record<string, string | null> = {};
    const expected: Record<string, string> = {};
    for (const kind of KINDS) {
      const id = `named-${kind}`;
      const caption = `Caption ${kind}`;
      await page.evaluate(
        ({ api, mountId, k, words, options }) => {
          const battle = (window as never as Record<string, { mountFields(id: string, f: unknown[]): unknown }>)[api];
          const field: Record<string, unknown> = { name: "f", kind: k, label: words, validators: { required: true } };
          if (k === "select") field.options = options;
          battle.mountFields(mountId, [field]);
        },
        { api: host.api, mountId: id, k: kind, words: caption, options: OPTIONS },
      );
      await page.waitForTimeout(110);

      const root = page.locator(`[data-form="${id}"]`);
      // The mark must be there for the reading to mean anything: a renderer that dropped it would
      // pass on a name with nothing to keep out of it.
      await expect(root.locator(".mdy-label__required").first(), `${kind}: the mark is drawn`).toBeAttached();
      heard[kind] = await announcedName(root.locator('[aria-required="true"]').first());
      expected[kind] = caption;
    }

    expect(heard).toEqual(expected);
  });
}
