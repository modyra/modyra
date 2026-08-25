/**
 * How a kind's value leaves the page when the browser submits the form it sits in.
 *
 * A consumer puts these controls inside a `<form>` and gives the page a button that submits. It is
 * elementary HTML, and until this existed a native submit sent **nothing**: a control without a
 * `name` is not serialised, that is the rule, and fifteen of the seventeen kinds had no `name` at
 * all. The other two — `radio` and `segmented` — had one, and it was the scoped widget id rather
 * than the field's path, so the payload carried a generated key nobody had asked for.
 *
 * ## The name is per part, and the four shapes are not interchangeable
 *
 * Naming "the field's control" is not a thing a kind can be asked for, because the kinds disagree
 * about how many controls a value has and what they are:
 *
 *     one control, and it is the value       text, number, slider, datepicker, file, timepicker…
 *     many controls, one shared name         radio, segmented — this is how HTML groups them
 *     many controls, one value between them  daterange (two dates), colors (a picker and a hex box)
 *     no control at all                      select, multiselect
 *
 * Writing the field's path onto every `input` in a kind's subtree gets three of the four wrong: it
 * sends a timepicker's hour and minute alongside the time itself, sends a daterange's two ends under
 * one key, and sends the popup's filter box — a control that holds no value and exists only while
 * the popup is open. **The part that carries the value is declared here, not deduced from shape.**
 *
 * ## Why a name is enough, and where it is not
 *
 * The grouping of radio buttons is by **form owner *and* name**, measured identical in Chromium,
 * Firefox and WebKit: two `<form>`s each holding `name="colour"` are two independent groups, and
 * choosing in one leaves the other alone. So inside a form the path is both correct to submit and
 * safe to group by.
 *
 * Outside any form the same two sets merge into one — which is why the scoped id was there. But a
 * control outside a form is never submitted natively either, so there the name has no receiving end
 * and is only a grouping key. That is the whole of the tension, and it resolves itself: **the name
 * is the question, the form owner is who is answering.**
 */
import { MDY_WIDGET_CONTRACTS, MDY_WIDGET_KINDS, type MdyWidgetKind } from "./catalog.js";

/**
 * How one kind puts its value into a form's payload.
 *
 * Every kind declares one. A kind that declared none would render controls a native submit silently
 * drops, which is the defect this contract exists to make impossible to reintroduce.
 */
export type MdySubmissionShape =
  /** One control, and it is the value. The part carries the field's name. */
  | { readonly form: "single"; readonly part: string }
  /**
   * Many controls, one name between them, which is how HTML expresses a single choice: only the
   * checked one is serialised, and sharing the name is what makes the arrow keys move within the
   * set and Tab step past it as a whole.
   */
  | { readonly form: "shared"; readonly part: string }
  /**
   * A boolean, which HTML serialises in a way a reader cannot interpret without knowing the rule: an
   * unchecked box is **absent** from the payload, so `false` and "never sent" are the same thing,
   * and a checked box with no `value` attribute sends the string `on`.
   *
   * So the control carries the model's value explicitly, and a hidden companion carries the false
   * case ahead of it — the later key wins, so the companion is only read when the box is unchecked.
   */
  | { readonly form: "boolean"; readonly part: string; readonly companion: string }
  /**
   * Several parts that are one value between them, each sent under its own suffixed key. A single
   * key would send the same name twice and leave the receiving end unable to tell the ends apart.
   */
  | { readonly form: "split"; readonly parts: readonly { readonly part: string; readonly suffix: string }[] }
  /**
   * No form control exists, so one is added that holds nothing but the value.
   *
   * `repeats` distinguishes a value from a list of them: a multiselect emits one per selected value,
   * in order, because a single joined key loses both the order and the multiplicity that the field's
   * whole purpose is to carry.
   */
  | { readonly form: "hidden"; readonly repeats: boolean };

/**
 * The part each kind sends its value from.
 *
 * A sibling of `LABEL_TARGET` and `DESCRIBED_BY_CARRIER` in `relations.ts`, and deliberately not the
 * same table: those name the part a person's assistive technology talks to, which for `select` and
 * `multiselect` is the `trigger` — a `<button>`, which no form serialises.
 *
 * `timepicker` sends from `control`, the text box, and not from its hour and minute segments: those
 * are two views of the same time, and naming them would send it whole and in pieces.
 *
 * `colors` sends from `hexInput` rather than the native picker for the reason the description does:
 * a renderer is free to make the native picker unreachable.
 */
const SUBMISSION: Readonly<Record<MdyWidgetKind, MdySubmissionShape>> = Object.freeze({
  text: { form: "single", part: "control" },
  email: { form: "single", part: "control" },
  password: { form: "single", part: "control" },
  textarea: { form: "single", part: "control" },
  number: { form: "single", part: "control" },
  slider: { form: "single", part: "control" },
  datepicker: { form: "single", part: "control" },
  timepicker: { form: "single", part: "control" },
  file: { form: "single", part: "control" },
  colors: { form: "single", part: "hexInput" },

  checkbox: { form: "boolean", part: "control", companion: "submitFalse" },
  toggle: { form: "boolean", part: "control", companion: "submitFalse" },

  radio: { form: "shared", part: "optionControl" },
  segmented: { form: "shared", part: "optionControl" },

  daterange: {
    form: "split",
    parts: [{ part: "startControl", suffix: "start" }, { part: "endControl", suffix: "end" }],
  },

  select: { form: "hidden", repeats: false },
  multiselect: { form: "hidden", repeats: true },
});

/** How this kind puts its value into a form's payload. */
export function submissionFor(kind: MdyWidgetKind): MdySubmissionShape {
  return SUBMISSION[kind];
}

/**
 * The key each part of a field sends its value under, given the field's path.
 *
 * The path and not the widget id: the id carries a per-form scope so that two forms on one page do
 * not collide, and a scope in a payload is a key the receiving end never asked for. Two forms send
 * the same key and stay separate, because a form's payload is its own.
 */
export function submissionNames(kind: MdyWidgetKind, path: string): Readonly<Record<string, string>> {
  const shape = SUBMISSION[kind];
  switch (shape.form) {
    case "split":
      return Object.freeze(Object.fromEntries(
        shape.parts.map(({ part, suffix }) => [part, `${path}.${suffix}`]),
      ));
    case "boolean":
      return Object.freeze({ [shape.part]: path, [shape.companion]: path });
    case "hidden":
      // No part carries it: the inputs are built by `syncSubmitValues`, marked by an attribute, and
      // are not a part a theme or a projection has any business reaching.
      return Object.freeze({});
    default:
      return Object.freeze({ [shape.part]: path });
  }
}

/**
 * Every kind declares a shape, and every part it names is a part that kind actually has.
 *
 * Exported rather than asserted at import time: a contract that throws while loading takes the
 * library down over a defect an audit should have caught at build time.
 */
export function submissionDefects(): readonly string[] {
  const defects: string[] = [];
  for (const kind of MDY_WIDGET_KINDS) {
    const shape = SUBMISSION[kind];
    if (shape === undefined) {
      defects.push(`${kind}: declares no submission shape — a native submit would drop it in silence`);
      continue;
    }
    const parts = MDY_WIDGET_CONTRACTS[kind].parts;
    const named = shape.form === "split"
      ? shape.parts.map((entry) => entry.part)
      : shape.form === "boolean" ? [shape.part, shape.companion]
      : shape.form === "hidden" ? [] : [shape.part];
    for (const part of named) {
      if (!Object.hasOwn(parts, part)) defects.push(`${kind}: submits from \`${part}\`, which its contract does not declare`);
    }
  }
  return defects;
}

/**
 * The hidden input a boolean field renders ahead of its box, as a part a renderer can bind.
 *
 * Here rather than in each renderer because all three need the same three attributes and none of
 * them needs to know why. The why is HTML's: an unchecked box is absent from the payload, so a
 * person who said no and a form that never carried the question arrive identical.
 */
export function submitFalsePart(
  path: string,
  state: { readonly disabled?: boolean; readonly checked?: boolean } = {},
): { readonly classes: readonly string[]; readonly attributes: Readonly<Record<string, string | boolean>> } {
  return Object.freeze({
    classes: Object.freeze([]),
    attributes: Object.freeze({
      type: "hidden",
      name: path,
      value: "false",
      // Silent while the box is ticked, so the payload carries **one** key rather than two.
      //
      // The common construction puts the companion first and lets the later value win, which works
      // and asks the receiving end to know that rule. Switching it off instead needs no convention:
      // a ticked box sends `true` alone, an unticked one sends `false` alone, and there is never a
      // repeated key to resolve. It also frees the companion to sit *after* the control — see
      // `submitFalsePart`'s placement note in the renderers.
      //
      // Disabled with the field for the same reason a control is: a disabled field is left out of
      // the payload entirely, and a companion still sending `false` would answer a question the
      // field was not asking.
      disabled: state.disabled === true || state.checked === true,
    }),
  });
}

/**
 * The name a group of radio inputs shares, which is two things at once.
 *
 * In HTML the `name` is what makes a set of radios one choice — arrow keys move within it, Tab steps
 * past it whole, and picking one clears the rest. It is *also* the key the value arrives under. Those
 * two jobs want different answers, and which one is at stake depends on where the control sits.
 *
 * Grouping is by **form owner and name together**, measured identical in Chromium, Firefox and
 * WebKit: two `<form>`s each holding `name="colour"` are two independent groups, and a group with no
 * owner does not merge with one that has an owner either. So inside a form the path is safe to group
 * by and correct to submit.
 *
 * Outside every form the same two sets *do* merge — and there a native submit sends nothing at all,
 * so the name has no receiving end and is only a grouping key. That is where the scoped id earns its
 * place, and the only place it does.
 */
export function groupSubmitName(within: Element | null | undefined, path: string, scopedId: string): string {
  return within?.closest("form") === null || within === null || within === undefined ? scopedId : path;
}

/**
 * Keeps a field's hidden submission inputs in step with the value it holds.
 *
 * Two kinds have no form control at all — a `select` is a button and a listbox, a `multiselect` is a
 * button and a strip of chips — so a native submit had nothing to read and sent nothing. This is the
 * only place in the library where the DOM carries a second copy of a value the model owns, and it is
 * here because there is no alternative: an input is the only thing a form serialises.
 *
 * One input per value, in order. A multiselect joined into a single key would lose both the order
 * and the multiplicity, which is the whole of what the field is for.
 *
 * The inputs are reused rather than replaced: rebuilding them on every change would discard nothing
 * a person can see, but it would churn the document on every keystroke of a filter.
 */
export function syncSubmitValues(host: Element, path: string, values: readonly unknown[], disabled = false): void {
  const document = host.ownerDocument;
  const existing = Array.from(host.querySelectorAll<HTMLInputElement>(`input[${SUBMIT_MARK}]`));

  values.forEach((value, index) => {
    const input = existing[index] ?? document.createElement("input");
    if (existing[index] === undefined) {
      input.setAttribute(SUBMIT_MARK, "");
      input.type = "hidden";
    }
    // Appended every time, not only when built: `append` moves a node it already holds, and the
    // field grows elements after this first runs. Last is where this belongs — nothing reaching for
    // "the first input" should find this one instead of the control a person can see, and the
    // contract declares it last among the field's parts.
    host.append(input);
    input.name = path;
    input.value = typeof value === "string" ? value : String(value ?? "");
    // A disabled field is left out of the payload entirely, which is the platform's rule and the
    // right one: it is not a value of nothing, it is a question that was not asked.
    input.disabled = disabled;
  });

  for (const spare of existing.slice(values.length)) spare.remove();
}

/**
 * What marks an input this module owns.
 *
 * An attribute rather than a class: a class would have to be declared in the contract, and this
 * element is not a part a theme has any business styling.
 */
const SUBMIT_MARK = "data-mdy-submit";

/**
 * Writes each control's submission key onto the elements that carry it, found by the classes the
 * contract declares for that part.
 *
 * For the kinds whose value is spread over several controls — a range's two ends, a colour's picker
 * and its hex box — and for the kinds whose one control the shell already names, this is the single
 * place that decides which element gets which key.
 *
 * By class rather than by a reference the renderer passes: three renderers build these elements in
 * three different ways, and the classes are the one description all three already honour. A part
 * whose element is missing is skipped rather than raising — a renderer may legitimately draw fewer
 * elements than the contract permits.
 *
 * The elements not named by the shape are *cleared*, which is the load-bearing half: a colour's
 * native picker and a range's second end both inherit a name from the shared control projection, and
 * two controls under one key send the value twice. `FormData.get` then takes the first and drops the
 * rest without an error, so the loss is silent.
 */
export function applySubmissionNames(root: Element, kind: MdyWidgetKind, path: string): void {
  const shape = SUBMISSION[kind];
  if (shape.form === "hidden" || shape.form === "shared") return;

  const names = submissionNames(kind, path);
  const parts = MDY_WIDGET_CONTRACTS[kind].parts;

  // Read from `classList` rather than through a selector: the classes are the contract's own and need
  // no escaping, and `CSS.escape` does not exist in every document this runs in.
  for (const element of Array.from(root.querySelectorAll("input, textarea, select"))) {
    const part = Object.entries(parts).find(([, contract]) =>
      contract.classes.length > 0 && contract.classes.every((name) => element.classList.contains(name)));
    if (part === undefined) continue;
    const name = names[part[0]];
    if (name === undefined) element.removeAttribute("name");
    else element.setAttribute("name", name);
  }
}
