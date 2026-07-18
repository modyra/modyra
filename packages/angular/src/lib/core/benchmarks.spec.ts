/**
 * Reproducible micro-benchmarks for the Signals core.
 *
 * Methodology: wall-clock (performance.now) inside the jest/jsdom
 * environment used by the unit suite, zoneless (no zone.js polyfill).
 * Numbers are logged for inspection and asserted only against very loose
 * ceilings so machine noise never breaks CI — treat the logged values, not
 * the assertions, as the measurement.
 */
import { ApplicationRef, Injector, signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { required } from "@modyra/core";
import { MdyDeclarativeAdapter } from "./declarative-form-adapter";
import { field, group, mdyForm } from "./typed-form";

function bench(label: string, fn: () => void): number {
  const start = performance.now();
  fn();
  const ms = performance.now() - start;
  // eslint-disable-next-line no-console
  console.log(`[bench] ${label}: ${ms.toFixed(2)}ms`);
  return ms;
}

function makeAdapter(fields: number): MdyDeclarativeAdapter {
  const adapter = new MdyDeclarativeAdapter(signal(undefined), signal("valid-only"));
  for (let i = 0; i < fields; i++) {
    adapter.getField(`f${i}`);
    adapter.upsertValidators(`f${i}`, "bench", [required()], true);
  }
  return adapter;
}

describe("core benchmarks", () => {
  it("creates 10 / 100 / 1000 validated fields", () => {
    expect(bench("create 10 fields", () => makeAdapter(10))).toBeLessThan(500);
    expect(bench("create 100 fields", () => makeAdapter(100))).toBeLessThan(1000);
    expect(bench("create 1000 fields", () => makeAdapter(1000))).toBeLessThan(50);
  });

  it("updates a single field in a 1000-field form without global recompute", () => {
    const adapter = makeAdapter(1000);
    adapter.state.valid(); // settle the computed graph
    const f = adapter.getField("f500")!();
    const ms = bench("1000x single-field update + read", () => {
      for (let i = 0; i < 1000; i++) {
        f.value.set(`v${i}`);
        f.errors();
        f.valid();
      }
    });
    expect(ms).toBeLessThan(15);
  });

  it("recomputes whole-form validity and value on demand", () => {
    const adapter = makeAdapter(1000);
    expect(
      bench("full validity of 1000 invalid fields", () => {
        expect(adapter.state.valid()).toBe(false);
      }),
    ).toBeLessThan(2000);
    for (let i = 0; i < 1000; i++) {
      (adapter.getField(`f${i}`)!().value as ReturnType<typeof signal<unknown>>).set("x");
    }
    expect(
      bench("re-validate after 1000 writes", () => {
        expect(adapter.state.valid()).toBe(true);
      }),
    ).toBeLessThan(20);
  });

  it("getChanges over 1000 fields", () => {
    const adapter = makeAdapter(1000);
    for (let i = 0; i < 500; i++) {
      (adapter.getField(`f${i}`)!().value as ReturnType<typeof signal<unknown>>).set("changed");
    }
    const ms = bench("getChanges (500 of 1000 changed)", () => {
      expect(Object.keys(adapter.getChanges())).toHaveLength(500);
    });
    expect(ms).toBeLessThan(1000);
  });

  it("undo/redo of 30 recorded snapshots", () => {
    // 30 keeps us under Angular's dev-mode "endless notifications" guard
    // (NG0103) that rapid set+tick loops would otherwise trip.
    const form = mdyForm(
      { name: field("start") },
      { injector: TestBed.inject(Injector), history: true },
    );
    const tick = (): void => TestBed.inject(ApplicationRef).tick();
    tick();
    const msRecord = bench("record 30 snapshots", () => {
      for (let i = 0; i < 30; i++) {
        form.f.name.set(`v${i}`);
        tick();
      }
    });
    const msUndo = bench("undo x30 + redo x30", () => {
      for (let i = 0; i < 30; i++) form.undo();
      for (let i = 0; i < 30; i++) form.redo();
    });
    expect(form.f.name.value()).toBe("v29");
    expect(msRecord).toBeLessThan(4);
    expect(msUndo).toBeLessThan(2000);
  });

  it("submit and nested patch on a typed form", async () => {
    const form = mdyForm({
      email: field("a@b.co"),
      address: group({ city: field("Rome"), zip: field("") }),
    });
    const msPatch = bench("100x nested patch", () => {
      for (let i = 0; i < 100; i++) form.patch({ address: { zip: `zip${i}` } });
    });
    const start = performance.now();
    for (let i = 0; i < 100; i++) await form.submit(() => undefined);
    const msSubmit = performance.now() - start;
    // eslint-disable-next-line no-console
    console.log(`[bench] 100x submit (noop action): ${msSubmit.toFixed(2)}ms`);
    expect(form.f.address.zip.value()).toBe("zip99");
    expect(msPatch).toBeLessThan(1000);
    expect(msSubmit).toBeLessThan(2000);
  });

  it("async validation round-trip", async () => {
    const adapter = new MdyDeclarativeAdapter(
      signal(undefined),
      signal("valid-only"),
      TestBed.inject(Injector),
    );
    const f = adapter.getField("user")!();
    adapter.upsertAsyncValidators("user", "bench", [async () => []]);
    const start = performance.now();
    for (let i = 0; i < 50; i++) {
      f.value.set(`v${i}`);
      TestBed.inject(ApplicationRef).tick();
      await new Promise((r) => setTimeout(r, 0));
    }
    const ms = performance.now() - start;
    // eslint-disable-next-line no-console
    console.log(`[bench] 50x async validate round-trip: ${ms.toFixed(2)}ms`);
    expect(f.pending()).toBe(false);
    expect(ms).toBeLessThan(180);
  });

  it("repeated form construction and teardown does not accumulate fields", () => {
    for (let round = 0; round < 50; round++) {
      const adapter = makeAdapter(50);
      for (let i = 0; i < 50; i++) adapter.removeField(`f${i}`);
      expect(adapter.fieldNames()).toHaveLength(0);
    }
  });
});
