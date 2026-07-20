import { ApplicationRef, Injector } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { crossField, email, min, required, serverValidator } from "@modyra/core";
import { array, field, group, mdyForm, MdyTypedForm } from "./typed-form";

function makeForm(): MdyTypedForm<{
  email: ReturnType<typeof field<string>>;
  age: ReturnType<typeof field<number | null>>;
  address: ReturnType<
    typeof group<{
      city: ReturnType<typeof field<string>>;
      zip: ReturnType<typeof field<string>>;
    }>
  >;
}> {
  return mdyForm({
    email: field("", [required(), email()]),
    age: field<number | null>(null, [min(18)]),
    address: group({
      city: field("Rome"),
      zip: field(""),
    }),
  });
}

describe("mdyForm", () => {
  describe("schema and handles", () => {
    it("seeds fields from the schema initial values", () => {
      const form = makeForm();
      expect(form.f.email.value()).toBe("");
      expect(form.f.age.value()).toBeNull();
      expect(form.f.address.city.value()).toBe("Rome");
    });

    it("exposes dotted adapter paths for nested groups", () => {
      const form = makeForm();
      expect(form.f.address.city.path).toBe("address.city");
      expect(form.f.email.path).toBe("email");
    });

    it("handle.set writes through to the form value", () => {
      const form = makeForm();
      form.f.address.zip.set("00100");
      form.f.age.set(30);
      expect(form.getValue()).toEqual({
        email: "",
        age: 30,
        address: { city: "Rome", zip: "00100" },
      });
    });

    it("value() is reactive and nested", () => {
      const form = makeForm();
      form.f.email.set("a@b.co");
      expect(form.value().email).toBe("a@b.co");
      expect(form.value().address.city).toBe("Rome");
    });
  });

  describe("validation from schema", () => {
    it("applies validators and drives field/form validity", () => {
      const form = makeForm();
      expect(form.f.email.valid()).toBe(false); // required fails on ""
      expect(form.state.valid()).toBe(false);

      form.f.email.set("valid@mail.io");
      form.f.age.set(20);
      expect(form.state.valid()).toBe(true);

      form.f.age.set(10); // min(18)
      expect(form.f.age.errors()).toHaveLength(1);
      expect(form.state.valid()).toBe(false);
    });

    it("required() marks the field required for aria (MDY_MARKS_REQUIRED)", () => {
      const form = makeForm();
      expect(form.f.email.required()).toBe(true);
      expect(form.f.age.required()).toBe(false);
    });
  });

  describe("setValue / patch / reset", () => {
    it("setValue replaces the whole nested value", () => {
      const form = makeForm();
      form.setValue({
        email: "x@y.z",
        age: 44,
        address: { city: "Milan", zip: "20100" },
      });
      expect(form.f.address.city.value()).toBe("Milan");
      expect(form.f.age.value()).toBe(44);
    });

    it("patch applies deep partials without touching siblings", () => {
      const form = makeForm();
      form.f.email.set("keep@me.io");
      form.patch({ address: { zip: "00184" } });
      expect(form.f.address.zip.value()).toBe("00184");
      expect(form.f.address.city.value()).toBe("Rome");
      expect(form.f.email.value()).toBe("keep@me.io");
    });

    it("reset restores the schema initial values", () => {
      const form = makeForm();
      form.f.address.city.set("Turin");
      form.f.email.set("tmp@tmp.io");
      form.f.email.markAsTouched();
      form.reset();
      expect(form.f.address.city.value()).toBe("Rome");
      expect(form.f.email.value()).toBe("");
      expect(form.f.email.touched()).toBe(false);
    });
  });

  describe("submit", () => {
    it("passes the typed nested value to the action", async () => {
      const form = makeForm();
      form.f.email.set("a@b.co");
      form.f.age.set(21);
      const action = jest.fn().mockResolvedValue(undefined);

      await form.submit(action);
      expect(action).toHaveBeenCalledWith({
        email: "a@b.co",
        age: 21,
        address: { city: "Rome", zip: "" },
      });
      expect(form.state.submitCount()).toBe(1);
    });

    it("maps server errors onto nested field paths", async () => {
      const form = makeForm();
      form.f.email.set("a@b.co");
      form.f.age.set(21);

      await form.submit(() => [
        { path: "address.zip", kind: "server", message: "Unknown ZIP" },
      ]);
      expect(form.f.address.zip.errors().map((e) => e.message)).toContain(
        "Unknown ZIP",
      );
    });
  });

  describe("interop with the flat adapter surface", () => {
    it("getField resolves dotted paths", () => {
      const form = makeForm();
      const ref = form.getField("address.city" as never);
      expect(ref).not.toBeNull();
    });

    it("errorsFor works with dotted paths", () => {
      const form = makeForm();
      const errors = form.errorsFor("email");
      expect(errors().length).toBeGreaterThan(0);
    });
  });

  describe("cross-field validators", () => {
    function makePasswordForm(): MdyTypedForm<{
      password: ReturnType<typeof field<string>>;
      confirm: ReturnType<typeof field<string>>;
    }> {
      return mdyForm(
        {
          password: field("", [required()]),
          confirm: field("", [required()]),
        },
        {
          validators: [
            crossField(["password", "confirm"], (v) =>
              v.password === v.confirm ? null : "Passwords do not match",
            ),
          ],
        },
      );
    }

    it("attributes the error to every involved field and gates validity", () => {
      const form = makePasswordForm();
      form.f.password.set("secret1");
      form.f.confirm.set("secret2");

      expect(form.f.password.errors().map((e) => e.message)).toContain(
        "Passwords do not match",
      );
      expect(form.f.confirm.valid()).toBe(false);
      expect(form.state.valid()).toBe(false);
      expect(form.state.canSubmit()).toBe(false);

      form.f.confirm.set("secret1");
      expect(form.f.password.errors()).toHaveLength(0);
      expect(form.state.valid()).toBe(true);
    });

    it("attributes errors to the form itself with an empty paths array", () => {
      const form = mdyForm(
        {
          a: field(0),
          b: field(0),
        },
        {
          validators: [
            crossField([], (v) =>
              (v.a as number) + (v.b as number) <= 10
                ? null
                : "Sum must not exceed 10",
            ),
          ],
        },
      );
      form.f.a.set(6);
      form.f.b.set(7);

      expect(form.errorsFor("")().map((e) => e.message)).toContain(
        "Sum must not exceed 10",
      );
      expect(form.f.a.errors()).toHaveLength(0); // not attributed to fields
      expect(form.state.valid()).toBe(false);
    });

    it("works with nested dotted paths", () => {
      const form = mdyForm(
        {
          range: group({
            from: field<number | null>(null),
            to: field<number | null>(null),
          }),
        },
        {
          validators: [
            crossField(["range.from", "range.to"], (v) => {
              const { from, to } = v.range;
              return from !== null && to !== null && from > to
                ? "from must be <= to"
                : null;
            }),
          ],
        },
      );
      form.f.range.from.set(5);
      form.f.range.to.set(3);
      expect(form.f.range.to.errors().map((e) => e.message)).toEqual([
        "from must be <= to",
      ]);

      form.f.range.to.set(9);
      expect(form.f.range.to.errors()).toHaveLength(0);
    });
  });

  describe("async debounce", () => {
    async function flushAsync(): Promise<void> {
      TestBed.inject(ApplicationRef).tick();
      await new Promise((r) => setTimeout(r, 0));
    }

    it("delays the async run and stays pending during the window", async () => {
      const calls: string[] = [];
      const form = mdyForm(
        {
          user: field("", [], {
            asyncValidators: [
              async (v) => {
                calls.push(v);
                return v === "taken" ? ["Name taken"] : [];
              },
            ],
            asyncDebounceMs: 40,
          }),
        },
        { injector: TestBed.inject(Injector) },
      );

      TestBed.inject(ApplicationRef).tick();
      expect(form.f.user.pending()).toBe(true);
      await flushAsync();
      expect(calls).toHaveLength(0); // still inside the debounce window

      // Rapid changes: only the last value should be validated.
      form.f.user.set("t");
      await flushAsync();
      form.f.user.set("taken");
      await flushAsync();
      expect(calls).toHaveLength(0);

      await new Promise((r) => setTimeout(r, 60));
      await flushAsync();
      expect(calls).toEqual(["taken"]);
      expect(form.f.user.pending()).toBe(false);
      expect(form.f.user.errors().map((e) => e.message)).toEqual([
        "Name taken",
      ]);
    });

    it("serverValidator + dependsOn retriggers on the dependency and stays pending until settled", async () => {
      let calls = 0;
      const form = mdyForm(
        {
          country: field("IT"),
          phone: field("000", [], serverValidator(
            async (_v, ctx) => {
              calls++;
              return ctx.form.fieldValue("country") === "IT" ? "Invalid for IT" : null;
            },
            { dependsOn: ["country"] },
          )),
        },
        { injector: TestBed.inject(Injector) },
      );

      TestBed.inject(ApplicationRef).tick();
      await flushAsync();
      expect(form.f.phone.errors().map((e) => e.message)).toEqual([
        "Invalid for IT",
      ]);
      const callsAfterInitial = calls;

      form.f.country.set("FR"); // phone value unchanged
      TestBed.inject(ApplicationRef).tick();
      await flushAsync();

      expect(calls).toBeGreaterThan(callsAfterInitial);
      expect(form.f.phone.pending()).toBe(false);
      expect(form.f.phone.errors()).toHaveLength(0);
    });
  });

  describe("getChanges", () => {
    it("returns only the fields that differ from the schema initials", () => {
      const form = makeForm();
      form.f.email.set("a@b.co");
      form.f.address.zip.set("00100");
      expect(form.getChanges()).toEqual({
        email: "a@b.co",
        address: { zip: "00100" },
      });
    });

    it("returns an empty patch for an untouched form", () => {
      const form = makeForm();
      expect(form.getChanges()).toEqual({});
    });

    it("drops a field from the patch when restored to its initial value", () => {
      const form = makeForm();
      form.f.address.city.set("Milan");
      form.f.address.city.set("Rome"); // back to initial
      expect(form.getChanges()).toEqual({});
    });
  });

  describe("undo / redo", () => {
    function tick(): void {
      TestBed.inject(ApplicationRef).tick(); // flush the history effect
    }

    function makeHistoryForm(): MdyTypedForm<{
      name: ReturnType<typeof field<string>>;
    }> {
      return mdyForm(
        { name: field("start") },
        { injector: TestBed.inject(Injector), history: true },
      );
    }

    it("undo restores the previous snapshot, redo re-applies it", () => {
      const form = makeHistoryForm();
      tick(); // record initial snapshot
      expect(form.canUndo()).toBe(false);

      form.f.name.set("first");
      tick();
      form.f.name.set("second");
      tick();
      expect(form.canUndo()).toBe(true);

      form.undo();
      expect(form.f.name.value()).toBe("first");
      form.undo();
      expect(form.f.name.value()).toBe("start");
      expect(form.canUndo()).toBe(false);
      expect(form.canRedo()).toBe(true);

      form.redo();
      expect(form.f.name.value()).toBe("first");
    });

    it("a new change after undo clears the redo stack", () => {
      const form = makeHistoryForm();
      tick();
      form.f.name.set("first");
      tick();
      form.undo();
      tick();
      expect(form.canRedo()).toBe(true);

      form.f.name.set("branch");
      tick();
      expect(form.canRedo()).toBe(false);
      expect(form.canUndo()).toBe(true);
    });

    it("undoing does not push a duplicate history entry", () => {
      const form = makeHistoryForm();
      tick();
      form.f.name.set("first");
      tick();
      form.undo();
      tick(); // history effect sees the restored value
      expect(form.canUndo()).toBe(false); // no spurious entry recorded
    });

    it("batches rapid changes into one undo step with debounceMs", async () => {
      const form = mdyForm(
        { name: field("start") },
        {
          injector: TestBed.inject(Injector),
          history: { debounceMs: 10 },
        },
      );
      tick(); // seed the initial snapshot

      // Simulated keystrokes, all inside the debounce window.
      form.f.name.set("s");
      tick();
      form.f.name.set("se");
      tick();
      form.f.name.set("sec");
      tick();
      await new Promise((r) => setTimeout(r, 30));
      tick();

      form.undo();
      // A single undo jumps back over the whole typing burst.
      expect(form.f.name.value()).toBe("start");
      expect(form.canUndo()).toBe(false);
    });

    it("reset() interacts sanely with history: undo restores pre-reset value", () => {
      const form = makeHistoryForm();
      tick();
      form.f.name.set("typed");
      tick();
      form.reset();
      tick(); // reset is recorded like any other value change
      expect(form.f.name.value()).toBe("start");

      form.undo();
      expect(form.f.name.value()).toBe("typed"); // reset itself is undoable
    });

    it("patch() changes are recorded as history entries", () => {
      const form = makeHistoryForm();
      tick();
      form.patch({ name: "patched" });
      tick();
      expect(form.canUndo()).toBe(true);
      form.undo();
      expect(form.f.name.value()).toBe("start");
    });

    it("undo flushes a pending debounced snapshot first", async () => {
      const form = mdyForm(
        { name: field("start") },
        {
          injector: TestBed.inject(Injector),
          history: { debounceMs: 1000 },
        },
      );
      tick();
      form.f.name.set("typed");
      tick(); // timer still pending — nothing recorded yet

      form.undo(); // must not lose the "typed" state silently
      expect(form.f.name.value()).toBe("start");
      form.redo();
      expect(form.f.name.value()).toBe("typed");
    });
  });

  describe("draft persistence", () => {
    interface MemoryStorage {
      readonly data: Map<string, string>;
      read(key: string): string | null;
      write(key: string, value: string): void;
      remove(key: string): void;
    }

    function memoryStorage(): MemoryStorage {
      const data = new Map<string, string>();
      return {
        data,
        read: (k) => data.get(k) ?? null,
        write: (k, v) => void data.set(k, v),
        remove: (k) => void data.delete(k),
      };
    }

    async function settle(ms: number): Promise<void> {
      TestBed.inject(ApplicationRef).tick();
      await new Promise((r) => setTimeout(r, ms));
      TestBed.inject(ApplicationRef).tick();
    }

    it("writes a debounced draft and restores it into a new form", async () => {
      const storage = memoryStorage();
      const make = () =>
        mdyForm(
          { name: field("initial") },
          {
            injector: TestBed.inject(Injector),
            draft: { key: "d1", storage, debounceMs: 10 },
          },
        );

      const first = make();
      expect(first.hasDraft()).toBe(false);
      first.f.name.set("typed by user");
      await settle(30);
      expect(storage.data.has("d1")).toBe(true);

      const second = make();
      expect(second.f.name.value()).toBe("typed by user"); // restored
      expect(second.hasDraft()).toBe(true);
    });

    it("writes no draft for a pristine form (R20)", async () => {
      const storage = memoryStorage();
      mdyForm(
        { name: field("initial") },
        {
          injector: TestBed.inject(Injector),
          draft: { key: "d0", storage, debounceMs: 5 },
        },
      );
      await settle(25);
      expect(storage.data.has("d0")).toBe(false);
    });

    it("clears the draft after an error-free submit", async () => {
      const storage = memoryStorage();
      const form = mdyForm(
        { name: field("x") },
        {
          injector: TestBed.inject(Injector),
          draft: { key: "d2", storage, debounceMs: 5 },
        },
      );
      form.f.name.set("dirty");
      await settle(20);
      expect(storage.data.has("d2")).toBe(true);

      await form.submit(() => undefined);
      expect(storage.data.has("d2")).toBe(false);
      expect(form.hasDraft()).toBe(false);
    });

    it("keeps the draft when the submit reports errors", async () => {
      const storage = memoryStorage();
      const form = mdyForm(
        { name: field("x") },
        {
          injector: TestBed.inject(Injector),
          draft: { key: "d3", storage, debounceMs: 5 },
        },
      );
      form.f.name.set("dirty");
      await settle(20);

      await form.submit(() => [
        { path: "name", kind: "server", message: "nope" },
      ]);
      expect(storage.data.has("d3")).toBe(true);
    });

    it("never persists nor restores excluded (sensitive) fields", async () => {
      const storage = memoryStorage();
      const make = () =>
        mdyForm(
          { email: field(""), password: field("") },
          {
            injector: TestBed.inject(Injector),
            draft: { key: "d4", storage, debounceMs: 5, exclude: ["password"] },
          },
        );

      const first = make();
      first.f.email.set("a@b.co");
      first.f.password.set("hunter2");
      await settle(25);

      const stored = storage.data.get("d4") ?? "";
      expect(stored).toContain("a@b.co");
      expect(stored).not.toContain("hunter2");

      const second = make();
      expect(second.f.email.value()).toBe("a@b.co");
      expect(second.f.password.value()).toBe(""); // not restored
    });

    it("discards an expired draft (ttlMs)", async () => {
      const storage = memoryStorage();
      storage.write(
        "d5",
        JSON.stringify({
          __mdyDraft: 1,
          savedAt: Date.now() - 60_000,
          value: { name: "stale" },
        }),
      );
      const form = mdyForm(
        { name: field("fresh") },
        {
          injector: TestBed.inject(Injector),
          draft: { key: "d5", storage, ttlMs: 1000 },
        },
      );
      expect(form.f.name.value()).toBe("fresh"); // stale draft not applied
      expect(form.hasDraft()).toBe(false);
      expect(storage.data.has("d5")).toBe(false); // and removed
    });

    it("discards a draft written with a different schema version", () => {
      const storage = memoryStorage();
      storage.write(
        "d6",
        JSON.stringify({
          __mdyDraft: 1,
          savedAt: Date.now(),
          value: { name: "old shape" },
        }),
      );
      const form = mdyForm(
        { name: field("fresh") },
        {
          injector: TestBed.inject(Injector),
          draft: { key: "d6", storage, version: 2 },
        },
      );
      expect(form.f.name.value()).toBe("fresh");
      expect(form.hasDraft()).toBe(false);
    });

    it("still restores a legacy plain-object draft", () => {
      const storage = memoryStorage();
      storage.write("d7", JSON.stringify({ name: "from v1" }));
      const form = mdyForm(
        { name: field("fresh") },
        {
          injector: TestBed.inject(Injector),
          draft: { key: "d7", storage },
        },
      );
      expect(form.f.name.value()).toBe("from v1");
      expect(form.hasDraft()).toBe(true);
    });
  });

  describe("async validators from the schema", () => {
    async function flushAsync(): Promise<void> {
      TestBed.inject(ApplicationRef).tick();
      await new Promise((r) => setTimeout(r, 0));
    }

    it("drives pending and merges async errors", async () => {
      const form = mdyForm(
        {
          user: field("", [], {
            asyncValidators: [
              async (v) => (v === "taken" ? ["Name taken"] : []),
            ],
          }),
        },
        { injector: TestBed.inject(Injector) },
      );

      TestBed.inject(ApplicationRef).tick();
      expect(form.f.user.pending()).toBe(true);
      await flushAsync();
      expect(form.f.user.pending()).toBe(false);

      form.f.user.set("taken");
      await flushAsync();
      expect(form.f.user.errors().map((e) => e.message)).toEqual([
        "Name taken",
      ]);
    });
  });

  describe("array fields", () => {
    function makeOrderForm(): MdyTypedForm<{
      items: ReturnType<
        typeof array<
          ReturnType<
            typeof group<{
              name: ReturnType<typeof field<string>>;
              qty: ReturnType<typeof field<number>>;
            }>
          >
        >
      >;
    }> {
      return mdyForm({
        items: array(
          group({ name: field("", [required()]), qty: field<number>(1) }),
          { initial: [{ name: "First", qty: 2 }] },
        ),
      });
    }

    it("builds rows from the schema initial value", () => {
      const form = makeOrderForm();
      expect(form.f.items.length()).toBe(1);
      expect(form.f.items.rows()[0]!.name.value()).toBe("First");
      expect(form.getValue().items).toEqual([{ name: "First", qty: 2 }]);
    });

    it("push/remove update rows() for template binding (@for)", () => {
      const form = makeOrderForm();
      form.f.items.push({ name: "Second", qty: 3 });
      expect(form.f.items.length()).toBe(2);
      expect(form.f.items.rows().map((r) => r.name.value())).toEqual([
        "First",
        "Second",
      ]);

      form.f.items.remove(0);
      expect(form.f.items.length()).toBe(1);
      expect(form.f.items.rows()[0]!.name.value()).toBe("Second");
      expect(form.getValue().items).toEqual([{ name: "Second", qty: 3 }]);
    });

    it("a required error on a pushed row's field gates state.valid", () => {
      const form = makeOrderForm();
      form.f.items.push({ name: "", qty: 1 });
      expect(form.state.valid()).toBe(false);
      form.f.items.rows()[1]!.name.set("Second");
      expect(form.state.valid()).toBe(true);
    });
  });
});

describe("security policy", () => {
  it("sanitizes values at the write choke point per the form policy", () => {
    const violations: Array<{ kind: string; path: string }> = [];
    const form = mdyForm(
      { name: field("") },
      {
        security: {
          sanitize: "text",
          onViolation: (v) => violations.push({ kind: v.kind, path: v.path }),
        },
      },
    );
    form.f.name.set("admin\u202E");
    expect(form.f.name.value()).toBe("admin");
    expect(violations).toEqual([{ kind: "sanitized", path: "name" }]);
  });

  it("per-field override exempts a field from the form policy", () => {
    const form = mdyForm(
      {
        name: field(""),
        code: field("", [], { sanitize: "off" }),
      },
      { security: { sanitize: "strict" } },
    );
    form.f.name.set("<b>x</b>");
    expect(form.f.name.value()).toBe("bx/b");
    form.f.code.set("<b>x</b>");
    expect(form.f.code.value()).toBe("<b>x</b>");
  });

  it("server errors with unsafe paths are dropped and reported", async () => {
    const violations: Array<{ kind: string; path: string }> = [];
    const form = mdyForm(
      { name: field("") },
      { security: { onViolation: (v) => violations.push({ kind: v.kind, path: v.path }) } },
    );
    form.f.name.set("x");
    await form.submit(() => [
      { path: "__proto__", kind: "server", message: "evil" },
      { path: "name", kind: "server", message: "taken" },
    ]);
    expect(form.f.name.errors().map((e) => e.message)).toEqual(["taken"]);
    expect(violations).toEqual([{ kind: "error-path", path: "__proto__" }]);
  });
});
