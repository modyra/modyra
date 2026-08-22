/**
 * A document may declare `__proto__`, and it is carried as data rather than as a key.
 *
 * Every layer of this framework turns strings from a document into object keys: a field name becomes
 * a payload key, an option value becomes a key in the map that remembers what was chosen, a kind
 * becomes a lookup into a table of renderers. JavaScript owns some of those strings already —
 * `__proto__` reaches the prototype chain, `constructor` and `toString` reach members every object
 * has — and a lookup written the obvious way answers with something that is not a value at all.
 *
 * **Nothing here is a defect today.** This spec was written after an attack found none, and it exists
 * for the reason a defence that works is worth pinning: it is invisible while it holds, spread across
 * a parser, a controller and three renderers, and any one of them can lose it in a refactor without a
 * single existing check going red. `TAG[kind]` on an object literal answering `Object.prototype`
 * rather than `undefined` was found by a test in the widgets package the same week; the same shape
 * reaches further than the one lookup that happened to be examined.
 *
 * Three claims, and the third is the one a reader should not skip:
 *
 *   - a kind the language owns is **refused**, and named in the refusal;
 *   - an option value the language owns is **carried**, because it is somebody's data and refusing it
 *     would be the framework deciding which strings a business may use;
 *   - carrying it changes nothing about the objects it passes through — no prototype moves, and
 *     nothing lands on a bare `{}` elsewhere in the page.
 *
 * The second and third together are the whole point. Refusing the value would also pass a naive
 * check, and would be wrong: a plan named `constructor` is a plan.
 *
 * Claims under attack: SEC-001, SEC-006, DYN-004.
 */

import { expect, test } from "@playwright/test";
import { HOSTS } from "./bench";

/** Strings the language answers to before any of our code does. */
const OWNED = ["__proto__", "constructor", "prototype", "toString", "valueOf"];

for (const host of HOSTS) {
  test(`a name the language owns is data, not a key, ${host.name}`, async ({ page }) => {
    test.setTimeout(120_000);
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(String(error.message).slice(0, 120)));

    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    // A kind the language owns: refused, and the refusal names it. A renderer picked by a bare
    // lookup would find `Object.prototype` here and draw whatever that becomes.
    for (const kind of OWNED) {
      const refused = await page.evaluate(({ api, k }) => {
        try {
          return (window as never as Record<string, Record<string, (...args: never[]) => unknown>>)[api]
            .mountFields(`own-${k}`, [{ name: "f", kind: k, label: "L" }] as never);
        } catch (error) {
          return { mounted: false, message: String((error as Error).message) };
        }
      }, { api: host.api, k: kind });
      await page.waitForTimeout(120);

      const drew = await page.evaluate((k) => {
        const root = document.querySelector(`[data-form="own-${k}"]`);
        if (root === null) return 0;
        // The form's own status region is **not** a control, and counting it punished the right
        // behaviour: that region is where the refusal is announced, so a form that refuses correctly
        // was reported as having drawn something. What is counted is a control a person could put a
        // value into.
        return [...root.querySelectorAll("input, select, textarea, [role]")]
          .filter((element) => !["status", "alert", "log"].includes(element.getAttribute("role") ?? ""))
          .length;
      }, kind);

      expect(
        drew,
        `a document declaring kind "${kind}" drew ${drew} control(s). The mount answered ` +
          `${JSON.stringify(refused)} — a kind the language owns must reach no renderer, because a ` +
          "lookup that finds a prototype member draws something nobody declared",
      ).toBe(0);
    }

    // An option value the language owns: carried, and carried as a value. Refusing it would be this
    // framework deciding which strings a business may name its own data with.
    for (const value of OWNED) {
      const id = `val-${value}`;
      await page.evaluate(({ api, mountId, v }) => {
        (window as never as Record<string, Record<string, (...args: never[]) => unknown>>)[api]
          .mountFields(mountId, [{
            name: "f", kind: "select", label: "L", initialValue: v,
            options: [{ value: v, label: "Chosen" }, { value: "ok", label: "OK" }],
          }] as never);
      }, { api: host.api, mountId: id, v: value });
      await page.waitForTimeout(200);

      const seen = await page.evaluate(({ api, mountId }) => {
        const held = (window as never as Record<string, { valueOf(i: string): Record<string, unknown> }>)[api].valueOf(mountId);
        const bare: Record<string, unknown> = {};
        return {
          held: held?.f ?? null,
          keys: Object.keys(held ?? {}),
          // The prototype of the payload, and of a fresh object made after it: either moving means
          // a value the document supplied reached somewhere a value should never reach.
          payloadProto: Object.getPrototypeOf(held ?? {}) === Object.prototype,
          bareIsUntouched: Object.keys(bare).length === 0 && (bare as { f?: unknown }).f === undefined,
        };
      }, { api: host.api, mountId: id });

      expect(
        seen.held,
        `a select whose chosen option is valued "${value}" holds ${JSON.stringify(seen.held)} — the ` +
          "document's own data was lost or replaced on its way through",
      ).toBe(value);
      expect(seen.keys, `the payload gained or lost a key carrying "${value}"`).toEqual(["f"]);
      expect(seen.payloadProto, `the payload's prototype moved while carrying "${value}"`).toBe(true);
      expect(seen.bareIsUntouched, `a fresh object gained a member while "${value}" was carried`).toBe(true);
    }

    expect(
      pageErrors,
      "carrying a name the language owns threw somewhere on the page, which is the failure mode a " +
        "bare lookup produces when it finds a prototype member instead of a value",
    ).toEqual([]);
  });
}
