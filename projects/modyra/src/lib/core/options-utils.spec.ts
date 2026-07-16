import { filterOptionsByQuery } from "./options-utils";
import { MdySelectOption } from "./types";

describe("filterOptionsByQuery", () => {
  const options: readonly MdySelectOption<number>[] = [
    { value: 1, label: "Rome" },
    { value: 2, label: "Milan" },
    { value: 3, label: "Palermo" },
  ];

  it("returns the original array for an empty or blank query", () => {
    expect(filterOptionsByQuery(options, "")).toBe(options);
    expect(filterOptionsByQuery(options, "   ")).toBe(options);
  });

  it("filters case-insensitively on the label", () => {
    expect(filterOptionsByQuery(options, "mil")).toEqual([options[1]]);
    expect(filterOptionsByQuery(options, "ROME")).toEqual([options[0]]);
  });

  it("matches substrings anywhere in the label", () => {
    expect(filterOptionsByQuery(options, "erm")).toEqual([options[2]]);
  });

  it("returns empty for no matches", () => {
    expect(filterOptionsByQuery(options, "xyz")).toEqual([]);
  });
});
