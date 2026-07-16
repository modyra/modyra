import {
  formatTimeAs,
  parse24Time,
  parseAnyTime,
  to24Hour,
  angleToHour,
  angleToMinute,
  buildTimeString,
  formatTime,
  hourToAngle,
  minuteToAngle,
  parseTime,
} from "./time-utils";

describe("time-utils", () => {
  describe("parseTime", () => {
    it("parses canonical values", () => {
      expect(parseTime("09:30 AM")).toEqual({ hour: 9, minute: 30, period: "AM" });
      expect(parseTime("12:00 PM")).toEqual({ hour: 12, minute: 0, period: "PM" });
      expect(parseTime("1:05 pm")).toEqual({ hour: 1, minute: 5, period: "PM" });
    });

    it("rejects hour 0 — the 12h model has hours 1-12 only (B23)", () => {
      expect(parseTime("00:30 AM")).toBeNull();
      expect(parseTime("0:30 AM")).toBeNull();
    });

    it("rejects invalid input", () => {
      expect(parseTime(null)).toBeNull();
      expect(parseTime("")).toBeNull();
      expect(parseTime("13:00 AM")).toBeNull();
      expect(parseTime("10:60 AM")).toBeNull();
      expect(parseTime("10:15")).toBeNull();
    });
  });

  describe("formatTime / buildTimeString", () => {
    it("round-trips with parseTime", () => {
      const t = parseTime("07:05 PM")!;
      expect(formatTime(t)).toBe("07:05 PM");
    });

    it("pads and defaults safely", () => {
      expect(buildTimeString(9, 5, "AM")).toBe("09:05 AM");
      expect(buildTimeString("bad", "worse", "PM")).toBe("12:00 PM");
    });
  });

  describe("angles", () => {
    it("maps hours and minutes to dial angles", () => {
      expect(hourToAngle(12)).toBe(0);
      expect(hourToAngle(3)).toBe(90);
      expect(minuteToAngle(15)).toBe(90);
      expect(minuteToAngle(0)).toBe(0);
    });

    it("snaps angles back to hours/minutes with wrap", () => {
      expect(angleToHour(0)).toBe(12);
      expect(angleToHour(359)).toBe(12);
      expect(angleToHour(90)).toBe(3);
      expect(angleToMinute(0)).toBe(0);
      expect(angleToMinute(359)).toBe(0);
      expect(angleToMinute(90)).toBe(15);
      expect(angleToMinute(-6)).toBe(59);
    });
  });

  describe("24-hour format", () => {
    it("parse24Time accepts 00-23 and rejects the rest", () => {
      expect(parse24Time("00:00")).toEqual({ hour: 12, minute: 0, period: "AM" });
      expect(parse24Time("14:30")).toEqual({ hour: 2, minute: 30, period: "PM" });
      expect(parse24Time("23:59")).toEqual({ hour: 11, minute: 59, period: "PM" });
      expect(parse24Time("9:05")).toEqual({ hour: 9, minute: 5, period: "AM" });
      expect(parse24Time("24:00")).toBeNull();
      expect(parse24Time("12:60")).toBeNull();
      expect(parse24Time("02:30 PM")).toBeNull();
      expect(parse24Time(null)).toBeNull();
    });

    it("to24Hour converts noon and midnight correctly", () => {
      expect(to24Hour({ hour: 12, minute: 0, period: "AM" })).toBe(0);
      expect(to24Hour({ hour: 12, minute: 0, period: "PM" })).toBe(12);
      expect(to24Hour({ hour: 2, minute: 30, period: "PM" })).toBe(14);
      expect(to24Hour({ hour: 9, minute: 0, period: "AM" })).toBe(9);
    });

    it("formatTimeAs round-trips both formats", () => {
      const t = { hour: 2, minute: 5, period: "PM" } as const;
      expect(formatTimeAs(t, "12h")).toBe("02:05 PM");
      expect(formatTimeAs(t, "24h")).toBe("14:05");
      expect(parseAnyTime("14:05", "24h")).toEqual(t);
      expect(parseAnyTime("02:05 PM", "12h")).toEqual(t);
    });
  });
});
