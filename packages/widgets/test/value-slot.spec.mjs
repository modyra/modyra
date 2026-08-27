/**
 * Whether a kind is drawn the way its slot says it should be.
 *
 * Two checks in this repository asked *«is it in the row system?»* and *«is it the same height as
 * the others?»*, disagreed across three renderers, and neither has a right answer in the abstract.
 * Equal height is not a rule — it is a **consequence**. The rules are alignment for everyone and a
 * box for containers, and which kinds are containers is a question the contract answers once.
 *
 * So this asks the one question that has a single answer everywhere: **does this kind carry the box
 * its category prescribes?** A renderer decides nothing; it reads `valueSlot` and obeys.
 *
 * The category is decided by how a value is **read**, never by how it is entered. Every hesitation
 * about the table has turned out to be somebody looking at entry — a swatch is pressed, files arrive
 * from another window, chips are removed one at a time, a segmented row has words in it.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { MDY_WIDGET_CONTRACTS, MDY_WIDGET_KINDS } from "../dist/index.js";

const SHEET = readFileSync(
  resolve(dirname(new URL(import.meta.url).pathname), "../../styles/src/modyra.css"), "utf8");

/**
 * Whether the foundation draws this class as a surface a value sits inside.
 *
 * Asked of the stylesheet rather than of a list of class names. A first version of this check looked
 * for `mdy-input-wrapper` and reported the file field — whose box is `mdy-file-container`, with an
 * edge, a ground and a radius — as a container with no box: it was measuring *the name of the box*
 * and calling a kind wrong for spelling it its own way. And a version that asked only "does
 * something hold the control" passed a slider declared a container, because a track holds one too.
 *
 * A surface is what a surface does: it has a ground and an edge. That is what the eye reads as
 * "there is a value in here", and it is what a track, a label and a bare wrapper do not have.
 */
function drawnAsASurface(className) {
  const rule = new RegExp(`\\.${className.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}\\s*\\{([^}]*)\\}`, "g");
  for (const match of SHEET.matchAll(rule)) {
    const body = match[1];
    const hasGround = /background(-color)?\s*:/.test(body);
    const hasEdge = /border(-radius|-width|-color)?\s*:/.test(body);
    if (hasGround && hasEdge) return true;
  }
  return false;
}

/**
 * The part a kind draws its value inside, derived rather than named.
 *
 * A first version of this asked for the class `mdy-input-wrapper` and reported the file field as a
 * container with no box. It has one — `mdy-file-container`, with an edge, a ground and a radius —
 * under a name of its own, because a drop zone is a box you can also drop onto. Asking for a
 * particular class measured *the name of the box* and called a kind wrong for spelling it its own
 * way.
 *
 * So the question is structural: **is the control inside a surface?** — walking up, because a kind
 * may nest its own box inside the shared one. The multiselect holds its trigger in a strip that
 * holds the chips, and that strip sits in the wrapper: the surface is the grandparent, and a check
 * reading only the immediate parent called the field boxless.
 */
const surfaceAround = (kind, isSurface) => {
  const definition = MDY_WIDGET_CONTRACTS[kind];
  const slot = definition.structure.nodes.find((node) =>
    node.part === "control" || node.part === "trigger" || node.part === "startControl");
  const parentOf = (part) => definition.structure.nodes.find((node) => node.part === part)?.parent ?? null;
  for (let part = slot?.parent ?? null; part !== null; part = parentOf(part)) {
    const classes = definition.parts[part]?.classes ?? [];
    if (classes.some(isSurface)) return part;
  }
  return null;
};

test("every kind declares how its value is read", () => {
  for (const kind of MDY_WIDGET_KINDS) {
    const slot = MDY_WIDGET_CONTRACTS[kind].valueSlot;
    assert.ok(slot === "container" || slot === "shape",
      `${kind} declares no value slot; it must say whether its value is read inside a surface `
      + "(container) or is the shape itself (shape)");
  }
});

test("a container carries the box, and a shape does not", () => {
  // Both directions, because one alone is satisfied by a contract that says the same thing about
  // every kind: all containers with no boxes passes "no shape has a box" perfectly.
  const containers = MDY_WIDGET_KINDS.filter((k) => MDY_WIDGET_CONTRACTS[k].valueSlot === "container");
  const shapes = MDY_WIDGET_KINDS.filter((k) => MDY_WIDGET_CONTRACTS[k].valueSlot === "shape");
  assert.ok(containers.length > 1 && shapes.length > 1,
    `the table puts every kind on one side — ${containers.length} container(s), ${shapes.length} shape(s) `
    + "— so neither assertion below is measuring anything");

  const unboxed = containers.filter((kind) => surfaceAround(kind, drawnAsASurface) === null);
  assert.deepEqual(unboxed, [],
    "a container is read by looking inside a surface, so the part holding its control is drawn as "
    + "one — a ground and an edge. Without them the value reads as ordinary text and stops looking "
    + "like a value of the form. Asked of the stylesheet, so a kind may name its own box");
  // The other direction is not the mirror image, and saying so is the point: a shape may still have
  // something holding its control — a checkbox's clickable label wraps its input — and what it must
  // not have is the *treatment*. A box drawn around a switch is an empty frame the eye discounts.
  const shapesInABox = shapes.filter((kind) => surfaceAround(kind, drawnAsASurface) !== null);
  assert.deepEqual(shapesInABox, [],
    "a shape *is* its value — a position, an on or an off — so there is nothing to look inside. "
    + "Carrying the shared box class gives it the height, ground and edge of a container");
});

test("the parts that hold a value inside a container are inside one box, not several", () => {
  // A time is two boxes for hours and minutes, a range is two ends: the slot is the *set*, so the
  // box is one and the parts sit within it. Asserted through containment, which is what a renderer
  // can get wrong without the classes looking different.
  for (const kind of ["daterange", "timepicker"]) {
    const definition = MDY_WIDGET_CONTRACTS[kind];
    const boxes = definition.structure.nodes.filter((node) =>
      (definition.parts[node.part]?.classes ?? []).includes("mdy-input-wrapper"));
    assert.equal(boxes.length, 1, `${kind} draws ${boxes.length} boxes for one value`);
  }
});
