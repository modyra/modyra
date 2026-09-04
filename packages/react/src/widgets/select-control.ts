/**
 * The select, in the shape that has a panel of ours: a trigger, a filter box and a list.
 *
 * The other shape is the platform's own chooser — `variantOf` answers `native` whenever the field
 * does not filter — and it is drawn here too, differently: it has no popup, no landing place for
 * focus and no keyboard model this file could add without taking one away.
 *
 * **Every behaviour below is read from a door, not decided here.** Where focus goes when the panel
 * opens is `focusPartOnOpen`; which key opens, moves, commits or cancels is `keyBindingFor`. A
 * renderer that lists key names instead drifts from the contract the moment the contract gains one,
 * and nothing tells it.
 */
import {
  createElement,
  useCallback,
  useEffect,
  useId,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactElement,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import {
  MDY_WIDGET_CONTRACTS,
  defaultOptionKey,
  defaultWidgetIdFactory,
  focusPartOnOpen,
  keyBindingFor,
  variantOf,
} from "@modyra/widgets";
import type { MdyFieldHandle, MdySelectOption } from "@modyra/core";
import { useMdySelectField } from "./select-field.js";
import { partProps, type MdyDeclaredPart } from "./part.js";
import { useMdyAnchoredPanel } from "./anchored-panel.js";
import { useMdyLightDismiss } from "./light-dismiss.js";

const CONTRACT = MDY_WIDGET_CONTRACTS.select;
const declared = CONTRACT.parts as Readonly<Record<string, MdyDeclaredPart | undefined>>;
const classesOf = (part: string): string => declared[part]?.classes.join(" ") ?? "";

export interface MdySelectFieldProps<TValue> {
  readonly field: MdyFieldHandle<TValue | null>;
  readonly options: readonly MdySelectOption<TValue>[];
  readonly label?: string;
  readonly widgetId?: string;
  readonly placeholder?: string;
  /**
   * Whether this select filters. It decides the shape rather than being an option on it: `variantOf`
   * answers `custom` for a select that filters and `native` for one that does not, and the two are
   * different controls — a combobox this package draws, and the chooser the platform draws and owns
   * the keyboard of. The default is the contract's default, so a field configured the same way is
   * the same control in every adapter.
   */
  readonly searchable?: boolean;
}

export function MdySelectField<TValue>(props: MdySelectFieldProps<TValue>): ReactElement {
  const generated = useId();
  const widgetId = props.widgetId ?? `mdy-${generated.replace(/:/g, "")}`;
  const searchable = props.searchable ?? false;
  const placeholder = props.placeholder ?? "Select…";
  const keyFor = useCallback(
    (option: MdySelectOption<TValue>): string => defaultOptionKey(option.value),
    [],
  );

  const anchor = useRef<HTMLButtonElement | null>(null);
  const optionElements = useRef(new Map<string, HTMLElement>());
  const api = useMdySelectField<TValue>(props.field, {
    widgetId,
    options: props.options,
    searchable,
    keyFor,
    ...(props.label === undefined || props.label === "" ? {} : { label: props.label }),
  }, (part, key) => {
    // The contract names the part; this says which element wears it here. Without it, "close and
    // put the person back on the trigger" is a command that resolves to nothing — the panel shuts
    // and focus is left on an element that has just been removed.
    if (part === "trigger") return anchor.current ?? undefined;
    if (part === "option" && key !== undefined) return optionElements.current.get(key);
    return undefined;
  });

  // The panel leaves the field and is positioned against the trigger: inside, it inherits the
  // `overflow` and the stacking of every ancestor, and a list clipped by a scrolling pane is a list
  // a person cannot finish reading. ADR 0130.
  const root = useRef<HTMLDivElement | null>(null);
  const panel = useRef<HTMLDivElement | null>(null);
  const open = api.state.open;

  useMdyLightDismiss({
    kind: "select",
    root,
    isOpen: open,
    close: () => api.dispatch({ type: "close", restoreFocus: false }),
  });
  useMdyAnchoredPanel({ kind: "select", panel, anchor, isOpen: open });

  /**
   * Focus follows the panel opening, wherever the opening came from.
   *
   * Driven by the state rather than called from each handler: a handler that focuses straight after
   * dispatching looks for an element the renderer has not drawn yet and finds nothing — silently,
   * because there is nothing wrong with the lookup. Watching the state means the search happens
   * after the panel exists, and it covers every way of opening, including the ones this component
   * does not handle.
   */
  useEffect(() => {
    const part = open ? focusPartOnOpen("select", { searchable }) : null;
    if (part === null) return;
    // By the id the projection publishes, never by class: two selects carry the same classes and
    // different ids, and the id is the one the trigger already points at.
    const id = defaultWidgetIdFactory.part(widgetId, part);
    const target = document.getElementById(id);
    if (target instanceof HTMLElement) target.focus();
  }, [open, searchable, widgetId]);

  const onKeyDown = (event: ReactKeyboardEvent<HTMLElement>): void => {
    const binding = keyBindingFor("select", event.nativeEvent, open);
    if (!binding) return;
    switch (binding.intent) {
      case "open":
        api.dispatch({ type: "open", source: "keyboard" });
        event.preventDefault();
        return;
      case "cancel":
        // Tab is a cancel here, and the one key that must keep its own meaning: the panel closes and
        // the browser moves on. Swallowing it would make this field a place a person can enter and
        // not leave. Escape leaves the person on the control they opened, and says so; Tab is on its
        // way somewhere, and pulling focus back would strand it on the field just left.
        api.dispatch({ type: "close", restoreFocus: event.key !== "Tab" });
        if (event.key !== "Tab") event.preventDefault();
        return;
      case "move":
        if (!open) return;
        api.dispatch({ type: "move", target: (binding.by ?? 1) > 0 ? "next" : "previous" });
        event.preventDefault();
        return;
      case "commit": {
        // What "commit" means for a list is "take the one the reading position is on"; the
        // controller names that key itself, so there is no second copy of "which option is active".
        const active = api.state.activeKey;
        if (!open || active === null) return;
        api.dispatch({ type: "select", optionKey: active });
        event.preventDefault();
        return;
      }
      default:
        return;
    }
  };

  const parts = api.view.parts;
  // The controller's list, not the prop: it has already reconciled a held value the options do not
  // contain, and looking in the prop list leaves that value invisible — the field shows a
  // placeholder while holding something a person can neither see nor replace.
  const shown = api.state.options;

  /**
   * The platform's chooser.
   *
   * A `<select>` is the control, the list and the keyboard model at once, so there is nothing here
   * to open and nothing to put focus into — which is why `focusPartOnOpen` answers `null` for this
   * shape. It must not claim otherwise either: `aria-expanded`, `aria-controls` and `aria-haspopup`
   * on a `<select>` describe a combobox that is not there, and the projection leaves them out for a
   * field that does not filter.
   *
   * The entry for "nothing chosen" has to exist, because a native chooser can only show that state
   * by having an option for it: without one, index 0 is a real choice, the control reads the first
   * label while the form holds nothing, and the field looks answered when it is not.
   */
  const drawNative = (): ReactElement => {
    const children: ReactNode[] = [];
    if (props.label !== undefined && props.label !== "") {
      children.push(createElement("label", {
        key: "label",
        id: defaultWidgetIdFactory.part(widgetId, "label"),
        htmlFor: defaultWidgetIdFactory.part(widgetId, "trigger"),
        className: classesOf("label"),
      }, props.label));
    }
    children.push(createElement("div", { key: "wrapper", className: classesOf("inputWrapper") }, [
      createElement("select", partProps(parts["trigger"], {
        key: "trigger",
        name: widgetId,
        value: api.state.selectedKey ?? "",
        onChange: (event: { readonly target: { readonly value: string } }) =>
          api.dispatch({ type: "select", optionKey: event.target.value }),
      }), [
        createElement("option", {
          key: "placeholder", className: classesOf("placeholder"), value: "", disabled: true,
        }, placeholder),
        ...shown.map((option) => createElement("option", {
          key: keyFor(option), value: keyFor(option),
        }, option.label)),
      ]),
      // The foundation takes the platform's arrow off every native chooser so a page of them reads
      // as one page, and a kind that removes an affordance owes one back. Beside the control, never
      // inside it: an `<option>` is the only thing a `<select>` may contain.
      createElement("span", { key: "arrow", className: classesOf("arrow"), "aria-hidden": "true" }),
    ]));
    children.push(createElement("p", {
      key: "description",
      id: defaultWidgetIdFactory.part(widgetId, "description"),
      className: classesOf("supportingText"),
    }));
    return createElement("div", { className: CONTRACT.rootClasses.join(" ") }, children);
  };

  if (variantOf("select", { searchable }) === "native") return drawNative();

  const selected = shown.find((option) => keyFor(option) === api.state.selectedKey);
  const children: ReactNode[] = [];

  if (props.label !== undefined && props.label !== "") {
    children.push(createElement("label", {
      key: "label",
      id: defaultWidgetIdFactory.part(widgetId, "label"),
      // The label names the trigger both ways: the relation the projection points at, and the `for`
      // that makes the caption itself a way to reach the control.
      htmlFor: defaultWidgetIdFactory.part(widgetId, "trigger"),
      className: classesOf("label"),
    }, props.label));
  }

  children.push(createElement("div", { key: "wrapper", className: classesOf("inputWrapper") }, [
    createElement("button", partProps(parts["trigger"], {
      key: "trigger",
      ref: anchor,
      type: "button",
      onClick: () => api.dispatch(open
        ? { type: "close", restoreFocus: false }
        : { type: "open", source: "pointer" }),
    }), selected === undefined
      ? createElement("span", { className: classesOf("placeholder") }, placeholder)
      : createElement("span", { className: classesOf("value") }, selected.label)),
    createElement("span", { key: "arrow", className: classesOf("arrow") }),
  ]));

  // Out of the field and against the trigger, and in the document while it is shut, so what names it
  // keeps naming something.
  children.push(createPortal(
    // No id of its own: the projection publishes no `popup` part, and what the trigger names — and
    // what the contract follows out of the field to decide "outside" — is the list inside it.
    createElement("div", {
      ref: panel,
      className: classesOf("popup"),
      hidden: !open,
      onKeyDown,
    }, [
      createElement("input", partProps(parts["search"], {
        key: "search",
        value: api.state.query,
        onChange: (event: { readonly target: { readonly value: string } }) =>
          api.dispatch({ type: "search", query: event.target.value }),
      })),
      createElement("ul", partProps(parts["options"], { key: "options" }),
        shown.map((option) => createElement("li", partProps(parts[keyFor(option)], {
          key: keyFor(option),
          ref: (element: HTMLElement | null) => {
            if (element) optionElements.current.set(keyFor(option), element);
            else optionElements.current.delete(keyFor(option));
          },
          onClick: () => api.dispatch({ type: "select", optionKey: keyFor(option) }),
        }), option.label))),
    ]),
    document.body,
    `${widgetId}__popup`,
  ));

  // Named by `aria-describedby` on every render, so it exists on every render: a description a
  // renderer draws only when it has text is a reference to nothing the rest of the time.
  children.push(createElement("p", {
    key: "description",
    id: defaultWidgetIdFactory.part(widgetId, "description"),
    className: classesOf("supportingText"),
  }));
  children.push(createElement("ul", partProps(parts["error"], { key: "error" })));

  return createElement("div", {
    className: CONTRACT.rootClasses.join(" "), ref: root, onKeyDown,
  }, children);
}
