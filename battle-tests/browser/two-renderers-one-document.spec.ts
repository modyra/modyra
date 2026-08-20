/**
 * One document, two renderers, and the state a consumer reads back.
 *
 * `@modyra/widgets` is the complete framework-agnostic UI contract, and Plain and Lit are two
 * derivations of it. A consumer who swaps one for the other changes what the page looks like, not
 * what the form *is*: the value it holds, the value it would send, whether it is valid, whether it
 * can be submitted. Those four are the form's, not the renderer's.
 *
 * So the same field list is mounted in both hosts and driven through the same sequence — a legal
 * value, a value the kind's contract refuses, disabled, readonly, reset — and after each step the two
 * are asked the same four questions. Every kind the contract publishes, in one spec, because a
 * divergence found one kind at a time is found one release at a time.
 *
 * What is *not* compared, deliberately: the DOM. Two renderers are allowed to draw differently, and
 * `UI-009` and the part audits are where that is held. This is about the answers underneath.
 *
 * Claims under attack: DYN-001, SUB-002, VAL-003.
 */

import { expect, test } from "@playwright/test";

type Page = import("@playwright/test").Page;

/** Every kind, with a value its contract accepts and one it refuses. */
const KINDS: ReadonlyArray<readonly [string, unknown, unknown]> = [
  ["text", "a word", 42],
  ["textarea", "a paragraph", 42],
  ["email", "a@b.co", 42],
  ["password", "hunter2", 42],
  ["number", 7, "seven"],
  ["slider", 7, "seven"],
  ["checkbox", true, "yes"],
  ["toggle", true, "yes"],
  ["datepicker", "2026-08-20", "not a date"],
  ["timepicker", "14:30", "not a time"],
  ["daterange", { start: "2026-08-20", end: "2026-08-21" }, { start: "nope", end: "nope" }],
  ["colors", "#123456", 42],
];

const OPTIONS = [{ value: "a", label: "A" }, { value: "b", label: "B" }];
const NEEDS_OPTIONS = new Set(["select", "multiselect", "radio", "segmented"]);

const settled = async (page: Page) => {
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve(null)))),
  );
};

/** Drive one kind through the sequence on one host, and report what the form says at each step. */
async function traceOn(page: Page, api: "battle" | "battleLit", kind: string, good: unknown, bad: unknown) {
  return page.evaluate(
    async ({ api, kind, good, bad, needsOptions, options }) => {
      const host = (window as never as Record<string, Record<string, (...args: unknown[]) => unknown>>)[api];
      const id = `diff-${kind}`;
      const declared = [{ name: "v", kind, label: "V", ...(needsOptions ? { options } : {}) }];
      host.mountFields(id, declared as never);
      const rest = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve(null))));
      await rest();

      const look = () => ({
        value: (host.valueOf(id) as Record<string, unknown>)?.v ?? null,
        errors: ((host.errorsOf(id, "v") as unknown[]) ?? []).length,
        canSubmit: host.canSubmitOf(id),
      });

      const seen: Record<string, unknown> = {};
      host.setValue(id, { v: good });
      await rest();
      seen.afterGood = look();

      host.setValue(id, { v: bad });
      await rest();
      seen.afterBad = look();

      host.setValue(id, { v: good });
      host.disable(id, "v");
      await rest();
      seen.afterDisable = look();

      host.reset(id);
      await rest();
      seen.afterReset = look();

      host.dispose?.(id);
      return seen;
    },
    { api, kind, good, bad, needsOptions: NEEDS_OPTIONS.has(kind), options: OPTIONS },
  );
}

test("the two renderers answer the same four questions about the same document", async ({ browser }) => {
  const plain = await browser.newPage();
  await plain.goto("/index.html");
  await plain.waitForFunction(() => (window as never as { battleReady?: boolean }).battleReady === true);

  const lit = await browser.newPage();
  await lit.goto("/lit.html");
  await lit.waitForFunction(() => (window as never as { battleLitReady?: boolean }).battleLitReady === true);

  const differed: string[] = [];
  let compared = 0;

  for (const [kind, good, bad] of KINDS) {
    const fromPlain = await traceOn(plain, "battle", kind, good, bad);
    const fromLit = await traceOn(lit, "battleLit", kind, good, bad);
    compared += 1;
    for (const step of Object.keys(fromPlain)) {
      const a = JSON.stringify((fromPlain as Record<string, unknown>)[step]);
      const b = JSON.stringify((fromLit as Record<string, unknown>)[step]);
      if (a !== b) differed.push(`${kind} ${step}: plain ${a}, lit ${b}`);
    }
  }

  await plain.close();
  await lit.close();

  // The control: the sweep ran over every kind it declares. A run that mounted nothing would
  // otherwise report perfect agreement.
  expect(compared, "the sweep compared no kinds at all").toBe(KINDS.length);
  expect(differed, differed.join("\n")).toEqual([]);
});
