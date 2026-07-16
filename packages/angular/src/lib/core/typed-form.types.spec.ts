/**
 * Compile-time tests for the typed form API.
 *
 * Every `@ts-expect-error` line asserts that the marked expression does NOT
 * compile — if a refactor makes it compile, TypeScript reports an unused
 * directive (TS2578) and the build of this spec fails. The runtime `it`
 * blocks only exist so the file runs as a (trivially green) jest suite.
 */
import { Signal } from "@angular/core";
import {
  field,
  group,
  mdyForm,
  MdyFieldHandle,
  MdyTypedFormLike,
} from "./typed-form";
import { crossField, email, min, minLength, required } from "./validators";

/** `true` iff `A` and `B` are identical types. */
type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false;

/** Compile-time assertion — only callable when the type argument is `true`. */
function assertType<T extends true>(): T | void {
  // Intentionally empty: the check happens at compile time.
}

function makeForm() {
  return mdyForm({
    email: field("", [required(), email()]),
    age: field<number | null>(null, [min(18)]),
    tags: field<readonly string[]>([], [minLength(1)]),
    address: group({
      city: field("Rome"),
      zip: field(""),
    }),
  });
}

describe("typed form — compile-time contracts", () => {
  it("field handles and value types are inferred from the schema", () => {
    const form = makeForm();

    // Literal initials widen to their primitive.
    assertType<Equal<typeof form.f.email, MdyFieldHandle<string>>>();
    assertType<Equal<typeof form.f.age, MdyFieldHandle<number | null>>>();
    assertType<
      Equal<ReturnType<typeof form.getValue>["address"]["city"], string>
    >();

    // A typo on a handle path is a compile error, not a runtime surprise.
    // @ts-expect-error — "emial" does not exist on the handle tree
    form.f.emial;
    // @ts-expect-error — "country" is not part of the address group
    form.f.address.country;

    expect(form.f.email.path).toBe("email");
  });

  it("set() and setValue() enforce the field/model types", () => {
    const form = makeForm();

    form.f.age.set(30);
    form.f.age.set(null);
    // @ts-expect-error — age is number | null, not string
    form.f.age.set("30");

    form.setValue({
      email: "a@b.co",
      age: null,
      tags: [],
      address: { city: "Rome", zip: "00100" },
    });
    // @ts-expect-error — setValue requires the complete model (address missing)
    form.setValue({ email: "a@b.co", age: null, tags: [] });

    expect(form.getValue().email).toBe("a@b.co");
  });

  it("patch() accepts a deep partial and rejects unknown keys", () => {
    const form = makeForm();

    form.patch({ address: { city: "Milan" } });
    form.patch({});
    // @ts-expect-error — unknown top-level key
    form.patch({ nope: 1 });
    // @ts-expect-error — wrong nested value type
    form.patch({ address: { zip: 100 } });

    // getChanges() returns the same deep-partial shape patch() accepts.
    const changes = form.getChanges();
    form.patch(changes);
    expect(form.getValue().address.city).toBe("Milan");
  });

  it("schema validators must match the field's value type", () => {
    // minLength targets string | readonly unknown[] — a number field rejects it.
    // @ts-expect-error — validator type mismatch
    mdyForm({ count: field(0, [minLength(2)]) });

    // Cross-field validators see the typed value.
    const form = mdyForm(
      {
        password: field(""),
        confirm: field(""),
      },
      {
        validators: [
          crossField(["password", "confirm"], (v) =>
            v.password === v.confirm ? [] : ["Passwords differ"],
          ),
        ],
      },
    );
    expect(form.state.valid()).toBe(true);
  });

  it("supports File, array and record field types", () => {
    const form = mdyForm({
      resume: field<File | null>(null),
      attachments: field<readonly File[]>([]),
      meta: field<Record<string, string>>({}),
    });

    assertType<Equal<typeof form.f.resume, MdyFieldHandle<File | null>>>();
    assertType<
      Equal<typeof form.f.attachments, MdyFieldHandle<readonly File[]>>
    >();
    // @ts-expect-error — record values are strings
    form.f.meta.set({ source: 1 });
    // @ts-expect-error — a File field does not accept a string path
    form.f.resume.set("/tmp/resume.pdf");
    form.f.meta.set({ source: "web" });

    expect(form.getValue().meta).toEqual({ source: "web" });
  });

  it("MdyTypedFormLike is a structural supertype of every typed form", () => {
    const form = makeForm();
    const like: MdyTypedFormLike = form; // must be assignable
    const names: Signal<readonly string[]> | undefined = (
      like as Partial<Record<"fieldNames", Signal<readonly string[]>>>
    ).fieldNames;
    expect(names?.()).toContain("address.city");
  });
});
