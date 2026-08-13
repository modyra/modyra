import { Component, signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { field, group, mdyForm, record } from "../core/typed-form";
import { MdyFormComponent } from "../form/mdy-form.component";
import { MdyTextComponent } from "../renderers/text/text-renderer.component";

/**
 * A component's lifecycle is not an edit.
 *
 * Cells come and go as rows enter and leave edit mode, and a whole section can be destroyed while a
 * row is being typed into. What the form holds does not follow any of it — the row was declared, and
 * only `remove` ends it.
 */
@Component({
  standalone: true,
  imports: [MdyFormComponent, MdyTextComponent],
  template: `
    <mdy-form [form]="form">
      @if (mounted()) {
        <mdy-control-text [field]="form.f.rows.row('a').name" [ariaLabel]="'Name'" />
      }
    </mdy-form>
  `,
})
class HostComponent {
  readonly form = mdyForm({ rows: record(group({ name: field("") })) });
  readonly mounted = signal(true);

  constructor() {
    this.form.f.rows.upsert("a", { name: "typed" });
  }
}

/**
 * A cell whose row has not been declared yet.
 *
 * The order is the caller's to choose: a table may render a column before whatever owns the
 * collection has declared its keys. The control claims a path the record has not opened, and the
 * claim is replayed when the row arrives — which requires the binding to re-ask, since whether a
 * path is open is answered from the collection's set rather than from a signal.
 */
@Component({
  standalone: true,
  imports: [MdyFormComponent, MdyTextComponent],
  template: `
    <mdy-form [form]="form">
      <mdy-control-text [field]="form.f.rows.cell('late', 'name')" [ariaLabel]="'Name'" />
    </mdy-form>
  `,
})
class MountedBeforeDeclaredComponent {
  readonly form = mdyForm({ rows: record(group({ name: field("") })) });
}

@Component({
  standalone: true,
  imports: [MdyFormComponent, MdyTextComponent],
  template: `
    <mdy-form [form]="form">
      <mdy-control-text [field]="form.f.orders.row('o1').lines.row('l1').sku" [ariaLabel]="'SKU'" />
    </mdy-form>
  `,
})
class NestedCellComponent {
  readonly form = mdyForm({
    orders: record(group({
      customer: field(""),
      lines: record(group({ sku: field(""), qty: field(1) })),
    })),
  });
  constructor() {
    this.form.f.orders.upsert("o1", { customer: "Ada", lines: { l1: { sku: "SKU-1", qty: 2 } } });
  }
}

describe("a record across an Angular component's lifecycle", () => {
  it("keeps the row when the cell is unmounted", () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const form = fixture.componentInstance.form;

    fixture.componentInstance.mounted.set(false);
    fixture.detectChanges();

    expect(form.f.rows.has("a")).toBe(true);
    expect(form.value().rows["a"]?.name).toBe("typed");
  });

  it("binds the same row again when the cell comes back", () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const form = fixture.componentInstance.form;

    fixture.componentInstance.mounted.set(false);
    fixture.detectChanges();
    form.f.rows.cell("a", "name").set("changed while away");
    fixture.componentInstance.mounted.set(true);
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector("input") as HTMLInputElement;
    expect(input.value).toBe("changed while away");
  });

  it("tears down with the component, taking its fields with it", () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const form = fixture.componentInstance.form;
    expect(form.fieldNames()).toContain("rows.a.name");

    expect(() => fixture.destroy()).not.toThrow();

    // Reading a destroyed form's value is out of contract — for a record as for an array — so what
    // is asserted is the teardown itself: nothing of the collection is left registered.
    expect(form.fieldNames().some((name) => name.startsWith("rows."))).toBe(false);
  });

  it("binds a cell mounted before its row was declared, once the row arrives", () => {
    const fixture = TestBed.createComponent(MountedBeforeDeclaredComponent);
    fixture.detectChanges();
    const form = fixture.componentInstance.form;
    const input = fixture.nativeElement.querySelector("input") as HTMLInputElement;

    expect(input.value).toBe("");
    expect(form.value().rows).toEqual({});

    form.f.rows.upsert("late", { name: "arrived" });
    fixture.detectChanges();

    expect(input.value).toBe("arrived");
  });

  it("binds a cell that lives inside a row's own record, and the subtree dies with the row", () => {
    const fixture = TestBed.createComponent(NestedCellComponent);
    fixture.detectChanges();
    const form = fixture.componentInstance.form;
    const input = fixture.nativeElement.querySelector("input") as HTMLInputElement;

    expect(input.value).toBe("SKU-1");

    input.value = "SKU-typed";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    fixture.detectChanges();
    expect(form.value().orders["o1"]?.lines["l1"]?.sku).toBe("SKU-typed");

    // Removing the order takes the whole subtree out of the value, mounted control or not.
    form.f.orders.remove("o1");
    fixture.detectChanges();
    expect(form.value().orders).toEqual({});
  });
});
