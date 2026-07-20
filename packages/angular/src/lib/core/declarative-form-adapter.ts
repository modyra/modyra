import { Injector, Signal, signal } from "@angular/core";
import {
  MdyFormEngine,
  type MdyFormRegistry,
  type MdySecurityPolicy,
} from "@modyra/core";
import { angularReactivity } from "./reactivity-angular";
import {
  MdyFieldRef,
  MdyFormAdapter,
  MdyFormError,
  MdyFormState,
  MdySubmitMode,
} from "./types";

declare const ngDevMode: boolean | undefined;

// The draft persistence contract lives in the framework-agnostic engine —
// re-exported here so existing import sites keep working.
export type { MdyDraftOptions, MdyDraftStorage } from "@modyra/core";

// ─── Registry interface ───────────────────────────────────────────────────────

/**
 * The flat path protocol controls and validator directives speak.
 * Angular specialization of the framework-agnostic core registry contract.
 */
export type MdyDeclarativeRegistry = MdyFormRegistry<Signal<boolean>>;

// ─── Declarative Adapter ──────────────────────────────────────────────────────

/**
 * Adapter used when `<mdy-form>` runs without an explicit [adapter] input,
 * and the engine underneath `mdyForm()`.
 *
 * Since the domain-model extraction this class is a thin Angular binding of
 * the framework-agnostic {@link MdyFormEngine} from `@modyra/core`: it feeds
 * the engine Angular's native signal primitives (via `angularReactivity`),
 * so every piece of form state is a real Angular signal that participates
 * in change detection — zoneless included. All semantics (lazy fields,
 * keyed validators, async last-wins, drafts, history, server-error
 * snapshots) live in the engine.
 */
export class MdyDeclarativeAdapter
  extends MdyFormEngine
  implements MdyFormAdapter<Record<string, unknown>>, MdyDeclarativeRegistry {
  constructor(
    formValue: Signal<Record<string, unknown> | undefined>,
    submitMode: Signal<MdySubmitMode> = signal("valid-only"),
    /** Needed to run async validators, drafts and history. */
    injector?: Injector,
    /** Injection-prevention policy for field values (see `@modyra/core` security). */
    security?: MdySecurityPolicy,
  ) {
    super(angularReactivity(injector), formValue, submitMode, {
      devWarnings: typeof ngDevMode !== "undefined" && !!ngDevMode,
      ...(security !== undefined && { security }),
    });
  }

  // The engine's members are created through `angularReactivity`, so at
  // runtime they ARE Angular signals — these declarations (and the two
  // overrides below) just narrow the abstract reactive types back to the
  // Angular-branded ones the rest of the library is typed against.
  declare readonly state: MdyFormState;
  declare readonly value: Signal<Record<string, unknown>>;
  declare readonly fieldNames: Signal<readonly string[]>;
  declare readonly hasDraft: Signal<boolean>;
  declare readonly canUndo: Signal<boolean>;
  declare readonly canRedo: Signal<boolean>;

  override getField(name: string): MdyFieldRef<unknown> | null {
    return super.getField(name) as unknown as MdyFieldRef<unknown> | null;
  }

  override errorsFor(path: string): Signal<ReadonlyArray<MdyFormError>> {
    return super.errorsFor(path) as unknown as Signal<
      ReadonlyArray<MdyFormError>
    >;
  }
}
