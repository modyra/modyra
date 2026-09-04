/**
 * The text-like kinds, drawn by one component.
 *
 * `text`, `email`, `password`, `textarea` and `number` share an anatomy and differ in what they ask
 * the platform for. Which native input that is comes from the catalogue — `controlType` — not from a
 * prop a host spells: an email field whose author forgot to say so renders as plain text and loses
 * the keyboard and the handling that go with it, silently.
 *
 * The state lives in the hook this wraps, which already holds the controller against the runtime the
 * handle owns. Nothing about the widget is decided here: the parts, their classes, their relations
 * and the element each is drawn as are the contract's answers, read through the projection.
 */
import { createElement, useId, type ReactElement, type ReactNode } from "react";
import { MDY_WIDGET_CONTRACTS } from "@modyra/widgets";
import type { MdyFieldHandle } from "@modyra/core";
import { useMdyTextField } from "./field.js";
import { partProps, type MdyDeclaredPart } from "./part.js";

/** The kinds this one component draws. */
export type MdyTextLikeKind = "text" | "email" | "password" | "textarea" | "number";

/** Which element each kind's control is, where the catalogue says something other than an input. */
const TAG_FOR_ELEMENT: Readonly<Record<string, string>> = Object.freeze({ textarea: "textarea" });

export interface MdyTextFieldProps<TValue extends string | number | null> {
  readonly field: MdyFieldHandle<TValue>;
  readonly kind?: MdyTextLikeKind;
  readonly label?: string;
  /**
   * Stable identity for this widget's parts.
   *
   * Optional here and required in the Vue components, and the difference is not an inconsistency:
   * React has `useId`, which produces an identity that survives a re-render and matches between
   * server and client. A host with its own scheme still passes one.
   */
  readonly widgetId?: string;
}

export function MdyTextField<TValue extends string | number | null>(
  props: MdyTextFieldProps<TValue>,
): ReactElement {
  const kind = props.kind ?? "text";
  const contract = MDY_WIDGET_CONTRACTS[kind];
  const declared = contract.parts as Readonly<Record<string, MdyDeclaredPart | undefined>>;
  const generated = useId();
  const widgetId = props.widgetId ?? `mdy-${generated.replace(/:/g, "")}`;

  const api = useMdyTextField<TValue>(props.field, {
    widgetId,
    // From the catalogue, not from a prop: `controlType` is what the contract says a kind's native
    // input is, and a renderer spelling it here would be a second statement of it — the one that
    // stops moving when the declaration does.
    inputType: contract.controlType,
  });

  const parts = api.view.parts as Readonly<Record<string, Parameters<typeof partProps>[0]>>;
  const classesOf = (part: string): string => declared[part]?.classes.join(" ") ?? "";
  const children: ReactNode[] = [];

  // The projection names this part `input`, carries the id, the `for` that points at it, the native
  // input the kind declares, the name a submit reads and every constraint attribute. Rebuilding any
  // of that here would be a second answer to a question already answered — the first version of this
  // file did exactly that and drew an email field with no `type` and no ARIA at all.
  if (props.label !== undefined && props.label !== "") {
    children.push(createElement("label", partProps(parts["label"], { key: "label" }), props.label));
  }

  const controlNode = contract.structure.nodes.find((node) => node.part === "control");
  children.push(createElement("div", { key: "wrapper", className: classesOf("inputWrapper") },
    createElement(TAG_FOR_ELEMENT[String(controlNode?.element)] ?? "input", partProps(parts["input"], {
      key: "control",
      className: classesOf("control"),
      value: (props.field.value() ?? "") as string,
      onChange: (event: { readonly target: { readonly value: string } }) =>
        api.dispatch({ type: "input", value: event.target.value as TValue }),
      onBlur: () => api.dispatch({ type: "blur" }),
    }))));

  children.push(createElement("p", partProps(parts["description"], { key: "description" })));
  children.push(createElement("ul", partProps(parts["error"], { key: "error" })));

  return createElement("div", { className: contract.rootClasses.join(" ") }, children);
}
