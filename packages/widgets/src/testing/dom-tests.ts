/**
 * Runtime DOM conformance.
 *
 * The static audits in `scripts/` prove that an adapter *references* the contract; this proves
 * that what it actually rendered matches it. It takes real elements, so any adapter — Angular in
 * TestBed, Lit in jsdom, Plain anywhere — is held to the same gate.
 */
import { MDY_WIDGET_CONTRACTS, type MdyWidgetKind } from "../catalog.js";
import type { MdyPartContract } from "../contract.js";
import { MDY_FIELD_SHELL_CLASSES } from "../structure.js";
import { inspectWidgetStructure } from "./structure-tests.js";

export type MdyDomContractIssueCode =
  | "ROOT_CLASS_MISSING"
  | "PART_MISSING"
  | "PART_CLASS_MISSING"
  | "PART_NOT_CONTAINED"
  | "PART_ORDER"
  | "ARIA_DANGLING_REF"
  | "ARIA_NON_STRING_STATE"
  | "INVENTED_CLASS"
  | "STRUCTURE";

export interface MdyDomContractIssue {
  readonly code: MdyDomContractIssueCode;
  readonly part: string;
  readonly message: string;
}

/** Elements the adapter rendered for each contract part, in document order. */
export type MdyDomPartMap = Readonly<Record<string, Element | readonly Element[] | null | undefined>>;

export interface MdyDomContractOptions {
  /** Which element(s) materialize each part. Parts absent from the map are treated as not rendered. */
  readonly parts?: MdyDomPartMap;
  /** Parts legitimately not rendered in this state — a closed popup, an error list with no errors. */
  readonly absentParts?: readonly string[];
  /** Reject `mdy-*` classes that the contract does not define. Off by default while the
   * per-part class vocabulary is still being filled in from the Angular baseline. */
  readonly strictClasses?: boolean;
  /** Extra classes accepted under `strictClasses` — theme hooks the contract does not own. */
  readonly allowedClasses?: readonly string[];
}

const ARIA_BOOLEAN_STATES = new Set([
  "aria-checked", "aria-disabled", "aria-expanded", "aria-invalid", "aria-pressed",
  "aria-required", "aria-selected", "aria-hidden", "aria-busy", "aria-multiselectable", "aria-modal",
]);
const ARIA_REFERENCES = ["aria-describedby", "aria-labelledby", "aria-controls", "aria-activedescendant", "aria-owns"];

function toArray(value: Element | readonly Element[] | null | undefined): readonly Element[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value as Element];
}

function classesOf(element: Element): readonly string[] {
  return element.getAttribute("class")?.split(/\s+/).filter(Boolean) ?? [];
}

/** Canonical vocabulary for a kind: root classes, part classes, the shared shell, plus modifiers. */
function canonicalClasses(kind: MdyWidgetKind, extra: readonly string[]): ReadonlySet<string> {
  const definition = MDY_WIDGET_CONTRACTS[kind];
  const parts: readonly MdyPartContract[] = Object.values(definition.parts);
  return new Set([
    ...definition.rootClasses,
    ...parts.flatMap((part) => part.classes),
    ...Object.values(MDY_FIELD_SHELL_CLASSES),
    ...extra,
  ]);
}

function isModifierOf(className: string, canonical: ReadonlySet<string>): boolean {
  const base = className.split("--")[0];
  return base !== className && canonical.has(base);
}

/** Pure inspection: returns every way the rendered DOM departs from the contract. */
export function inspectWidgetDom(
  root: Element,
  kind: MdyWidgetKind,
  options: MdyDomContractOptions = {},
): readonly MdyDomContractIssue[] {
  const definition = MDY_WIDGET_CONTRACTS[kind];
  const issues: MdyDomContractIssue[] = [];
  for (const issue of inspectWidgetStructure(definition.structure)) {
    issues.push({ code: "STRUCTURE", part: issue.part, message: issue.message });
  }

  const rootClasses = new Set(classesOf(root));
  for (const className of definition.rootClasses) {
    if (!rootClasses.has(className)) {
      issues.push({ code: "ROOT_CLASS_MISSING", part: "root", message: `root must carry ${className}` });
    }
  }

  // A widget that owns an overlay may materialize it in a portal — the contract describes the
  // anatomy, not where the browser keeps the node — so the popup subtree is exempt from the
  // containment and ordering checks when it is rendered outside the root.
  const portalled = new Set<string>();
  if (definition.capabilities.overlay) {
    const parentOf = new Map(definition.structure.nodes.map((node) => [node.part as string, node.parent as string | undefined]));
    for (const node of definition.structure.nodes) {
      let cursor: string | undefined = node.part;
      while (cursor) {
        if (cursor === "popup") { portalled.add(node.part); break; }
        cursor = parentOf.get(cursor);
      }
    }
  }
  const isPortalled = (part: string, element: Element): boolean => portalled.has(part) && !root.contains(element);

  const parts = options.parts ?? {};
  const absent = new Set(options.absentParts ?? []);
  const resolved = new Map<string, readonly Element[]>();
  resolved.set("root", [root]);
  for (const [part, value] of Object.entries(parts)) resolved.set(part, toArray(value));

  for (const node of definition.structure.nodes) {
    if (node.part === "root" || absent.has(node.part)) continue;
    const elements = resolved.get(node.part) ?? [];
    if (elements.length === 0) {
      if (!node.optional) {
        issues.push({ code: "PART_MISSING", part: node.part, message: `required part ${node.part} was not rendered` });
      }
      continue;
    }
    const contract = definition.parts[node.part as keyof typeof definition.parts] as MdyPartContract | undefined;
    for (const element of elements) {
      const own = new Set(classesOf(element));
      for (const className of contract?.classes ?? []) {
        if (!own.has(className)) {
          issues.push({ code: "PART_CLASS_MISSING", part: node.part, message: `${node.part} must carry ${className}` });
        }
      }
    }
    const parentElements = node.parent ? resolved.get(node.parent) ?? [] : [root];
    const parent = parentElements[0];
    if (parent) {
      for (const element of elements) {
        if (isPortalled(node.part, element)) continue;
        if (element !== parent && !parent.contains(element)) {
          issues.push({ code: "PART_NOT_CONTAINED", part: node.part, message: `${node.part} must render inside ${node.parent ?? "root"}` });
        }
      }
    }
  }

  // Sibling order: parts sharing a parent must appear in the document in the contract's order.
  const byParent = new Map<string, { part: string; order: number; element: Element }[]>();
  for (const node of definition.structure.nodes) {
    const elements = resolved.get(node.part) ?? [];
    const element = elements[0];
    if (!element || node.part === "root" || isPortalled(node.part, element)) continue;
    const key = node.parent ?? "root";
    const siblings = byParent.get(key) ?? [];
    siblings.push({ part: node.part, order: node.order, element });
    byParent.set(key, siblings);
  }
  for (const siblings of byParent.values()) {
    const expected = [...siblings].sort((a, b) => a.order - b.order);
    for (let index = 1; index < expected.length; index += 1) {
      const previous = expected[index - 1];
      const current = expected[index];
      const position = previous.element.compareDocumentPosition(current.element);
      const follows = (position & 4) !== 0 || (position & 16) !== 0; // FOLLOWING or CONTAINED_BY
      if (!follows) {
        issues.push({ code: "PART_ORDER", part: current.part, message: `${current.part} must follow ${previous.part}` });
      }
    }
  }

  // ARIA is checked across the portal too: a reference that dangles outside the root is still a
  // broken reference.
  const portalRoots = new Set<Element>();
  for (const [part, elements] of resolved) {
    for (const element of elements) if (isPortalled(part, element)) portalRoots.add(element);
  }
  const scope: readonly Element[] = [
    root, ...Array.from(root.querySelectorAll("*")),
    ...[...portalRoots].flatMap((portal) => [portal, ...Array.from(portal.querySelectorAll("*"))]),
  ];
  for (const element of scope) {
    for (const attribute of ARIA_REFERENCES) {
      const value = element.getAttribute(attribute);
      if (!value) continue;
      for (const id of value.split(/\s+/).filter(Boolean)) {
        if (!root.ownerDocument?.getElementById(id)) {
          issues.push({ code: "ARIA_DANGLING_REF", part: "root", message: `${attribute} points at missing id ${id}` });
        }
      }
    }
    for (const state of ARIA_BOOLEAN_STATES) {
      const value = element.getAttribute(state);
      if (value === null) continue;
      if (value !== "true" && value !== "false" && !(state === "aria-invalid" && value === "grammar")) {
        issues.push({ code: "ARIA_NON_STRING_STATE", part: "root", message: `${state} must be "true" or "false", got ${JSON.stringify(value)}` });
      }
    }
  }

  if (options.strictClasses) {
    const canonical = canonicalClasses(kind, options.allowedClasses ?? []);
    for (const element of scope) {
      for (const className of classesOf(element)) {
        if (!className.startsWith("mdy-")) continue;
        if (canonical.has(className) || isModifierOf(className, canonical)) continue;
        issues.push({ code: "INVENTED_CLASS", part: "root", message: `${className} is not part of the ${kind} contract` });
      }
    }
  }

  return issues;
}

/** Throws one error listing every contract violation found in the rendered DOM. */
export function assertWidgetDomContract(
  root: Element,
  kind: MdyWidgetKind,
  options: MdyDomContractOptions = {},
): void {
  const issues = inspectWidgetDom(root, kind, options);
  if (issues.length === 0) return;
  throw new Error([`${kind} does not conform to the widget DOM contract:`,
    ...issues.map((issue) => `  ${issue.code} [${issue.part}]: ${issue.message}`)].join("\n"));
}
