import {
  addDays,
  addMonths,
  addYears,
  buildMonthGrid,
  compareDates,
  daysInMonth,
  formatIsoDate,
  isSameDay,
  localeDateOrder,
  parseIsoDate,
  parseLocalizedDate,
} from "./date-utils";

describe("date-utils", () => {
  describe("parseIsoDate", () => {
    it("parses valid ISO dates", () => {
      expect(parseIsoDate("2026-07-15")).toEqual({ year: 2026, month: 7, day: 15 });
    });

    it("rejects invalid calendar dates", () => {
      expect(parseIsoDate("2026-02-31")).toBeNull();
      expect(parseIsoDate("2026-13-01")).toBeNull();
      expect(parseIsoDate("2026-00-10")).toBeNull();
      expect(parseIsoDate("not-a-date")).toBeNull();
      expect(parseIsoDate(null)).toBeNull();
    });

    it("accepts Feb 29 only on leap years", () => {
      expect(parseIsoDate("2024-02-29")).not.toBeNull();
      expect(parseIsoDate("2026-02-29")).toBeNull();
    });
  });

  describe("formatIsoDate", () => {
    it("pads to YYYY-MM-DD", () => {
      expect(formatIsoDate({ year: 26, month: 3, day: 5 })).toBe("0026-03-05");
    });

    it("round-trips with parseIsoDate", () => {
      expect(formatIsoDate(parseIsoDate("2026-12-01")!)).toBe("2026-12-01");
    });
  });

  describe("daysInMonth", () => {
    it("knows month lengths and leap years", () => {
      expect(daysInMonth(2026, 1)).toBe(31);
      expect(daysInMonth(2026, 2)).toBe(28);
      expect(daysInMonth(2024, 2)).toBe(29);
      expect(daysInMonth(2026, 4)).toBe(30);
    });
  });

  describe("arithmetic", () => {
    it("addMonths clamps the day (Jan 31 → Feb 28)", () => {
      expect(addMonths({ year: 2026, month: 1, day: 31 }, 1)).toEqual({
        year: 2026,
        month: 2,
        day: 28,
      });
    });

    it("addMonths crosses year boundaries in both directions", () => {
      expect(addMonths({ year: 2026, month: 12, day: 10 }, 1)).toEqual({
        year: 2027,
        month: 1,
        day: 10,
      });
      expect(addMonths({ year: 2026, month: 1, day: 10 }, -1)).toEqual({
        year: 2025,
        month: 12,
        day: 10,
      });
    });

    it("addYears clamps Feb 29", () => {
      expect(addYears({ year: 2024, month: 2, day: 29 }, 1)).toEqual({
        year: 2025,
        month: 2,
        day: 28,
      });
    });

    it("addDays crosses months", () => {
      expect(addDays({ year: 2026, month: 1, day: 31 }, 1)).toEqual({
        year: 2026,
        month: 2,
        day: 1,
      });
    });
  });

  describe("comparison", () => {
    it("compareDates orders correctly", () => {
      const a = { year: 2026, month: 1, day: 1 };
      const b = { year: 2026, month: 1, day: 2 };
      expect(compareDates(a, b)).toBeLessThan(0);
      expect(compareDates(b, a)).toBeGreaterThan(0);
      expect(compareDates(a, a)).toBe(0);
      expect(isSameDay(a, { ...a })).toBe(true);
    });
  });

  describe("localized typing", () => {
    it("detects the locale part order", () => {
      expect(localeDateOrder("it-IT")).toEqual(["day", "month", "year"]);
      expect(localeDateOrder("en-US")).toEqual(["month", "day", "year"]);
    });

    it("parses day-first and month-first formats per locale", () => {
      expect(parseLocalizedDate("31/12/2026", "it-IT")).toEqual({
        year: 2026, month: 12, day: 31,
      });
      expect(parseLocalizedDate("12/31/2026", "en-US")).toEqual({
        year: 2026, month: 12, day: 31,
      });
      expect(parseLocalizedDate("31.12.2026", "de-DE")).toEqual({
        year: 2026, month: 12, day: 31,
      });
    });

    it("always accepts ISO and maps 2-digit years to 2000-2099", () => {
      expect(parseLocalizedDate("2026-12-31", "en-US")).toEqual({
        year: 2026, month: 12, day: 31,
      });
      expect(parseLocalizedDate("31/12/26", "it-IT")).toEqual({
        year: 2026, month: 12, day: 31,
      });
    });

    it("treats a 4-digit token as the year regardless of position", () => {
      expect(parseLocalizedDate("2026/12/31", "it-IT")).toEqual({
        year: 2026, month: 12, day: 31,
      });
    });

    it("rejects invalid calendar dates and garbage", () => {
      expect(parseLocalizedDate("31/02/2026", "it-IT")).toBeNull();
      expect(parseLocalizedDate("13/13/2026", "en-US")).toBeNull();
      expect(parseLocalizedDate("hello", "it-IT")).toBeNull();
      expect(parseLocalizedDate("1/2", "it-IT")).toBeNull();
      expect(parseLocalizedDate(null, "it-IT")).toBeNull();
    });
  });

  describe("buildMonthGrid", () => {
    it("returns 42 cells covering the whole month", () => {
      const grid = buildMonthGrid(2026, 7, 1);
      expect(grid).toHaveLength(42);
      const inMonth = grid.filter(
        (c) => c.date.month === 7 && c.date.year === 2026,
      );
      expect(inMonth).toHaveLength(31);
    });
  });
});
