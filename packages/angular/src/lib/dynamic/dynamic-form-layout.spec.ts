/**
 * Contract v2 layout, rendered by Angular.
 *
 * The assertions are deliberately the same ones the framework-free renderer's layout test makes:
 * the classes come from `@modyra/widgets`, the column count is published as a custom property, and
 * a field the layout does not name still renders. Two adapters, one expectation.
 */
import { Component, signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { MDY_LAYOUT_CLASSES, MDY_LAYOUT_COLUMN_COUNT_PROPERTY } from "@modyra/widgets";
import type { MdyDynamicField, MdyDynamicLayoutNode } from "@modyra/core/dynamic-config";
import { MdyDynamicFormComponent } from "./mdy-dynamic-form.component";

@Component({
  standalone: true,
  imports: [MdyDynamicFormComponent],
  template: `<mdy-dynamic-form [fields]="fields()" [layout]="layout()" />`,
})
class LayoutHost {
  fields = signal<MdyDynamicField[]>([
    { name: "first", kind: "text", label: "First" },
    { name: "last", kind: "text", label: "Last" },
    { name: "notes", kind: "textarea", label: "Notes" },
  ]);
  layout = signal<MdyDynamicLayoutNode[]>([
    {
      kind: "section",
      id: "identity",
      label: "Identity",
      children: [{ kind: "columns", id: "name-row", columns: [["first"], ["last"]] }],
    },
  ]);
}

describe("MdyDynamicFormComponent, declarative layout", () => {
  it("renders the contract's grid vocabulary", () => {
    const fixture = TestBed.createComponent(LayoutHost);
    fixture.detectChanges();
    const host: HTMLElement = fixture.nativeElement;

    const section = host.querySelector(`.${MDY_LAYOUT_CLASSES.section}`);
    expect(section).toBeTruthy();
    expect(section!.getAttribute("data-layout-id")).toBe("identity");
    expect(section!.querySelector(`.${MDY_LAYOUT_CLASSES.sectionLabel}`)!.textContent).toContain("Identity");

    const row = section!.querySelector<HTMLElement>(`.${MDY_LAYOUT_CLASSES.columns}`);
    expect(row).toBeTruthy();
    // The count is what the foundation divides the row by; a wrong one silently misdraws the grid.
    expect(row!.style.getPropertyValue(MDY_LAYOUT_COLUMN_COUNT_PROPERTY)).toBe("2");
    expect(row!.querySelectorAll(`.${MDY_LAYOUT_CLASSES.column}`).length).toBe(2);
  });

  it("places named fields in their column and still renders the rest", () => {
    const fixture = TestBed.createComponent(LayoutHost);
    fixture.detectChanges();
    const host: HTMLElement = fixture.nativeElement;

    const columns = Array.from(host.querySelectorAll(`.${MDY_LAYOUT_CLASSES.column}`));
    expect(columns.length).toBe(2);
    expect(columns[0]!.querySelector("mdy-control-text")).toBeTruthy();
    expect(columns[1]!.querySelector("mdy-control-text")).toBeTruthy();
    // `notes` is in no column: a partial layout arranges what it describes and drops nothing.
    expect(host.querySelector("mdy-control-textarea")).toBeTruthy();
  });

  it("renders the fields in order when no layout is declared", () => {
    const fixture = TestBed.createComponent(LayoutHost);
    fixture.componentInstance.layout.set([]);
    fixture.detectChanges();
    const host: HTMLElement = fixture.nativeElement;

    expect(host.querySelector(`.${MDY_LAYOUT_CLASSES.section}`)).toBeNull();
    expect(host.querySelectorAll("mdy-control-text").length).toBe(2);
    expect(host.querySelector("mdy-control-textarea")).toBeTruthy();
  });
});
