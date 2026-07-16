import {
  compose,
  composeFirst,
  email,
  max,
  maxLength,
  min,
  minLength,
  pattern,
  required,
} from "./validators";

describe("pure validators", () => {
  describe("required", () => {
    const v = required();

    it("fails on null, undefined, empty/blank string, empty array", () => {
      expect(v(null)).toHaveLength(1);
      expect(v(undefined)).toHaveLength(1);
      expect(v("")).toHaveLength(1);
      expect(v("   ")).toHaveLength(1);
      expect(v([])).toHaveLength(1);
    });

    it("passes on non-empty values, including falsy 0 and false", () => {
      expect(v("x")).toEqual([]);
      expect(v(0)).toEqual([]);
      expect(v(false)).toEqual([]);
      expect(v(["a"])).toEqual([]);
    });

    it("uses the custom message", () => {
      expect(required("obbligatorio")(null)).toEqual(["obbligatorio"]);
    });
  });

  describe("minLength / maxLength", () => {
    it("checks string and array lengths", () => {
      expect(minLength(3)("ab")).toHaveLength(1);
      expect(minLength(3)("abc")).toEqual([]);
      expect(maxLength(2)([1, 2, 3])).toHaveLength(1);
      expect(maxLength(3)([1, 2, 3])).toEqual([]);
    });

    it("treats null/undefined as length 0", () => {
      expect(minLength(1)(null as unknown as string)).toHaveLength(1);
      expect(maxLength(5)(undefined as unknown as string)).toEqual([]);
    });
  });

  describe("email", () => {
    const v = email();

    it("accepts empty values (use required for presence)", () => {
      expect(v(null)).toEqual([]);
      expect(v("")).toEqual([]);
    });

    it("validates the format", () => {
      expect(v("a@b.co")).toEqual([]);
      expect(v("not-an-email")).toHaveLength(1);
      expect(v("a @b.co")).toHaveLength(1);
    });
  });

  describe("pattern", () => {
    it("tests the regex, skipping empty values", () => {
      const v = pattern(/^\d+$/);
      expect(v("123")).toEqual([]);
      expect(v("12a")).toHaveLength(1);
      expect(v(null)).toEqual([]);
    });
  });

  describe("min / max", () => {
    it("compares numbers, skipping null", () => {
      expect(min(18)(17)).toHaveLength(1);
      expect(min(18)(18)).toEqual([]);
      expect(max(99)(100)).toHaveLength(1);
      expect(max(99)(99)).toEqual([]);
      expect(min(1)(null)).toEqual([]);
    });
  });

  describe("compose / composeFirst", () => {
    const failA = (): readonly string[] => ["A"];
    const failB = (): readonly string[] => ["B"];
    const ok = (): readonly string[] => [];

    it("compose merges all errors", () => {
      expect(compose(failA, ok, failB)("x")).toEqual(["A", "B"]);
    });

    it("composeFirst stops at the first failure", () => {
      expect(composeFirst(ok, failA, failB)("x")).toEqual(["A"]);
      expect(composeFirst(ok, ok)("x")).toEqual([]);
    });
  });
});
