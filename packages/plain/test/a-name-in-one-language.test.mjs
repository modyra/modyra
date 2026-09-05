/**
 * A control's name is in one language, and it is the document's.
 *
 * A renderer that writes the field's caption and appends words of its own produces a name in two
 * languages, and the half it appended is in no dictionary — so no translation can ever reach it. It
 * is invisible to anybody working in English, which is why it survived: the fault is only audible to
 * the person it fails.
 *
 * The shell already names the element that stands for the field, from the field's own words. What
 * this guards is that no kind writes that name first: the shell fills a gap and does not overwrite,
 * so a renderer naming its own control silently wins and the shell's rule never runs.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { installDomGlobals } from "./support/dom-env.mjs";

installDomGlobals();

const { mountMdyForm } = await import("../dist/index.js");
const { readAccessibleName } = await import("@modyra/widgets/testing");

/** Kinds whose operable control is not the platform's own named input. */
const CAPTION = "Colore del marchio";

const nameOf = (kind, selector) => {
  const host = document.createElement("div");
  document.body.append(host);
  mountMdyForm(host, [{ name: "brand", kind, label: CAPTION }], { submitLabel: null });
  const element = host.querySelector(selector);
  assert.ok(element, `${kind}: no ${selector} to read a name from`);
  const reading = readAccessibleName(element, "bench", document);
  host.remove();
  return reading.value;
};

test("the colours hex box is named by the caption, with nothing appended", () => {
  const { name } = nameOf("colors", ".mdy-colors__hex-input");
  assert.equal(name, CAPTION);
});

test("no word of the name comes from outside the document's own", () => {
  const { name } = nameOf("colors", ".mdy-colors__hex-input");
  // The check that would have caught the original: the caption is the whole name, so anything the
  // renderer added shows up as a remainder. Asserting "does not contain 'hex'" would pass the day
  // somebody appends a different English word instead.
  assert.equal(name.replace(CAPTION, "").trim(), "");
});
