/**
 * Which name a reader hears, and by which mechanism.
 *
 * Asking whether an element *has* a name is a different question from asking *which*, and only the
 * second is order-sensitive: an implementation that consults the mechanisms in any order answers
 * "yes, it has one" correctly, and answers "which" wrongly the moment an element carries two. The
 * kit's own boolean helper can afford a different order for that reason; this cannot.
 *
 * Written against a stand-in rather than a rendered widget: what is under test is the precedence,
 * and a real renderer supplies one mechanism at a time.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { readAccessibleName } from "../dist/testing/index.js";

const dom = new JSDOM("<!doctype html><html><body></body></html>");
const document_ = dom.window.document;

/** An input carrying whichever naming mechanisms a case needs, in a document that can resolve them. */
function drawn({ labelledby, label, forLabel, wrapping, content } = {}) {
  document_.body.replaceChildren();
  const input = document_.createElement("input");
  input.id = "the-control";
  if (label) input.setAttribute("aria-label", label);
  if (labelledby) {
    const named = document_.createElement("span");
    named.id = "names-it";
    named.textContent = labelledby;
    document_.body.append(named);
    input.setAttribute("aria-labelledby", "names-it");
  }
  if (content) input.textContent = content;
  if (forLabel) {
    const caption = document_.createElement("label");
    caption.setAttribute("for", "the-control");
    caption.textContent = forLabel;
    document_.body.append(caption);
  }
  if (wrapping) {
    const around = document_.createElement("label");
    around.textContent = wrapping;
    around.append(input);
    document_.body.append(around);
    return input;
  }
  document_.body.append(input);
  return input;
}

const nameOf = (element) => readAccessibleName(element, "text.control", document_);

test("a nameless element is a reading, not a failure to look", () => {
  const one = nameOf(drawn());
  assert.equal(one.read, true, "the element was there and was asked");
  assert.equal(one.value.name, "");
  assert.equal(one.value.mechanism, "none");
});

test("each mechanism on its own is reported as itself", () => {
  assert.deepEqual(nameOf(drawn({ labelledby: "From elsewhere" })).value,
    { name: "From elsewhere", mechanism: "aria-labelledby" });
  assert.deepEqual(nameOf(drawn({ label: "Written on it" })).value,
    { name: "Written on it", mechanism: "aria-label" });
  assert.deepEqual(nameOf(drawn({ forLabel: "Pointed at" })).value,
    { name: "Pointed at", mechanism: "native-label" });
  assert.deepEqual(nameOf(drawn({ wrapping: "Wrapped around" })).value,
    { name: "Wrapped around", mechanism: "native-label" });
});

test("labelledby beats a label written on the element", () => {
  // The case the whole order exists for. An element carrying both is announced by the first, and a
  // panel reporting the second would send a reader to change the wrong attribute.
  const one = nameOf(drawn({ labelledby: "What is heard", label: "What is not" }));
  assert.equal(one.value.name, "What is heard");
  assert.equal(one.value.mechanism, "aria-labelledby");
});

test("aria-label beats a native label, which beats the element's own text", () => {
  assert.equal(nameOf(drawn({ label: "Written on it", forLabel: "Pointed at" })).value.name, "Written on it");
  assert.equal(nameOf(drawn({ forLabel: "Pointed at", content: "Its own words" })).value.name, "Pointed at");
});

test("a labelledby that resolves to nothing falls through to what is heard instead", () => {
  // A dangling reference is not a name. The next mechanism is what a reader would actually get, and
  // reporting the broken reference as the name would describe a page nobody experiences.
  const input = drawn({ label: "Written on it" });
  input.setAttribute("aria-labelledby", "nothing-with-this-id");
  const one = nameOf(input);
  assert.equal(one.value.name, "Written on it");
  assert.equal(one.value.mechanism, "aria-label");
});

test("the reading says the name was computed here, not asked of the platform", () => {
  // No browser exposes its own name computation to a page. Saying so is what keeps a reader
  // checking rather than trusting.
  assert.equal(nameOf(drawn({ label: "Anything" })).method, "own-implementation");
});
