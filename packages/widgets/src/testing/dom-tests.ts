/**
 * Runtime DOM conformance.
 *
 * The static audits in `scripts/` prove that an adapter *references* the contract; this proves
 * that what it actually rendered matches it. It takes real elements, so any adapter — in a test
 * harness, in jsdom, in a browser — is held to the same gate.
 */
import { MDY_POPUP_OPENERS, MDY_WIDGET_CONTRACTS, type MdyWidgetKind, type MdyWidgetVariant } from "../catalog.js";
import { MDY_LABELABLE_TAGS, MDY_WIDGET_RELATIONS, partsRequiringName } from "../relations.js";
import type { MdyPartContract } from "../contract.js";
import { MDY_STATE_MODIFIERS } from "../state.js";
import { MDY_ARIA_DISABLED_PARTS } from "../structure.js";
import { MDY_FIELD_SHELL_CLASSES, MDY_FIELD_STATE_CLASSES, MDY_SHARED_UI_CLASSES } from "../structure.js";
import { overlayOnlyParts } from "../widget-states.js";
import { inspectWidgetStructure } from "./structure-tests.js";

export type MdyDomContractIssueCode =
  | "EXEMPTION_ACTIVE"
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
  | "RELATION_MISSING"
  | "RELATION_WRONG_TARGET"
  | "RELATION_NOT_LABELABLE"
  | "NAME_MISSING"
  | "PART_ROLE"
  | "PART_HIDDEN"
  | "INVENTED_CLASS"
  | "STRUCTURE";

export interface MdyDomContractIssue {
  readonly code: MdyDomContractIssueCode;
  readonly part: string;
  readonly message: string;
}

/** Elements the adapter rendered for each contract part, in document order. */
/**
 * Whether an element is a part the contract says announces its unavailability rather than setting it.
 *
 * Matched by the part's own classes, because that is what an element carries — asking a renderer to
 * mark it instead would be asking the thing under inspection to describe itself. Exported so the
 * state matrix asks this question rather than reading the same list a second time: two readings of
 * one declaration is how two checks come to disagree about it.
 */
export function announcesUnavailability(kind: MdyWidgetKind, element: Element): boolean {
  return MDY_ARIA_DISABLED_PARTS.some((entry) => {
    const [entryKind, part] = entry.split(".");
    if (entryKind !== kind) return false;
    const classes = (MDY_WIDGET_CONTRACTS[kind].parts as Record<string, MdyPartContract | undefined>)[part]?.classes ?? [];
    return classes.length > 0 && classes.every((name) => element.classList.contains(name));
  });
}

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
  /** Reject `mdy-*` classes the contract does not define. A renderer that needs a hook of its own
   * namespaces it under {@link adapterPrefix} rather than spelling a contract class. */
  readonly strictClasses?: boolean;
  /**
   * Prefix an adapter uses to namespace classes of its own, such as `mdy-<adapter>-`.
   *
   * **Passing this reports `EXEMPTION_ACTIVE` for every class it skips.** It suspends a rule, and a
   * result that does not say a rule was suspended reads exactly like one where the rule held — while
   * the person who passed the option and the person who later reads the green are not the same
   * person. Five undeclared classes lived for months behind this, in a repository whose conformance
   * check fails on undeclared classes, and the check was green the whole time.
   *
   * The option stays because a renderer outside this repository may rely on it. What it no longer
   * does is stay quiet: either the class is reported as invented, or the exemption is reported as
   * active. There is no combination that reports nothing.
   */
  readonly adapterPrefix?: string;
  /**
   * Whether the widget's overlay is showing.
   *
   * A part that only exists inside the popup cannot be required of a closed widget, so the contract
   * can mark one required and still be satisfied at rest. Left unset, those parts are not demanded:
   * a caller that has not said which state it is inspecting is not held to the open one.
   */
  readonly open?: boolean;
  /**
   * Which configured variant this instance is, for a kind whose anatomy depends on one.
   *
   * Left out, a varianted kind is checked only against the anatomy its variants agree on — which is
   * honest but weak, and is what an inspector that knows nothing about the configuration can say.
   * Naming it is what makes the differing half checkable.
   *
   * Closed: the catalogue declares which configurations exist, so a name nothing describes is a
   * compile error rather than a widget checked against an anatomy that is not there.
   */
  readonly variant?: MdyWidgetVariant;
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
 * widget — but it may not satisfy it by carrying the right class and nothing else. A class is
 * styling; it tells an assistive technology nothing.
 *
 * `undefined` means the catalog declares no semantics for that element: a wrapper, a run of text.
 * Those are listed rather than defaulted, so an element name nobody thought about fails loudly
 * instead of silently admitting everything.
 */
export const MDY_SEMANTIC_ELEMENTS: Readonly<Record<string, { tags: readonly string[]; roles: readonly string[] } | undefined>> = Object.freeze({
  root: undefined,
  group: undefined,
  // Prose the user reads. Which block or inline element carries it is presentation, and renderers
  // differ freely; what it may not be is a control, a button or an interactive element pretending
  // to be a caption.
  text: { tags: ["p", "div", "span", "output", "strong", "em", "small", "abbr"], roles: ["presentation", "none"] },
  presentation: undefined,
  label: { tags: ["label"], roles: [] },
  input: {
    tags: ["input", "textarea", "select"],
    roles: ["textbox", "searchbox", "combobox", "spinbutton", "slider", "checkbox", "radio", "switch"],
  },
  button: { tags: ["button"], roles: ["button", "switch"] },
  // An input that exists so a native submit has something to read. It carries no role, because a
  // role would put it in the accessibility tree, where it is a duplicate of a value the person can
  // already see and operate somewhere else.
  submission: { tags: ["input"], roles: [] },
  listbox: { tags: ["select"], roles: ["listbox", "grid"] },
  option: { tags: ["option"], roles: ["option", "gridcell"] },
  // A choice in a radiogroup. Native or by role, as everywhere else — the tag check below refuses an
  // `<input>` that is any other type, so this does not admit every input in the catalogue.
  radio: { tags: ["input"], roles: ["radio"] },
  // Holds controls and is not one. `presentation` cannot say this — it admits everything, which is
  // the point of it — and the distinction matters wherever a part's children are buttons: a button
  // inside a button is invalid, and nothing else in this table refuses it.
  container: { tags: ["div", "span", "li", "p", "section"], roles: ["presentation", "none", "group"] },
  dialog: { tags: ["dialog"], roles: ["dialog", "alertdialog"] },
  // The thing a pointer uses to reach a value the widget owns. A `<label>` wrapping a hidden native
  // input and a `<button>` beside one are both correct, and the second avoids nesting a focusable
  // control inside another — so this admits either rather than picking the pattern one renderer
  // happened to use first. It is not unconstrained: a bare div still fails.
  affordance: { tags: ["label", "button"], roles: ["button"] },
  // A popup is a positioning container. Its accessible semantics live on what it *contains* — the
  // listbox, the grid, the dialog — so constraining the box itself would only force a role that
  // says nothing. Declared unconstrained rather than left to fall through, so the omission is a
  // decision on the record. Nothing yet checks the contained element, so a popup framing the wrong
  // thing — or nothing — is invisible here.
  popup: undefined,
  grid: { tags: ["table"], roles: ["grid", "rowgroup", "presentation", "none"] },
  gridcell: { tags: ["td", "th"], roles: ["gridcell", "button"] },
  // The heading of a grid column — a weekday above a calendar. It is a cell, not prose, and saying
  // so is what keeps the grid navigable.
  columnheader: { tags: ["th"], roles: ["columnheader"] },
  // A run of errors is a list, an inline error is a span, a loading note is a paragraph. Named
  // rather than widened to "anything": this still rejects a control, a button or a bare div.
  status: { tags: ["output", "ul", "ol", "li", "p", "span"], roles: ["status", "alert", "log", "list", "listitem"] },
  // A graphic with an accessible name. The tag is whatever draws it, so the role is what counts.
  image: { tags: ["img", "svg"], roles: ["img"] },
});

/**
 * The parts of `kind` that carry exactly the classes `part` carries, in declared order.
 *
 * Length 1 for almost every part, which is the uninteresting case: the part is alone under its
 * selector and the first match is it. Where it is longer, the anatomy's order is the only thing
 * that tells the members apart, and every resolver must read it the same way — two derivations of
 * "which of these is which" would disagree the moment one of them was tightened.
 */
export function partsSharingClassesWith(kind: MdyWidgetKind, part: string): readonly string[] {
  const definition = MDY_WIDGET_CONTRACTS[kind];
  const parts = definition.parts as Readonly<Record<string, MdyPartContract | undefined>>;
  const key = (name: string): string => [...(parts[name]?.classes ?? [])].sort().join(" ");
  const target = key(part);
  if (target === "") return [part];

  return definition.structure.nodes
    .filter((node) => key(node.part) === target)
    .sort((a, b) => a.order - b.order)
    .map((node) => node.part);
}

/** An `input[type=button]` is a button; a bare `input` is a control. Tags alone cannot say so. */
function satisfiesSemanticElement(element: Element, semantic: string, declaredRole?: string): boolean {
  const allowed = MDY_SEMANTIC_ELEMENTS[semantic];
  if (!allowed) return true;
  // A role the contract itself asks for is not a claim the element made up. `container` admits no
  // roles by construction — it is the word for a box that announces nothing — so a part the contract
  // gives a role to would otherwise fail its own requirement.
  if (declaredRole && element.getAttribute("role") === declaredRole) return true;
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
  if (semantic === "radio" && tag === "input") return element.getAttribute("type") === "radio";
  return allowed.tags.includes(tag);
}

/** Canonical vocabulary for a kind: root classes, part classes, the shared shell, plus modifiers. */
function canonicalClasses(kind: MdyWidgetKind): ReadonlySet<string> {
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
    ...Object.values(definition.presentationClasses),
    ...MDY_SHARED_UI_CLASSES,
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
      // A state's name and the modifier it becomes are not the same string — `hasError` is spelled
      // `--has-error` on the element. Comparing the name against the class suffix rejected every
      // state where the two differ, which no fixture had yet put on screen.
      for (const state of part.states) known.add(MDY_STATE_MODIFIERS[state]);
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


/**
 * The role an element already has from its tag, before any `role` attribute.
 *
 * A contract that required the attribute would ask a renderer to spell what the host language
 * already says: `<input type="checkbox">` *is* a checkbox, and writing `role="checkbox"` on it adds
 * nothing. Only the roles the catalogue actually declares are listed; anything else is `null`, which
 * means "the attribute is the only way to say it".
 */
function implicitRole(element: Element): string | null {
  const tag = element.tagName.toLowerCase();
  if (tag === "button") return "button";
  if (tag === "table") return "table";
  if (tag === "tr") return "row";
  if (tag === "th") return "columnheader";
  if (tag === "td") return "gridcell";
  if (tag === "option") return "option";
  // The platform's own chooser. A `<select>` with no `multiple` and no `size` is a combobox to the
  // accessibility tree — which is what a select's trigger promises — so a renderer drawing the native
  // shape carries the role without writing it, and demanding the attribute would ask it to spell
  // what the element already says.
  if (tag === "select") return element.hasAttribute("multiple") ? "listbox" : "combobox";
  if (tag !== "input") return null;
  const type = (element.getAttribute("type") ?? "text").toLowerCase();
  if (type === "checkbox") return "checkbox";
  if (type === "radio") return "radio";
  if (type === "range") return "slider";
  // A number box is a spinbutton to the platform, and a renderer using one carries the role without
  // writing it. Demanding the attribute would ask three renderers to spell what two of them get from
  // the element they chose — and reporting "with none" over an element that has the role is the
  // inspector describing its own table rather than the page.
  if (type === "number") return "spinbutton";
  return null;
}

/**
 * Whether an element has an accessible name, by any of the mechanisms the contract admits.
 *
 * Deliberately permissive about *how*: `aria-label`, a resolved `aria-labelledby`, a `label[for]`,
 * a wrapping label, or the element's own text. The contract requires a name, not a mechanism.
 */
function accessibleName(element: Element, document_: Document | null | undefined): boolean {
  if (element.getAttribute("aria-label")?.trim()) return true;
  const labelledBy = element.getAttribute("aria-labelledby");
  if (labelledBy && document_) {
    for (const id of labelledBy.split(/\s+/).filter(Boolean)) {
      if (document_.getElementById(id)?.textContent?.trim()) return true;
    }
  }
  const id = element.getAttribute("id");
  if (id && document_?.querySelector(`label[for="${CSS_ESCAPE(id)}"]`)?.textContent?.trim()) return true;
  if (element.closest("label")?.textContent?.trim()) return true;
  return !!element.textContent?.trim();
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
  // Named by the caller, because only the caller knows how the instance was configured. An unknown
  // name is a caller error worth failing on rather than a silent fall back to the shared anatomy —
  // a typo'd variant would otherwise report a widget as conformant against half a contract.
  const variant = options.variant === undefined ? undefined : definition.variants[options.variant];
  if (options.variant !== undefined && !variant) {
    issues.push({
      code: "PART_MISSING",
      part: "root",
      message: `${kind} declares no variant named ${options.variant}`,
    });
  }

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
    if (found.length === 0) continue;

    // A kind may declare two parts with identical classes — a date range's two controls, a
    // timepicker's two segment inputs. No selector separates them, so taking every match would
    // report each part twice and call a correct widget ambiguous. What separates them is already in
    // the anatomy: their declared position among the parts that share their classes.
    const sharing = partsSharingClassesWith(kind, node.part);
    if (sharing.length > 1) {
      const element = found[sharing.indexOf(node.part)];
      if (element) resolved.set(node.part, [element]);
      continue;
    }
    resolved.set(node.part, found);
  }

  /** Whether any ancestor of `part` was also declared absent. Containment is transitive. */
  const parentOf = new Map(definition.structure.nodes.map((node) => [node.part as string, node.parent as string | undefined]));
  const hasAbsentAncestor = (part: string): boolean => {
    for (let cursor = parentOf.get(part), depth = 0; cursor && depth < 20; cursor = parentOf.get(cursor), depth += 1) {
      if (absent.has(cursor)) return true;
    }
    return false;
  };

  for (const node of definition.structure.nodes) {
    if (node.part === "root") continue;
    if (absent.has(node.part)) {
      // The contract decides what may be missing. A caller naming a mandatory part is claiming a
      // state the contract does not have — unless the part's own parent is absent too, in which
      // case the absence is entailed rather than claimed. A datepicker's `calendar` is mandatory and
      // its `popup` is optional, so a renderer that builds its popup on open cannot report its
      // resting state at all without this: it would be told that a part inside a container it
      // legitimately did not render is nevertheless required to be there.
      if (!node.optional && !hasAbsentAncestor(node.part)) {
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
      // A required part that lives inside the overlay is required *of an open widget*. Demanding it
      // at rest would make every closed picker non-conforming; never demanding it means a part the
      // contract calls mandatory is one nothing checks.
      const onlyWhileOpen = overlayOnlyParts(kind).includes(node.part);
      // Required by the kind, or by the variant it was configured as.
      const required = !node.optional || (variant?.required.includes(node.part) ?? false);
      // A mandatory part whose only declared home is gone was not omitted — it had nowhere to be.
      // `checkbox.indicator` is mandatory and lives under `label`, which a document without a
      // caption may legitimately not have; demanding the child there asks a renderer for an element
      // and refuses it the place to put it. The overlay rule above is this same shape, written for
      // one condition; this covers the rest — `kindOffersIt`, `documentDeclaresIt`, and whatever
      // the vocabulary gains next.
      const nowhereToBe = hasAbsentAncestor(node.part);
      if (required && !nowhereToBe && (!onlyWhileOpen || options.open === true)) {
        issues.push({ code: "PART_MISSING", part: node.part, message: `required part ${node.part} was not rendered` });
      }
      continue;
    }
    const contract = definition.parts[node.part as keyof typeof definition.parts] as MdyPartContract | undefined;

    // A part that answers unavailability by announcing it must not also take itself off the page.
    // `hidden` is the one that undoes the rule while leaving the element in the tree for every other
    // check here to find: the part is present, carries its classes, and a person still cannot see or
    // reach it. Which is the state the rule exists to prevent — a control that comes and goes moves
    // the one beside it under the hands of somebody aiming at it.
    for (const element of elements) {
      if (!announcesUnavailability(kind, element)) continue;
      if (element.hasAttribute("hidden")) {
        issues.push({
          code: "PART_HIDDEN",
          part: node.part,
          message: `${node.part} says when it cannot act with aria-disabled, so it must not be hidden`,
        });
      }
      if (!element.hasAttribute("aria-disabled")) {
        issues.push({
          code: "PART_HIDDEN",
          part: node.part,
          message: `${node.part} is drawn at all times, so it must say whether it can act with aria-disabled`,
        });
      }
    }

    // A part the contract gives a role must carry it. `element` says what a part may be — the
    // semantic lists the roles it admits — and this says which one it has to have, so the contract
    // can require a listbox rather than merely permit one.
    // The variant's role wins where it states one: a counter chip is a `spinbutton` and a toggle
    // chip a `group`, which is one part answering differently in two modes of one widget rather than
    // two parts.
    const wantedRole = (variant?.roles as Record<string, string> | undefined)?.[node.part] ?? contract?.role;
    if (wantedRole) {
      for (const element of elements) {
        const actual = element.getAttribute("role") ?? implicitRole(element);
        if (actual !== wantedRole) {
          issues.push({
            code: "PART_ROLE",
            part: node.part,
            message: `${node.part} must carry role="${wantedRole}", got ${actual ? `role="${actual}"` : `<${element.tagName.toLowerCase()}> with none`}`,
          });
        }
      }
    }

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
      // A varianted kind states its element per configuration; the shared declaration is what the
      // variants agree on, which for a part that genuinely differs is nothing useful.
      const expectedElement = variant?.elements[node.part] ?? (node.element as string);
      const declaredRole = (variant?.roles as Record<string, string> | undefined)?.[node.part]
        ?? (definition.parts[node.part as keyof typeof definition.parts] as MdyPartContract | undefined)?.role;
      if (!satisfiesSemanticElement(element, expectedElement, declaredRole)) {
        issues.push({
          code: "PART_ELEMENT",
          part: node.part,
          message: `${node.part} must be a ${expectedElement}, got <${element.tagName.toLowerCase()}>` +
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

  // The declared opener must be the element carrying the relation. Checking that whatever holds
  // `aria-controls` points at this widget's own popup is not enough on its own: this says *which
  // part* is supposed to hold it, so a widget cannot satisfy the relation from some other element
  // that happens to have one, and one that declares an opener and never wires it up fails here.
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

  // Every relation the kind declares, checked against what was rendered.
  //
  // The direction that matters is the missing one: a part carrying no reference at all has nothing
  // to dangle, so a field whose errors reach no assistive technology was indistinguishable from one
  // with no errors. A relation is required exactly when both ends are on screen.
  const isOnScreen = (element: Element): boolean =>
    !element.hasAttribute("hidden") && element.getAttribute("aria-hidden") !== "true";
  for (const relation of MDY_WIDGET_RELATIONS[kind]) {
    const carriers = resolved.get(relation.from) ?? [];
    if (carriers.length === 0) continue;
    // Any of the declared targets, not the first: which one a reference names is a runtime decision
    // the contract leaves open on purpose. `aria-describedby` points at the error list while there
    // are errors to read and at the supporting text otherwise, and the error list is in the document
    // either way — so "the first one rendered" would demand it name an empty list.
    const candidates = relation.to
      .map((part) => ({ part, elements: (resolved.get(part) ?? []).filter(isOnScreen) }))
      .filter((candidate) => candidate.elements.length > 0);
    if (candidates.length === 0) continue;
    const target = { part: relation.to.join(" or "), elements: candidates.flatMap((c) => c.elements) };

    const carrier = carriers[0]!;
    const reference = carrier.getAttribute(relation.attribute);
    if (!reference) {
      issues.push({
        code: "RELATION_MISSING",
        part: relation.from,
        message: `${relation.from} must name ${target.part} with ${relation.attribute}`,
      });
      continue;
    }

    const named: Element[] = [];
    for (const id of reference.split(/\s+/).filter(Boolean)) {
      const element = document_?.getElementById(id);
      if (element) named.push(element);
    }
    if (named.length > 0 && !named.some((element) => target.elements.some(
      (expected) => expected === element || expected.contains(element) || element.contains(expected),
    ))) {
      issues.push({
        code: "RELATION_WRONG_TARGET",
        part: relation.from,
        message: `${relation.from} names ${reference} with ${relation.attribute}, not the ${target.part}`,
      });
    }

    // `label[for]` resolves only to a labelable element. Naming anything else is markup the browser
    // ignores, so the label neither names the control nor moves focus to it.
    if (relation.attribute === "for") {
      for (const element of named) {
        if (!MDY_LABELABLE_TAGS.includes(element.tagName.toLowerCase())) {
          issues.push({
            code: "RELATION_NOT_LABELABLE",
            part: relation.from,
            message: `label[for] names a <${element.tagName.toLowerCase()}>, which is not labelable`,
          });
        }
      }
    }
  }

  // A part whose semantic is a landmark of its own — a listbox, a grid, a dialog — must be
  // announced with a name. Which mechanism supplies it is the renderer's choice and the text is the
  // renderer's to translate; that there is one is not optional, because an unnamed container leaves
  // the user to guess what they have landed in.
  for (const part of partsRequiringName(kind)) {
    for (const element of resolved.get(part) ?? []) {
      if (accessibleName(element, document_)) continue;
      issues.push({
        code: "NAME_MISSING",
        part,
        message: `${part} is a ${MDY_WIDGET_CONTRACTS[kind].structure.nodes.find((n) => n.part === part)?.element} and must have an accessible name`,
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
    // Except where the contract says this part announces its unavailability rather than setting it,
    // which it says for the controls that must keep their place in the tab order. The declaration is
    // narrow and explicit for that reason — see `MDY_ARIA_DISABLED_PARTS`, and ADR 0171 for what
    // neither it nor this inspector can see: whether the handler refuses.
    if (announcesUnavailability(kind, element)) continue;
    if (!element.hasAttribute("disabled")) {
      issues.push({
        code: "ARIA_STATE_NOT_APPLIED",
        part: "root",
        message: `<${element.tagName.toLowerCase()}> has aria-disabled="true" but is not actually disabled`,
      });
    }
  }

  if (options.strictClasses) {
    const canonical = canonicalClasses(kind);
    const declared = declaredModifiers(kind);
    for (const element of scope) {
      for (const className of classesOf(element)) {
        if (!className.startsWith("mdy-")) continue;
        if (options.adapterPrefix && className.startsWith(options.adapterPrefix)) {
          issues.push({
            code: "EXEMPTION_ACTIVE", part: "root",
            message: `${className} was not checked against the ${kind} contract: adapterPrefix `
              + `"${options.adapterPrefix}" suspends the class rule for it`,
          });
          continue;
        }
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
