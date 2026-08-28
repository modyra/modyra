import { Component } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { field, mdyForm } from "../../core/typed-form";
import { MdyFormComponent } from "../../form/mdy-form.component";
import { MdyFileComponent } from "./file-renderer.component";

/**
 * The two outputs a host binds to in order to learn what happened to a choice of files.
 *
 * The form's value carries what was accepted. Nothing else carries what was *refused* — a file over
 * the size limit, a type the field does not take — and a host that shows its own message about it
 * has no other way to know. Refusing in silence leaves no evidence it happened.
 *
 * Asserted because the equivalent output on another kind died on one of its two paths during an
 * adoption and the whole suite stayed green: the value still moved, so everything that watched the
 * value was satisfied, and nothing watched the announcement.
 */
@Component({
  standalone: true,
  imports: [MdyFormComponent, MdyFileComponent],
  template: `
    <mdy-form [form]="form">
      <mdy-control-file
        [field]="form.f.docs"
        [maxFileSize]="10"
        [ariaLabel]="'Docs'"
        (fileSelected)="accepted.push($event)"
        (filesRejected)="refused.push($event)"
      />
    </mdy-form>
  `,
})
class HostComponent {
  readonly form = mdyForm({ docs: field<readonly File[]>([]) });
  readonly accepted: (readonly File[] | null)[] = [];
  readonly refused: ReadonlyArray<File>[] = [];
}

const fileOf = (name: string, bytes: number) =>
  new File([new Uint8Array(bytes)], name, { type: "text/plain" });

describe("choosing files", () => {
  const drop = (fixture: { nativeElement: HTMLElement }, files: File[]) => {
    const zone = fixture.nativeElement.querySelector("input[type=file]") as HTMLInputElement;
    Object.defineProperty(zone, "files", { value: files, configurable: true });
    zone.dispatchEvent(new Event("change", { bubbles: true }));
  };

  it("announces what it took, alongside putting it in the value", () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    drop(fixture, [fileOf("small.txt", 4)]);
    fixture.detectChanges();

    expect(fixture.componentInstance.form.value().docs.map((one) => one.name)).toEqual(["small.txt"]);
    expect(fixture.componentInstance.accepted.at(-1)?.map((one) => one.name)).toEqual(["small.txt"]);
  });

  it("announces what it turned away, which the value cannot say", () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    drop(fixture, [fileOf("huge.txt", 999)]);
    fixture.detectChanges();

    expect(fixture.componentInstance.form.value().docs).toEqual([]);
    expect(fixture.componentInstance.refused.at(-1)?.map((one) => one.name)).toEqual(["huge.txt"]);
    // And says nothing about what it took, because it took nothing. A host told "these are your
    // files" after a refusal shows the previous choice as though it had just been made — which on a
    // first pick is an empty list announced as a selection.
    expect(fixture.componentInstance.accepted).toEqual([]);
  });

  it("says the value is empty when it is cleared", () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    drop(fixture, [fileOf("small.txt", 4)]);
    fixture.detectChanges();

    const clear = Array.from(fixture.nativeElement.querySelectorAll("button"))
      .find((one) => /clear|remove|rimuovi/i.test((one as HTMLElement).getAttribute("aria-label") ?? "")) as HTMLElement | undefined;
    expect(clear).toBeDefined();
    clear?.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.form.value().docs).toEqual([]);
    expect(fixture.componentInstance.accepted.at(-1)).toBeNull();
  });
});
