/**
 * This renderer writes no class of its own.
 *
 * It used to write five, beside the contract's class, on four of its eleven field renderers. They
 * were the hooks for a plain-only stylesheet; the stylesheet was folded into the contract's own
 * vocabulary and its rules deleted, and the hooks outlived them — selected by nothing, styled by
 * nothing, and on some of the kinds rather than all of them.
 *
 * The check is the absence, held in the page rather than in the source. A grep proves the literal is
 * gone from the file it was written in; only mounting a form proves nothing puts it back through some
 * other path, and the class was placed by four separate renderers to begin with.
 *
 * The live region is the exception, and it is an id: one per renderer, spelled differently in each,
 * because two renderers sharing a region on one page means an announcement reaches whichever a screen
 * reader is watching.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { installDomGlobals } from "./support/dom-env.mjs";

installDomGlobals();
const { mountMdyForm } = await import("../dist/index.js");

/** Every kind whose renderer once carried a mark, and enough others to catch one coming back. */
const FIELDS = [
  { name: "colour", kind: "colors", label: "Colour" },
  { name: "day", kind: "datepicker", label: "Day" },
  { name: "span", kind: "daterange", label: "Span" },
  { name: "hour", kind: "timepicker", label: "Hour" },
  { name: "note", kind: "text", label: "Note" },
  { name: "pick", kind: "select", label: "Pick", options: [{ value: "a", label: "A" }] },
  { name: "many", kind: "multiselect", label: "Many", options: [{ value: "a", label: "A" }] },
  { name: "agree", kind: "checkbox", label: "Agree" },
];

function mount() {
  const host = document.createElement("div");
  document.body.append(host);
  return { host, form: mountMdyForm(host, FIELDS, { submitLabel: null }) };
}

/** Every class on the container and everything under it, including the container's own. */
function classesInPage(host) {
  const found = new Set(host.classList);
  for (const element of host.querySelectorAll("*")) for (const name of element.classList) found.add(name);
  return found;
}

test("no renderer-private class reaches the page", () => {
  const { host, form } = mount();
  const own = [...classesInPage(host)].filter((name) => name.startsWith("mdy-plain-"));
  assert.deepEqual(own, [],
    "this renderer wrote a class of its own. A class outside the catalogue is invisible to a theme "
    + "written against the contract, and it is what the other two renderers do not have");
  form.dispose();
  host.remove();
});

test("the kinds that used to be marked carry the contract's class and nothing else of ours", () => {
  const { host, form } = mount();
  for (const contractClass of ["mdy-colors", "mdy-datepicker", "mdy-timepicker"]) {
    const element = host.querySelector(`.${contractClass}`);
    assert.ok(element, `${contractClass} is missing — removing the private mark took the contract's class with it`);
    assert.deepEqual([...element.classList].filter((name) => name.startsWith("mdy-plain-")), [],
      `${contractClass} still carries a renderer-private class`);
  }
  form.dispose();
  host.remove();
});

test("the container is left as it was found", () => {
  const { host, form } = mount();
  assert.ok(host.classList.contains("mdy-dynamic-form"), "the mount point lost the class the contract gives it");
  form.dispose();
  assert.deepEqual([...host.classList], [],
    "a container handed back to the page still carries a class this renderer put there");
  host.remove();
});

test("everything spoken passes through a single live region", () => {
  // Found by the attribute the contract declares for it, not by this renderer's id: the id is the
  // renderer's own spelling of something the contract already names, and a check written against the
  // spelling would keep passing if every renderer kept its own region.
  const { host, form } = mount();
  const regions = document.querySelectorAll("[data-mdy-shared-region]");
  assert.ok(regions.length <= 1,
    `${regions.length} live regions on the page — two things said at once reach whichever a screen `
    + "reader happens to be watching, in an order nothing specifies");
  form.dispose();
  host.remove();
});
