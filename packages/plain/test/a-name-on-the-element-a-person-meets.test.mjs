/**
 * The name a document declares lands on the control a person actually reaches.
 *
 * A field's shell names "the element that stands for the field", and which element that is depends
 * on what the kind hands it. A text box hands over the input itself, so the name lands right. A
 * number hands over the spinner's container — the input with a stepper either side — which is
 * neither operable nor role-bearing, and the last branch of the shell's fallback chain named **the
 * container**: a `<span>` with no role, not focusable, never announced. The document declared a name
 * and the control a person meets had none.
 *
 * It survived because no check in any tier asked a *number* for its declared name — the one battle
 * row that asks mounts a text field, and one kind stood for the class.
 *
 * Asserted on the resolved name of the element the caption points at, which is the element a person
 * lands on: asking "does some element carry the words" is what made this invisible, since the words
 * were on an element nothing could reach.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { installDomGlobals } from "./support/dom-env.mjs";

installDomGlobals();

const { mountMdyForm } = await import("../dist/index.js");
const { readAccessibleName } = await import("@modyra/widgets/testing");

/** Every kind whose control the platform can associate with a caption, so `for` points at it. */
const NATIVELY_LABELLED = ["text", "email", "password", "textarea", "number", "checkbox", "toggle", "select"];

const DECLARED = "spoken name";

const nameOfControl = (kind) => {
  const host = document.createElement("div");
  document.body.append(host);
  mountMdyForm(host, [{
    name: "f", kind, label: "L", ariaLabel: DECLARED,
    ...(kind === "select" ? { options: [{ value: "a", label: "A" }] } : {}),
  }], { submitLabel: null });
  const caption = host.querySelector("label");
  const target = caption?.getAttribute("for");
  // An attribute selector rather than an id one: `CSS.escape` is absent in some of the
  // environments this suite runs in, which the shell's own code says too.
  const control = target ? host.querySelector(`[id="${target}"]`) : null;
  assert.ok(control, `${kind}: the caption points at nothing`);
  const reading = readAccessibleName(control, "bench", document);
  host.remove();
  return reading.value;
};

test("every natively labelled control is announced by the name its document declared", () => {
  const heard = Object.fromEntries(NATIVELY_LABELLED.map((kind) => [kind, nameOfControl(kind).name]));
  assert.deepEqual(heard, Object.fromEntries(NATIVELY_LABELLED.map((kind) => [kind, DECLARED])));
});

test("a chip's steppers are named from the table, in the document's language", async () => {
  const named = (locale) => {
    const host = document.createElement("div");
    document.body.append(host);
    mountMdyForm(host, [{
      name: "t", kind: "multiselect", label: "T", mode: "multi",
      ...(locale === undefined ? {} : { locale }),
      options: [{ value: "a", label: "Alpha" }],
    }], { submitLabel: null });
    host.querySelector(".mdy-multiselect__trigger")?.click();
    return { host, read: () => [...document.querySelectorAll(".mdy-chip__btn")].map((b) => b.getAttribute("aria-label")) };
  };

  const english = named(undefined);
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.deepEqual(english.read(), ["One fewer Alpha", "One more Alpha"]);
  english.host.remove();
  for (const popup of document.querySelectorAll(".mdy-popup")) popup.remove();

  // The half that matters: written as literals the words were the wrong ones *and* unreachable by
  // any translation. Asserting only the English would pass with the literals restored.
  const italian = named("it");
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.deepEqual(italian.read(), ["Uno in meno Alpha", "Uno in più Alpha"]);
  italian.host.remove();
});
