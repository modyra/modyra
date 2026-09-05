import "@angular/compiler";
import { TestBed } from "@angular/core/testing";
import { MDY_POPUP_OPENERS, MDY_WIDGET_CONTRACTS, capabilityOf, partClasses, type MdyWidgetKind } from "@modyra/widgets";
import { CATALOG_KINDS, CatalogHost, partsOf } from "./catalog-host.spec";

/**
 * The element the contract calls this kind's opener — not a selector list written here.
 *
 * A list written at the call site names whichever element happened to open the panel when it was
 * written, and the opener is also where `aria-expanded` is published: point it at a sibling and the
 * state reads `null` for a widget that is plainly open.
 */
const openerOf = (root: Element, kind: MdyWidgetKind): HTMLElement | null => {
  const opener = MDY_POPUP_OPENERS[kind]?.opener;
  if (opener === undefined) return null;
  // The part name comes from the catalogue keyed by this same kind, so it is this kind's part; the
  // table's type is per-kind and cannot say so at a call site that iterates over kinds.
  const classes = partClasses(kind, opener as Parameters<typeof partClasses>[1]);
  return root.querySelector<HTMLElement>(classes.map((one) => `.${one}`).join(""));
};

describe("a drag that leaves the field", () => {
  const POPUP_KINDS = CATALOG_KINDS
    .filter(({ kind }) => MDY_WIDGET_CONTRACTS[kind].capabilities.overlay)
    .filter(({ kind }) => capabilityOf(kind, "dismissOnFocusOutside"))
    // A kind whose opener the catalogue does not name has no element to read the state from, and
    // an unreadable row would pass by reading `null` against `null`.
    .filter(({ kind }) => MDY_POPUP_OPENERS[kind] !== undefined);

  it("covers every kind that declares both halves", () => {
    expect(POPUP_KINDS.length).toBeGreaterThan(1);
  });

  for (const { kind, selector, name } of POPUP_KINDS) {
    it(`${kind}: stays open and marks the field visited`, () => {
      const fixture = TestBed.createComponent(CatalogHost);
      fixture.detectChanges();
      const root = fixture.nativeElement.querySelector(selector) as Element;
      openerOf(root, kind as MdyWidgetKind)!.click();
      fixture.detectChanges();

      const popup = partsOf(root, kind as MdyWidgetKind).popup as Element | null;
      expect({ kind, opened: popup !== null }).toEqual({ kind, opened: true });

      // Somewhere the person could drag to: outside the widget's branch, in the same document.
      const elsewhere = document.createElement("button");
      document.body.appendChild(elsewhere);

      // The gesture begins inside the panel and is still unresolved — no `pointerup` — which is the
      // state the pointer policy vetoes a focus dismissal from.
      const inside = (popup!.querySelector("*") ?? popup) as Element;
      inside.dispatchEvent(new Event("pointerdown", { bubbles: true }));
      elsewhere.dispatchEvent(new Event("focusin", { bubbles: true }));
      fixture.detectChanges();

      const field = fixture.componentInstance.adapter.getField(name);
      // Read from what the widget *says*, not from whether the panel's element is still in the
      // tree: a closed overlay can leave its node behind for a beat, and an assertion on presence
      // then passes for a widget that has already closed. `aria-expanded` is the answer the
      // contract publishes, and it is the one a screen reader gets.
      const stillOpen = openerOf(root, kind as MdyWidgetKind)?.getAttribute("aria-expanded");

      // Named in one object so a failure says which half went, for which kind: closing under the
      // person's own hand and forgetting the visit are different defects with the same green.
      expect({ kind, open: stillOpen, visited: field?.().touched() })
        .toEqual({ kind, open: "true", visited: true });

      elsewhere.remove();
      fixture.destroy();
    });
  }
});
