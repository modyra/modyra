/**
 * Runtime DOM conformance.
 *
 * The static audits in `scripts/` prove that an adapter *references* the contract; this proves
 * that what it actually rendered matches it. It takes real elements, so any adapter — Angular in
 * TestBed, Lit in jsdom, Plain anywhere — is held to the same gate.
 */
import { MDY_POPUP_OPENERS, MDY_WIDGET_CONTRACTS, type MdyWidgetKind } from "../catalog.js";
import type { MdyPartContract } from "../contract.js";
import { MDY_FIELD_SHELL_CLASSES, MDY_FIELD_STATE_CLASSES, MDY_SHARED_UI_CLASSES } from "../structure.js";
import { inspectWidgetStructure } from "./structure-tests.js";

export type MdyDomContractIssueCode =
  | "ROOT_CLASS_MISSING"
  | "ABSENT_PART_NOT_OPTIONAL"
  | "ABSENT_PART_PRESENT"
  | "PART_MISSING"
  | "PART_CARDINALITY"
  | "PART_ELEMENT"
  | "PART_CLASS_MISSING"
  | "PART_NOT_CONTAINED"
  | "PART_ORDER"
  | "ARIA_DANGLING_REF"
  | "ARIA_AMBIGUOUS_REF"
  | "ARIA_FOREIGN_REF"
  | "ARIA_STATE_INCOHERENT"
  | "ARIA_STATE_NOT_APPLIED"
  | "ID_DUPLICATE"
  | "PART_NOT_OWNED"
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
  /**
   * Parts legitimately not rendered in this state — a closed popup, an error list with no errors.
   *
   * This is a fixture describing a state, not a silencer. Naming a part the contract declares
   * mandatory is itself a violation, and so is naming a part that is still in the DOM: an adapter
   * does not get to decide what the contract requires of it.
   */
  readonly absentParts?: readonly string[];
  /**
   * How many elements each part must have in this state, for parts the contract lets repeat.
   * The contract knows a part repeats; only the caller knows the state has three options and not
   * one, so the count comes from here and the *DOM* is what answers it — not the part map, which
   * is the adapter restating its own claim.
   */
  readonly counts?: Readonly<Record<string, number>>;
  /** Reject `mdy-*` classes that the contract does not define. Off by default while the
   * per-part class vocabulary is still being filled in from the Angular baseline. */
  readonly strictClasses?: boolean;
  /** Extra classes accepted under `strictClasses` — theme hooks the contract does not own. */
  readonly allowedClasses?: readonly string[];
  /**
   * Prefix an adapter uses to namespace classes of its own, such as `mdy-plain-`.
   *
   * A renderer may need a hook the contract has no opinion on. Namespacing it is what keeps that
   * distinguishable from inventing a contract class, and the prefix is declared rather than the
   * individual names so the check stays a rule instead of a list.
   */
  readonly adapterPrefix?: string;
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

/** Class names are contract-authored, but they still reach `querySelector` — escape them. */
function CSS_ESCAPE(value: string): string {
  return value.replace(/[^\w-]/g, (character) => `\\${character}`);
}

function classesOf(element: Element): readonly string[] {
  return element.getAttribute("class")?.split(/\s+/).filter(Boolean) ?? [];
}

/**
 * What each semantic element in the catalog admits. A part may satisfy its element by tag or by an
 * explicit role — a `div role="textbox"` is a control, and refusing it would forbid every composite
 * widget — but it may not satisfy it by carrying the right class and nothing else, which is what
 * the contract allowed until now.
 *
 * `undefined` means the catalog declares no semantics for that element: a wrapper, a run of text.
 * Those are listed rather than defaulted, so an element name nobody thought about fails loudly
 * instead of silently admitting everything.
 */
const SEMANTIC_ELEMENTS: Readonly<Record<string, { tags: readonly string[]; roles: readonly string[] } | undefined>> = Object.freeze({
  root: undefined,
  group: undefined,
  text: undefined,
  presentation: undefined,
  label: { tags: ["label"], roles: [] },
  input: {
    tags: ["input", "textarea", "select"],
    roles: ["textbox", "searchbox", "combobox", "spinbutton", "slider", "checkbox", "radio", "switch"],
  },
  button: { tags: ["button"], roles: ["button", "switch"] },
  listbox: { tags: ["select"], roles: ["listbox", "grid"] },
  option: { tags: ["option"], roles: ["option", "gridcell"] },
  dialog: { tags: ["dialog"], roles: ["dialog", "alertdialog"] },
  // A popup is a positioning container. Its accessible semantics live on what it *contains* — the
  // listbox, the grid, the dialog — so constraining the box itself would only force a role that
  // says nothing. Declared unconstrained rather than left to fall through, so the omission is a
  // decision on the record. A real check on what a popup contains belongs with task 08.
  popup: undefined,
  grid: { tags: ["table"], roles: ["grid", "rowgroup", "presentation", "none"] },
  gridcell: { tags: ["td", "th"], roles: ["gridcell", "button"] },
  // A run of errors is a list, an inline error is a span, a loading note is a paragraph. Named
  // rather than widened to "anything": this still rejects a control, a button or a bare div.
  status: { tags: ["output", "ul", "ol", "li", "p", "span"], roles: ["status", "alert", "log", "list", "listitem"] },
});

/** An `input[type=button]` is a button; a bare `input` is a control. Tags alone cannot say so. */
function satisfiesSemanticElement(element: Element, semantic: string): boolean {
  const allowed = SEMANTIC_ELEMENTS[semantic];
  if (!allowed) return true;
  const tag = element.tagName.toLowerCase();
  const role = element.getAttribute("role");
  if (role && allowed.roles.includes(role)) return true;
  if (role) return false; // An explicit, non-matching role is a claim, and it is the wrong one.
  if (semantic === "button" && tag === "input") {
    return ["button", "submit", "reset", "image"].includes(element.getAttribute("type") ?? "");
  }
  if (semantic === "input" && tag === "input") {
    return !["button", "submit", "reset", "image"].includes(element.getAttribute("type") ?? "");
  }
  return allowed.tags.includes(tag);
}

/** Canonical vocabulary for a kind: root classes, part classes, the shared shell, plus modifiers. */
function canonicalClasses(kind: MdyWidgetKind, extra: readonly string[]): ReadonlySet<string> {
  const definition = MDY_WIDGET_CONTRACTS[kind];
  const parts: readonly MdyPartContract[] = Object.values(definition.parts);
  const S = MDY_FIELD_STATE_CLASSES;
  return new Set([
    ...definition.rootClasses,
    ...parts.flatMap((part) => part.classes),
    ...Object.values(MDY_FIELD_SHELL_CLASSES),
    // The vocabulary the projections emit. It is contract data too, and leaving it out made the
    // contract flag classes it produces itself.
    S.field,
    ...S.fieldStates.map((state) => `${S.field}--${state}`),
    S.control,
    ...S.controlStates.map((state) => `${S.control}--${state}`),
    S.rendererOpen,
    // Structure the themes style that the kind declares but does not make a part of its anatomy,
    // and the classes that belong to no single widget.
    ...definition.presentationClasses,
    ...MDY_SHARED_UI_CLASSES,
    ...extra,
  ]);
}

/**
 * Which modifiers each canonical base may carry, from the states its part declares.
 *
 * A part's `states` exist to make the classes it can ever carry finite and knowable, which is what
 * lets a theme enumerate them. A base with no declared states is unconstrained: the vocabulary is
 * still being filled in, and refusing every modifier on an undeclared base would reject the classes
 * the renderers legitimately use today.
 */
function declaredModifiers(kind: MdyWidgetKind): ReadonlyMap<string, ReadonlySet<string>> {
  const definition = MDY_WIDGET_CONTRACTS[kind];
  const byBase = new Map<string, Set<string>>();
  for (const part of Object.values(definition.parts) as readonly MdyPartContract[]) {
    if (!part.states?.length) continue;
    for (const className of part.classes) {
      const known = byBase.get(className) ?? new Set<string>();
      for (const state of part.states) known.add(state);
      byBase.set(className, known);
    }
  }
  return byBase;
}

function isModifierOf(
  className: string,
  canonical: ReadonlySet<string>,
  declared: ReadonlyMap<string, ReadonlySet<string>>,
): boolean {
  const base = className.split("--")[0];
  if (base === className || !canonical.has(base)) return false;
  const allowed = declared.get(base);
  return allowed ? allowed.has(className.slice(base.length + 2)) : true;
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

  // A portalled popup lives outside the root, so anything that searches the DOM has to look there
  // too — otherwise a part is "missing" purely because the browser moved it.
  const portalRoots = new Set<Element>();
  for (const [part, elements] of resolved) {
    for (const element of elements) if (isPortalled(part, element)) portalRoots.add(element);
  }
  const searchScope: readonly Element[] = [root, ...portalRoots];

  // The caller's map is an override, not the definition of what exists. A part it does not name is
  // looked up by the classes the contract gives it, over the same scope every other check uses, so a
  // rendered part is inspected whether or not the caller thought to mention it. Without this an
  // optional part could sit on screen with its element, classes, containment and order unchecked,
  // and a caller could silence any check by omission.
  for (const node of definition.structure.nodes) {
    if (node.part === "root" || resolved.has(node.part) || absent.has(node.part)) continue;
    const contract = definition.parts[node.part as keyof typeof definition.parts] as MdyPartContract | undefined;
    const selector = (contract?.classes ?? []).map((className) => `.${CSS_ESCAPE(className)}`).join("");
    if (!selector) continue;
    const found = searchScope.flatMap((container) => Array.from(container.querySelectorAll(selector)));
    if (found.length > 0) resolved.set(node.part, found);
  }

  for (const node of definition.structure.nodes) {
    if (node.part === "root") continue;
    if (absent.has(node.part)) {
      // The contract decides what may be missing. A caller naming a mandatory part is claiming a
      // state the contract does not have.
      if (!node.optional) {
        issues.push({
          code: "ABSENT_PART_NOT_OPTIONAL",
          part: node.part,
          message: `${node.part} is required by the ${kind} contract and cannot be declared absent`,
        });
        continue;
      }
      // And a part declared absent has to actually be gone — otherwise "absent" is just a word
      // that turns off the checks for whatever is still on the screen.
      const claimed = resolved.get(node.part) ?? [];
      const contract = definition.parts[node.part as keyof typeof definition.parts] as MdyPartContract | undefined;
      // All of the part's classes, not any: `chip` is `.mdy-chip.mdy-chip--value` and `option` is
      // `.mdy-chip`, so matching on one of them finds every option and calls it a chip.
      const selector = (contract?.classes ?? []).map((className) => `.${CSS_ESCAPE(className)}`).join("");
      const found = claimed.length > 0
        ? claimed
        : selector
          ? Array.from(root.querySelectorAll(selector))
          : [];
      if (found.length > 0) {
        issues.push({
          code: "ABSENT_PART_PRESENT",
          part: node.part,
          message: `${node.part} was declared absent but ${found.length} element(s) for it are in the DOM`,
        });
      }
      continue;
    }
    const elements = resolved.get(node.part) ?? [];
    if (elements.length === 0) {
      if (!node.optional) {
        issues.push({ code: "PART_MISSING", part: node.part, message: `required part ${node.part} was not rendered` });
      }
      continue;
    }
    const contract = definition.parts[node.part as keyof typeof definition.parts] as MdyPartContract | undefined;

    // A part the contract does not mark `repeated` is singular: two of them is not a richer
    // rendering, it is an ambiguous one, and every later check would silently pick the first.
    if (!node.repeated && elements.length > 1) {
      issues.push({
        code: "PART_CARDINALITY",
        part: node.part,
        message: `${node.part} is singular in the ${kind} contract but ${elements.length} were rendered`,
      });
    }

    const expected = options.counts?.[node.part];
    if (expected !== undefined) {
      // Count the DOM, not the map. A part with classes can be counted for real; one without has
      // nothing to search on, so the map is all there is.
      const selector = (contract?.classes ?? []).map((className) => `.${CSS_ESCAPE(className)}`).join("");
      const actual = selector
        ? searchScope.reduce(
            (total, container) => total + container.querySelectorAll(selector).length,
            0,
          )
        : elements.length;
      if (actual !== expected) {
        issues.push({
          code: "PART_CARDINALITY",
          part: node.part,
          message: `${node.part} was declared to have ${expected} element(s), the DOM has ${actual}`,
        });
      }
    }

    for (const element of elements) {
      if (!satisfiesSemanticElement(element, node.element as string)) {
        issues.push({
          code: "PART_ELEMENT",
          part: node.part,
          message: `${node.part} must be a ${node.element}, got <${element.tagName.toLowerCase()}>` +
            `${element.getAttribute("role") ? ` role="${element.getAttribute("role")}"` : ""}`,
        });
      }
      const own = new Set(classesOf(element));
      for (const className of contract?.classes ?? []) {
        if (!own.has(className)) {
          issues.push({ code: "PART_CLASS_MISSING", part: node.part, message: `${node.part} must carry ${className}` });
        }
      }
    }
    const parentElements = node.parent ? resolved.get(node.parent) ?? [] : [root];
    // Any of them, not the first: a parent part can repeat — a calendar has six rows, a chip group
    // has one wrapper per option — and a child belongs to whichever instance holds it.
    if (parentElements.length > 0) {
      for (const element of elements) {
        if (isPortalled(node.part, element)) continue;
        if (!parentElements.some((parent) => element === parent || parent.contains(element))) {
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

  // ─── Identity and ownership ────────────────────────────────────────────────
  // Structure proves a widget is shaped right. None of it proves that *this* widget's parts are
  // its own: two selects on a page are structurally identical, and the failures below are the ones
  // that only exist once there are two of something.

  const document_ = root.ownerDocument;

  // An id claimed twice is not a cosmetic problem: the browser permits it, and every lookup that
  // resolves by id — getElementById, label[for], every ARIA IDREF — silently picks one of them.
  for (const element of scope) {
    const id = element.getAttribute("id");
    if (!id) continue;
    const claimants = document_?.querySelectorAll(`[id="${CSS_ESCAPE(id)}"]`).length ?? 1;
    if (claimants > 1) {
      issues.push({
        code: "ID_DUPLICATE",
        part: "root",
        message: `id ${id} is claimed by ${claimants} elements`,
      });
    }
  }

  // A reference must resolve to one element, and that element must belong to this widget — being
  // outside the root is not the test, because a portalled popup is legitimately outside it. What
  // makes it this widget's is that this widget declared it as a part.
  const ownedElements = new Set<Element>();
  for (const [, elements] of resolved) for (const element of elements) ownedElements.add(element);
  const ownsElement = (element: Element): boolean => {
    if (root.contains(element)) return true;
    for (const owned of ownedElements) if (owned === element || owned.contains(element)) return true;
    return false;
  };

  for (const element of scope) {
    // `for` is an IDREF exactly like the ARIA ones — it is only HTML rather than ARIA, which is the
    // sole reason the reference walk used to skip it. A label pointing at a control that does not
    // exist is a label that does nothing when clicked and names nothing to a screen reader.
    const references = element.tagName.toLowerCase() === "label"
      ? [...ARIA_REFERENCES, "for"]
      : ARIA_REFERENCES;
    for (const attribute of references) {
      const value = element.getAttribute(attribute);
      if (!value) continue;
      for (const id of value.split(/\s+/).filter(Boolean)) {
        const matches = document_?.querySelectorAll(`[id="${CSS_ESCAPE(id)}"]`) ?? [];
        // The ARIA attributes get their dangling check in the pass above; `for` only exists here.
        if (matches.length === 0 && attribute === "for") {
          issues.push({
            code: "ARIA_DANGLING_REF",
            part: "label",
            message: `label[for] points at missing id ${id}`,
          });
          continue;
        }
        if (matches.length > 1) {
          issues.push({
            code: "ARIA_AMBIGUOUS_REF",
            part: "root",
            message: `${attribute} points at id ${id}, which ${matches.length} elements claim`,
          });
          continue;
        }
        const target = matches[0];
        if (target && !ownsElement(target)) {
          issues.push({
            code: "ARIA_FOREIGN_REF",
            part: "root",
            message: `${attribute} points at ${id}, which is not a part of this widget`,
          });
        }
      }
    }
  }

  // The declared opener must be the element carrying the relation. Task 07 proved that whatever
  // holds `aria-controls` points at this widget's own popup; this says *which part* is supposed to
  // hold it, so a widget cannot satisfy the relation from some other element that happens to have
  // one — and a widget that declares an opener and never wires it up is now visible.
  const openerPart = MDY_POPUP_OPENERS[kind]?.opener;
  if (definition.capabilities.overlay && openerPart && (resolved.get("popup") ?? []).length > 0) {
    const openers = resolved.get(openerPart) ?? [];
    if (openers.length > 0 && !openers.some((element) => element.hasAttribute("aria-controls"))) {
      issues.push({
        code: "PART_NOT_OWNED",
        part: openerPart,
        message: `${openerPart} opens the ${kind} popup and must carry aria-controls naming it`,
      });
    }
  }

  // The popup a trigger names must be the popup this widget declared. Without this, a widget can
  // present any compatible element as its overlay and nothing notices whose it is.
  if (definition.capabilities.overlay) {
    const declaredPopups = resolved.get("popup") ?? [];
    for (const element of scope) {
      const controls = element.getAttribute("aria-controls");
      if (!controls) continue;
      const named = document_?.getElementById(controls);
      if (!named || declaredPopups.length === 0) continue;
      const matchesDeclared = declaredPopups.some(
        (popup) => popup === named || popup.contains(named) || named.contains(popup),
      );
      if (!matchesDeclared) {
        issues.push({
          code: "PART_NOT_OWNED",
          part: "popup",
          message: `aria-controls names ${controls}, which is not the popup this widget declared`,
        });
      }
    }
  }

  // A control that says it is expanded, and no popup. `absentParts` covers the other direction —
  // declared closed while still rendered — so between them the claim and the DOM have to agree.
  const popupAbsent = absent.has("popup") || (resolved.get("popup") ?? []).length === 0;
  if (definition.capabilities.overlay && popupAbsent) {
    for (const element of scope) {
      if (element.getAttribute("aria-expanded") === "true") {
        issues.push({
          code: "ARIA_STATE_INCOHERENT",
          part: "popup",
          message: `aria-expanded="true" but no popup is rendered`,
        });
      }
    }
  }

  // ARIA that describes a native control must agree with the control. `aria-disabled` alone leaves
  // the element focusable and operable: the assistive technology is told one thing and the pointer
  // and keyboard do another.
  const NATIVE_DISABLEABLE = new Set(["input", "select", "textarea", "button", "fieldset", "optgroup", "option"]);
  for (const element of scope) {
    if (element.getAttribute("aria-disabled") !== "true") continue;
    if (!NATIVE_DISABLEABLE.has(element.tagName.toLowerCase())) continue;
    if (!element.hasAttribute("disabled")) {
      issues.push({
        code: "ARIA_STATE_NOT_APPLIED",
        part: "root",
        message: `<${element.tagName.toLowerCase()}> has aria-disabled="true" but is not actually disabled`,
      });
    }
  }

  if (options.strictClasses) {
    const canonical = canonicalClasses(kind, options.allowedClasses ?? []);
    const declared = declaredModifiers(kind);
    for (const element of scope) {
      for (const className of classesOf(element)) {
        if (!className.startsWith("mdy-")) continue;
        if (options.adapterPrefix && className.startsWith(options.adapterPrefix)) continue;
        if (canonical.has(className) || isModifierOf(className, canonical, declared)) continue;
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
