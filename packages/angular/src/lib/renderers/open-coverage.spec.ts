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

    // Named rather than counted, and this is the second shape of this check.
    //
    // It was `rendered >= 40` against a total the contract supplies — so when the contract *grew*,
    // the denominator moved and the floor did not. Three parts were declared, this adapter drew one
    // of them, and 42 of 48 still cleared 40: a part entered the public contract, a renderer ignored
    // it, and the gate built to catch exactly that stayed green. It called itself a ratchet and
    // nothing ever raised it.
    //
    // Each exemption is now a decision with a reason, so a part that appears in the contract and
    // nowhere in this adapter fails here on the day it is declared.
    const EXPECTED_ABSENT: Readonly<Record<string, readonly string[]>> = {
      // A note that appears when a search matches nothing, over a list that has results.
      select: ["empty"],
      multiselect: ["empty"],
      // This adapter's calendars navigate months and years through the header rather than through
      // their own pickers; the parts exist for renderers that draw them.
      datepicker: ["monthPicker", "monthCell", "yearPicker", "yearCell"],
      daterange: ["monthPicker", "monthCell", "yearPicker", "yearCell"],
      // `dialog` is the timepicker's inner dialog, which the overlay panel is here. The period
      // toggle is drawn only on a 12-hour picker and this fixture is 24-hour; the dimmed stretches
      // only when `showUnavailable` asks for them, and it is off by default.
      timepicker: ["dialog", "period", "periodOption", "dialUnavailable", "dialUnavailableArc"],
    };

    const unexpected = report
      .map((line) => {
        const [kind, absent] = line.split(": absent while open — ");
        const parts = (absent ?? "").trim() === "none" ? [] : (absent ?? "").trim().split(", ");
        const allowed = EXPECTED_ABSENT[kind!] ?? [];
        const surprises = parts.filter((part) => !allowed.includes(part));
        const returned = allowed.filter((part) => !parts.includes(part));
        return [
          ...surprises.map((part) => `${kind}: ${part} is in the contract and this adapter draws it nowhere`),
          ...returned.map((part) => `${kind}: ${part} is drawn now — remove it from EXPECTED_ABSENT`),
        ];
      })
      .flat();

    expect(`${unexpected.length === 0 ? "ok" : "dropped"} ${rendered}/${total} — ${unexpected.join(" | ") || report.join(" | ")}`)
      .toMatch(/^ok /);
  });
});
