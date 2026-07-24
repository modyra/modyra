/**
 * Structured TS writer (plan section 10 "AST/structured writer -> print"):
 * every target composes output from these primitives instead of hand-rolled
 * string templates for whole files (R10). Deterministic — same input always
 * prints the same text, required for the P8/P7 "deterministic" gate.
 */

const IDENTIFIER_RE = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

export function isValidIdentifier(name: string): boolean {
  return IDENTIFIER_RE.test(name);
}

/** A property key, quoted only when it is not already a valid bare identifier. */
export function printKey(key: string): string {
  return isValidIdentifier(key) ? key : JSON.stringify(key);
}

export function printString(value: string): string {
  return JSON.stringify(value);
}

/** A regex built from a portable pattern string — never a bare `/…/` literal, so no source-string escaping to get wrong. */
export function printRegExp(pattern: string): string {
  return `new RegExp(${JSON.stringify(pattern)})`;
}

function indentLines(body: string, indent: string): string {
  return body
    .split("\n")
    .map((line) => (line ? `${indent}${line}` : line))
    .join("\n");
}

export interface TsProp {
  key: string;
  value: string;
}

/**
 * `{ a: 1, b: 2 }` printed one property per line, indented — empty object
 * prints `{}`. Nesting needs no indent bookkeeping from the caller: pass a
 * child `printObject()`/`printArray()` result straight in as a prop value
 * and this cascades its own two-space indent onto every one of its lines.
 */
export function printObject(props: readonly TsProp[]): string {
  if (!props.length) return "{}";
  const body = props.map((p) => `${printKey(p.key)}: ${p.value},`).join("\n");
  return `{\n${indentLines(body, "  ")}\n}`;
}

/** `[a, b, c]` — one item per line when any item is multi-line, else stays inline. Nests the same way as {@link printObject}. */
export function printArray(items: readonly string[]): string {
  if (!items.length) return "[]";
  if (items.every((i) => !i.includes("\n")) && items.join(", ").length <= 80) {
    return `[${items.join(", ")}]`;
  }
  const body = items.map((i) => `${i},`).join("\n");
  return `[\n${indentLines(body, "  ")}\n]`;
}

export function printCall(callee: string, args: readonly string[]): string {
  return `${callee}(${args.join(", ")})`;
}
