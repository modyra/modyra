/**
 * Injection-prevention policy for untrusted field values.
 *
 * Form values are attacker-controlled more often than not: pasted text,
 * restored drafts (localStorage is writable by any script on the origin),
 * AI-generated payloads, API prefills. Modyra never renders values as HTML
 * (see SECURITY.md), but values still leak into places where invisible or
 * markup characters are dangerous: emails, PDF exports, logs, CSV files,
 * downstream systems that DO render HTML, and phishing-style UI spoofing
 * via bidi/zero-width characters.
 *
 * This module is the pure, zero-dependency heart of the feature: the form
 * engine wires it at the single write choke point (the field value signal)
 * so every entry path — user input, `patch`/`setValue`, draft restore,
 * array operations — is covered by construction.
 */

/** Built-in sanitization profiles, or a custom function. */
export type MdySanitizeProfile = "off" | "text" | "strict";

/**
 * Sanitizer for a field value:
 * - `"off"` — values pass through untouched (default);
 * - `"text"` — strips invisible/dangerous characters (control chars except
 *   `\t`/`\n`, DEL/C1, zero-width, bidi override/isolate, line/paragraph
 *   separators) from every string in the value. Prevents UI spoofing and
 *   log/CSV injection while preserving all legitimate text;
 * - `"strict"` — everything `"text"` does, plus removes `<`, `>` and
 *   backticks so the value can never form markup. For names, labels and
 *   identifiers that must stay plain text everywhere;
 * - a function — full control; receives the whole field value and returns
 *   the sanitized one. Must be pure and idempotent (it runs on every
 *   write). Keeps the core dependency-free: plug DOMPurify or any
 *   allow-list logic here.
 */
export type MdySanitizer = MdySanitizeProfile | ((value: unknown) => unknown);

/** What the security layer intercepted. */
export type MdySecurityViolationKind =
  /** A value was modified by the sanitizer (characters stripped). */
  | "sanitized"
  /** A string exceeded `maxValueLength` and was truncated. */
  | "max-length"
  /** A restored draft entry was dropped: its shape doesn't match the field. */
  | "draft-shape"
  /** A server error was dropped: its path is unsafe (prototype pollution). */
  | "error-path";

/** A single interception, reported through `MdySecurityPolicy.onViolation`. */
export interface MdySecurityViolation {
  readonly kind: MdySecurityViolationKind;
  /** Dotted field path the violation concerns ("" when form-level). */
  readonly path: string;
  /** Human-readable detail for logs/telemetry. */
  readonly detail: string;
}

/**
 * Form-level security policy. Sanitization is opt-in (`"off"` by default)
 * in 0.x to avoid breaking existing forms; it will become secure-by-default
 * at 1.0. The structural checks (draft shape, server-error paths) are
 * always on and not configurable — they only ever drop data that could
 * never have been produced by the form itself.
 */
export interface MdySecurityPolicy {
  /**
   * Default sanitizer for every field (overridable per field via
   * `field(initial, validators, { sanitize })`). Default `"off"`.
   */
  readonly sanitize?: MdySanitizer;
  /**
   * Maximum length for string values (anywhere inside the field value);
   * longer strings are truncated. Default: no cap.
   */
  readonly maxValueLength?: number;
  /**
   * Telemetry hook invoked for every interception. Errors thrown by the
   * callback are swallowed (reported as dev warnings) so a faulty hook
   * cannot break the form.
   */
  readonly onViolation?: (violation: MdySecurityViolation) => void;
}

/** Result of applying a sanitizer/length cap to a field value. */
export interface MdyValueSecurityResult {
  readonly value: unknown;
  /** What was done to the value — empty when it passed through unchanged. */
  readonly actions: ReadonlyArray<{
    readonly kind: "sanitized" | "max-length";
    readonly detail: string;
  }>;
}

// Control chars except \t \n, DEL+C1, zero-width, line/paragraph separators,
// bidi overrides and isolates.
const MDY_TEXT_STRIP_RE =
  // eslint-disable-next-line no-control-regex -- matching control characters is the whole point of this regex
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u200B-\u200D\u2028-\u202E\u2066-\u2069\uFEFF]/g;
const MDY_STRICT_EXTRA_RE = /[<>`]/g;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null) return false;
  const proto: unknown = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function stripProfileChars(text: string, profile: MdySanitizeProfile): string {
  let out = text.replace(MDY_TEXT_STRIP_RE, "");
  if (profile === "strict") {
    out = out.replace(MDY_STRICT_EXTRA_RE, "");
  }
  return out;
}

function truncateCodePoints(text: string, max: number): string {
  // Code-point aware so a surrogate pair is never split.
  return Array.from(text).slice(0, max).join("");
}

/**
 * Applies `fn` to every string inside `value` (deep through plain objects
 * and arrays, cycle-safe). Reference-preserving: when nothing changes the
 * original reference is returned, so signal identity checks keep working.
 */
function mapStringsDeep(
  value: unknown,
  fn: (text: string) => string,
  seen: WeakSet<object>,
): unknown {
  if (typeof value === "string") return fn(value);
  if (Array.isArray(value)) {
    if (seen.has(value)) return value;
    seen.add(value);
    let changed = false;
    const next = value.map(item => {
      const mapped = mapStringsDeep(item, fn, seen);
      if (!Object.is(mapped, item)) changed = true;
      return mapped;
    });
    return changed ? next : value;
  }
  if (isPlainObject(value)) {
    if (seen.has(value)) return value;
    seen.add(value);
    let changed = false;
    const next: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      const mapped = mapStringsDeep(item, fn, seen);
      if (!Object.is(mapped, item)) changed = true;
      next[key] = mapped;
    }
    return changed ? next : value;
  }
  return value;
}

/**
 * Applies a sanitizer and length cap to a field value — the pure unit the
 * engine calls on every write. Built-in profiles map over every string in
 * the value (deep); a custom sanitizer receives the whole value, then the
 * length cap is applied to its result.
 */
export function applyValueSecurity(
  value: unknown,
  options: {
    readonly sanitizer: MdySanitizer;
    readonly maxValueLength?: number;
  },
): MdyValueSecurityResult {
  const { sanitizer, maxValueLength } = options;
  const actions: Array<{
    kind: "sanitized" | "max-length";
    detail: string;
  }> = [];
  let out = value;

  if (typeof sanitizer === "function") {
    out = sanitizer(out);
    if (!Object.is(out, value)) {
      actions.push({
        kind: "sanitized",
        detail: "Custom sanitizer modified the value.",
      });
    }
  } else if (sanitizer !== "off") {
    const mapped = mapStringsDeep(
      out,
      text => stripProfileChars(text, sanitizer),
      new WeakSet(),
    );
    if (!Object.is(mapped, out)) {
      actions.push({
        kind: "sanitized",
        detail: `Profile "${sanitizer}" stripped invisible/markup characters.`,
      });
      out = mapped;
    }
  }

  if (maxValueLength !== undefined && maxValueLength >= 0) {
    const mapped = mapStringsDeep(
      out,
      (text) =>
        text.length > maxValueLength
          ? truncateCodePoints(text, maxValueLength)
          : text,
      new WeakSet(),
    );
    if (!Object.is(mapped, out)) {
      actions.push({
        kind: "max-length",
        detail: `String truncated to ${maxValueLength} characters.`,
      });
      out = mapped;
    }
  }

  return { value: out, actions };
}

/**
 * Shape check for restored draft entries: the stored value must be
 * type-compatible with the field's declared initial value. `null` is
 * always accepted (Modyra's empty sentinel); a `null` initial accepts any
 * JSON-shaped value (the field's type is unconstrained). Anything
 * reachable only from live objects (File/Blob, functions, class
 * instances) can never legitimately come back from a JSON draft.
 */
export function draftShapeMatches(initial: unknown, value: unknown): boolean {
  if (value === null) return true;
  if (initial === null || initial === undefined) {
    // Unknown type: accept JSON shapes only (no functions/symbols — though
    // JSON.parse cannot produce them, drafts may arrive from custom code).
    const t = typeof value;
    return (
      t === "string" || t === "number" || t === "boolean" ||
      Array.isArray(value) || isPlainObject(value)
    );
  }
  if (Array.isArray(initial)) return Array.isArray(value);
  if (isPlainObject(initial)) return isPlainObject(value);
  const t = typeof initial;
  if (t === "string" || t === "number" || t === "boolean") {
    return typeof value === t;
  }
  // File/Blob/Date/class instances: a JSON draft can never restore these.
  return false;
}
