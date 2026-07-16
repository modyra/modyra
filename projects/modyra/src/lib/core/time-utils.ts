/**
 * Pure utility functions for 12-hour time string manipulation.
 *
 * Time values are represented as `"HH:MM AM/PM"` strings.
 * All helpers are side-effect-free and return new values.
 */

export interface ParsedTime {
  readonly hour: number;   // 1-12
  readonly minute: number; // 0-59
  readonly period: 'AM' | 'PM';
}

const TIME_RE = /^(\d{1,2}):(\d{2})\s?(AM|PM)$/i;

// ── Parsing / Formatting ─────────────────────────────────────────────────────

/** Parse a `"HH:MM AM/PM"` string. Returns `null` on invalid input. */
export function parseTime(value: string | null | undefined): ParsedTime | null {
  if (!value) return null;
  const m = TIME_RE.exec(value);
  if (!m) return null;
  const hour   = Number(m[1]);
  const minute = Number(m[2]);
  const period = m[3]!.toUpperCase() as 'AM' | 'PM';
  if (hour < 1 || hour > 12 || minute < 0 || minute > 59) return null;
  return { hour, minute, period };
}

/** Format a `ParsedTime` to a canonical `"HH:MM AM"` string. */
export function formatTime(t: ParsedTime): string {
  return `${String(t.hour).padStart(2, '0')}:${String(t.minute).padStart(2, '0')} ${t.period}`;
}

/** Display/value format for the timepicker. */
export type MdyTimeFormat = '12h' | '24h';

const TIME24_RE = /^([01]?\d|2[0-3]):([0-5]\d)$/;

/** 0-23 hour of a parsed time. */
export function to24Hour(t: ParsedTime): number {
  return (t.hour % 12) + (t.period === 'PM' ? 12 : 0);
}

/** Parse a 24-hour `"HH:mm"` string (00-23). Returns `null` on invalid input. */
export function parse24Time(value: string | null | undefined): ParsedTime | null {
  if (!value) return null;
  const m = TIME24_RE.exec(value.trim());
  if (!m) return null;
  const hour24 = Number(m[1]);
  const minute = Number(m[2]);
  const period: 'AM' | 'PM' = hour24 >= 12 ? 'PM' : 'AM';
  const hour = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return { hour, minute, period };
}

/** Parse a time string in the given format. */
export function parseAnyTime(
  value: string | null | undefined,
  format: MdyTimeFormat,
): ParsedTime | null {
  return format === '24h' ? parse24Time(value) : parseTime(value);
}

/** Format a `ParsedTime` in the given format (`"02:30 PM"` / `"14:30"`). */
export function formatTimeAs(t: ParsedTime, format: MdyTimeFormat): string {
  if (format === '12h') return formatTime(t);
  return `${String(to24Hour(t)).padStart(2, '0')}:${String(t.minute).padStart(2, '0')}`;
}

/** Build a formatted time string from parts, with safe defaults. */
export function buildTimeString(
  hour: number | string,
  minute: number | string,
  period: 'AM' | 'PM',
): string {
  const h = typeof hour   === 'number' ? hour   : parseInt(hour,   10) || 12;
  const m = typeof minute === 'number' ? minute : parseInt(minute, 10) || 0;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} ${period}`;
}

/** Get the current system time in "HH:MM AM/PM" format. */
export function getCurrentTime(): string {
  const now = new Date();
  let hour = now.getHours();
  const minute = now.getMinutes();
  const period = hour >= 12 ? 'PM' : 'AM';
  
  hour = hour % 12;
  if (hour === 0) hour = 12;
  
  return buildTimeString(hour, minute, period);
}

// ── Angle / Selection helpers ─────────────────────────────────────────────────

/** Convert an hour (1–12) to a dial angle in degrees (0 = 12 o'clock). */
export function hourToAngle(hour: number): number {
  return (hour % 12) * 30;
}

/** Convert a minute (0–59) to a dial angle in degrees (0 = 12 o'clock). */
export function minuteToAngle(minute: number): number {
  return minute * 6;
}

/**
 * Snap an arbitrary angle to the nearest hour position.
 * Returns hours 1–12. Handles 360°/0° wrap gracefully.
 */
export function angleToHour(angle: number): number {
  // Normalise to [0, 360)
  let a = ((angle % 360) + 360) % 360;
  let h = Math.round(a / 30) % 12;
  return h === 0 ? 12 : h;
}

/**
 * Snap an arbitrary angle to the nearest minute.
 * Returns minutes 0–59. Handles 360°/0° wrap gracefully.
 */
export function angleToMinute(angle: number): number {
  let a = ((angle % 360) + 360) % 360;
  let m = Math.round(a / 6) % 60;
  return m;
}

/**
 * Calculate the angle (0–360°, 0 = 12 o'clock, clockwise) from the center
 * of an element to a pointer event's coordinates.
 */
export function pointerAngle(
  rect: DOMRect,
  clientX: number,
  clientY: number,
): number {
  const cx = rect.left + rect.width  / 2;
  const cy = rect.top  + rect.height / 2;
  let theta = Math.atan2(clientY - cy, clientX - cx) * (180 / Math.PI);
  theta += 90;          // shift: 3 o'clock → 12 o'clock is 0
  if (theta < 0) theta += 360;
  return theta;
}

/**
 * Extract touch or mouse coordinates from an event.
 * Returns `null` if the event has no touches (e.g. touchend with 0 touches).
 */
export function getPointerCoords(
  event: MouseEvent | TouchEvent,
): { clientX: number; clientY: number } | null {
  if (typeof TouchEvent !== 'undefined' && event instanceof TouchEvent) {
    const touch = event.touches[0] ?? event.changedTouches[0];
    if (!touch) return null;
    return { clientX: touch.clientX, clientY: touch.clientY };
  }
  const me = event as MouseEvent;
  return { clientX: me.clientX, clientY: me.clientY };
}
