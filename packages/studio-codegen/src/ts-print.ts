
const IDENTIFIER_RE = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

/**
 * Words a **declaration** may not be called, though an identifier may be shaped like one.
 *
 * Every reserved word has an identifier's shape, so a check that asks only about shape says `class`
 * is a name — and `export function class(…)` is a module that does not compile. The names this
 * catches are not exotic ones: `default` is what someone calls the fallback rule, `import` the one
 * that runs on an imported row, `new` the one for a new record.
 *
 * Module context, which is what is generated: `await` is reserved there and not in a sloppy script,
 * and `let`, `static`, `yield` and the rest are reserved under strict mode, which a module always
 * is. The TypeScript-only soft keywords — `type`, `as`, `satisfies` — are absent deliberately: they
 * are legal declaration names and refusing them would rename code that compiles.
 */
const RESERVED = new Set([
  "await", "break", "case", "catch", "class", "const", "continue", "debugger", "default", "delete",
  "do", "else", "enum", "export", "extends", "false", "finally", "for", "function", "if",
  "implements", "import", "in", "instanceof", "interface", "let", "new", "null", "package",
  "private", "protected", "public", "return", "static", "super", "switch", "this", "throw", "true",
  "try", "typeof", "var", "void", "while", "with", "yield",
]);

/**
 * Whether `name` has an identifier's shape.
 *
 * Shape only, which is the right question for a **property key**: `{ class: 1 }` is legal and
 * quoting it would be noise. A name being declared is a different question — {@link
 * isValidBindingName}.
 */
export function isValidIdentifier(name: string): boolean {
  return IDENTIFIER_RE.test(name);
}

/** Whether `name` can be the name of something declared: an identifier's shape, and not reserved. */
export function isValidBindingName(name: string): boolean {
  return IDENTIFIER_RE.test(name) && !RESERVED.has(name);
}

/** A name a declaration can carry, derived from one it cannot. */
export function toBindingName(raw: string): string {
  const cleaned = raw.replace(/[^A-Za-z0-9_$]/g, "_").replace(/^[0-9]/, "_$&");
  if (cleaned.length === 0) return "impl";
  // Prefixed rather than suffixed, which is what a leading digit already gets: one repair, one shape
  // to recognise, and the original word stays readable in the name.
  return RESERVED.has(cleaned) ? `_${cleaned}` : cleaned;
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
