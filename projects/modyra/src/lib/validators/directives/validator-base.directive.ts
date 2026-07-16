import {
  computed,
  DestroyRef,
  Directive,
  effect,
  HostAttributeToken,
  inject,
  input,
  untracked,
} from "@angular/core";
import { MDY_DECLARATIVE_REGISTRY } from "../../core/tokens";
import { ValidatorFn } from "../../core/types";

declare const ngDevMode: boolean | undefined;

let _nextValidatorKey = 0;

/**
 * Shared base for declarative validator directives.
 *
 * Resolves the target field from either the static `name` attribute or a
 * dynamic `[name]` binding (the directive declares its own `name` input, so
 * Angular delivers the same binding the renderer receives — B11), and keeps
 * the registered validators in sync with the directive inputs: every change
 * re-runs {@link buildValidators} and swaps the previous set via a per-instance
 * key. On destroy (or when the target field changes) the validators owned by
 * this instance are removed (B12).
 */
@Directive()
export abstract class MdyValidatorBaseDirective {
  private readonly _registry = inject(MDY_DECLARATIVE_REGISTRY, {
    optional: true,
  });
  private readonly _attrName = inject(new HostAttributeToken("name"), {
    optional: true,
  });

  /**
   * Target field name. Populated automatically from the host's `name`
   * attribute or `[name]` binding — no need to set it explicitly.
   */
  readonly name = input<string>("");

  private readonly _fieldName = computed(() => this.name() || this._attrName || "");
  private readonly _key = `mdy-vd-${_nextValidatorKey++}`;
  private _lastField: string | null = null;

  /**
   * Returns the current validator set for this directive.
   * Called inside a reactive context: reading inputs here makes the
   * registration re-run when they change.
   * Validators are typed contravariantly (`ValidatorFn<never>`) so concrete
   * directives can return validators for their specific value type.
   */
  protected abstract buildValidators(): {
    readonly validators: ReadonlyArray<ValidatorFn<never>>;
    readonly marksRequired?: boolean;
  };

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      if (this._lastField && this._registry) {
        this._registry.removeValidators(this._lastField, this._key);
      }
    });
    effect(() => {
      const registry = this._registry;
      if (!registry) return;
      const field = this._fieldName();
      const { validators, marksRequired } = this.buildValidators();
      untracked(() => {
        if (this._lastField && this._lastField !== field) {
          registry.removeValidators(this._lastField, this._key);
        }
        this._lastField = field || null;
        if (!field) {
          if (typeof ngDevMode !== "undefined" && ngDevMode) {
            console.warn(
              `[modyra] ${this.constructor.name} cannot resolve its target field: ` +
                `the host has neither a "name" attribute nor a [name] binding.`,
            );
          }
          return;
        }
        registry.upsertValidators(field, this._key, validators, marksRequired ?? false);
      });
    });
  }
}
