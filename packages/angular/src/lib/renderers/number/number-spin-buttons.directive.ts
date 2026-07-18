import { Directive, ElementRef, inject, input, OnInit, Renderer2 } from "@angular/core";
import { MDY_ICONS } from "@modyra/core/icons";
import { MDY_I18N_MESSAGES } from "../../core/i18n";

/**
 * @description
 * Directive that adds custom design-system spin buttons to a number input.
 * Usage: <input type="number" [mdyNumberSpinButtons]="true" />
 *
 * - No mutation of input args
 * - No any, no !, no as, no ViewChild
 * - All public properties readonly
 * - No side effects in constructor
 * - No effect() or signals (not needed)
 * - ARIA/keyboard accessible
 */
@Directive({
  selector: "[mdyNumberSpinButtons]",
  standalone: true,
})
export class MdyNumberSpinButtonsDirective implements OnInit {
  /** Enables custom spin buttons if true. */
  readonly mdyNumberSpinButtons = input.required<boolean | string>();

  private readonly i18n = inject(MDY_I18N_MESSAGES);
  private readonly el = inject<ElementRef<HTMLInputElement>>(ElementRef);
  private readonly renderer = inject(Renderer2);

  ngOnInit(): void {
    const enabled = this.mdyNumberSpinButtons();
    if (enabled === false || enabled === "false") return;
    const input = this.el.nativeElement;
    const wrapper = this.renderer.createElement("span");
    this.renderer.setStyle(wrapper, "position", "relative");
    this.renderer.setStyle(input, "paddingRight", "2.5em");
    this.renderer.insertBefore(input.parentNode, wrapper, input);
    this.renderer.appendChild(wrapper, input);

    // Up button
    const upBtn = this.renderer.createElement("button");
    this.renderer.addClass(upBtn, "mdy-spin-btn");
    this.renderer.addClass(upBtn, "mdy-spin-btn-up");
    upBtn.type = "button";
    upBtn.tabIndex = -1;
    upBtn.setAttribute("aria-label", this.i18n.increase);
    const upIcon = MDY_ICONS.SPIN_UP;
    upBtn.innerHTML = `<svg width='1em' height='1em' viewBox='${upIcon.viewBox}' fill='none' xmlns='http://www.w3.org/2000/svg'>${upIcon.content}</svg>`;
    this.renderer.setStyle(upBtn, "position", "absolute");
    this.renderer.setStyle(upBtn, "right", "0.25em");
    this.renderer.setStyle(upBtn, "top", "0.15em");
    this.renderer.setStyle(upBtn, "background", "none");
    this.renderer.setStyle(upBtn, "border", "none");
    this.renderer.setStyle(upBtn, "padding", "0.15em");
    this.renderer.setStyle(upBtn, "cursor", "pointer");
    this.renderer.setStyle(upBtn, "z-index", "2");
    this.renderer.appendChild(wrapper, upBtn);

    // Down button
    const downBtn = this.renderer.createElement("button");
    this.renderer.addClass(downBtn, "mdy-spin-btn");
    this.renderer.addClass(downBtn, "mdy-spin-btn-down");
    downBtn.type = "button";
    downBtn.tabIndex = -1;
    downBtn.setAttribute("aria-label", this.i18n.decrease);
    const downIcon = MDY_ICONS.SPIN_DOWN;
    downBtn.innerHTML = `<svg width='1em' height='1em' viewBox='${downIcon.viewBox}' fill='none' xmlns='http://www.w3.org/2000/svg'>${downIcon.content}</svg>`;
    this.renderer.setStyle(downBtn, "position", "absolute");
    this.renderer.setStyle(downBtn, "right", "0.25em");
    this.renderer.setStyle(downBtn, "bottom", "0.15em");
    this.renderer.setStyle(downBtn, "background", "none");
    this.renderer.setStyle(downBtn, "border", "none");
    this.renderer.setStyle(downBtn, "padding", "0.15em");
    this.renderer.setStyle(downBtn, "cursor", "pointer");
    this.renderer.setStyle(downBtn, "z-index", "2");
    this.renderer.appendChild(wrapper, downBtn);

    upBtn.addEventListener("click", () => this.step(input, +1));
    downBtn.addEventListener("click", () => this.step(input, -1));
  }

  private step(input: HTMLInputElement, dir: 1 | -1): void {
    if (input.disabled || input.readOnly) return; // R11
    const step = Number(input.step) || 1;
    const min = input.min !== "" ? Number(input.min) : -Infinity;
    const max = input.max !== "" ? Number(input.max) : +Infinity;
    let value = input.value === "" ? 0 : Number(input.value);
    value = Math.max(min, Math.min(max, value + dir * step));
    input.value = String(value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }
}
