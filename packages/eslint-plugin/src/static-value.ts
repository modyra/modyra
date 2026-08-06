/**
 * Reconstructs the value a source literal denotes, reading syntax only.
 *
 * Nothing here executes, resolves or imports anything: an identifier, a call, a member access or a
 * spread is reported as unknown rather than followed. The rules run in an editor over whatever
 * repository is open, so a reconstruction that ran code would execute a stranger's source on file
 * open. The contract is data at runtime and it is data here too.
 *
 * The whole document is refused when any part of it is unknown. A half-known document produces
 * findings about absences that are not absences — a layout slot naming a field that is only missing
 * because the `fields` array came from a variable — and one false report is enough for a consumer
 * to switch the rule off, after which it protects nobody.
 */

/** A syntax node, read structurally: ESLint ships no node types and only these members are used. */
export type EsNode = { readonly type: string } & Readonly<Record<string, unknown>>;

/** Returned in place of a value the syntax does not state. */
export const UNKNOWN: unique symbol = Symbol("modyra.unknown");

export const isUnknown = (value: unknown): boolean => value === UNKNOWN;

const asNode = (value: unknown): EsNode | undefined =>
  typeof value === "object" && value !== null && typeof (value as { type?: unknown }).type === "string"
    ? (value as EsNode)
    : undefined;

const asNodes = (value: unknown): ReadonlyArray<unknown> | undefined =>
  Array.isArray(value) ? value : undefined;

/** The name a non-computed property key states, or undefined when the key is an expression. */
export const propertyKey = (property: EsNode): string | undefined => {
  if (property["computed"] === true) return undefined;
  const key = asNode(property["key"]);
  if (!key) return undefined;
  if (key.type === "Identifier" && typeof key["name"] === "string") return key["name"];
  if (key.type === "Literal" && (typeof key["value"] === "string" || typeof key["value"] === "number")) {
    return String(key["value"]);
  }
  return undefined;
};

/**
 * Type-only wrappers change what the compiler believes and not what the expression denotes, so the
 * value is read straight through them.
 */
const TYPE_WRAPPERS = new Set([
  "TSAsExpression",
  "TSSatisfiesExpression",
  "TSNonNullExpression",
  "TSInstantiationExpression",
  "TSTypeAssertion",
]);

export const unwrapTypeOnly = (node: EsNode): EsNode => {
  let current = node;
  while (TYPE_WRAPPERS.has(current.type)) {
    const inner = asNode(current["expression"]);
    if (!inner) return current;
    current = inner;
  }
  return current;
};

/** The value the syntax states, or {@link UNKNOWN}. */
export const evaluate = (input: EsNode | undefined): unknown => {
  if (!input) return UNKNOWN;
  const node = unwrapTypeOnly(input);

  switch (node.type) {
    case "Literal": {
      // A regexp or a bigint is a literal the contract has no representation for; treating either
      // as its `value` would hand the parser something it never receives from JSON.
      if (node["regex"] !== undefined || node["bigint"] !== undefined) return UNKNOWN;
      return node["value"];
    }

    case "TemplateLiteral": {
      const expressions = asNodes(node["expressions"]) ?? [];
      const quasis = asNodes(node["quasis"]) ?? [];
      if (expressions.length > 0 || quasis.length !== 1) return UNKNOWN;
      const cooked = asNode(quasis[0])?.["value"];
      const text = (cooked as { cooked?: unknown } | undefined)?.cooked;
      return typeof text === "string" ? text : UNKNOWN;
    }

    case "Identifier":
      return node["name"] === "undefined" ? undefined : UNKNOWN;

    case "UnaryExpression": {
      if (node["operator"] !== "-" && node["operator"] !== "+") return UNKNOWN;
      const argument = evaluate(asNode(node["argument"]));
      if (typeof argument !== "number") return UNKNOWN;
      return node["operator"] === "-" ? -argument : argument;
    }

    case "ArrayExpression": {
      const elements = asNodes(node["elements"]);
      if (!elements) return UNKNOWN;
      const out: unknown[] = [];
      for (const raw of elements) {
        // A hole states no value, and a spread names a source this pass will not follow.
        const element = asNode(raw);
        if (!element || element.type === "SpreadElement") return UNKNOWN;
        const value = evaluate(element);
        if (isUnknown(value)) return UNKNOWN;
        out.push(value);
      }
      return out;
    }

    case "ObjectExpression": {
      const properties = asNodes(node["properties"]);
      if (!properties) return UNKNOWN;
      const out: Record<string, unknown> = {};
      for (const raw of properties) {
        const property = asNode(raw);
        if (!property || property.type !== "Property" || property["kind"] !== "init") return UNKNOWN;
        const key = propertyKey(property);
        if (key === undefined) return UNKNOWN;
        const value = evaluate(asNode(property["value"]));
        if (isUnknown(value)) return UNKNOWN;
        out[key] = value;
      }
      return out;
    }

    default:
      return UNKNOWN;
  }
};

/**
 * Walks a diagnostic's path back to the syntax that produced it.
 *
 * The segments are used as the parser wrote them. The parser builds a path by joining raw keys, so
 * unescaping here would decode something that was never encoded, and a segment that fails to
 * resolve costs only precision: the deepest node reached is reported instead, which is always an
 * ancestor of the real one.
 */
export const resolvePath = (root: EsNode, path: string): EsNode => {
  const segments = path.split("/").filter((segment) => segment !== "");
  /** What the segments have reached so far, and what a caller would underline. */
  let report: EsNode = root;
  /** The same node with type-only wrappers removed, which is what the next segment reads. */
  let container: EsNode = unwrapTypeOnly(root);

  for (const segment of segments) {
    if (container.type === "ObjectExpression") {
      const match = (asNodes(container["properties"]) ?? [])
        .map(asNode)
        .find((property) => property?.type === "Property" && propertyKey(property) === segment);
      const value = match ? asNode(match["value"]) : undefined;
      if (!match || !value) return report;
      // The property spans `key: value`, so underlining it shows the name the author wrote and not
      // only what it was set to.
      report = match;
      container = unwrapTypeOnly(value);
      continue;
    }

    if (container.type === "ArrayExpression") {
      const index = Number(segment);
      if (!Number.isInteger(index) || index < 0) return report;
      const element = asNode((asNodes(container["elements"]) ?? [])[index]);
      if (!element) return report;
      report = element;
      container = unwrapTypeOnly(element);
      continue;
    }

    return report;
  }

  return report;
};
