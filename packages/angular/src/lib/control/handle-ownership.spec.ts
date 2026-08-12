import { Component, Injector, signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { MdyDeclarativeAdapter } from "../core/declarative-form-adapter";
import { MdyFormComponent } from "../form/mdy-form.component";
import { MdyTimepickerComponent } from "../renderers/timepicker/timepicker-renderer.component";

/**
 * A control built on the declarative `name` path owns its handle's signals.
 *
 * The base builds a handle for that path so every renderer has one to give its controller. A
 * controller resolves the runtime to observe through `observerFor`, which reads the *owner*
 * registry — and the base registered in the neighbouring *form* registry, which nothing reads for
 * this. `observerFor` then fell back to a vanilla runtime, whose signals an Angular computed cannot
 * see: the controller's state changed and the template never re-rendered.
 *
 * It failed silently, which is exactly what that registry exists to prevent, and it took a clock
 * whose hand would not move to notice. So the check is behavioural: change something only the
 * controller holds, and see it reach the DOM.
 */
@Component({
  standalone: true,
  imports: [MdyFormComponent, MdyTimepickerComponent],
  template: `
    <mdy-form [adapter]="adapter">
      <mdy-control-timepicker name="alarm" label="Alarm" />
    </mdy-form>
  `,
})
class Host {
  adapter = new MdyDeclarativeAdapter(signal({ alarm: "09:30 AM" }), undefined, TestBed.inject(Injector));
}

describe("a declaratively named control owns its handle", () => {
  it("re-renders when the controller's own state changes", () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    host.querySelector<HTMLElement>(".mdy-timepicker__toggle")!.click();
    fixture.detectChanges();

    const renderer = fixture.debugElement.query(By.directive(MdyTimepickerComponent))
      .componentInstance as unknown as {
        controller: () => { dispatch(intent: unknown): unknown } | undefined;
        draftValue: () => string;
      };
    const controller = renderer.controller();
    expect(controller).toBeDefined();
    expect(renderer.draftValue()).toContain("09");

    // The draft is the controller's alone — the field's value has not moved — so this reaches the
    // template only if the runtime observing the handle is the one whose signals it reads.
    controller!.dispatch({ type: "set-hour", hour: 11 });
    fixture.detectChanges();

    expect(renderer.draftValue()).toContain("11");
  });
});
