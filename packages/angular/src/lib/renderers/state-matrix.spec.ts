/**
 * The state matrix, driven against the Angular renderers.
 *
 * Same judgement as every other adapter — `collectStateMatrix` from `@modyra/widgets/testing` — with
 * the driving in `catalog-host.spec.ts`, where the equivalence suite reaches for it too. Until this
 * existed a state defect in Angular was invisible: the matrix ran on Plain alone, which is how
 * `readonly` was fixed there, reported closed, and stayed broken here.
 *
 * It then ran on eight of seventeen kinds, which was the same blindness one level down: every
 * composite — select, multiselect, the three pickers, colors, file, radio, segmented — was driven
 * into no state by any Angular test. This drives all seventeen, over the catalogue fixture the DOM
 * contract suite uses, so the two cannot disagree about where a part lives.
 */
import "@angular/compiler";
import { collectStateMatrix, normalizeStateLedger } from "@modyra/widgets/testing";
import type { MdyWidgetKind } from "@modyra/widgets";
import { MDY_WIDGET_TRANSITIONS } from "@modyra/widgets";
import { explainValueMismatch } from "@modyra/core";

import {
  CATALOG_KINDS,
  emptyFor,
  mountStateFixture,
  OPENER,
  partsOf,
  valueFor,
} from "./catalog-host.spec";

const KINDS: readonly MdyWidgetKind[] = CATALOG_KINDS.map(({ kind }) => kind);

/**
 * The values this fixture drives with are the values the contract says the kind holds.
 *
 * A driver that hands the wrong shape produces a green row about a state the widget was never in.
 */
describe("the state-matrix fixture", () => {
  it("drives each kind with a value of its declared shape", () => {
    for (const kind of KINDS) {
      expect(`${kind} empty: ${explainValueMismatch(kind, emptyFor(kind))}`).toBe(`${kind} empty: null`);
      expect(`${kind} filled: ${explainValueMismatch(kind, valueFor(kind))}`).toBe(`${kind} filled: null`);
    }
  });
});

/**
 * Angular's divergences from the state contract, asserted in both directions: a new divergence fails
 * here, and so does an entry left behind after its fix.
 *
 * `loading` stays undrivable for `select` and `multiselect`: nothing in the public API puts a field
 * into that state, and the matrix reports it rather than counting it as a pass.
 */
const KNOWN_DIVERGENCES: Record<string, string[]> = {};

describe("Angular renderers, against the widget state contract", () => {
  it("every declared state of every kind is asserted, and the divergences are the recorded ones", async () => {
    const matrix = await collectStateMatrix({ kinds: KINDS, mount: mountStateFixture });

    // eslint-disable-next-line no-console -- the matrix is the deliverable; a matrix nobody can read
    // the shape of will silently lose rows.
    console.log(matrix.report("angular, every kind"));

    expect(matrix.asserted + matrix.undrivable.length).toBe(matrix.expected);
    expect(matrix.observed).toEqual(normalizeStateLedger(KNOWN_DIVERGENCES));
    expect(matrix.unsupportedAria).toEqual([]);
  });
});

/**
 * Escape closes an open overlay — the transition the contract declares, replayed against the DOM.
 *
 * The matrix proves the widget looks right in a state it was put into; this proves it *gets* there.
 * A renderer whose Escape handler is bound where focus never lands passes every other check here.
 */
describe("the declared transitions", () => {
  const closable = KINDS.filter((kind) =>
    MDY_WIDGET_TRANSITIONS[kind].some(
      (t) => t.from === "open" && t.trigger.type === "key" && t.trigger.key === "Escape",
    ),
  );

  it("declares Escape on every overlay kind", () => {
    expect(closable.length).toBeGreaterThan(0);
  });

  it.each(closable.map((kind) => [kind]))("%s closes on Escape", async (kind) => {
    const fixture = mountStateFixture(kind);
    const root = fixture.root;

    const opener = root.querySelector(OPENER) as HTMLElement | null;
    expect(opener).toBeTruthy();
    expect(fixture.drive("open")).toBe(true);
    await fixture.settle();

    // `aria-expanded` on the opener is the contract's own statement of open-ness, and the one
    // signal every adapter carries — a closed CDK panel is still resolvable, so its presence says
    // nothing.
    expect(`${kind} opened: ${opener!.getAttribute("aria-expanded")}`).toBe(`${kind} opened: true`);
    const popup = partsOf(root, kind).popup as Element | null;

    // Where the user actually is: an overlay that takes focus handles Escape inside itself, one
    // that leaves focus on the opener handles it there.
    const active = document.activeElement;
    const target = active && (root.contains(active) || popup!.contains(active))
      ? (active as HTMLElement)
      : opener!;
    target.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await fixture.settle();

    expect(`${kind} closed: ${opener!.getAttribute("aria-expanded")}`).toBe(`${kind} closed: false`);
    fixture.dispose();
  });
});
