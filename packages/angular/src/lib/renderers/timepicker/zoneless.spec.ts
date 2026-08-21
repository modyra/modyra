/**
 * What a binding shows when nothing else redraws it.
 *
 * `jest-preset-angular` installs Zone.js, and Zone redraws on every event — so a template binding
 * that never established its dependency is invisible to all 373 specs in this package and to every
 * demo. A consumer running zoneless was the first thing in the project's life able to see one.
 *
 * The timepicker's open popup is the surface where that matters most: it is the only display in the
 * library that depends on state which never touches the form handle until `confirm`. Every other
 * widget's visible state moves the handle, and a renderer watches the handle for a dozen other
 * reasons — so a missing subscription is masked by something else redrawing.
 *
 * This fixture asserts what a person **sees**, not what the controller emitted and not what the draft
 * holds. Those pass while the header is frozen; that is the whole point.
 */
import { Component, Injector, provideZonelessChangeDetection, signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { MdyDeclarativeAdapter } from "../../core/declarative-form-adapter";
import { field, mdyForm } from "../../core/typed-form";
import { MdyFormComponent } from "../../form/mdy-form.component";
import { MdyTimepickerComponent } from "./timepicker-renderer.component";

@Component({
  standalone: true,
  imports: [MdyFormComponent, MdyTimepickerComponent],
  template: `
    <mdy-form [adapter]="adapter">
      <mdy-control-timepicker name="alarm" label="Alarm" format="24h" />
    </mdy-form>
  `,
})
class ZonelessHost {
  adapter = new MdyDeclarativeAdapter(signal({ alarm: "09:30" }), undefined, TestBed.inject(Injector));
}

/** The documented consumer shape: a typed form, and the handle bound directly. */
@Component({
  standalone: true,
  imports: [MdyFormComponent, MdyTimepickerComponent],
  template: `
    <mdy-form [form]="form">
      <mdy-control-timepicker [field]="form.f.alarm" label="Alarm" format="24h" />
    </mdy-form>
  `,
})
class BoundHandleHost {
  readonly form = mdyForm({ alarm: field<string | null>("09:30") }, { injector: TestBed.inject(Injector) });
}

/**
 * Opens the picker and turns the hand one step with the keyboard, reading the face before and after.
 *
 * The face is the display; `aria-valuenow` is what it says. Neither is the draft the controller
 * holds, which is correct whether or not anything re-renders.
 */
async function turnTheHand(host: HTMLElement, settle: () => Promise<unknown>) {
  host.querySelector<HTMLElement>(".mdy-timepicker__toggle")!.click();
  await settle();

  const face = host.querySelector<HTMLElement>(".mdy-timepicker-dial__face")!;
  expect(face).toBeTruthy();
  const before = face.getAttribute("aria-valuenow");

  face.focus();
  face.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }));
  await settle();
  return { before, after: face.getAttribute("aria-valuenow") };
}

describe("Angular without Zone.js", () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
  });

  it("the dial's hand follows the arrows on a named field", async () => {
    const fixture = TestBed.createComponent(ZonelessHost);
    await fixture.whenStable();
    const read = await turnTheHand(fixture.nativeElement, () => fixture.whenStable());
    expect(read.after).not.toBe(read.before);
  });

  it("the dial's hand follows the arrows on a bound handle", async () => {
    const fixture = TestBed.createComponent(BoundHandleHost);
    await fixture.whenStable();
    const read = await turnTheHand(fixture.nativeElement, () => fixture.whenStable());
    expect(read.after).not.toBe(read.before);
  });
});
