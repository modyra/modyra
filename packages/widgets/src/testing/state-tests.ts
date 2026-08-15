/**
 * State conformance.
 *
 * `inspectWidgetDom` asks whether a widget is shaped right. This asks whether it is *behaving*
 * right in a named state — which parts it grew, what it exposes to assistive technology, and
 * whether the behaviour actually changed or only the ARIA claiming it did.
 *
 * Driving a renderer into a state is the adapter's job: one sets a property, another pushes a
 * signal, a third sets an attribute, and no shared helper can do all three honestly. What is shared is
 * the *judgement* — every adapter drives its own control and then hands the DOM here. Cross-renderer
 * equivalence rests on that split: same judgement, different drivers.
 */
import { MDY_WIDGET_CONTRACTS, type MdyWidgetKind } from "../catalog.js";
import {
  MDY_WIDGET_STATE_CONTRACTS,
  stateCarriers,
  widgetSupportsState,
  type MdyWidgetState,
} from "../widget-states.js";
import type { MdyDomPartMap } from "./dom-tests.js";

export type MdyStateIssueCode =
  | "STATE_NOT_SUPPORTED"
  | "STATE_ARIA_MISSING"
  | "STATE_ARIA_WRONG"
  | "STATE_NOT_APPLIED"
  | "STATE_PART_MISSING"
  | "STATE_PART_PRESENT"
  | "STATE_ARIA_UNSUPPORTED";

export interface MdyStateIssue {
  readonly code: MdyStateIssueCode;
  readonly state: MdyWidgetState;
  readonly message: string;
}

export interface MdyStateInspectOptions {
  /** Which elements materialize each part, as for `inspectWidgetDom`. */
  readonly parts?: MdyDomPartMap;
  /** The element the state is really about — the focusable, operable control. */
  readonly control?: Element | null;
}

/** Native elements that can genuinely carry `disabled` / `readonly`. */
const NATIVE_CONTROLS = new Set(["input", "select", "textarea", "button"]);
/**
 * Where the native `readonly` attribute does something.
 *
 * HTML honours it for text-like inputs and a textarea, and ignores it everywhere else: a range, a
 * checkbox, a colour, a file input and a `<select>` all take the attribute and stay operable. On
 * those the refusal belongs to the widget — the controller declines the change — and `aria-readonly`
 * is what says so. Asking for an attribute the platform ignores would demand markup that lies.
 */
const READONLY_HONOURING_TYPES = new Set([
  "text", "search", "url", "tel", "email", "password",
  "date", "month", "week", "time", "datetime-local", "number",
]);
function honoursNativeReadonly(element: Element): boolean {
  const tag = element.tagName.toLowerCase();
  if (tag === "textarea") return true;
  if (tag !== "input") return false;
  return READONLY_HONOURING_TYPES.has((element.getAttribute("type") ?? "text").toLowerCase());
}

function partElements(parts: MdyDomPartMap | undefined, part: string): readonly Element[] {
  const value = parts?.[part];
  if (!value) return [];
  return Array.isArray(value) ? value : [value as Element];
}

/**
 * Every way a widget claiming to be in `state` departs from what the contract says that means.
 *
 * Pure: it reads the DOM it is handed and never drives anything.
 */
export function inspectWidgetState(
  root: Element,
  kind: MdyWidgetKind,
  state: MdyWidgetState,
  options: MdyStateInspectOptions = {},
): readonly MdyStateIssue[] {
  const issues: MdyStateIssue[] = [];

  if (!widgetSupportsState(kind, state)) {
    issues.push({
      code: "STATE_NOT_SUPPORTED",
      state,
      message: `${kind} does not declare the state ${state}`,
    });
    return issues;
  }

  const contract = MDY_WIDGET_STATE_CONTRACTS[state];
  const control = options.control ?? partElements(options.parts, "control")[0] ?? null;

  if (contract.aria) {
    const { attribute, value } = contract.aria;
    // Which element carries the state is the claim, not merely that some element does. The contract
    // names the carrier per kind — the opener for `open`, the operable part for the rest — so a
    // widget that exposes `aria-expanded` on its root while its trigger says nothing fails here
    // rather than passing for having said it somewhere.
    const parts = stateCarriers(kind, state);
    for (const part of parts) {
      const elements = partElements(options.parts, part).length > 0
        ? partElements(options.parts, part)
        // A caller that named the control but not the part it materializes is describing the same
        // element under the anatomy's name for it.
        : part === "control" && control ? [control] : [];
      // Not rendered is not this check's finding: `inspectWidgetDom` decides whether a part the
      // contract requires may be missing, and asserting an attribute on an element nobody drew
      // would report the same defect twice under a worse name.
      if (elements.length === 0) continue;

      const found = elements.map((element) => element.getAttribute(attribute)).filter((v) => v !== null);
      if (found.length === 0) {
        issues.push({
          code: "STATE_ARIA_MISSING",
          state,
          message: `${state} must be exposed as ${attribute}="${value}" on ${part}; the attribute is absent there`,
        });
      } else if (!found.includes(value)) {
        issues.push({
          code: "STATE_ARIA_WRONG",
          state,
          message: `${state} must be ${attribute}="${value}" on ${part}, found ${found.map((v) => JSON.stringify(v)).join(", ")}`,
        });
      }
    }
  }

  // The one that matters: a state the ARIA claims and the control does not have. Checked against
  // *every* native control the widget renders, not just the one nominated as `control` — a
  // date field whose toggle button is disabled while its text input still accepts typing is
  // disabled in appearance only.
  if (contract.nativeAttribute) {
    // Only the widget's own interactive surface. A closed overlay's contents are not part of it —
    // demanding `disabled` on all forty-six cells of a calendar that is not on screen is not a
    // contract, it is noise, and a disabled field should not be open in the first place.
    const popups = partElements(options.parts, "popup");
    const insidePopup = (element: Element): boolean =>
      popups.some((popup) => popup === element || popup.contains(element));
    const candidates = [control, ...Array.from(root.querySelectorAll("input, select, textarea, button"))]
      .filter((element): element is Element => Boolean(element))
      .filter((element) => !insidePopup(element));
    const seen = new Set<Element>();
    for (const element of candidates) {
      if (seen.has(element)) continue;
      seen.add(element);
      const tag = element.tagName.toLowerCase();
      // Only where the platform acts on it. Elsewhere the widget refuses the change itself and
      // announces it in ARIA, which the check above is what verifies.
      const applicable = contract.nativeAttribute === "readonly"
        ? honoursNativeReadonly(element)
        : NATIVE_CONTROLS.has(tag);
      if (!applicable) continue;
      if (!element.hasAttribute(contract.nativeAttribute)) {
        issues.push({
          code: "STATE_NOT_APPLIED",
          state,
          message:
            `${state} is claimed but <${tag}>${element.getAttribute("type") ? `[type=${element.getAttribute("type")}]` : ""} ` +
            `does not carry ${contract.nativeAttribute} — it is still operable and only the ARIA changed`,
        });
      }
    }
  }

  const definition = MDY_WIDGET_CONTRACTS[kind];
  for (const part of contract.requiresParts ?? []) {
    // Only require a part the kind actually has: `errors` is universal, `loading` is not.
    if (!(part in definition.parts)) continue;
    if (partElements(options.parts, part).length === 0) {
      issues.push({
        code: "STATE_PART_MISSING",
        state,
        message: `${state} requires the ${part} part, which was not rendered`,
      });
    }
  }
  for (const part of contract.forbidsParts ?? []) {
    if (partElements(options.parts, part).length > 0) {
      issues.push({
        code: "STATE_PART_PRESENT",
        state,
        message: `${state} forbids the ${part} part, which was rendered`,
      });
    }
  }

  return issues;
}

/**
 * ARIA a kind exposes for a state it does not declare.
 *
 * `aria-readonly="false"` on a slider is not harmless noise — it is the signature of a common ARIA
 * shell applied mechanically to every control, and it tells a screen reader that read-only is a
 * meaningful axis for something where it is not. Checked separately from
 * {@link inspectWidgetState} because it is about the states a widget is *not* in.
 */
export function inspectUnsupportedStateAria(
  root: Element,
  kind: MdyWidgetKind,
): readonly MdyStateIssue[] {
  const issues: MdyStateIssue[] = [];
  const scope = [root, ...Array.from(root.querySelectorAll("*"))];
  for (const [state, contract] of Object.entries(MDY_WIDGET_STATE_CONTRACTS)) {
    if (!contract.aria) continue;
    if (widgetSupportsState(kind, state as MdyWidgetState)) continue;
    for (const element of scope) {
      if (element.hasAttribute(contract.aria.attribute)) {
        issues.push({
          code: "STATE_ARIA_UNSUPPORTED",
          state: state as MdyWidgetState,
          message:
            `${kind} does not declare ${state}, but <${element.tagName.toLowerCase()}> carries ` +
            `${contract.aria.attribute}="${element.getAttribute(contract.aria.attribute)}"`,
        });
      }
    }
  }
  return issues;
}
