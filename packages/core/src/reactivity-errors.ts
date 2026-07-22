/**
 * Typed errors for the {@link import("./reactivity.js").MdyReactivity}
 * contract. Adapters and the form engine throw these instead of ad-hoc
 * `Error`s or silent no-ops, so a caller can `instanceof`-check the failure
 * mode (see `.modyra/piano-modyra-reactivity-adapter-api.md` §8.7).
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

/** A feature requiring an active runtime context (e.g. an Angular Injector) was used before activation. */
export class MdyActivationError extends Error {
  constructor(readonly feature: string) {
    super(`[modyra] "${feature}" requires the adapter to be activated with a runtime context first.`);
    this.name = "MdyActivationError";
  }
}
