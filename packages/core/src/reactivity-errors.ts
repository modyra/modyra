/**
 * Typed errors for the {@link import("./reactivity.js").MdyReactivity}
 * contract. Adapters and the form engine throw these instead of ad-hoc
 * `Error`s or silent no-ops, so a caller can `instanceof`-check the failure
 * mode.
 */

/** A capability was used but the adapter's `capabilities` reports it false. */
export class MdyUnsupportedCapabilityError extends Error {
  constructor(
    readonly capability: string,
    readonly adapterKind: string,
  ) {
    super(
      `[modyra] "${capability}" is not supported by the "${adapterKind}" reactivity adapter.`,
    );
    this.name = "MdyUnsupportedCapabilityError";
  }
}

/** An observer was created by a runtime that does not own the signal it reads. */
export class MdyCrossRuntimeObservationError extends Error {
  constructor(readonly observerKind: string, readonly ownerKind?: string) {
    super(
      `[modyra] A "${observerKind}" reactivity runtime attempted to observe ` +
        `a signal it does not own${ownerKind ? ` (owned by "${ownerKind}")` : ""}. ` +
        `Observe signals through their owning runtime's MdyReactiveOwner instead.`,
    );
    this.name = "MdyCrossRuntimeObservationError";
  }
}

/** A resource was registered on (or a scope operation attempted on) a destroyed scope. */
export class MdyDestroyedScopeError extends Error {
  constructor(readonly scopeId?: symbol) {
    super("[modyra] Cannot register a resource on a destroyed MdyReactiveScope.");
    this.name = "MdyDestroyedScopeError";
  }
}

/** An adapter violated one of the conformance rules (e.g. a fictitious capability, a silent no-op). */
export class MdyAdapterContractError extends Error {
  constructor(readonly adapterKind: string, reason: string) {
    super(`[modyra] Adapter "${adapterKind}" violates the reactivity contract: ${reason}`);
    this.name = "MdyAdapterContractError";
  }
}

/** A feature requiring an active runtime context — a host framework's injector — was used before
 * activation. */
export class MdyActivationError extends Error {
  constructor(readonly feature: string) {
    super(`[modyra] "${feature}" requires the adapter to be activated with a runtime context first.`);
    this.name = "MdyActivationError";
  }
}

/**
 * A signal was written while a computed was recomputing.
 *
 * A computed is a function of its inputs and nothing else. Whether it runs at all depends on who
 * reads it, and how often depends on what invalidates it — so a write from inside happens a number
 * of times the program never states, in an order decided by whichever consumer read first.
 *
 * The same code runs on every reactivity a host may bring, and at least one of them refuses this
 * write outright. A rule obeyed by the strictest graph is the only one that holds everywhere.
 */
export class MdyComputedWriteError extends Error {
  constructor() {
    super(
      "[modyra] A signal was written inside a computed. A computed derives a value from its " +
        "inputs; it may run any number of times, or none, so a write from within it is not a " +
        "statement the program can make. Move the write into an effect, or into the code that " +
        "caused it.",
    );
    this.name = "MdyComputedWriteError";
  }
}
