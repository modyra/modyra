/**
 * The two kinds a person answers yes or no: a checkbox and a switch.
 *
 * They share one anatomy and differ in what the control announces itself as — a switch is a switch to
 * assistive technology, and that is the catalogue's answer rather than a class this file picks. The
 * indicator is the painted mark that stands for the state; it is required, and it lives inside the
 * caption, which is what makes the caption a place a person can press.
 *
 * `submitFalse` is the part that exists because an unchecked box sends nothing. Optional in the
 * anatomy and drawn whenever the projection offers it: a form that posts silence for "no" cannot be
 * told apart from one where the question was never asked.
 */
import { createElement, useId, type ReactElement, type ReactNode } from "react";
import { MDY_WIDGET_CONTRACTS } from "@modyra/widgets";
import type { MdyFieldHandle } from "@modyra/core";
import { useMdyBooleanField } from "./boolean-field.js";
import { partProps, type MdyDeclaredPart } from "./part.js";

/** The kinds this one component draws. */
export type MdyBooleanKind = "checkbox" | "toggle";

export interface MdyBooleanFieldProps {
  readonly field: MdyFieldHandle<boolean>;
  readonly kind?: MdyBooleanKind;
  readonly label?: string;
  readonly widgetId?: string;
}

export function MdyBooleanField(props: MdyBooleanFieldProps): ReactElement {
  const kind = props.kind ?? "checkbox";
  const contract = MDY_WIDGET_CONTRACTS[kind];
  const declared = contract.parts as Readonly<Record<string, MdyDeclaredPart | undefined>>;
  const generated = useId();
  const widgetId = props.widgetId ?? `mdy-${generated.replace(/:/g, "")}`;

  // What the control announces itself as, read from the catalogue rather than mapped here. The kind
  // is `toggle` and the variant is `switch`, and the bridge between the two names is the role the
  // contract gives the control — a two-line table would be a second statement of it, and the one
  // that stops moving when a third kind arrives.
  const variant = contract.parts.control.role === "switch" ? "switch" : "checkbox";
  const api = useMdyBooleanField(props.field, { widgetId, variant });
  const parts = api.view.parts as Readonly<Record<string, Parameters<typeof partProps>[0]>>;
  const classesOf = (part: string): string => declared[part]?.classes.join(" ") ?? "";
  /**
   * The painted mark, read from the anatomy instead of named here.
   *
   * The two kinds do not draw the same one: a checkbox declares a single `indicator` under the
   * caption, a switch declares a `track` holding a `thumb`. Both are the caption's non-textual
   * children, so asking the structure draws either without a branch — and draws a third kind's mark
   * the day one is declared, instead of putting an empty span where its parts should be.
   */
  const markUnder = (parent: string): ReactNode[] =>
    contract.structure.nodes
      .filter((node) => node.parent === parent && node.element !== "text" && node.element !== "image")
      .map((node) => createElement(
        "span",
        { key: String(node.part), className: classesOf(String(node.part)), "aria-hidden": "true" },
        markUnder(String(node.part)),
      ));

  const inside: ReactNode[] = [
    createElement("input", partProps(parts["input"], {
      key: "control",
      className: classesOf("control"),
      type: "checkbox",
      checked: props.field.value() === true,
      // The vocabulary names the act, not the value: `check` and `uncheck` are what a person does,
      // and a renderer that invented a `set` would be answering a question the contract phrases
      // differently.
      onChange: (event: { readonly target: { readonly checked: boolean } }) =>
        api.dispatch({ type: event.target.checked ? "check" : "uncheck" }),
      onBlur: () => api.dispatch({ type: "blur" }),
    })),
  ];
  // Offered by the projection only where the kind declares it, and drawn wherever it is offered: an
  // unchecked box sends nothing, and a form that posts silence for "no" reads the same as one where
  // nobody was asked.
  if (parts["submitFalse"] !== undefined) {
    inside.push(createElement("input", partProps(parts["submitFalse"], { key: "submitFalse", type: "hidden" })));
  }
  // The caption is drawn whether or not it holds words, because the painted mark lives inside it:
  // the two kinds declare `label` optional and the mark under it required, so a caption skipped for
  // want of a caption takes a required part off the page with it.
  // Named against the control it captions, from the projection's own id rather than a string built
  // here. A text field's projection carries the `for` itself; this one does not, and a caption that
  // names nothing is a caption a person can press and assistive technology cannot follow.
  inside.push(createElement("label", partProps(parts["label"], {
    key: "label",
    className: classesOf("label"),
    for: parts["input"]?.id,
  }), [...markUnder("label"), props.label ?? ""]));

  return createElement("div", { className: contract.rootClasses.join(" ") }, [
    createElement("div", { key: "wrapper", className: classesOf("inputWrapper") }, inside),
    createElement("p", partProps(parts["description"], { key: "description" })),
    createElement("ul", partProps(parts["error"], { key: "error" })),
  ]);
}
