/**
 * Tabbing through a required field and leaving it empty says nothing.
 *
 * ADR 0167. Focus arriving and leaving is an act on attention, not on the value: Tab is how a person
 * reads a form, the way eyes scroll it. Somebody tabbing past twenty required fields to learn what a
 * form asks must not collect twenty announcements of "invalid" for fields they were about to fill
 * in — a sighted person scrolling the same form gets no red borders.
 *
 * The question is not "has focus been here" but "did the value change while they were there".
 *
 * Asked of every kind in the host, because the divergence this replaces was per-kind: the kinds that
 * stayed silent were silent by accident — nobody had bound a handler to their trigger — and the ones
 * that spoke were the ones whose control happened to hear its own blur.
 */
import { TestBed } from "@angular/core/testing";
import { CATALOG_KINDS, CatalogHost } from "./catalog-host.spec";
import { MDY_FIELD_SHELL_CLASSES } from "@modyra/widgets";

/** Whatever a Tab lands on: the box for the kinds that have one, the opener for the rest. */
function focusable(root: Element): HTMLElement | null {
  return root.querySelector<HTMLElement>("input, textarea, select")
    ?? root.querySelector<HTMLElement>("button");
}

const saysWrong = (root: Element): boolean => root.querySelectorAll('[aria-invalid="true"]').length > 0;

/**
 * The other channel, and the one a sighted person actually reads.
 *
 * `aria-invalid` and the message under the field answer one question — is this person being told —
 * and they were computed from two different rules: the attribute learned that a traversal is not an
 * answer while the text was painted from "which refusals exist". Sixteen of seventeen kinds said
 * `false` and printed "required" at the same time.
 */
const saysWrongInWords = (root: Element): boolean =>
  Array.from(root.querySelectorAll(
    `.${MDY_FIELD_SHELL_CLASSES.errors}, .${MDY_FIELD_SHELL_CLASSES.errorItem}, .${MDY_FIELD_SHELL_CLASSES.inlineError}`,
  ))
    .map((element) => (element.textContent ?? "").trim())
    .filter((text) => text !== "").length > 0;

describe("reading a form is not declining it", () => {
  for (const { kind, selector } of CATALOG_KINDS) {
    it(`${kind}: focus in, focus out, nothing typed — it says nothing`, () => {
      const fixture = TestBed.createComponent(CatalogHost);
      fixture.detectChanges();
      const root = fixture.nativeElement.querySelector(selector) as Element | null;
      expect(root).toBeTruthy();

      const control = focusable(root!);
      expect(control).toBeTruthy();
      control!.focus();
      control!.dispatchEvent(new FocusEvent("focus"));
      fixture.detectChanges();
      control!.dispatchEvent(new FocusEvent("blur"));
      control!.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
      fixture.detectChanges();

      expect(`${kind} after a bare traversal: ${saysWrong(root!)}`)
        .toBe(`${kind} after a bare traversal: false`);
      expect(`${kind} prints a refusal after a bare traversal: ${saysWrongInWords(root!)}`)
        .toBe(`${kind} prints a refusal after a bare traversal: false`);
    });
  }

  /**
   * The perimeter, and the channel this change must not break: a refused submit marks every field,
   * and every field speaks. Without this the silence above is satisfied by a form that never says
   * anything at all.
   */
  it("a refused submit makes every required field speak", () => {
    const fixture = TestBed.createComponent(CatalogHost);
    fixture.detectChanges();
    fixture.componentInstance.adapter.markAllTouched();
    fixture.detectChanges();
    const spoke = CATALOG_KINDS.filter(({ selector }) => {
      const root = fixture.nativeElement.querySelector(selector) as Element | null;
      return root !== null && saysWrong(root);
    });
    expect(`kinds speaking after a refused submit: ${spoke.length > 0}`)
      .toBe("kinds speaking after a refused submit: true");
    // In words too: an attribute nobody can see is not the field saying it.
    const printed = CATALOG_KINDS.filter(({ selector }) => {
      const root = fixture.nativeElement.querySelector(selector) as Element | null;
      return root !== null && saysWrongInWords(root);
    });
    expect(`kinds printing a refusal after a refused submit: ${printed.length > 0}`)
      .toBe("kinds printing a refusal after a refused submit: true");
  });
});
