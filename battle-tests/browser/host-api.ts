/**
 * The surface a host page installs on `window`.
 *
 * Two entry points under `host/` build one each — `battle` for the plain renderer, `battleLit` for
 * lit — and a spec that runs the same body against both reaches its host by name, as a string. That
 * string is what leaves the call site untyped, so the surface is written down here instead: a host
 * method that changes shape then breaks every spec that calls it rather than only the one being
 * edited.
 *
 * The two hosts are not the same surface. Only the plain one carries the collection and diagnostic
 * methods the structural battles need; only lit carries `submitAnswering`, because the plain host
 * takes its answer at mount time. They are separate types for that reason, and `EitherHost` exists
 * for the specs that branch on which one they are holding — a branch the compiler cannot see, so the
 * check in the spec is what keeps such a call honest.
 */

/** What `mountFields` reports back: whether a form was built, and why not when it was not. */
export interface MountOutcome { readonly mounted: boolean; readonly message?: string }

/** One entry of what a host held after a refused submit. A form-level error names no path. */
export interface SubmitError { readonly path?: string | null; readonly message?: unknown }

/** The methods both hosts install. */
export interface SharedHost {
  mountFields(id: string, fields: readonly unknown[], options?: unknown): MountOutcome;
  lastSubmitErrorsOf(id: string): readonly SubmitError[];
  valueOf(id: string): unknown;
  dispose(id: string): void;
}

/** The plain host, which also answers questions about what its renderer left in the DOM. */
export interface PlainHost extends SharedHost {
  mount(id: string, options?: { key?: string; idPrefix?: string }): MountOutcome;
  mountWithSubmit(id: string, fields: readonly unknown[], errors: unknown): MountOutcome;
  removeRow(id: string, key: string): void;
  declareRow(id: string, key: string, value: unknown): void;
  destroyFormOnly(id: string): void;
  danglingReferences(): readonly Record<string, unknown>[];
  duplicateIds(): readonly string[];
  focusState(): Record<string, unknown>;
  controlCount(): number;
}

/** The lit host, which submits after mounting rather than at it. */
export interface LitHost extends SharedHost {
  submitAnswering(id: string, answer: unknown): Promise<unknown>;
}

/** Held by a spec that runs one body against both and branches on which it has. */
export type EitherHost = PlainHost & LitHost;
