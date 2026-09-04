/**
 * The Vue demo draws every kind the shared scenario declares, using the package's own components.
 *
 * This page is where the arc started: it hand-rolled a text field, copying `mdy-renderer--text`,
 * `mdy-label`, `mdy-input-wrapper`, `aria-invalid` and `aria-required` beside a package shipping
 * seventeen components that derive all of them from the contract. A demo doing the thing the library
 * exists to stop is the worst place for it to happen, and the one most likely to be copied.
 *
 * **Counted as fields, not as root classes.** `text`, `email` and `password` share one anatomy and
 * therefore one `mdy-renderer--*` class, so counting those classes reports fifteen for a page
 * showing seventeen — the same shape of error as counting component names, one layer down.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";

const { installDomGlobals } = await import("../../../packages/vue/test/support/dom-env.mjs");
installDomGlobals();

const { everyKind } = await import("../../../examples/shared/scenarios/every-kind.js");

const page = async () => {
  for (const [id, tag] of [["app", "div"], ["theme", "link"], ["devtools", "div"]]) {
    const node = document.createElement(tag);
    node.id = id;
    (tag === "link" ? document.head : document.body).append(node);
  }
  await import("../../../examples/vue/main.js");
  await new Promise((resolve) => setTimeout(resolve, 200));
  return document;
};

test("the showcase draws one control per kind the scenario declares", async () => {
  const dom = await page();
  const forms = [...dom.querySelectorAll("form.mdy-form")];
  const counts = forms.map((form) => form.querySelectorAll(":scope > [class*=mdy-renderer]").length);

  assert.ok(
    counts.includes(everyKind.fields().length),
    `no form on the page holds ${everyKind.fields().length} controls; the forms hold ${counts.join(", ")}`,
  );
});

test("the kinds that share an anatomy still ask for their own native input", () => {
  // The half a class count cannot see. `email` and `password` are drawn by the same component with
  // the same classes as `text`, and what separates them is the input the contract declares.
  const types = new Set([...document.querySelectorAll("input[type]")].map((input) => input.getAttribute("type")));

  for (const wanted of ["email", "password"]) {
    assert.ok(types.has(wanted), `no control on the page asks the platform for "${wanted}"`);
  }
});

test("the demo writes no control of its own", () => {
  // The assertion that keeps the arc closed. A page may hold `<input>` for its own chrome — a theme
  // picker is not a form control — so this reads the source rather than the DOM: what must not come
  // back is a *hand-written control*, and the tell is a demo spelling out contract classes.
  const source = readFileSync(new URL("../../../examples/vue/main.js", import.meta.url), "utf8");

  for (const spelled of ["mdy-renderer--", "mdy-input-wrapper", "mdy-control__errors", "aria-invalid"]) {
    assert.ok(
      !source.includes(`"${spelled}`) && !source.includes(`class="${spelled}`),
      `the demo spells out ${spelled}, which is the contract's answer and not a demo's to write`,
    );
  }
});
