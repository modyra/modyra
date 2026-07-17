import { Component, Injector, signal, Signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { MdyDeclarativeAdapter } from "../core/declarative-form-adapter";
import {
  MdyFieldRef,
  MdyFormAdapter,
  MdyFormError,
  MdyFormState,
  MdyFormSubmitEvent,
} from "../core/types";
import { MdyRequiredDirective } from "../validators/directives/mdy-required.directive";
import { MdyTextComponent } from "../renderers/text/text-renderer.component";
import { MdyFormComponent } from "./mdy-form.component";

function makeAdapter(seed?: Record<string, unknown>): MdyDeclarativeAdapter {
  return new MdyDeclarativeAdapter(signal(seed), undefined, TestBed.inject(Injector));
}

/** Adapter WITHOUT MdyDeclarativeRegistry support (value/state only). */
function makeNonRegistryAdapter(
  backing: MdyDeclarativeAdapter,
): MdyFormAdapter<Record<string, unknown>> {
  return {
    state: backing.state as MdyFormState,
    value: backing.value as Signal<Record<string, unknown>>,
    getValue: () => backing.getValue(),
    getField: (name) => backing.getField(name as string) as MdyFieldRef<unknown> | null,
    errorsFor: (path) => backing.errorsFor(path as string) as Signal<ReadonlyArray<MdyFormError>>,
    submit: (action) => backing.submit(action),
    markAllTouched: () => backing.markAllTouched(),
    buildSubmitEvent: (value) =>
      backing.buildSubmitEvent(value) as MdyFormSubmitEvent<Record<string, unknown>>,
    patchValue: (partial) => backing.patchValue(partial),
    setValue: (value) => backing.setValue(value),
    reset: () => backing.reset(),
  };
}

@Component({
  standalone: true,
  imports: [MdyFormComponent, MdyTextComponent, MdyRequiredDirective],
  template: `
    <mdy-form [adapter]="adapter">
      <mdy-control-text name="username" label="Username" mdyRequired />
    </mdy-form>
  `,
})
class ExplicitAdapterHost {
  adapter = makeAdapter();
}

@Component({
  standalone: true,
  imports: [MdyFormComponent, MdyTextComponent],
  template: `
    <mdy-form [form]="form">
      <mdy-control-text name="city" label="City" />
    </mdy-form>
  `,
})
class FormInputHost {
  form = makeAdapter();
}

@Component({
  standalone: true,
  imports: [MdyFormComponent, MdyTextComponent],
  template: `
    <mdy-form [adapter]="adapter">
      <mdy-control-text name="plain" label="Plain" />
    </mdy-form>
  `,
})
class NonRegistryAdapterHost {
  backing = makeAdapter();
  adapter = makeNonRegistryAdapter(this.backing);
}

@Component({
  standalone: true,
  imports: [MdyFormComponent, MdyTextComponent],
  template: `
    <mdy-form>
      <mdy-control-text name="internal" label="Internal" />
    </mdy-form>
  `,
})
class InternalAdapterHost {}

describe("MdyFormComponent (integration)", () => {
  describe("explicit [adapter] mode (H1 regression)", () => {
    it("claims name-based controls on the explicit adapter", () => {
      const fixture = TestBed.createComponent(ExplicitAdapterHost);
      fixture.detectChanges();
      const adapter = fixture.componentInstance.adapter;
      expect(adapter.fieldNames()).toContain("username");
    });

    it("routes user input to the explicit adapter's field", () => {
      const fixture = TestBed.createComponent(ExplicitAdapterHost);
      fixture.detectChanges();
      const input: HTMLInputElement =
        fixture.nativeElement.querySelector("input");
      input.value = "ada";
      input.dispatchEvent(new Event("input"));
      fixture.detectChanges();
      expect(
        fixture.componentInstance.adapter.getField("username")!().value(),
      ).toBe("ada");
    });

    it("applies validator directives (mdyRequired) to the explicit adapter", () => {
      const fixture = TestBed.createComponent(ExplicitAdapterHost);
      fixture.detectChanges();
      const adapter = fixture.componentInstance.adapter;
      const field = adapter.getField("username")!();
      expect(field.required()).toBe(true);
      expect(field.valid()).toBe(false);
      field.value.set("ada");
      expect(field.valid()).toBe(true);
      expect(adapter.state.valid()).toBe(true);
    });

    it("releases the claim on the explicit adapter when the control is destroyed", () => {
      const fixture = TestBed.createComponent(ExplicitAdapterHost);
      fixture.detectChanges();
      const adapter = fixture.componentInstance.adapter;
      expect(adapter.fieldNames()).toContain("username");
      fixture.destroy();
      expect(adapter.fieldNames()).not.toContain("username");
    });
  });

  describe("[form] input mode", () => {
    it("claims and updates fields on the bound form adapter", () => {
      const fixture = TestBed.createComponent(FormInputHost);
      fixture.detectChanges();
      const form = fixture.componentInstance.form;
      expect(form.fieldNames()).toContain("city");
      const input: HTMLInputElement =
        fixture.nativeElement.querySelector("input");
      input.value = "Rome";
      input.dispatchEvent(new Event("input"));
      expect(form.getField("city")!().value()).toBe("Rome");
    });
  });

  describe("registry-incompatible [adapter]", () => {
    it("warns in dev mode and does not crash", () => {
      const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
      try {
        const fixture = TestBed.createComponent(NonRegistryAdapterHost);
        fixture.detectChanges();
        expect(warn).toHaveBeenCalledWith(
          expect.stringMatching(/does not implement MdyDeclarativeRegistry/),
        );
      } finally {
        warn.mockRestore();
      }
    });
  });

  describe("internal adapter lifecycle", () => {
    it("still supports fully declarative usage (no [form]/[adapter])", () => {
      const fixture = TestBed.createComponent(InternalAdapterHost);
      fixture.detectChanges();
      const input: HTMLInputElement =
        fixture.nativeElement.querySelector("input");
      input.value = "x";
      input.dispatchEvent(new Event("input"));
      expect(input.value).toBe("x");
    });

    it("destroys the internal adapter with the component", () => {
      const fixture = TestBed.createComponent(InternalAdapterHost);
      fixture.detectChanges();
      const formDebug = fixture.debugElement.query(By.directive(MdyFormComponent));
      const form = formDebug.componentInstance as unknown as {
        _declarativeAdapter: MdyDeclarativeAdapter;
      };
      const internal = form._declarativeAdapter;
      expect(internal.destroyed).toBe(false);
      fixture.destroy();
      expect(internal.destroyed).toBe(true);
    });
  });
});
