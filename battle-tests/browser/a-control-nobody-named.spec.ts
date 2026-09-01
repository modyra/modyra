import { expect, test } from "@playwright/test";
import { MDY_WIDGET_KINDS } from "@modyra/widgets";

/**
 * A field a document declared without a label, and the control nobody can name.
 *
 * The Dynamic Form Contract makes `label` optional. Measured rather than assumed: `parseDynamicForm`
 * accepts a field with no `label` key, with an empty one and with a whitespace one, in **both**
 * lenient and strict mode, for every kind — including `daterange` and `select`.
 *
 * The widgets contract says something else about the result. `MDY_SEMANTICS_REQUIRING_NAME` is a
 * published list of the roles that must carry an accessible name — `listbox`, `dialog`, `grid` — and
 * a `daterange` without a label renders `role="grid"` with neither `aria-label` nor
 * `aria-labelledby`. A plain text field renders an input with no `aria-label`, no `aria-labelledby`,
 * and a `<label for>` element that is **empty**.
 *
 * So the two halves of the contract disagree about the same field, and the renderer resolves it by
 * producing a control a screen reader announces as its role and nothing else.
 *
 * **The check is written by hand because an auditor did not see all of it.** axe-core over the same
 * four fields caught the text field, the select and the checkbox, and said nothing about the
 * `daterange`, whose `role="grid"` had no name at all — a role with no name is not a rule axe runs
 * here, and it is the one the widgets contract names explicitly. A second test measured that gap
 * and has been removed now that it closed; the reason is at the foot of this file.
 *
 * Either repair closes it: require a label where a document is read, or give a control the field's
 * own name when nobody wrote one. What this refuses is a control with a role and no name.
 *
 * Claims under attack: A11Y-004, A11Y-001.
 */

/**
 * Every kind, read from the package rather than written out here. A list copied into a spec named
 * "every kind" covers every kind only until there is a new one, and then says nothing about it while
 * keeping its name.
 */
const KINDS = [...MDY_WIDGET_KINDS];

test.beforeEach(async ({ page }) => {
  await page.goto("/index.html");
  await page.waitForFunction(() => (window as never as { battleReady?: boolean }).battleReady === true);
});

test("a field declared with a label names its control", async ({ page }) => {
  // The control. Without it every failure below would also be true of a renderer that names nothing.
  const named = await page.evaluate(async () => {
    window.battle.mountFields("named", [{ name: "f", kind: "text", label: "Given name" }] as never);
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
    const host = document.querySelector('[data-form="named"]') as HTMLElement;
    const input = host.querySelector("input") as HTMLInputElement;
    const label = host.querySelector(`label[for="${input.id}"]`) as HTMLElement | null;
    return { aria: input.getAttribute("aria-label"), labelText: (label?.innerText ?? "").trim() };
  });
  expect(named.aria === "Given name" || named.labelText === "Given name", JSON.stringify(named)).toBe(true);
});

test("with both mechanisms the name is the referenced one, not the literal", async ({ page }) => {
  // **The assertion the inverted precedence survived under, written the other way round.** Every
  // check in this file asked whether a name *exists*, and a resolver reading `aria-label` first
  // still finds a non-empty string — so the defect was latent in what was asked rather than absent
  // from the code, and the repair is only guarded once something asks *which* name.
  //
  // The naming rules put the reference before the literal: an element carrying both is announced by
  // the referenced text. Reporting the literal is being right about the markup and wrong about what
  // a screen reader says.
  await page.evaluate(async () => {
    window.battle.mountFields("both", [{ name: "f", kind: "text", label: "Given name" }] as never);
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
    const control = document.querySelector('[data-form="both"] input');
    const target = document.createElement("span");
    target.id = "both-mechanisms-target";
    target.textContent = "The referenced name";
    control?.parentElement?.append(target);
    control?.setAttribute("aria-label", "The literal name");
    control?.setAttribute("aria-labelledby", "both-mechanisms-target");
  });

  const resolved = await page.evaluate(() => {
    const element = document.querySelector('[data-form="both"] input');
    if (element === null) return null;
    const by = element.getAttribute("aria-labelledby");
    if (by !== null) {
      const text = by.split(/\s+/)
        .map((ref) => (document.getElementById(ref)?.innerText ?? "").trim())
        .join(" ").trim();
      if (text !== "") return text;
    }
    const literal = element.getAttribute("aria-label");
    return literal !== null && literal.trim() !== "" ? literal.trim() : "";
  });

  expect(resolved, "no control was found to name").not.toBeNull();
  expect(resolved, "the literal was reported where a reference was present").toBe("The referenced name");
});

test("every control has a name even when the document declared none", async ({ page }) => {
  const unnamed: Array<Record<string, unknown>> = [];

  for (const kind of KINDS) {
    const id = `noname-${kind}`;
    await page.evaluate(
      ({ mountId, k }) => window.battle.mountFields(mountId, [{ name: "f", kind: k, options: [{ value: "a", label: "A" }] }] as never),
      { mountId: id, k: kind },
    );
    await page.waitForTimeout(140);

    const seen = await page.evaluate((mountId) => {
      const host = document.querySelector(`[data-form="${mountId}"]`) as HTMLElement;
      if (host === null) return { missing: true, unnamed: ["the field did not mount"] };

      /** The accessible name of one element, as far as this check can compute it. */
      const nameOf = (element: Element): string => {
        // **`aria-labelledby` first.** The naming rules put the reference before the literal, so an
        // element carrying both has the referenced text as its name and reading the literal first
        // reports the markup rather than what a screen reader says. The inversion survived because
        // every assertion under it asks whether a name *exists*, and a wrong precedence still finds
        // a non-empty string — latent in the assertion rather than absent from the code.
        const by = element.getAttribute("aria-labelledby");
        if (by !== null) {
          const text = by
            .split(/\s+/)
            .map((ref) => (document.getElementById(ref)?.innerText ?? "").trim())
            .join(" ")
            .trim();
          if (text !== "") return text;
        }
        const aria = element.getAttribute("aria-label");
        if (aria !== null && aria.trim() !== "") return aria.trim();
        const id = (element as HTMLElement).id;
        if (id !== "") {
          const label = host.querySelector(`label[for="${CSS.escape(id)}"]`) as HTMLElement | null;
          const text = (label?.innerText ?? "").trim();
          if (text !== "") return text;
        }
        const wrapping = element.closest("label") as HTMLElement | null;
        return (wrapping?.innerText ?? "").trim();
      };

      // The parts that carry a name: the roles the widgets contract lists as requiring one, and the
      // native controls a person actually operates.
      const parts = [
        ...host.querySelectorAll('[role="listbox"],[role="dialog"],[role="grid"],[role="combobox"],[role="radiogroup"]'),
        // A hidden input is not one of them, and cannot be: it is not rendered, so it has no
        // accessible name to give and no person to give it to. A field may carry one alongside its
        // visible control so a native submit sends the value.
        ...Array.from(host.querySelectorAll("input,textarea,select"))
          .filter((each) => (each as HTMLInputElement).type !== "hidden"),
      ];
      const missing = parts
        .filter((part) => nameOf(part) === "")
        .map((part) => `${part.tagName.toLowerCase()}${part.getAttribute("role") ? `[role=${part.getAttribute("role")}]` : ""}`);
      return { missing: [...new Set(missing)], parts: parts.length };
    }, id);

    if ((seen.missing as string[]).length > 0) unnamed.push({ kind, ...seen });
  }

  expect(unnamed, JSON.stringify(unnamed, null, 1)).toEqual([]);
});

// The second test of this file has been removed, which is what it asked for.
//
// It measured that a hand-written check saw an unnamed composite role the auditor said nothing
// about, and it was written to expire: "when the last composite kind is named it will fail, and the
// right response then is to delete it rather than repair it: there will be nothing left for a
// hand-written check to see that the auditor does not."
//
// It failed. Every composite kind is now named, so the gap it documented is closed and the property
// it protected is the one the test above already asserts — every control has a name, auditor or no
// auditor. Repairing it would have meant inventing a new gap for it to watch.
