import { Directive, effect, ElementRef, inject, Injector, input, OnInit, Renderer2 } from "@angular/core";
import { MDY_ICONS, numberEntered, numberStepped, presentationClass } from "@modyra/widgets";
import { MDY_I18N_MESSAGES } from "../../core/i18n";

@Directive({
  selector: "[mdyNumberSpinButtons]",
  standalone: true,
})
export class MdyNumberSpinButtonsDirective implements OnInit {
  readonly mdyNumberSpinButtons = input.required<boolean | string>();

  /** Whether the field these belong to is out of play. */
  readonly mdyNumberSpinButtonsDisabled = input<boolean>(false);

  private readonly injector = inject(Injector);

  private readonly i18n = inject(MDY_I18N_MESSAGES);
  private readonly el = inject<ElementRef<HTMLInputElement>>(ElementRef);
  private readonly renderer = inject(Renderer2);

  ngOnInit(): void {
    const enabled = this.mdyNumberSpinButtons();
    if (enabled === false || enabled === "false") return;
    const input = this.el.nativeElement;
    // The wrapper is the contract's spinner: the positioning context the box and its two steppers
    // share. Its geometry — the row it takes, where each stepper stands, whether they stack or sit
    // side by side for the field's height — is the shared stylesheet's, so it is not restated here.
    const wrapper = this.renderer.createElement("span");
    this.renderer.addClass(wrapper, presentationClass("number", "spinner"));
    this.renderer.insertBefore(input.parentNode, wrapper, input);
    this.renderer.appendChild(wrapper, input);

    const upBtn = this.renderer.createElement("button");
    this.renderer.addClass(upBtn, "mdy-spin-btn");
    this.renderer.addClass(upBtn, "mdy-spin-btn-up");
    upBtn.type = "button";
    upBtn.tabIndex = -1;
    upBtn.setAttribute("aria-label", this.i18n.increase);
    const upIcon = MDY_ICONS.SPIN_UP;
    upBtn.innerHTML = `<svg width='1em' height='1em' viewBox='${upIcon.viewBox}' fill='none' xmlns='http://www.w3.org/2000/svg'>${upIcon.content}</svg>`;
    this.renderer.appendChild(wrapper, upBtn);

    const downBtn = this.renderer.createElement("button");
    this.renderer.addClass(downBtn, "mdy-spin-btn");
    this.renderer.addClass(downBtn, "mdy-spin-btn-down");
    downBtn.type = "button";
    downBtn.tabIndex = -1;
    downBtn.setAttribute("aria-label", this.i18n.decrease);
    const downIcon = MDY_ICONS.SPIN_DOWN;
    downBtn.innerHTML = `<svg width='1em' height='1em' viewBox='${downIcon.viewBox}' fill='none' xmlns='http://www.w3.org/2000/svg'>${downIcon.content}</svg>`;
    this.renderer.appendChild(wrapper, downBtn);

    upBtn.addEventListener("click", () => this.step(input, +1));
    downBtn.addEventListener("click", () => this.step(input, -1));

    // A field out of play has no operable furniture. The steppers step the box, so they are as
    // unavailable as it is — and a `<button>` inside a disabled field that is not itself disabled is
    // a tab stop the field no longer has and a control the state audit reports as unpainted.
    effect(() => {
      const off = this.mdyNumberSpinButtonsDisabled();
      for (const button of [upBtn, downBtn] as HTMLButtonElement[]) {
        button.disabled = off;
        button.setAttribute("aria-hidden", off ? "true" : "false");
      }
    }, { injector: this.injector });
  }

  private step(input: HTMLInputElement, dir: 1 | -1): void {
    if (input.disabled || input.readOnly) return; // R11
    const value = numberStepped(numberEntered(input.value), dir, {
      min: numberEntered(input.min),
      max: numberEntered(input.max),
      step: numberEntered(input.step),
    });
    if (value === null) return;
    input.value = String(value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }
}
