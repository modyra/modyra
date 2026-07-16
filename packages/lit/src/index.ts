/**
 * @modyra/lit — Lit binding for the Modyra form engine.
 *
 * The engine runs on the core's `vanillaReactivity()`; a
 * `ReactiveController` subscribes the host element to the reactive state
 * it renders and calls `requestUpdate()` on change. The controller types
 * are structural, so this package has no hard dependency on lit itself.
 */
import {
  createForm,
  MdyCoreFormOptions,
  MdyFormSchema,
  MdyFormValue,
  MdySignal,
  MdyTypedForm,
  vanillaReactivity,
} from "@modyra/core";

/** Structural subset of Lit's ReactiveControllerHost. */
export interface MdyControllerHost {
  addController(controller: {
    hostConnected?(): void;
    hostDisconnected?(): void;
  }): void;
  requestUpdate(): void;
}

/**
 * Re-renders the host whenever any of the tracked signals change.
 *
 * ```ts
 * class SignupForm extends LitElement {
 *   private form = createLitForm({ email: field("", [required()]) });
 *   private tracker = new MdyFormController(this, [
 *     this.form.f.email.value, this.form.f.email.errors, this.form.state.valid,
 *   ]);
 *   render() { return html`<input .value=${this.form.f.email.value()} …>`; }
 * }
 * ```
 */
export class MdyFormController {
  private _ref: { destroy(): void } | null = null;
  private _first = true;

  constructor(
    private readonly _host: MdyControllerHost,
    private readonly _signals: ReadonlyArray<MdySignal<unknown>>,
  ) {
    _host.addController(this);
  }

  hostConnected(): void {
    const rx = vanillaReactivity();
    this._first = true;
    this._ref = rx.effect(() => {
      for (const signal of this._signals) signal();
      if (this._first) {
        this._first = false; // initial run only collects dependencies
        return;
      }
      this._host.requestUpdate();
    });
  }

  hostDisconnected(): void {
    this._ref?.destroy();
    this._ref = null;
  }
}

/** `createForm` on the vanilla graph — pair it with {@link MdyFormController}. */
export function createLitForm<S extends MdyFormSchema>(
  schema: S,
  options?: Omit<MdyCoreFormOptions<MdyFormValue<S>>, "reactivity">,
): MdyTypedForm<S> {
  return createForm(schema, { ...options, reactivity: vanillaReactivity() });
}

export * from "@modyra/core";

export { defineMdyTextField, MdyTextFieldElement } from "./text-field.js";
