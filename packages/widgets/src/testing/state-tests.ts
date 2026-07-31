/**
 * State conformance.
 *
 * `inspectWidgetDom` asks whether a widget is shaped right. This asks whether it is *behaving*
 * right in a named state — which parts it grew, what it exposes to assistive technology, and
 * whether the behaviour actually changed or only the ARIA claiming it did.
 *
 * Driving a renderer into a state is the adapter's job: Plain sets a property, Angular pushes a
 * signal, Lit sets an attribute, and no shared helper can do all three honestly. What is shared is
 * the *judgement* — every adapter drives its own control and then hands the DOM here. Task 16's
 * cross-renderer equivalence is meant to be built on exactly this split.
 */
import { MDY_WIDGET_CONTRACTS, type MdyWidgetKind } from "../catalog.js";
import {
  MDY_WIDGET_STATE_CONTRACTS,
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
/** `readonly` is only a real attribute on these; a select or a checkbox has no such thing. */
const READONLY_CAPABLE = new Set(["input", "textarea"]);

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
    // The state may be exposed on the control or on the root, depending on where the widget puts
    // its semantics — a composite exposes `aria-expanded` on its trigger, not on a wrapper div.
    // Where a widget exposes its state depends on its anatomy: a text field puts it on the input, a
    // radio group on the group, a select on its trigger. Rather than guess, accept any declared
    // part — the contract's claim at this stage is that the widget exposes the state *somewhere*
    // an assistive technology will meet it. Narrowing that to one part per kind is task 08's job.
    const carriers = [
      control,
      root,
      ...Object.keys(options.parts ?? {}).flatMap((part) => partElements(options.parts, part)),
    ].filter((element): element is Element => Boolean(element));
    const found = carriers.map((element) => element.getAttribute(attribute)).filter((v) => v !== null);
    if (found.length === 0) {
      issues.push({
        code: "STATE_ARIA_MISSING",
        state,
        message: `${state} must be exposed as ${attribute}="${value}"; the attribute is absent`,
      });
    } else if (!found.includes(value)) {
      issues.push({
        code: "STATE_ARIA_WRONG",
        state,
        message: `${state} must be ${attribute}="${value}", found ${found.map((v) => JSON.stringify(v)).join(", ")}`,
      });
    }
  }

  // The one that matters: a state the ARIA claims and the control does not have. Checked against
  // *every* native control the widget renders, not just the one nominated as `control` — a
  // date field whose toggle button is disabled while its text input still accepts typing is
  // disabled in appearance only.
  if (contract.nativeAttribute) {
    const candidates = [control, ...Array.from(root.querySelectorAll("input, select, textarea, button"))]
      .filter((element): element is Element => Boolean(element));
    const seen = new Set<Element>();
    for (const element of candidates) {
      if (seen.has(element)) continue;
      seen.add(element);
      const tag = element.tagName.toLowerCase();
      // A button has no read-only rendering, so `readonly` is only asked of what can carry it.
      const applicable = contract.nativeAttribute === "readonly"
        ? READONLY_CAPABLE.has(tag)
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
