/**
 * The capability answers about the injector it was given.
 *
 * `capabilities.effects` was `injector !== undefined` — a proxy for "can this run effects" rather
 * than the question. A parentless injector has no `ChangeDetectionScheduler`, so the capability
 * promised effects and Angular then raised `NG0201` from inside the engine's own `effect()` call:
 * the better-looking input produced the worse failure, where no injector at all degrades honestly.
 */
import { Injector, createEnvironmentInjector } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { angularReactivity } from "./reactivity-angular";

describe("angularReactivity capabilities", () => {
  it("claims effects only when effects can be run", () => {
    // No injector: the documented degradation, unchanged.
    expect(angularReactivity().capabilities.effects).toBe(false);

    // A detached container — `Injector.create` with no parent has no scheduler.
    const detached = Injector.create({ providers: [] });
    expect(angularReactivity(detached).capabilities.effects).toBe(false);

    // The known-good cases in the same run, so this is answering about the injector rather than
    // refusing everything: an application injector and a child of one both run effects.
    const application = TestBed.inject(Injector);
    expect(angularReactivity(application).capabilities.effects).toBe(true);
    expect(
      angularReactivity(createEnvironmentInjector([], application as never)).capabilities.effects,
    ).toBe(true);
  });

  it("an effect really runs on the runtime that claims one", () => {
    // The capability is only worth anything if the thing it promises works.
    const rx = angularReactivity(TestBed.inject(Injector));
    expect(rx.capabilities.effects).toBe(true);

    const value = rx.signal(0);
    let runs = 0;
    const ref = rx.effect(() => {
      value();
      runs += 1;
    });
    TestBed.flushEffects?.();
    expect(runs).toBeGreaterThan(0);
    ref.destroy();
  });
});
