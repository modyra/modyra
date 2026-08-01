/**
 * The state matrix, driven against the Angular renderers.
 *
 * Same judgement as every other adapter — `collectStateMatrix` from `@modyra/widgets/testing` — with only
 * the driving here. Until this existed a state defect in Angular was invisible: the matrix ran on
 * Plain alone, which is how `readonly` was fixed there, reported closed, and stayed broken here.
 *
 * It then ran on eight of seventeen kinds, which was the same blindness one level down: every
 * composite — select, multiselect, the three pickers, colors, file, radio, segmented — was driven
 * into no state by any Angular test. This drives all seventeen, over the catalogue fixture the DOM
 * contract suite uses, so the two cannot disagree about where a part lives.
 */
import "@angular/compiler";
import { signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import {
  collectStateMatrix,
  normalizeStateLedger,
  type MdyStateFixture,
} from "@modyra/widgets/testing";
import type { MdyWidgetKind } from "@modyra/widgets";
import { MDY_WIDGET_TRANSITIONS } from "@modyra/widgets";
import { explainValueMismatch } from "@modyra/core";

import { CATALOG_KINDS, CatalogHost, partsOf } from "./catalog-host.spec";

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
const ENTRY = new Map(CATALOG_KINDS.map((entry) => [entry.kind, entry]));

/** A value each kind will actually accept — a filled state reached with a rejected value is empty. */
function valueFor(kind: MdyWidgetKind): unknown {
  switch (kind) {
    case "number": case "slider": return 7;
    case "checkbox": case "toggle": return true;
    case "multiselect": return ["a"];
    case "radio": case "segmented": case "select": return "a";
    case "datepicker": return "2026-07-15";
    case "daterange": return { start: "2026-07-15", end: "2026-07-20" };
    case "timepicker": return "10:30";
    case "colors": return "#004cff";
    case "file": return [new File(["content"], "report.txt", { type: "text/plain" })];
    default: return "value";
  }
}

/**
 * The empty value each kind can hold.
 *
 * Not `""` for everything. Plain's driver did that, and a daterange handed a string where an object
 * belongs was rejected by `required` for being an empty string rather than for being an empty
 * range — so its `invalid` row was green because of the fixture. Do not reintroduce that here.
 */
function emptyFor(kind: MdyWidgetKind): unknown {
  switch (kind) {
    case "multiselect": return [];
    case "checkbox": case "toggle": return false;
    case "number": return null;
    // A slider is never empty: its thumb is somewhere, and that somewhere is its minimum.
    case "slider": return 0;
    case "file": return [];
    case "daterange": return { start: null, end: null };
    default: return "";
  }
}

function controlOf(root: Element): Element | null {
  return root.querySelector(
    ".mdy-input-wrapper input, .mdy-input-wrapper textarea, .mdy-input-wrapper select",
  ) ?? root.querySelector("input, textarea, select");
}

/** The element that opens each composite's overlay, by the part the catalogue names. */
const OPENER = ".mdy-select__trigger, .mdy-datepicker__toggle, .mdy-timepicker__toggle,"
  + " .mdy-colors__toggle-area, .mdy-multiselect__search-btn";

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
    const matrix = await collectStateMatrix({
      kinds: KINDS,
      mount(kind): MdyStateFixture {
        const fixture = TestBed.createComponent(CatalogHost);
        fixture.detectChanges();
        const entry = ENTRY.get(kind);
        if (!entry) throw new Error(`no host control declared for ${kind}`);
        const root = fixture.nativeElement.querySelector(entry.selector) as Element;
        const adapter = fixture.componentInstance.adapter;
        const field = adapter.getField(entry.name);

        return {
          root,
          parts: () => partsOf(root, kind),
          control: () => controlOf(root),
          // Angular renders on change detection, not on a task.
          settle: () => { fixture.detectChanges(); },
          dispose: () => fixture.destroy(),
          drive(state): boolean {
            switch (state) {
              case "pristine": return true;
              case "empty": field?.().value.set(emptyFor(kind)); return true;
              case "filled": field?.().value.set(valueFor(kind)); return true;
              case "touched": field?.().touched.set(true); return true;
              case "invalid":
                field?.().value.set(emptyFor(kind));
                field?.().touched.set(true);
                return true;
              case "focused": (controlOf(root) as HTMLElement | null)?.focus?.(); return true;
              case "selected": field?.().value.set(valueFor(kind)); return true;
              case "disabled": adapter.setDisabled(entry.name, signal(true)); return true;
              case "readonly": adapter.setReadonly(entry.name, signal(true)); return true;
              case "open": {
                const opener = root.querySelector(OPENER) as HTMLElement | null;
                if (!opener) return false;
                opener.click();
                fixture.detectChanges();
                return true;
              }
              case "loading": {
                // Async options are the renderer's concern, not the form's, so the state is driven
                // through the control that owns it.
                const control = fixture.debugElement.query(By.css(entry.selector))
                  ?.componentInstance as { loadingOverride?: { set(v: boolean): void } } | undefined;
                if (!control?.loadingOverride) return false;
                control.loadingOverride.set(true);
                fixture.detectChanges();
                return true;
              }
              default: return false;
            }
          },
        };
      },
    });

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

  it.each(closable.map((kind) => [kind]))("%s closes on Escape", (kind) => {
    const fixture = TestBed.createComponent(CatalogHost);
    fixture.detectChanges();
    const root = fixture.nativeElement.querySelector(ENTRY.get(kind)!.selector) as Element;

    const opener = root.querySelector(OPENER) as HTMLElement | null;
    expect(opener).toBeTruthy();
    opener!.click();
    fixture.detectChanges();

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
    fixture.detectChanges();

    expect(`${kind} closed: ${opener!.getAttribute("aria-expanded")}`).toBe(`${kind} closed: false`);
  });
});
