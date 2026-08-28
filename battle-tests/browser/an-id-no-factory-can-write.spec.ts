/**
 * The package publishes seven functions that spell a field's ids — `textFieldPartIds`,
 * `multiselectFieldPartIds`, `datepickerFieldPartIds` and the rest — and one delimiter,
 * `MDY_ID_DELIMITER`. Together they are the promise that a consumer can write an id down before the
 * page exists: in their own `aria-describedby`, in a stylesheet, in a test.
 *
 * An id the renderer emits that no factory spells is outside that promise. It may be perfectly good
 * markup and still be unusable from outside, because there is nothing to compute it from.
 *
 * Two claims, and the second is the one with teeth:
 *
 *   spelled       an id is one of the seven factories' outputs, or
 *   composed      it is the field's scope, the published delimiter, and a suffix — the shape every
 *                 factory uses, so a consumer who knows the scope can still reach it
 *
 * The scope is not guessed. It is read back from an id the factories *do* spell — every kind emits
 * `<scope><delimiter>label` — so a kind whose ids use a different join is measured against its own
 * scope rather than against a prefix this spec invented.
 *
 * Claims under attack: ADP-001, A11Y-001.
 */
import { expect, test } from "@playwright/test";
import {
  MDY_ID_DELIMITER, MDY_WIDGET_KINDS, booleanFieldPartIds, datepickerFieldPartIds, fieldShellPartIds,
  multiselectFieldPartIds, optionFieldPartIds, textFieldPartIds, timepickerFieldPartIds,
} from "@modyra/widgets";
import { HOSTS } from "./bench";

type Api = Record<string, Record<string, (...args: never[]) => unknown>>;
type Factory = (scope: string) => Record<string, string>;

/**
 * All seven, unioned rather than matched to a kind. Which factory serves which kind is not declared
 * anywhere, and a mapping written here would be this spec's invention: the union asks the weaker and
 * honest question, whether *any* published door spells this id.
 */
const FACTORIES: Factory[] = [booleanFieldPartIds, datepickerFieldPartIds, fieldShellPartIds,
  multiselectFieldPartIds, optionFieldPartIds, textFieldPartIds, timepickerFieldPartIds] as unknown as Factory[];

const spelled = (scope: string): Set<string> =>
  new Set(FACTORIES.flatMap((factory) => Object.values(factory(scope))));

/**
 * The suffixes the factories append, asked of the factories rather than listed here: each is called
 * with a scope no page would produce, and what remains is the suffix. Naming one by hand — `label`,
 * say — anchors every kind to an id that four of them have no reason to draw, because a control its
 * label wraps needs no id to be pointed at.
 */
// A scope no page produces, and a valid one: a factory refuses an id it would not accept.
const SENTINEL = "zzzscopezzz";
const SUFFIXES = [...new Set([...spelled(SENTINEL)]
  .filter((id) => id.startsWith(SENTINEL))
  .map((id) => id.slice(SENTINEL.length)))];

/** The scope of a field, read back from whichever of its ids a factory would have spelled. */
const scopeOf = (ids: string[]): string | null => {
  const votes = new Map<string, number>();
  for (const id of ids) {
    for (const suffix of SUFFIXES) {
      if (suffix !== "" && id.endsWith(suffix)) {
        const scope = id.slice(0, -suffix.length);
        if (scope !== "") votes.set(scope, (votes.get(scope) ?? 0) + 1);
      }
    }
  }
  // The scope every id agrees on. A tie between a scope and a longer one containing it is won by the
  // one more ids voted for, which is the shorter — the longer is a suffix read as part of the scope.
  const agreed = [...votes.entries()].sort((a, b) => b[1] - a[1] || a[0].length - b[0].length)[0]?.[0];
  if (agreed !== undefined) return agreed;
  // No suffix voted, which is what a field with a single id looks like — and a single id is the scope
  // itself: `textFieldPartIds(scope).inputId` is `scope`, with nothing appended. Falling through to
  // "no scope" here would report a conforming field as unmeasurable.
  return ids.length > 0 ? ids.reduce((shortest, id) => (id.length < shortest.length ? id : shortest)) : null;
};

test("an id no factory can write", async ({ page }) => {
  test.setTimeout(600_000);
  const unspellable: string[] = [];
  const scopeless: string[] = [];
  let seen = 0;

  for (const host of HOSTS) {
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    for (const kind of MDY_WIDGET_KINDS) {
      const mountId = `spell-${kind}`;
      await page.evaluate(
        ({ door, id, k }) => (window as never as Api)[door].mountFields(id, [{
          name: "campo", kind: k, label: "Etichetta",
          options: [{ value: "a", label: "A" }, { value: "b", label: "B" }],
        }] as never),
        { door: host.api, id: mountId, k: kind },
      );
      await page.locator(`[data-form="${mountId}"]`).waitFor({ timeout: 5_000 }).catch(() => undefined);

      const ids = await page.evaluate(({ id }) => {
        const root = document.querySelector(`[data-form="${id}"]`) as HTMLElement | null;
        return root === null ? [] : [...root.querySelectorAll<HTMLElement>("[id]")].map((element) => element.id);
      }, { id: mountId });
      if (ids.length === 0) continue;
      seen += ids.length;

      // The scope, read back from an id the factories spell rather than cut off the front of one.
      const scope = scopeOf(ids);
      if (scope === null) {
        scopeless.push(`${kind} in ${host.name}: none of its ${ids.length} id(s) has a shape any factory spells`);
        continue;
      }
      const known = spelled(scope);

      for (const id of ids) {
        if (known.has(id)) continue;
        if (id.startsWith(`${scope}${MDY_ID_DELIMITER}`)) continue;
        unspellable.push(`${kind} in ${host.name}: "${id}" — scope is "${scope}", delimiter is "${MDY_ID_DELIMITER}"`);
      }
    }
  }

  // The premise: a page that drew no ids has none that cannot be spelled.
  expect(seen, "no field emitted an id at all, so nothing was checked").toBeGreaterThan(30);
  expect(scopeless, "these have no anchor id, so their other ids were measured against nothing").toEqual([]);

  expect(
    [...new Set(unspellable)],
    `${new Set(unspellable).size} id(s) no published factory can spell:\n${[...new Set(unspellable)].join("\n")}\n\n` +
      "An id exists to be named from outside. One that is neither a factory's output nor the scope " +
      "joined by the published delimiter cannot be written down in advance by anyone.",
  ).toEqual([]);
});
