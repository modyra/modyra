import { ApplicationRef, Injector } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { MdyDiagnostic, MdyUnsupportedCapabilityError } from "@modyra/core";
import { angularReactivity } from "./reactivity-angular";

/**
 * Milestone 4 (piano-modyra-reactivity-adapter-api.md §9): no dedicated
 * coverage existed for this adapter before this batch (CodeGraph flagged it
 * "no covering tests found"). Covers the hardening this milestone adds:
 * honest capabilities, a typed error instead of a silent no-op effect, and
 * real equality propagation — plus the pre-existing signal/computed/effect
 * behavior the shared `runReactivityContract` suite checks for other
 * adapters (not reusable here as-is: it's written against Node's
 * `node:test`, while this package's whole suite runs under Jest).
 */
describe("angularReactivity", () => {
  describe("with an Injector", () => {
    it("reports honest capabilities and canEffect", () => {
      const rx = angularReactivity(TestBed.inject(Injector));
      expect(rx.canEffect).toBe(true);
      expect(rx.capabilities).toEqual({
        effects: true,
        effectOwnership: true,
        signalEquality: true,
        computedEquality: true,
        batching: false,
        deterministicFlush: false,
        directObservation: false,
        writableComputed: false,
        graphInspection: false,
        serverSnapshots: false,
      });
    });

    it("signal read/write/update and asReadonly", () => {
      const rx = angularReactivity(TestBed.inject(Injector));
      const s = rx.signal(1);
      expect(s()).toBe(1);
      s.set(2);
      expect(s()).toBe(2);
      s.update((v) => v + 1);
      expect(s()).toBe(3);
      const ro = s.asReadonly();
      expect(ro()).toBe(3);
      expect((ro as { set?: unknown }).set).toBeUndefined();
    });

    it("computed caches and recomputes on dependency change", () => {
      const rx = angularReactivity(TestBed.inject(Injector));
      const s = rx.signal(2);
      let runs = 0;
      const c = rx.computed(() => {
        runs++;
        return s() * 10;
      });
      expect(c()).toBe(20);
      expect(c()).toBe(20);
      expect(runs).toBe(1);
      s.set(3);
      expect(c()).toBe(30);
      expect(runs).toBe(2);
    });

    it("respects a custom equal on signal and computed", () => {
      const rx = angularReactivity(TestBed.inject(Injector));
      const s = rx.signal({ n: 1 }, { equal: (a, b) => a.n === b.n });
      let computations = 0;
      const c = rx.computed(
        () => {
          computations++;
          return s().n;
        },
        { equal: () => false }, // never-equal: every read recomputes downstream consumers
      );
      expect(c()).toBe(1);
      s.set({ n: 1 }); // equal per the custom fn: must not notify consumers
      expect(computations).toBe(1);
      s.set({ n: 2 });
      expect(c()).toBe(2);
    });

    it("effect runs, tracks, cleans up and destroy() is idempotent", () => {
      const rx = angularReactivity(TestBed.inject(Injector));
      const s = rx.signal(0);
      let runs = 0;
      let cleanups = 0;
      const ref = rx.effect((onCleanup) => {
        runs++;
        s();
        onCleanup(() => cleanups++);
      });
      TestBed.inject(ApplicationRef).tick();
      expect(runs).toBe(1);
      expect(ref.destroyed).toBe(false);

      s.set(1);
      TestBed.inject(ApplicationRef).tick();
      expect(runs).toBe(2);
      expect(cleanups).toBe(1);

      ref.destroy();
      expect(ref.destroyed).toBe(true);
      ref.destroy(); // idempotent
      expect(ref.destroyed).toBe(true);

      s.set(2);
      TestBed.inject(ApplicationRef).tick();
      expect(runs).toBe(2); // did not run again after destroy
    });

    it("untracked read does not create a dependency", () => {
      const rx = angularReactivity(TestBed.inject(Injector));
      const tracked = rx.signal(1);
      const untrackedDep = rx.signal(10);
      let runs = 0;
      const ref = rx.effect(() => {
        runs++;
        tracked();
        rx.untracked(() => untrackedDep());
      });
      TestBed.inject(ApplicationRef).tick();
      expect(runs).toBe(1);
      untrackedDep.set(20);
      TestBed.inject(ApplicationRef).tick();
      expect(runs).toBe(1);
      ref.destroy();
    });
  });

  describe("without an Injector", () => {
    it("reports capabilities.effects and canEffect as false", () => {
      const rx = angularReactivity();
      expect(rx.canEffect).toBe(false);
      expect(rx.capabilities?.effects).toBe(false);
      expect(rx.capabilities?.effectOwnership).toBe(false);
    });

    it("effect() throws a typed error by default instead of a silent no-op", () => {
      const rx = angularReactivity();
      expect(() => rx.effect(() => undefined)).toThrow(
        MdyUnsupportedCapabilityError,
      );
    });

    it('with unsupported: "report", degrades to a disabled ref and reports a diagnostic — never silently', () => {
      const reports: MdyDiagnostic[] = [];
      const rx = angularReactivity({
        unsupported: "report",
        diagnostics: { report: (d) => reports.push(d) },
      });
      const ref = rx.effect(() => undefined);
      expect(ref.destroyed).toBe(true);
      expect(reports).toHaveLength(1);
      expect(reports[0]?.code).toBe("MDY_EFFECTS_UNAVAILABLE");
      expect(reports[0]?.adapter).toBe("angular");
    });

    it("signal/computed/untracked still work without an Injector", () => {
      const rx = angularReactivity();
      const s = rx.signal(1);
      const c = rx.computed(() => s() + 1);
      expect(c()).toBe(2);
      expect(rx.untracked(() => s())).toBe(1);
    });
  });
});
