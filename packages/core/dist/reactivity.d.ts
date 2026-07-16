/**
 * Reactive contract the form engine is written against.
 *
 * The engine never imports a framework: it only needs something that can
 * create writable signals, derived computations and effects. Adapters bind
 * these to their host framework (Angular passes its native signals, so the
 * engine's state integrates with change detection); `vanillaReactivity()`
 * is a dependency-tracked implementation for Node, CLIs and plain unit
 * tests.
 */
/** Read-only reactive value — call it to read (and track) the value. */
export interface MdySignal<T> {
    (): T;
}
/** Writable reactive value. */
export interface MdyWritableSignal<T> extends MdySignal<T> {
    set(value: T): void;
    update(fn: (value: T) => T): void;
    asReadonly(): MdySignal<T>;
}
/** Handle to a running effect. */
export interface MdyEffectRef {
    destroy(): void;
}
/** Registers a callback run before the next effect run (or on destroy). */
export type MdyOnCleanup = (cleanup: () => void) => void;
export interface MdyReactivity {
    signal<T>(initial: T): MdyWritableSignal<T>;
    computed<T>(fn: () => T): MdySignal<T>;
    effect(fn: (onCleanup: MdyOnCleanup) => void): MdyEffectRef;
    untracked<T>(fn: () => T): T;
    /**
     * False when this reactivity cannot run effects (e.g. an Angular adapter
     * constructed without an Injector). Effect-dependent features (async
     * validators, drafts, history) are skipped with a warning.
     */
    readonly canEffect: boolean;
}
/**
 * Standalone reactive engine: dependency-tracked signals, lazy cached
 * computeds and microtask-batched effects. Enough to run the whole form
 * engine outside any framework — the "decisive test":
 *
 * ```ts
 * const form = createForm({ email: field("") });
 * form.f.email.set("foo@bar.com");
 * console.log(form.f.email.errors());
 * ```
 *
 * works in Node with no framework installed. Await a microtask
 * (`await Promise.resolve()`) after writes when asserting on
 * effect-driven state (async validators, drafts, history).
 */
export declare function vanillaReactivity(): MdyReactivity;
