import { mdyFormSerialize } from "./utils";

describe("mdyFormSerialize", () => {
  it("passes primitives through", () => {
    expect(mdyFormSerialize("x")).toBe("x");
    expect(mdyFormSerialize(0)).toBe(0);
    expect(mdyFormSerialize(null)).toBeNull();
    expect(mdyFormSerialize(false)).toBe(false);
  });

  it("maps File objects to descriptive strings", () => {
    const file = new File(["abc"], "resume.pdf");
    expect(mdyFormSerialize(file)).toBe("[File: resume.pdf (3 bytes)]");
  });

  it("recurses into arrays and objects", () => {
    const file = new File(["ab"], "a.txt");
    const out = mdyFormSerialize({
      name: "Ada",
      docs: [file],
      nested: { file },
    }) as Record<string, unknown>;
    expect(out["name"]).toBe("Ada");
    expect(out["docs"]).toEqual(["[File: a.txt (2 bytes)]"]);
    expect((out["nested"] as Record<string, unknown>)["file"]).toBe(
      "[File: a.txt (2 bytes)]",
    );
  });
});
