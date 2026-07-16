import { z } from "zod";
import { mdyFormFromSchema } from "./mdy-form-from-schema";

describe("mdyFormFromSchema", () => {
  function makeForm() {
    return mdyFormFromSchema(
      z.object({
        email: z.string().email("Invalid email"),
        age: z.number().min(18, "Must be 18+").default(18),
        nickname: z.string().optional(),
        address: z.object({
          city: z.string().min(1, "City required"),
          zip: z.string().default(""),
        }),
      }),
    );
  }

  describe("schema mapping", () => {
    it("seeds defaults and optionals, null otherwise", () => {
      const form = makeForm();
      expect(form.f.age.value()).toBe(18); // .default(18)
      expect(form.f.email.value()).toBeNull(); // required, no default
      expect(form.f.nickname.value()).toBeNull(); // optional → parses to undefined → null
      expect(form.f.address.zip.value()).toBe(""); // nested default
    });

    it("maps nested objects to groups with dotted paths", () => {
      const form = makeForm();
      expect(form.f.address.city.path).toBe("address.city");
    });

    it("marks required for pieces rejecting undefined and null", () => {
      const form = makeForm();
      expect(form.f.email.required()).toBe(true);
      expect(form.f.nickname.required()).toBe(false);
      expect(form.f.age.required()).toBe(false); // has default
    });
  });

  describe("field validation from pieces", () => {
    it("uses the Zod messages", () => {
      const form = makeForm();
      form.f.email.set("not-an-email");
      expect(form.f.email.errors().map((e) => e.message)).toContain(
        "Invalid email",
      );

      form.f.age.set(15);
      expect(form.f.age.errors().map((e) => e.message)).toEqual(["Must be 18+"]);
    });

    it("form becomes valid when every piece passes", () => {
      const form = makeForm();
      form.f.email.set("a@b.co");
      form.f.address.city.set("Rome");
      expect(form.state.valid()).toBe(true);
      expect(form.getValue()).toEqual({
        email: "a@b.co",
        age: 18,
        nickname: null,
        address: { city: "Rome", zip: "" },
      });
    });
  });

  describe("object-level refinements", () => {
    it("maps pathed refine() issues to cross-field errors", () => {
      const form = mdyFormFromSchema(
        z
          .object({
            password: z.string().default(""),
            confirm: z.string().default(""),
          })
          .refine((v) => v.password === v.confirm, {
            path: ["confirm"],
            message: "Passwords do not match",
          }),
      );
      form.f.password.set("one");
      form.f.confirm.set("two");
      expect(form.f.confirm.errors().map((e) => e.message)).toContain(
        "Passwords do not match",
      );
      expect(form.state.valid()).toBe(false);

      form.f.confirm.set("one");
      expect(form.state.valid()).toBe(true);
    });

    it("maps unpathed refine() issues to the form (path null)", () => {
      const form = mdyFormFromSchema(
        z
          .object({
            a: z.number().default(0),
            b: z.number().default(0),
          })
          .refine((v) => v.a + v.b <= 10, { message: "Sum too big" }),
      );
      form.f.a.set(6);
      form.f.b.set(7);
      expect(form.errorsFor("")().map((e) => e.message)).toContain(
        "Sum too big",
      );
      expect(form.state.valid()).toBe(false);
    });

    it("does not duplicate piece-level refine() messages at form level", () => {
      const form = mdyFormFromSchema(
        z.object({
          code: z
            .string()
            .default("")
            .refine((v) => v === "" || v.startsWith("X"), {
              message: "Must start with X",
            }),
        }),
      );
      form.f.code.set("ABC");
      const messages = form.f.code.errors().map((e) => e.message);
      expect(messages.filter((m) => m === "Must start with X")).toHaveLength(1);
    });
  });
});
