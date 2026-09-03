import { Component } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { MdyDynamicFormComponent } from "../dynamic/mdy-dynamic-form.component";

/**
 * The name every control announces, on a document that wrote no caption.
 *
 * `aria-labelledby` wins the name computation, and it wins even when it points at an element that is
 * not on the page or carries no words: the reference is not tried and abandoned, it produces an
 * empty name, and the `aria-label` beside it is never consulted. So a control whose caption is drawn
 * but never identified is one attribute away from announcing nothing — and the attribute that is
 * keeping it safe today is a conditional in a template, not the contract.
 *
 * Read as a reader would: the resolved name, never the attribute that was written. An assertion on
 * the attribute would pass on exactly the state this exists to catch.
 */
const option = { value: "x", label: "X" };

/** Every kind the catalogue declares, with words for a reader and no caption on the page. */
const FIELDS = [
  { name: "a", kind: "text", ariaLabel: "A" },
  { name: "b", kind: "email", ariaLabel: "B" },
  { name: "c", kind: "password", ariaLabel: "C" },
  { name: "d", kind: "textarea", ariaLabel: "D" },
  { name: "e", kind: "number", ariaLabel: "E" },
  { name: "f", kind: "slider", ariaLabel: "F" },
  { name: "g", kind: "checkbox", ariaLabel: "G" },
  { name: "h", kind: "toggle", ariaLabel: "H" },
  { name: "i", kind: "radio", ariaLabel: "I", options: [option] },
  { name: "j", kind: "segmented", ariaLabel: "J", options: [option] },
  { name: "k", kind: "select", ariaLabel: "K", options: [option] },
  { name: "k2", kind: "select", ariaLabel: "K2", searchable: true, options: [option] },
  { name: "l", kind: "multiselect", ariaLabel: "L", options: [option] },
  { name: "m", kind: "datepicker", ariaLabel: "M" },
  { name: "n", kind: "timepicker", ariaLabel: "N" },
  { name: "o", kind: "daterange", ariaLabel: "O" },
  { name: "p", kind: "file", ariaLabel: "P" },
  { name: "q", kind: "colors", ariaLabel: "Q" },
];

@Component({
  standalone: true,
  imports: [MdyDynamicFormComponent],
  template: `<mdy-dynamic-form [fields]="fields" />`,
})
class UncaptionedHost {
  readonly fields = FIELDS;
}

/**
 * What a reader announces.
 *
 * A reference names an element by **that element's own name**, not by its text: a listbox pointed at
 * a trigger that carries `aria-label` is named by those words even though the trigger has no words
 * inside it. Reading text alone reports such a control as nameless, which is a defect the page does
 * not have — and a bench that invents one costs the same as a bench that misses one.
 */
function nameOf(element: Element): string {
  const spoken = element.getAttribute("aria-label");
  if (spoken !== null && spoken.trim() !== "") return spoken.trim();
  return (element.textContent ?? "").trim();
}

function announced(element: Element): string {
  const points = element.getAttribute("aria-labelledby");
  if (points !== null && points.trim() !== "") {
    return points
      .split(/\s+/)
      .map((id) => {
        const target = element.ownerDocument.getElementById(id);
        return target === null ? "" : nameOf(target);
      })
      .join(" ")
      .trim();
  }
  return (element.getAttribute("aria-label") ?? "").trim();
}

describe("a field with no caption", () => {
  it("names every control it draws, and points at nothing that is not there", () => {
    const fixture = TestBed.createComponent(UncaptionedHost);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;

    // The bench's own precondition: a host that drew no controls would satisfy every claim below by
    // having nothing to check.
    const named = Array.from(root.querySelectorAll("[aria-label], [aria-labelledby]"));
    expect(named.length).toBeGreaterThanOrEqual(FIELDS.length);

    const nameless: string[] = [];
    const dangling: string[] = [];
    for (const element of named) {
      const points = element.getAttribute("aria-labelledby");
      if (points !== null && points.trim() !== "") {
        for (const id of points.trim().split(/\s+/)) {
          const target = element.ownerDocument.getElementById(id);
          if (target === null) dangling.push(`${element.tagName.toLowerCase()} -> ${id}`);
          else if (nameOf(target) === "") dangling.push(`${element.tagName.toLowerCase()} -> ${id} (no name)`);
        }
      }
      if (announced(element) === "") nameless.push(`${element.tagName.toLowerCase()}.${element.className}`);
    }

    expect({ dangling, nameless }).toEqual({ dangling: [], nameless: [] });
  });

  it("identifies the caption element it draws, so the contract's reference can resolve", () => {
    // The element every reference resolves to. It is drawn whenever the field has words at all, and
    // taken out of sight when those words are the field's own key rather than a person's — a name is
    // owed to a screen reader, a heading is not.
    const fixture = TestBed.createComponent(UncaptionedHost);
    fixture.detectChanges();

    const captions = Array.from(document.querySelectorAll("mdy-control-label label"));
    const identified = Array.from(document.querySelectorAll("[id$='__label']")).map((element) => element.id);

    // Not "the id is missing" — the element was. With no words to show it was not rendered at all, so
    // a projection naming it pointed at nothing, and a conditional in each template stood in for the
    // absence where nobody would look for it.
    // Every caption that is drawn carries an id, which is what a reference needs to land on. Three
    // kinds draw none — the control names itself where the caption would sit inside it — and that is
    // a decision each of those kinds owns rather than something this batch settles for them.
    expect(captions.length).toBeGreaterThanOrEqual(FIELDS.length - 3);
    expect(captions.filter((caption) => caption.id === "")).toEqual([]);
    expect(identified.length).toBe(captions.length);
  });
});
