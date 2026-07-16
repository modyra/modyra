import { ApplicationRef, Injector, signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { MdyDeclarativeAdapter } from "./declarative-form-adapter";
import { MdyFormError, MdySubmitMode } from "./types";
import { min, required } from "./validators";

function makeAdapter(
  seed?: Record<string, unknown>,
  mode: MdySubmitMode = "valid-only",
  injector?: Injector,
): MdyDeclarativeAdapter {
  return new MdyDeclarativeAdapter(signal(seed), signal(mode), injector);
}

describe("MdyDeclarativeAdapter", () => {
  describe("fields", () => {
    it("creates fields lazily with seed from formValue", () => {
      const adapter = makeAdapter({ age: 18 });
      const field = adapter.getField("age")!();
      expect(field.value()).toBe(18);
    });

    it("defaults unseeded fields to null", () => {
      const adapter = makeAdapter();
      expect(adapter.getField("x")!().value()).toBeNull();
    });

    it("prefers the explicit initial value over the seed", () => {
      const adapter = makeAdapter({ age: 18 });
      adapter.setInitialValue("age", 30);
      expect(adapter.getField("age")!().value()).toBe(30);
    });

    it("an explicit null initial value wins over the seed (R1)", () => {
      const adapter = makeAdapter({ age: 18 });
      adapter.setInitialValue("age", null);
      expect(adapter.getField("age")!().value()).toBeNull();
    });

    it("exposes a reactive whole-form value", () => {
      const adapter = makeAdapter();
      adapter.getField("a")!().value.set(1);
      adapter.getField("b")!().value.set("x");
      expect(adapter.value()).toEqual({ a: 1, b: "x" });
    });
  });

  describe("validators", () => {
    it("upsertValidators replaces the set owned by a key (B12)", () => {
      const adapter = makeAdapter();
      const field = adapter.getField("age")!();
      adapter.upsertValidators("age", "k", [min(18)]);
      field.value.set(10);
      expect(field.errors()).toHaveLength(1);

      adapter.upsertValidators("age", "k", [min(5)]);
      expect(field.errors()).toHaveLength(0);
    });

    it("removeValidators removes only the owning key's validators", () => {
      const adapter = makeAdapter();
      const field = adapter.getField("v")!();
      adapter.upsertValidators("v", "a", [required()]);
      adapter.upsertValidators("v", "b", [min(3)]);
      field.value.set(null);
      expect(field.errors()).toHaveLength(1);

      adapter.removeValidators("v", "a");
      expect(field.errors()).toHaveLength(0);
      field.value.set(1);
      expect(field.errors()).toHaveLength(1); // min(3) from "b" still active
    });

    it("tracks required through keyed registration (B13-adjacent)", () => {
      const adapter = makeAdapter();
      const field = adapter.getField("r")!();
      expect(field.required()).toBe(false);
      adapter.upsertValidators("r", "k", [required()], true);
      expect(field.required()).toBe(true);
      adapter.removeValidators("r", "k");
      expect(field.required()).toBe(false);
    });
  });

  describe("errorsFor", () => {
    it("recomputes when the field is created after the first read (B3)", () => {
      const adapter = makeAdapter();
      const errors = adapter.errorsFor("late");
      expect(errors()).toEqual([]);

      adapter.upsertValidators("late", "k", [required()]);
      expect(errors().map((e: MdyFormError) => e.path)).toEqual(["late"]);
    });
  });

  describe("setValue / patchValue / reset", () => {
    it("setValue resets fields absent from the new value to null (B4)", () => {
      const adapter = makeAdapter();
      adapter.getField("a")!().value.set(1);
      adapter.getField("b")!().value.set(2);
      adapter.setValue({ a: 10 });
      expect(adapter.getField("a")!().value()).toBe(10);
      expect(adapter.getField("b")!().value()).toBeNull();
    });

    it("patchValue leaves untouched fields alone", () => {
      const adapter = makeAdapter();
      adapter.getField("a")!().value.set(1);
      adapter.getField("b")!().value.set(2);
      adapter.patchValue({ a: 10 });
      expect(adapter.getField("b")!().value()).toBe(2);
    });

    it("reset restores explicit initial values, others to null", () => {
      const adapter = makeAdapter({ seeded: "seed" });
      adapter.setInitialValue("kept", "init");
      const kept = adapter.getField("kept")!();
      const seeded = adapter.getField("seeded")!();
      kept.value.set("changed");
      seeded.value.set("changed");
      kept.touched.set(true);
      kept.dirty.set(true);

      adapter.reset();
      expect(kept.value()).toBe("init");
      expect(seeded.value()).toBeNull(); // [formValue] is a seed, not a reset target
      expect(kept.touched()).toBe(false);
      expect(kept.dirty()).toBe(false);
    });
  });

  describe("claim counting (B9)", () => {
    it("drops the field only when the last claim is released", () => {
      const adapter = makeAdapter();
      adapter.claimField("dup");
      adapter.claimField("dup");
      adapter.getField("dup")!().value.set("v");

      adapter.removeField("dup");
      expect(adapter.getField("dup")!().value()).toBe("v"); // still alive

      adapter.removeField("dup");
      expect(adapter.getField("dup")!().value()).toBeNull(); // recreated fresh
    });

    it("removeField without claims deletes immediately (back-compat)", () => {
      const adapter = makeAdapter();
      adapter.getField("x")!().value.set(1);
      adapter.removeField("x");
      expect(adapter.getField("x")!().value()).toBeNull();
    });
  });

  describe("submit", () => {
    it("blocks and marks all touched when invalid in valid-only mode", async () => {
      const adapter = makeAdapter();
      adapter.upsertValidators("name", "k", [required()], true);
      const field = adapter.getField("name")!();
      const action = jest.fn();

      await adapter.submit(action);
      expect(action).not.toHaveBeenCalled();
      expect(adapter.state.submitCount()).toBe(0);
      expect(field.touched()).toBe(true);
    });

    it("runs the action and tracks submitCount when valid (B5)", async () => {
      const adapter = makeAdapter();
      adapter.getField("name")!().value.set("Ada");
      const action = jest.fn().mockResolvedValue(undefined);

      await adapter.submit(action);
      expect(action).toHaveBeenCalledWith({ name: "Ada" });
      expect(adapter.state.submitCount()).toBe(1);
      expect(adapter.state.submitting()).toBe(false);
    });

    it("surfaces server errors on the matching field until it changes (B6)", async () => {
      const adapter = makeAdapter();
      const field = adapter.getField("email")!();
      field.value.set("a@b.co");

      await adapter.submit(() => [
        { path: "email", kind: "server", message: "Already registered" },
      ]);

      expect(adapter.state.lastSubmitErrors()).toHaveLength(1);
      expect(field.errors().map(e => e.message)).toContain("Already registered");
      expect(field.valid()).toBe(false);

      field.value.set("other@b.co"); // editing clears the server error
      expect(field.errors()).toHaveLength(0);
    });

    it("converts thrown errors into a global form error", async () => {
      const adapter = makeAdapter();
      adapter.getField("x")!();
      await adapter.submit(() => {
        throw new Error("boom");
      });
      const errs = adapter.state.lastSubmitErrors();
      expect(errs).toEqual([
        { path: null, kind: "unknown", message: "boom" },
      ]);
      expect(adapter.errorsFor("")()).toEqual(errs);
    });

    it("respects manual submit mode", async () => {
      const adapter = makeAdapter(undefined, "manual");
      adapter.getField("x")!();
      const action = jest.fn();
      await adapter.submit(action);
      expect(action).not.toHaveBeenCalled();
    });
  });

  describe("async validators (B7)", () => {
    async function flushAsync(): Promise<void> {
      TestBed.inject(ApplicationRef).tick(); // run pending effects
      await new Promise((r) => setTimeout(r, 0)); // let promises settle
    }

    it("drives pending and merges async errors, last-wins", async () => {
      const adapter = makeAdapter(undefined, "valid-only", TestBed.inject(Injector));
      const field = adapter.getField("user")!();
      adapter.upsertAsyncValidators("user", "k", [
        async (v) => (v === "taken" ? ["Name taken"] : []),
      ]);

      TestBed.inject(ApplicationRef).tick();
      expect(field.pending()).toBe(true);
      expect(adapter.state.pending()).toBe(true);
      expect(adapter.state.canSubmit()).toBe(false);

      await flushAsync();
      expect(field.pending()).toBe(false);
      expect(field.errors()).toHaveLength(0);

      field.value.set("taken");
      await flushAsync();
      expect(field.errors().map(e => e.message)).toEqual(["Name taken"]);
      expect(field.valid()).toBe(false);
    });

    it("clears pending and errors when async validators are removed", async () => {
      const adapter = makeAdapter(undefined, "valid-only", TestBed.inject(Injector));
      const field = adapter.getField("user")!();
      adapter.upsertAsyncValidators("user", "k", [async () => ["always"]]);
      await flushAsync();
      expect(field.errors()).toHaveLength(1);

      adapter.removeValidators("user", "k");
      await flushAsync();
      expect(field.errors()).toHaveLength(0);
      expect(field.pending()).toBe(false);
    });

    it("turns a rejected promise into an async error", async () => {
      const adapter = makeAdapter(undefined, "valid-only", TestBed.inject(Injector));
      const field = adapter.getField("user")!();
      adapter.upsertAsyncValidators("user", "k", [
        () => Promise.reject(new Error("server down")),
      ]);
      await flushAsync();
      expect(field.errors().map(e => `${e.kind}:${e.message}`)).toEqual([
        "async:server down",
      ]);
      expect(field.pending()).toBe(false);
    });

    it("blocks submit while an async check is pending", async () => {
      const adapter = makeAdapter(undefined, "valid-only", TestBed.inject(Injector));
      adapter.getField("user");
      let release!: (v: string[]) => void;
      adapter.upsertAsyncValidators("user", "k", [
        () => new Promise<string[]>((r) => (release = r)),
      ]);
      TestBed.inject(ApplicationRef).tick();
      expect(adapter.state.pending()).toBe(true);

      const action = jest.fn();
      await adapter.submit(action);
      expect(action).not.toHaveBeenCalled(); // canSubmit waits for pending

      release([]);
      await flushAsync();
      await adapter.submit(action);
      expect(action).toHaveBeenCalledTimes(1);
    });

    it("destroying the field while a check is in flight is safe", async () => {
      const adapter = makeAdapter(undefined, "valid-only", TestBed.inject(Injector));
      adapter.claimField("user");
      let release!: (v: string[]) => void;
      adapter.upsertAsyncValidators("user", "k", [
        () => new Promise<string[]>((r) => (release = r)),
      ]);
      TestBed.inject(ApplicationRef).tick();
      expect(adapter.state.pending()).toBe(true);

      adapter.removeField("user"); // destroys the async runner
      expect(adapter.state.pending()).toBe(false); // record gone

      release(["late"]); // resolving afterwards must not throw or resurrect
      await flushAsync();
      expect(adapter.state.pending()).toBe(false);
      expect(adapter.state.valid()).toBe(true);
    });
  });

  describe("cross-field validators with dynamic fields", () => {
    it("keeps working when an involved field is removed", () => {
      const adapter = makeAdapter();
      adapter.claimField("a");
      adapter.claimField("b");
      adapter.setFormValidators([
        (v) =>
          v["a"] === v["b"]
            ? []
            : [{ path: "b", kind: "cross-field", message: "differ" }],
      ]);
      adapter.getField("a")!().value.set("x");
      expect(adapter.state.valid()).toBe(false);

      adapter.removeField("b"); // validator now sees value without "b"
      expect(() => adapter.state.valid()).not.toThrow();
      // "b" is gone: its attributed error gates validity no longer via the
      // field, but the form-level computation still evaluates safely.
      expect(adapter.errorsFor("")().length).toBe(0);
    });
  });

  describe("server errors on unknown paths", () => {
    it("surfaces them as form-level errors instead of dropping them", async () => {
      const adapter = makeAdapter({ name: "x" });
      adapter.getField("name");
      const formErrors = adapter.errorsFor("");

      await adapter.submit(() => [
        { path: "ghost.field", kind: "server", message: "unmapped" } as MdyFormError,
      ]);
      expect(formErrors().map(e => e.message)).toContain("unmapped");
    });
  });
});
