/**
 * What a typed colour has to be, asked once.
 *
 * A renderer had its own regular expression for this — `/^#[0-9a-fA-F]{3,8}$/` — and it disagreed
 * with the contract on five strings, in both directions. The lengths between the real ones were
 * accepted and stored as values:
 *
 * ```
 * #ffff  #fffff  #ffffffff  #12345      kept by the renderer, refused by the contract
 * fff    "  #fff  "                     refused by the renderer, accepted and normalised here
 * ```
 *
 * `#fffff` is not a colour any engine paints. Four and eight digits are, in CSS with alpha — and the
 * contract refuses those on purpose, which is a decision this records rather than re-argues.
 *
 * The point is not which set is right. It is that one field, drawn twice, answered a person's typing
 * two ways.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { colorValueTransition } from "../dist/index.js";

const typed = (value) => colorValueTransition({ type: "text", value });

test("the lengths a colour comes in are kept, and the ones between them are not", () => {
  for (const value of ["#fff", "#ffffff", "#FFFFFF"]) {
    assert.equal(typed(value).value, value, `${value} is a colour and was not kept`);
  }
  for (const value of ["#ffff", "#fffff", "#ffffffff", "#12345", "#ff"]) {
    assert.equal(typed(value).value, undefined,
      `${value} was accepted. It is a length no colour has, and stored it becomes a value that paints `
      + "as nothing — visibly the field holds something and nothing shows it");
  }
});

test("a colour is recognised without its hash, and through the spaces around it", () => {
  assert.equal(typed("fff").value, "#fff",
    "a value typed without its hash was refused. People type `fff`, and a field that refuses it "
    + "while another renderer of the same field accepts it is the same control answering two ways");
  assert.equal(typed("  #fff  ").value, "#fff", "spaces around a pasted value were not trimmed");
});

test("what is not a colour at all changes nothing", () => {
  for (const value of ["#GGG", "rebeccapurple", "12345"]) {
    assert.equal(typed(value).value, undefined, `${value} was taken as a colour`);
  }
});

test("typing never closes the panel, and choosing a preset does", () => {
  // The reason this needs a controller rather than a validator: the three doors do not agree on when
  // a value is a decision. `#0` is on its way to being a colour.
  assert.notEqual(typed("#fff").close, true, "typing closed the panel under the person typing");
  assert.equal(colorValueTransition({ type: "preset", value: "#fff" }).close, true,
    "choosing a preset left the panel open, so the question it was opened to ask stays on screen "
    + "after it has been answered");
});
