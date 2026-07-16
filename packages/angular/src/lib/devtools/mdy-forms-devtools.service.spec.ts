import { ApplicationRef, Component } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { field, mdyForm, MdyTypedForm } from "../core/typed-form";
import { MdyFormComponent } from "../form/mdy-form.component";
import { MdyDevtoolsDirective } from "./mdy-devtools.directive";
import {
  MDY_DEVTOOLS_HOTKEY,
  MdyFormsDevtoolsService,
} from "./mdy-forms-devtools.service";

@Component({
  standalone: true,
  imports: [MdyFormComponent, MdyDevtoolsDirective],
  template: `
    <mdy-form [form]="formA" mdyDevtools>
      <input id="input-a" />
    </mdy-form>
    <mdy-form [form]="formB" mdyDevtools>
      <input id="input-b" />
    </mdy-form>
  `,
})
class DevtoolsHostComponent {
  readonly formA: MdyTypedForm<{ a: ReturnType<typeof field<string>> }> =
    mdyForm({ a: field("alpha") });
  readonly formB: MdyTypedForm<{ b: ReturnType<typeof field<string>> }> =
    mdyForm({ b: field("beta") });
}

function pressHotkey(): void {
  document.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "d",
      ctrlKey: true,
      shiftKey: true,
      bubbles: true,
    }),
  );
}

function overlayEl(): HTMLElement | null {
  return document.querySelector("mdy-forms-devtools-overlay");
}

describe("MdyFormsDevtoolsService + mdyDevtools", () => {
  afterEach(() => {
    TestBed.inject(MdyFormsDevtoolsService).close();
  });

  function setup(): { detect: () => void } {
    const fixture = TestBed.createComponent(DevtoolsHostComponent);
    fixture.detectChanges();
    return {
      detect: () => {
        TestBed.inject(ApplicationRef).tick();
        fixture.detectChanges();
      },
    };
  }

  it("toggles the overlay with the hotkey", () => {
    const { detect } = setup();
    expect(overlayEl()).toBeNull();

    pressHotkey();
    detect();
    expect(overlayEl()).not.toBeNull();

    pressHotkey();
    detect();
    expect(overlayEl()).toBeNull();
  });

  it("closes via the ✕ button", () => {
    const { detect } = setup();
    pressHotkey();
    detect();

    const close = overlayEl()?.querySelector<HTMLButtonElement>(
      ".mdy-devtools-overlay__close",
    );
    expect(close).toBeTruthy();
    close!.click();
    detect();
    expect(overlayEl()).toBeNull();
  });

  it("inspects the form that contains the focused element", () => {
    const { detect } = setup();
    document.getElementById("input-a")!.focus();
    pressHotkey();
    detect();

    // formA has field "a" with value "alpha" — shown in the JSON dump.
    expect(overlayEl()!.textContent).toContain("alpha");
    expect(overlayEl()!.textContent).not.toContain("beta");
  });

  it("falls back to the last registered form without focus", () => {
    const { detect } = setup();
    (document.activeElement as HTMLElement | null)?.blur();
    pressHotkey();
    detect();
    expect(overlayEl()!.textContent).toContain("beta");
  });

  it("opens as a focused dialog and restores focus on close", () => {
    const { detect } = setup();
    const input = document.getElementById("input-a") as HTMLElement;
    input.focus();
    pressHotkey();
    detect();

    const overlay = overlayEl()!;
    expect(overlay.getAttribute("role")).toBe("dialog");
    expect(document.activeElement).toBe(overlay);

    pressHotkey();
    detect();
    expect(document.activeElement).toBe(input); // focus handed back
  });
});

describe("MdyFormsDevtoolsService with the hotkey disabled", () => {
  it("ignores the key sequence when MDY_DEVTOOLS_HOTKEY is null", () => {
    TestBed.configureTestingModule({
      providers: [{ provide: MDY_DEVTOOLS_HOTKEY, useValue: null }],
    });
    const fixture = TestBed.createComponent(DevtoolsHostComponent);
    fixture.detectChanges();

    pressHotkey();
    TestBed.inject(ApplicationRef).tick();
    fixture.detectChanges();
    expect(overlayEl()).toBeNull();

    // Programmatic toggle still works.
    const service = TestBed.inject(MdyFormsDevtoolsService);
    service.toggle();
    TestBed.inject(ApplicationRef).tick();
    expect(overlayEl()).not.toBeNull();
    service.close();
  });
});
