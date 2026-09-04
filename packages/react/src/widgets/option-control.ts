/**
 * The radio group and the segmented control, which are the same widget with two coats of paint.
 *
 * The catalogue says so — `segmented` declares the same anatomy as `radio`, because it is the same
 * control: a choice in a radiogroup — so there is no branch here. The only thing that differs is the
 * *name* of the part carrying an option's words, and that name is derived rather than listed: one
 * kind calls it `optionLabel` and the other `optionText`, and both declare it as the `text` child of
 * `option`. Asking the structure costs one line and survives a third kind of the same shape.
 *
 * **The arrows are the platform's, not this file's.** Native radios sharing a `name` are a radiogroup
 * the browser roves by itself: the declared arrow keys move focus and selection with no listener. A
 * handler answering those keys would have to cancel them to avoid acting twice, and would then owe
 * the whole behaviour back — focus included — in exchange for nothing.
 *
 * **The key is derived by the contract, not by `String`.** Every plain object renders as
 * `[object Object]`, so an object-valued list would give every option one key and one choice would
 * mark them all. For a primitive the two agree exactly, which is why a fixture cannot see the
 * difference.
 */
import {
  createElement,
  useCallback,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import {
  MDY_WIDGET_CONTRACTS,
  defaultOptionKey,
  groupSubmitName,
  type MdyOptionFieldVariant,
} from "@modyra/widgets";
import type { MdyFieldHandle, MdySelectOption } from "@modyra/core";
import { useMdyOptionField } from "./option-field.js";
import { partProps, type MdyDeclaredPart } from "./part.js";

export interface MdyOptionFieldProps<TValue> {
  readonly field: MdyFieldHandle<TValue | null>;
  readonly options: readonly MdySelectOption<TValue>[];
  readonly kind?: MdyOptionFieldVariant;
  readonly label?: string;
  readonly widgetId?: string;
  /** The path the answer arrives under when this group sits in a form. */
  readonly name?: string;
}

export function MdyOptionField<TValue>(props: MdyOptionFieldProps<TValue>): ReactElement {
  const kind = props.kind ?? "radio";
  const contract = MDY_WIDGET_CONTRACTS[kind];
  const declared = contract.parts as Readonly<Record<string, MdyDeclaredPart | undefined>>;
  const generated = useId();
  const widgetId = props.widgetId ?? `mdy-${generated.replace(/:/g, "")}`;
  const keyFor = useCallback(
    (option: MdySelectOption<TValue>): string => defaultOptionKey(option.value),
    [],
  );

  const api = useMdyOptionField<TValue>(props.field, {
    widgetId,
    variant: kind,
    options: props.options,
    keyFor,
    ...(props.label === undefined || props.label === "" ? {} : { label: props.label }),
  });

  // Whether the answer travels under the field's path or under this widget's own id depends on
  // there being a form around the group, and that question has no answer until the group is in the
  // document. It can change afterwards, if the group is moved.
  const group = useRef<HTMLDivElement | null>(null);
  const [submitName, setSubmitName] = useState(widgetId);
  useLayoutEffect(() => {
    setSubmitName(groupSubmitName(group.current, props.name ?? widgetId, widgetId));
  }, [props.name, widgetId, props.options]);

  const parts = api.view.parts;
  const classesOf = (part: string): string => declared[part]?.classes.join(" ") ?? "";
  /** Which part carries an option's words: the `text` child of `option`, whatever the kind calls it. */
  const wordsPart = String(contract.structure.nodes
    .find((node) => node.parent === "option" && node.element === "text")?.part);

  const children: ReactNode[] = [];
  if (props.label !== undefined && props.label !== "") {
    children.push(createElement("label", partProps(parts["label"], { key: "label" }), props.label));
  }

  children.push(createElement("div", partProps(parts["group"], { key: "group", ref: group }),
    props.options.map((option) => {
      const key = keyFor(option);
      const projected = parts[key];
      // The projection describes the *option*, so its id and its classes belong to the row the
      // contract paints. Its ARIA does not: `role="radio"` and `aria-checked` are what the native
      // control already is and already conveys, and repeating them on the label announces two
      // radios for one choice. What the input takes from the projection is the one thing it cannot
      // derive — whether this choice is refused.
      return createElement("label", {
        key,
        id: projected?.id,
        // The projection's classes, which are the declared ones plus whatever state the option is
        // in; the declared list is the fallback for a key the projection does not offer.
        className: (projected?.classes ?? declared["option"]?.classes ?? []).join(" "),
      }, [
        createElement("input", {
          key: "control",
          className: classesOf("optionControl"),
          type: "radio",
          name: submitName,
          value: key,
          disabled: projected?.attributes["disabled"] === true,
          checked: api.state.selectedKey === key,
          onChange: () => api.dispatch({ type: "select", optionKey: key }),
          onBlur: () => api.dispatch({ type: "blur" }),
        }),
        createElement("span", { key: "check", className: classesOf("optionCheck"), "aria-hidden": "true" }),
        createElement("span", { key: "words", className: classesOf(wordsPart) }, option.label),
      ]);
    })));

  children.push(createElement("p", partProps(parts["description"], { key: "description" })));
  children.push(createElement("ul", partProps(parts["error"], { key: "error" })));

  return createElement("div", { className: contract.rootClasses.join(" ") }, children);
}
