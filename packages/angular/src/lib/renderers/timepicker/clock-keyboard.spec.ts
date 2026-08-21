import { Component, Injector, signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { MdyDeclarativeAdapter } from "../../core/declarative-form-adapter";
import { MdyFormComponent } from "../../form/mdy-form.component";
import { MdyTimepickerComponent } from "./timepicker-renderer.component";

/**
 * The clock face is a control, not a pointer surface. Listening for `mousedown` and `touchstart`
 * alone would leave every number on it reachable only by dragging a hand around a circle. These
 * assert the two halves of that: the arrows turn the hand, and a time keeps its own formalism on
 * the face as well as in its value.
 */
@Component({
  standalone: true,
  imports: [MdyFormComponent, MdyTimepickerComponent],
  template: `
    <mdy-form [adapter]="adapter">
      <mdy-control-timepicker name="alarm" label="Alarm" [format]="format()" />
    </mdy-form>
  `,
})
class ClockHost {
  format = signal<"12h" | "24h">("12h");
  adapter = new MdyDeclarativeAdapter(signal({ alarm: "09:30 AM" }), undefined, TestBed.inject(Injector));
}

function open(format: "12h" | "24h") {
  const fixture = TestBed.createComponent(ClockHost);
  fixture.componentInstance.format.set(format);
  fixture.detectChanges();
  const host = fixture.nativeElement as HTMLElement;
  host.querySelector<HTMLElement>(".mdy-timepicker__toggle")!.click();
  fixture.detectChanges();
  return { fixture, host };
}

const face = (host: HTMLElement) => host.querySelector<HTMLElement>(".mdy-timepicker-dial__face")!;

describe("the clock face as a control", () => {
  it("is focusable and announces itself as a slider with the format's bounds", () => {
    const twelve = open("12h");
    const f = face(twelve.host);
    expect(f.getAttribute("tabindex")).toBe("0");
    expect(f.getAttribute("role")).toBe("slider");
    expect(f.getAttribute("aria-valuemin")).toBe("1");
    expect(f.getAttribute("aria-valuemax")).toBe("12");
    expect(f.getAttribute("aria-valuenow")).toBe("9");
    expect(f.getAttribute("aria-valuetext")).toContain("9");

    const day = open("24h");
    const g = face(day.host);
    // Twenty-four hours, and no hour thirteen on a twelve-hour clock.
    expect(g.getAttribute("aria-valuemin")).toBe("0");
    expect(g.getAttribute("aria-valuemax")).toBe("23");
  });

  it("offers every hour the format has, and no more", () => {
    const twelve = open("12h");
    expect(twelve.host.querySelectorAll(".mdy-timepicker-dial__number").length).toBe(12);
    expect(twelve.host.querySelectorAll(".mdy-timepicker-dial__number--inner").length).toBe(0);

    const day = open("24h");
    const numbers = Array.from(day.host.querySelectorAll(".mdy-timepicker-dial__number")).map((n) => n.textContent!.trim());
    expect(numbers.length).toBe(24);
    // 14:00 is a value a 24-hour picker holds; it must also be one it can be pointed at.
    expect(numbers).toContain("14");
    expect(numbers).toContain("00");
    // The second twelve go on an inner ring rather than on top of the first twelve.
    expect(day.host.querySelectorAll(".mdy-timepicker-dial__number--inner").length).toBe(12);
  });

  it("turns the hand with the arrows, clockwise, and wraps at the end of the ring", () => {
    const { fixture, host } = open("12h");
    const press = (key: string) => {
      face(host).dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
      fixture.detectChanges();
    };
    const now = () => face(host).getAttribute("aria-valuenow");

    expect(now()).toBe("9");
    press("ArrowRight");
    expect(now()).toBe("10");
    press("ArrowLeft");
    expect(now()).toBe("9");
    // End of the ring: 12 then 1, because a clock has no hour zero on a twelve-hour face.
    press("End");
    expect(now()).toBe("12");
    press("ArrowRight");
    expect(now()).toBe("1");
    press("ArrowLeft");
    expect(now()).toBe("12");
  });

  it("never reaches an hour the format does not have", () => {
    const { fixture, host } = open("24h");
    const press = (key: string) => {
      face(host).dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
      fixture.detectChanges();
    };
    // All the way round twice, in both directions: the announced value stays inside 0–23 throughout.
    for (const key of ["ArrowRight", "ArrowLeft", "PageUp", "PageDown"]) {
      for (let step = 0; step < 26; step += 1) {
        press(key);
        const value = Number(face(host).getAttribute("aria-valuenow"));
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(23);
      }
    }
  });

  it("a 24-hour clock offers no AM/PM, and a 12-hour one does", () => {
    expect(open("12h").host.querySelector(".mdy-timepicker-period-toggle")).toBeTruthy();
    expect(open("24h").host.querySelector(".mdy-timepicker-period-toggle")).toBeNull();
  });

  it("gives the hour box focus when the picker opens, so a keyboard can start", () => {
    const { host } = open("12h");
    // It used to take the *face*. The face is a slider a keyboard can operate and it is not where a
    // person types — a picker that opened with focus there left the two controls that accept typing
    // unreached, and Tab walked out of the popup without ever entering it.
    //
    // The clock is projected rather than created, so focus is taken on `open` becoming true.
    return Promise.resolve().then(() => {
      const hour = host.querySelector(".mdy-timepicker-segment--hour .mdy-timepicker-segment-input");
      expect(document.activeElement).toBe(hour);
    });
  });

  it("the arrows work from anywhere in the clock, except a text input", () => {
    const { fixture, host } = open("12h");
    const press = (from: Element, key: string) => {
      from.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
      fixture.detectChanges();
    };
    const now = () => face(host).getAttribute("aria-valuenow");

    // From Confirm — where focus lands the moment a user reaches for the button that commits.
    const confirm = host.querySelector(".mdy-timepicker-action-btn--confirm")!;
    const before = now();
    press(confirm, "ArrowRight");
    expect(now()).not.toBe(before);

    // From an hour or minute box, which has its own arrows and must keep them.
    const box = host.querySelector(".mdy-timepicker-segment-input");
    if (box) {
      const held = now();
      press(box, "ArrowRight");
      expect(now()).toBe(held);
    }
  });

  it("turning the hand from the face still turns it once, not twice", () => {
    // The handler moved to the clock root and a keydown on the face bubbles to it. Left on both,
    // every arrow would step two hours.
    const { fixture, host } = open("12h");
    face(host).dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true, cancelable: true }));
    fixture.detectChanges();
    expect(face(host).getAttribute("aria-valuenow")).toBe("10");
  });
});
