/**
 * The same state puts the same class on a field, whoever drew it.
 *
 * A stylesheet is one file for three renderers. A class one of them writes and another does not is a
 * rule that applies to two thirds of an application, and nothing about the page says so — the field
 * that misses it is not broken, it is merely plain, which is the hardest kind of difference to see.
 *
 * **The state is proved before the class is read, and that is the whole of this file.** A class cannot
 * be compared until the state behind it is the same everywhere: a renderer that did not take the value
 * is not *filled*, and one that was never made to speak has nothing to be *wrong* about. Compared
 * without that, three renderers in three different states produce three different class lists and it
 * reads as a vocabulary divergence — which is what a first version of this measurement reported for
 * `daterange` and `file`, neither of which had one.
 *
 * So a renderer that cannot reach the state is its own row. It is a real finding, and a different one.
 *
 * **Read from the page, not from a renderer's source.** A class a renderer spells out and a class it
 * receives from the published vocabulary are the same class to a stylesheet and to a person; only a
 * check that greps files can tell them apart, and telling them apart is what makes it wrong the moment
 * a class moves into the contract.
 *
 * Claims under attack: UI-009, ADP-001.
 */
import { expect, test } from "@playwright/test";
import { MDY_WIDGET_KINDS } from "@modyra/widgets";

import { HOSTS, madeToSpeak } from "./bench";

type Api = Record<string, Record<string, (...args: never[]) => unknown>>;

/** A value each kind takes from a document, or `null` where a page cannot declare one. */
const VALUE: Record<string, unknown> = {
  text: "x", email: "a@b.co", password: "x", textarea: "x", number: 1, slider: 1,
  checkbox: true, toggle: true, radio: "a", segmented: "a", select: "a", multiselect: ["a"],
  datepicker: "2026-01-02", timepicker: "10:30", colors: "#ff0000",
};

test("a class a state puts on is the same class in every renderer", async ({ page }) => {
  test.setTimeout(900_000);

  /** kind -> host -> the classes read, once the state was shown to have been reached. */
  const wearing: Record<string, Record<string, string>> = {};
  /** A renderer that never reached the state, so its classes answer a different question. */
  const unreached: string[] = [];
  let compared = 0;

  for (const host of HOSTS) {
    await page.goto(host.page);
    await page.waitForFunction((flag) => (window as never as Record<string, boolean>)[flag] === true, host.ready);

    for (const kind of MDY_WIDGET_KINDS as unknown as string[]) {
      const held = VALUE[kind];
      if (held === undefined) continue;
      const mountId = `state-${kind}`;

      await page.evaluate(({ door, id, k, value }) => (window as never as Api)[door].mountFields(id, [{
        name: "campo", kind: k, label: "Etichetta", initialValue: value,
        validators: { required: true },
        options: [{ value: "a", label: "A" }, { value: "b", label: "B" }],
      }] as never), { door: host.api, id: mountId, k: kind, value: held });
      await page.locator(`[data-form="${mountId}"]`).waitFor({ timeout: 5_000 }).catch(() => undefined);
      await page.waitForTimeout(140);

      // The first half of the state, proved rather than assumed: the document said the field holds a
      // value, and a renderer that did not take it is not the same field as one that did.
      const took = await page.evaluate(({ id }) => {
        const root = document.querySelector(`[data-form="${id}"]`);
        if (root === null) return false;
        for (const box of root.querySelectorAll<HTMLInputElement>("input, select, textarea")) {
          if (box.type === "checkbox" || box.type === "radio") { if (box.checked) return true; continue; }
          if (box.value !== "") return true;
        }
        // A kind that draws its value rather than holding it in a box says so in its own text.
        return (root.textContent ?? "").trim().length > "Etichetta".length;
      }, { id: mountId });
      if (!took) { unreached.push(`${kind} in ${host.name}: did not take the value the document declared`); continue; }

      // The second half: a field that was never made to speak has nothing to be wrong about.
      const spoke = await madeToSpeak(page, `[data-form="${mountId}"]`, host.api);
      if (!spoke) { unreached.push(`${kind} in ${host.name}: could not be made to say anything was wrong`); continue; }
      await page.waitForTimeout(160);

      const classes = await page.evaluate(({ id }) => [...new Set([...document.querySelectorAll(`[data-form="${id}"] *`)]
        .flatMap((element) => [...element.classList]))].sort(), { id: mountId });

      compared += 1;
      wearing[kind] ??= {};
      wearing[kind][host.name] = classes.filter((one) => one.startsWith("mdy-label--")).join(" ");
    }
  }

  // The premise: a sweep where no renderer reached the state compares nothing, and three empty lists
  // agree perfectly. What is asserted below only means something once this has.
  expect(compared, "no field reached both halves of the state, so nothing was compared").toBeGreaterThan(20);

  const split = Object.entries(wearing)
    .filter(([, byHost]) => HOSTS.every((host) => byHost[host.name] !== undefined))
    .filter(([, byHost]) => new Set(HOSTS.map((host) => byHost[host.name])).size > 1)
    .map(([kind, byHost]) => `${kind}: ${HOSTS.map((host) => `${host.name}=[${byHost[host.name]}]`).join(" ")}`)
    .sort();

  if (unreached.length > 0) console.log(`[state unreached] ${unreached.length}: ${unreached.slice(0, 8).join(" | ")}`);

  expect(
    split,
    `${split.length} kind(s) wear different caption classes in the same state:\n${split.join("\n")}\n\n`
    + "One stylesheet is written for all three. A class one renderer puts on and another does not is a "
    + "rule that applies to two thirds of an application, and the field that misses it looks plain "
    + "rather than broken.",
  ).toEqual([]);

  expect(
    unreached,
    `${unreached.length} field(s) never reached the state this compares:\n${unreached.join("\n")}\n\n`
    + "A value a document declared and a renderer did not take, or a rule that could not be made to "
    + "fail, is a defect of its own — and reading its classes would report it as a vocabulary "
    + "difference, which it is not.",
  ).toEqual([]);
});
