/**
 * The same form, drawn twice, sending once.
 *
 * What reaches a server is the surface where a difference between renderers stops being a rendering
 * question. `what-a-page-actually-sends` reads one renderer and checks the payload against the
 * document — the right check, and it cannot see the other kind of wrong: two renderers that each look
 * defensible and send different things.
 *
 * Every kind the catalog declares, given the same value through the same public call, submitted the
 * same way, compared byte for byte. A divergence here means one of the two is wrong about a value the
 * consumer's server will act on, and neither would look wrong on its own.
 *
 * The control is that the payload carries the value at all. Two renderers that both send `{}` agree
 * perfectly and prove nothing, so each kind is asserted to have put its own name in what it sent
 * before the two are compared.
 *
 * Claims under attack: SUB-001.
 */

import { expect, test } from "@playwright/test";

import { MDY_WIDGET_KINDS } from "@modyra/widgets";

const HOSTS = [
  { name: "plain", page: "/index.html", ready: "battleReady", api: "battle" },
  { name: "lit", page: "/lit.html", ready: "battleLitReady", api: "battleLit" },
] as const;

/**
 * A value each kind can hold, written the way an application would write it.
 *
 * A multiselect holds the option **values**, not the option records — `["a"]`, not
 * `[{value: "a", …}]`. Handed the records it refuses to submit at all, correctly, and the control
 * below is what caught this spec asking the wrong question.
 */
const VALUE: Record<string, unknown> = {
  text: "t", textarea: "t", email: "a@b.c", password: "p", number: 5, slider: 5,
  checkbox: true, toggle: true, select: "a", radio: "a", segmented: "a",
  multiselect: ["a"], datepicker: "2026-03-04",
  daterange: { start: "2026-03-04", end: "2026-03-06" }, timepicker: "10:30 AM",
  colors: "#112233", file: [],
};

type Api = Record<string, {
  mountFields(id: string, fields: unknown[]): unknown;
  setValue(id: string, patch: unknown): void;
  submit(id: string): unknown;
  submittedBy(id: string): unknown[];
  dispose(id: string): void;
}>;

/** Fill one field of each kind and give back what the page sent, per kind. */
async function payloadsFrom(page: import("@playwright/test").Page, host: (typeof HOSTS)[number]) {
  await page.goto(host.page);
  await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

  const sent: Record<string, string> = {};
  for (const kind of MDY_WIDGET_KINDS) {
    await page.evaluate(({ api, k }) => {
      (window as never as Api)[api].mountFields("p", [{
        name: "x", kind: k, label: "X",
        options: [{ value: "a", label: "A" }, { value: "b", label: "B" }],
      }]);
    }, { api: host.api, k: kind });
    await page.waitForTimeout(170);

    await page.evaluate(({ api, value }) => (window as never as Api)[api].setValue("p", { x: value }),
      { api: host.api, value: VALUE[kind] ?? null });
    await page.waitForTimeout(200);

    await page.evaluate(({ api }) => (window as never as Api)[api].submit("p"), { api: host.api });
    await page.waitForTimeout(260);

    sent[kind] = await page.evaluate(({ api }) =>
      JSON.stringify((window as never as Api)[api].submittedBy("p").at(-1) ?? null), { api: host.api });

    await page.evaluate(({ api }) => (window as never as Api)[api].dispose("p"), { api: host.api });
    await page.waitForTimeout(50);
  }
  return sent;
}

test("every kind sends the same thing from both renderers", async ({ page }) => {
  test.setTimeout(600_000);

  const fromPlain = await payloadsFrom(page, HOSTS[0]);
  const fromLit = await payloadsFrom(page, HOSTS[1]);

  // The control: a payload that carries the field at all. Two renderers that both send nothing agree
  // perfectly and prove nothing.
  const empty = MDY_WIDGET_KINDS.filter((kind) => !String(fromPlain[kind]).includes('"x"'));
  expect(empty, `these kinds sent no value at all, so comparing them proves nothing: ${JSON.stringify(empty)}`).toEqual([]);

  const differ = MDY_WIDGET_KINDS
    .filter((kind) => fromPlain[kind] !== fromLit[kind])
    .map((kind) => ({ kind, plain: fromPlain[kind], lit: fromLit[kind] }));

  expect(
    differ,
    `${differ.length} kinds send different payloads from the two renderers, and a server would act on whichever one it was handed`,
  ).toEqual([]);
});
