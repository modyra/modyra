import {
  buildDynamicValidators,
  parseDynamicFields,
} from "./dynamic-form-config";

describe("buildDynamicValidators", () => {
  function run(
    config: Parameters<typeof buildDynamicValidators>[0],
    value: unknown,
  ): readonly string[] {
    const { validators } = buildDynamicValidators(config);
    return validators.flatMap((fn) => fn(value as never));
  }

  it("returns no validators for an empty config", () => {
    const { validators, marksRequired } = buildDynamicValidators({});
    expect(validators).toHaveLength(0);
    expect(marksRequired).toBe(false);
  });

  it("maps required and flags marksRequired", () => {
    const { marksRequired } = buildDynamicValidators({ required: true });
    expect(marksRequired).toBe(true);
    expect(run({ required: true }, "")).toHaveLength(1);
    expect(run({ required: true }, "x")).toHaveLength(0);
  });

  it("maps numeric and length constraints", () => {
    expect(run({ min: 18 }, 10)).toHaveLength(1);
    expect(run({ min: 18 }, 20)).toHaveLength(0);
    expect(run({ max: 5 }, 7)).toHaveLength(1);
    expect(run({ minLength: 3 }, "ab")).toHaveLength(1);
    expect(run({ maxLength: 3 }, "abcd")).toHaveLength(1);
  });

  it("maps email and pattern from a JSON-safe source string", () => {
    expect(run({ email: true }, "nope")).toHaveLength(1);
    expect(run({ email: true }, "a@b.co")).toHaveLength(0);
    expect(run({ pattern: "^X" }, "Yz")).toHaveLength(1);
    expect(run({ pattern: "^X" }, "Xz")).toHaveLength(0);
  });

  it("combines multiple constraints", () => {
    const errors = run({ required: true, minLength: 5 }, "ab");
    expect(errors).toHaveLength(1); // minLength fails, required passes
  });
});

describe("parseDynamicFields", () => {
  const valid = { kind: "text", name: "fullName", label: "Full name" };

  it("accepts a bare array of valid fields", () => {
    expect(parseDynamicFields([valid])).toHaveLength(1);
  });

  it("accepts a version-1 envelope and rejects other versions", () => {
    expect(parseDynamicFields({ version: 1, fields: [valid] })).toHaveLength(1);
    expect(parseDynamicFields({ version: 2, fields: [valid] })).toHaveLength(0);
  });

  it("drops entries with unknown kinds, missing names or non-objects", () => {
    const parsed = parseDynamicFields([
      valid,
      { kind: "hologram", name: "x" }, // unknown kind
      { kind: "text" }, // no name
      "garbage",
      null,
    ]);
    expect(parsed).toEqual([valid]);
  });

  it("requires an options array for option-based kinds", () => {
    expect(
      parseDynamicFields([{ kind: "select", name: "topic" }]),
    ).toHaveLength(0);
    expect(
      parseDynamicFields([
        { kind: "select", name: "topic", options: [{ value: 1, label: "One" }] },
      ]),
    ).toHaveLength(1);
  });

  it("returns [] for a payload that is not a config at all", () => {
    expect(parseDynamicFields("nope")).toEqual([]);
    expect(parseDynamicFields({ fields: "nope", version: 1 })).toEqual([]);
  });
});
