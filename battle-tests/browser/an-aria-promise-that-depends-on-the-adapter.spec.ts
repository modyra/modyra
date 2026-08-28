/**
 * An ARIA attribute is a promise made to a screen reader, and the same document should make the same
 * promises whoever drew it. It does not.
 *
 * Nineteen ARIA attributes are in play across the three renderers. **Seven of them are declared** —
 * `MDY_WIDGET_RELATIONS` names the ones that point at another part, and the state vocabularies name
 * `aria-disabled`, `aria-invalid`, `aria-readonly`, `aria-expanded`. The other twelve are written by
 * renderers and named by nothing: `aria-live`, `aria-modal`, `aria-haspopup`, `aria-valuenow` and the
 * rest carry obligations — a live region has a politeness and an atomicity, a spinbutton owes a value,
 * a range and a text — and no check asks for any of them.
 *
 * So this asserts the thing that holds without a declaration: **the three agree**. A promise made in
 * one adapter and not another is a person being told something on one page and not on the identical
 * page next to it, and no reading of the contract says which one is right — which is exactly why it is
 * the contract that owes the answer.
 *
 * Read as *which attributes are written at all* on a kind, not their values: a value differs for
 * honest reasons, a promise being absent does not.
 *
 * The dominant shape is not subtle. `aria-live` appears on every kind in one renderer and on none in
 * the other two.
 *
 * Claims under attack: ADP-001, A11Y-004.
 */
import { expect, test } from "@playwright/test";
import { MDY_WIDGET_KINDS } from "@modyra/widgets";
import { HOSTS } from "./bench";

type Api = Record<string, Record<string, (...args: never[]) => unknown>>;

test("an aria promise that depends on the adapter", async ({ page }) => {
  test.setTimeout(600_000);

  /** kind → renderer → the ARIA attributes written anywhere in the field. */
  const written = new Map<string, Record<string, string[]>>();
  let seen = 0;

  for (const host of HOSTS) {
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    for (const kind of MDY_WIDGET_KINDS) {
      const mountId = `aria-${kind}`;
      await page.evaluate(
        ({ door, id, k }) => (window as never as Api)[door].mountFields(id, [{
          name: "campo", kind: k, label: "Etichetta",
          options: [{ value: "a", label: "A" }, { value: "b", label: "B" }],
        }] as never),
        { door: host.api, id: mountId, k: kind },
      );
      await page.locator(`[data-form="${mountId}"]`).waitFor({ timeout: 5_000 }).catch(() => undefined);

      const found = await page.evaluate(({ id }) => {
        const root = document.querySelector(`[data-form="${id}"]`) as HTMLElement | null;
        if (root === null) return [];
        const names = new Set<string>();
        for (const element of root.querySelectorAll<HTMLElement>("*")) {
          for (const name of element.getAttributeNames()) if (name.startsWith("aria-")) names.add(name);
        }
        return [...names];
      }, { id: mountId });

      seen += found.length;
      if (!written.has(kind)) written.set(kind, {});
      written.get(kind)![host.name] = found;
    }
  }

  // The premise: a page that wrote no ARIA at all has three renderers agreeing perfectly about nothing.
  expect(seen, "no renderer wrote a single ARIA attribute, so this compared nothing").toBeGreaterThan(30);

  const disagreements = [...written.entries()].flatMap(([kind, byHost]) => {
    const everywhere = new Set(HOSTS.flatMap((host) => byHost[host.name] ?? []));
    return [...everywhere]
      .filter((name) => HOSTS.some((host) => !(byHost[host.name] ?? []).includes(name)))
      .sort()
      .map((name) => `${kind}: ${name} written by ${HOSTS.filter((host) => (byHost[host.name] ?? []).includes(name)).map((host) => host.name).join(" and ")}`);
  });

  expect(
    disagreements,
    `${disagreements.length} ARIA promise(s) are made by some renderers and not others:\n${disagreements.join("\n")}\n\n` +
      "The same document should say the same things to a screen reader whoever drew it. Which answer " +
      "is right is not in the contract — seven of the nineteen attributes in play are declared at all — " +
      "so this is a declaration owed, not a renderer to blame.",
  ).toEqual([]);
});
