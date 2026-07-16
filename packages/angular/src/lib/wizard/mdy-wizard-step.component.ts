import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  Signal,
  signal,
} from "@angular/core";
import { MdyFieldHandle } from "../core/typed-form";

/**
 * One step of an `<mdy-form-wizard>`.
 *
 * The step declares which fields it owns via `[fields]` (names or typed
 * handles): the wizard gates navigation on their validity and marks them
 * touched when the user tries to advance past an invalid step.
 *
 * Inactive steps are hidden, **not destroyed** — their controls stay
 * registered on the form, so values and validators survive navigation.
 */
@Component({
  selector: "mdy-wizard-step",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: "mdy-wizard__step",
    "[hidden]": "!isActive()",
    role: "group",
    "[attr.aria-label]": "label() || null",
  },
  template: `<ng-content />`,
})
export class MdyWizardStepComponent {
  /** Step title shown in the wizard progress header. */
  readonly label = input<string>("");

  /**
   * Fields owned by this step — names (`"email"`) or typed handles
   * (`form.f.email`). Used for per-step validation.
   */
  readonly fields = input<
    ReadonlyArray<string | MdyFieldHandle<unknown>>
  >([]);

  /** Resolved adapter paths of the step's fields. */
  readonly fieldNames: Signal<readonly string[]> = computed(() =>
    this.fields().map((f) => (typeof f === "string" ? f : f.path)),
  );

  /** Set by the parent wizard. */
  readonly isActive = signal(false);
}
