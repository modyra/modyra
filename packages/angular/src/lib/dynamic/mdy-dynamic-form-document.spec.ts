import { Component, signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import type { MdyDynamicDiagnostic } from "@modyra/core";
import { MdyDynamicFormComponent } from "./mdy-dynamic-form.component";

/**
 * The component reads a document, rather than being handed one already parsed.
 *
 * It is named for the dynamic contract and took only the parsed half of it, so a host rendering one
 * server document here and on another adapter wrote the parse step twice — with the strict-mode
 * diagnostics and the refusal of a partial form as the part most easily forgotten.
 */
@Component({
  standalone: true,
  imports: [MdyDynamicFormComponent],
  template: `<mdy-dynamic-form
    [document]="document()"
    [parseMode]="mode()"
    (diagnostics)="reported = $event" />`,
})
class DocumentHost {
  readonly document = signal<unknown>(null);
  readonly mode = signal<"strict" | "lenient">("strict");
  reported: ReadonlyArray<MdyDynamicDiagnostic> = [];
}

const WELL_FORMED = {
  version: 2,
  fields: [
    { name: "email", kind: "text", label: "Email" },
    { name: "vat", kind: "text", label: "VAT" },
  ],
  rules: [{ effect: "visible", target: "vat", when: { field: "email", operator: "isNotEmpty" } }],
};

function host(): {
  fixture: ReturnType<typeof TestBed.createComponent<DocumentHost>>;
  component: MdyDynamicFormComponent;
} {
  const fixture = TestBed.createComponent(DocumentHost);
  fixture.detectChanges();
  const component = fixture.debugElement.children[0]!
    .componentInstance as MdyDynamicFormComponent;
  return { fixture, component };
}

describe("MdyDynamicFormComponent [document]", () => {
  it("renders the fields a document declares", () => {
    const { fixture } = host();
    fixture.componentInstance.document.set(WELL_FORMED);
    fixture.detectChanges();

    const labels = [...fixture.nativeElement.querySelectorAll("label")]
      .map((each: HTMLElement) => each.textContent?.trim());
    expect(labels.join(" ")).toContain("Email");
  });

  it("emits what reading the document found", () => {
    const { fixture } = host();
    fixture.componentInstance.document.set(WELL_FORMED);
    fixture.detectChanges();

    expect(fixture.componentInstance.reported).toEqual([]);
  });

  it("renders nothing from a document strict mode refuses, and says why", () => {
    const { fixture } = host();
    // A rule naming a field the document does not declare: parsed, reported, and in strict mode a
    // reason to render none of it — a partial form is the shape a host cannot tell from a whole one.
    fixture.componentInstance.document.set({
      version: 2,
      fields: [{ name: "email", kind: "text", label: "Email" }],
      rules: [{ effect: "visible", target: "nobody", when: { field: "email", operator: "isNotEmpty" } }],
    });
    fixture.detectChanges();

    expect(fixture.componentInstance.reported.length).toBeGreaterThan(0);
    expect(fixture.nativeElement.querySelectorAll("label").length).toBe(0);
  });

  it("renders what parsed when the host asks for lenient", () => {
    const { fixture } = host();
    fixture.componentInstance.mode.set("lenient");
    fixture.componentInstance.document.set({
      version: 2,
      fields: [{ name: "email", kind: "text", label: "Email" }],
      rules: [{ effect: "visible", target: "nobody", when: { field: "email", operator: "isNotEmpty" } }],
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll("label").length).toBeGreaterThan(0);
  });
});
