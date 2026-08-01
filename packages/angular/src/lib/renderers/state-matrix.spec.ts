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
import { explainValueMismatch } from "@modyra/core";

import {
  CATALOG_KINDS,
  emptyFor,
  mountStateFixture,
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
