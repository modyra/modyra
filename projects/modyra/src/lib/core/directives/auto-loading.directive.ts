import {
  DestroyRef,
  Directive,
  effect,
  inject,
  input,
  numberAttribute,
  signal,
} from "@angular/core";
import { MDY_OPTIONS_CONTROL } from "../tokens";

/**
 * Directive that automatically manages the loading state of an options-based control.
 * It sets the loading state to true until the options signal emits a non-empty array
 * for the first time, or until the timeout elapses — a legitimately empty list
 * must not spin forever (B24).
 *
 * Usage:
 * <mdy-control-select [options]="myOptions()" mdyOptionsAutoLoading />
 */
@Directive({
  selector: "[mdyOptionsAutoLoading]",
  standalone: true,
})
export class MdyOptionsAutoLoadingDirective {
  private readonly control = inject(MDY_OPTIONS_CONTROL);
  private readonly hasLoaded = signal(false);
  private timer: ReturnType<typeof setTimeout> | null = null;

  /**
   * Milliseconds to wait for a non-empty options list before clearing the
   * loading state anyway (an empty result is a valid outcome). 0 disables
   * the timeout.
   */
  readonly mdyOptionsAutoLoadingTimeout = input(10_000, {
    transform: numberAttribute,
  });

  constructor() {
    // Set initial loading state to true
    this.control.loadingOverride.set(true);
    this.armTimeout();

    inject(DestroyRef).onDestroy(() => {
      this.clearTimer();
      // Hand loading control back to the host on destroy.
      this.control.loadingOverride.set(null);
    });

    effect(() => {
      const options = this.control.overrideOptions() ?? this.control.options();

      if (options.length > 0) {
        if (!this.hasLoaded()) {
          this.hasLoaded.set(true);
          this.clearTimer();
          this.control.loadingOverride.set(false);
        }
      } else {
        // If options become empty again, we assume a new load has started
        this.hasLoaded.set(false);
        this.control.loadingOverride.set(true);
        this.armTimeout();
      }
    });
  }

  private armTimeout(): void {
    this.clearTimer();
    const ms = this.mdyOptionsAutoLoadingTimeout();
    if (ms > 0) {
      this.timer = setTimeout(() => {
        this.control.loadingOverride.set(false);
      }, ms);
    }
  }

  private clearTimer(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
