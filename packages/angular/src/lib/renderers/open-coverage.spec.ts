import "@angular/compiler";
import { TestBed } from "@angular/core/testing";
import { MDY_WIDGET_CONTRACTS, overlayOnlyParts, type MdyWidgetKind } from "@modyra/widgets";
import { CATALOG_KINDS, CatalogHost, partsOf } from "./catalog-host.spec";

/**
 * How much of the open widget the open-state suite actually looks at.
 *
 * A conformance run that resolves none of the popup's parts reports "conforms" about nothing. This
 * counts what an open widget really renders, so the sibling suite's green is a claim with a size.
 */
const OPENER = ".mdy-select__trigger, .mdy-datepicker__toggle, .mdy-timepicker__toggle,"
  + " .mdy-colors__toggle-area, .mdy-multiselect__search-btn";

describe("the open-state suite's reach", () => {
  it("resolves most of what only exists while open", () => {
    const report: string[] = [];
    let rendered = 0;
    let total = 0;

    for (const { kind, selector } of CATALOG_KINDS) {
      if (!MDY_WIDGET_CONTRACTS[kind].capabilities.overlay) continue;
      const fixture = TestBed.createComponent(CatalogHost);
      fixture.detectChanges();
      const root = fixture.nativeElement.querySelector(selector) as Element;
      (root.querySelector(OPENER) as HTMLElement).click();
      fixture.detectChanges();

      const parts = partsOf(root, kind as MdyWidgetKind);
      const popup = parts["popup"] as Element | null;
      const scopes = [root, ...(popup && !root.contains(popup) ? [popup] : [])];
      const definition = MDY_WIDGET_CONTRACTS[kind];
      const missing: string[] = [];

      for (const part of overlayOnlyParts(kind)) {
        total += 1;
        const classes = definition.parts[part as keyof typeof definition.parts]?.classes ?? [];
        if (!classes.length) { missing.push(`${part}(no class)`); continue; }
        const selectorFor = classes.map((c: string) => `.${c}`).join("");
        const hit = part === "popup"
          ? !!popup
          : scopes.some((scope) => scope.querySelector(selectorFor));
        if (hit) rendered += 1; else missing.push(part);
      }
      report.push(`${kind}: absent while open — ${missing.join(", ") || "none"}`);
    }

    // Pinned rather than logged: the number is the claim the sibling suite's green is worth, so a
    // renderer that quietly stops rendering half its popup fails here instead of passing there.
    // A ratchet, not a target. 40 of the 45 are rendered by an open widget today; the five that are
    // not are the two "no results" notes over populated lists, the two action bars this adapter does
    // not draw, and the timepicker's inner dialog. A renderer that quietly stops rendering part of
    // its popup fails here rather than passing the conformance run next door on a smaller subject.
    expect(`${rendered >= 40 ? "ok" : "dropped"} ${rendered}/${total} — ${report.join(" | ")}`)
      .toMatch(/^ok /);
  });
});
