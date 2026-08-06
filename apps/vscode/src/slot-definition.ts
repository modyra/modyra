import { findNodeAtOffset, parseTree, type Node } from "jsonc-parser";

/**
 * Resolves a field name written somewhere in a contract to where that field is declared.
 *
 * A layout places fields by name, and a rule and a validation name them too. Following one by eye
 * means scrolling to the `fields` array and reading down it, which is exactly the work an editor
 * exists to do.
 *
 * What counts as a reference is decided by the document rather than by a list of paths kept here: a
 * string that matches a declared field name is a reference to it, wherever it sits. The exception is
 * the content-bearing keys, where a match is a coincidence — a label reading "email" is not a
 * pointer to the `email` field. Being wrong here costs an offered jump, never a diagnostic.
 */

/** Where a declaration sits in the source text. */
export interface Declaration {
  readonly offset: number;
  readonly length: number;
}

/** Keys whose string value is prose or an identifier of its own, never a field reference. */
const CONTENT_KEYS = new Set(["label", "message", "placeholder", "id", "kind", "node", "operator", "effect"]);

const keyOf = (node: Node): string | undefined => {
  const property = node.parent;
  if (property?.type !== "property") return undefined;
  const key = property.children?.[0];
  return typeof key?.value === "string" ? key.value : undefined;
};

/** The `name` property of a field object declaring `fieldName`, searched depth-first. */
const findDeclaration = (node: Node | undefined, fieldName: string): Declaration | undefined => {
  if (!node) return undefined;

  if (node.type === "object") {
    const properties = node.children ?? [];
    const named = properties.find((property) => property.children?.[0]?.value === "name");
    const value = named?.children?.[1];
    // A `kind` beside it is what makes the object a field rather than anything else that happens to
    // carry a name — an option, a section, a project node.
    const isField = properties.some((property) => property.children?.[0]?.value === "kind");
    if (isField && value?.value === fieldName && typeof value.offset === "number") {
      return { offset: value.offset, length: value.length };
    }
  }

  for (const child of node.children ?? []) {
    const found = findDeclaration(child, fieldName);
    if (found) return found;
  }
  return undefined;
};

/**
 * Where the field named at `offset` is declared, or undefined when the cursor is not on a reference
 * or the name matches nothing.
 */
export const declarationAt = (text: string, offset: number): Declaration | undefined => {
  const root = parseTree(text);
  if (!root) return undefined;

  const node = findNodeAtOffset(root, offset);
  if (!node || node.type !== "string" || typeof node.value !== "string") return undefined;

  const key = keyOf(node);
  if (key !== undefined && CONTENT_KEYS.has(key)) return undefined;

  const declaration = findDeclaration(root, node.value);
  // Standing on the declaration itself and being sent to it is a jump that goes nowhere.
  if (!declaration || declaration.offset === node.offset) return undefined;
  return declaration;
};
