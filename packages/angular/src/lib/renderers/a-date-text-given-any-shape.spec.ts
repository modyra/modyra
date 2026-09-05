import { isoDateText } from "./renderer-projection";

/**
 * The date part of a value, whatever shape the value is (ADR 0208).
 *
 * The model holds what a document put in it and reports the field invalid rather than refusing the
 * write, so this reader is handed values of any shape. Reading one as text throws during change
 * detection, which takes out the control that was going to show the verdict.
 *
 * Every shape is asked, and the forgiving one is kept in on purpose: a string walks through the
 * text path and answers, so a check that only tried a string would pass on a reader that cannot
 * survive a number.
 */
const SHAPES: readonly unknown[] = [7, {}, true, [null], "a name"];

describe("a date text given a value of any shape", () => {
  for (const shape of SHAPES) {
    it(`answers ${JSON.stringify(shape)} instead of throwing`, () => {
      expect(() => isoDateText(shape as never)).not.toThrow();
      expect(typeof isoDateText(shape as never)).toBe("string");
    });
  }

  it("and still answers a real ISO value with its date part", () => {
    // The premise: a reader that returned "" for everything would pass every line above while
    // showing a person nothing.
    expect(isoDateText("2026-09-05T13:45:00Z")).toBe("2026-09-05");
  });
});
