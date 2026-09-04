/**
 * The multiselect: chips for what is held, and a panel of choices for what can be.
 *
 * The largest kind in the catalogue, and the one where every rule this package has learned holds at
 * once — the variant read from the mode, the reading position announced through the projection, and
 * the per-row quantity keyed by option.
 *
 * **The mode is the shape, and it is a closed set.** `single` is a set of toggles; `multi` is a bag
 * where a choice can be taken more than once, and it owes a stepper and a count on every row. A mode
 * outside the two produces a variant name the catalogue does not declare, which downstream means
 * *no* variant requirements rather than a refusal — the checks for the shape quietly stop applying.
 * That is why this component takes the declared type rather than a string.
 */
import {
  createElement,
  useCallback,
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
  keyBindingFor,
} from "@modyra/widgets";
import type { MdyFieldHandle, MdyMultiselectMode, MdySelectOption } from "@modyra/core";
import { useMdyMultiselectField } from "./multiselect-field.js";
import { partProps, type MdyDeclaredPart } from "./part.js";
import { useMdyAnchoredPanel } from "./anchored-panel.js";
import { useMdyLightDismiss } from "./light-dismiss.js";

const CONTRACT = MDY_WIDGET_CONTRACTS.multiselect;
const declared = CONTRACT.parts as Readonly<Record<string, MdyDeclaredPart | undefined>>;
const classesOf = (part: string): string => declared[part]?.classes.join(" ") ?? "";
const roleOf = (part: string): string | undefined => declared[part]?.role ?? undefined;

export interface MdyMultiselectFieldProps<TValue> {
  readonly field: MdyFieldHandle<readonly TValue[]>;
  readonly options: readonly MdySelectOption<TValue>[];
  readonly label?: string;
  readonly widgetId?: string;
  readonly mode?: MdyMultiselectMode;
  readonly searchable?: boolean;
  readonly placeholder?: string;
}

export function MdyMultiselectField<TValue>(props: MdyMultiselectFieldProps<TValue>): ReactElement {
  const generated = useId();
  const widgetId = props.widgetId ?? `mdy-${generated.replace(/:/g, "")}`;
  const mode = props.mode ?? "single";
  const searchable = props.searchable ?? false;
  const placeholder = props.placeholder ?? "Choose…";
  const keyFor = useCallback(
    (option: MdySelectOption<TValue>): string => defaultOptionKey(option.value),
    [],
  );

  const root = useRef<HTMLDivElement | null>(null);
  const panel = useRef<HTMLDivElement | null>(null);
  const anchor = useRef<HTMLButtonElement | null>(null);
  const optionElements = useRef(new Map<string, HTMLElement>());

  const api = useMdyMultiselectField<TValue>(props.field, {
    widgetId,
    options: props.options,
    mode,
    keyFor,
  }, (part, key) => {
    if (part === "trigger") return anchor.current ?? undefined;
    if (part === "option" && key !== undefined) return optionElements.current.get(key);
    return undefined;
  });

  const open = api.state.open;
  useMdyLightDismiss({
    kind: "multiselect",
    root,
    isOpen: open,
    close: () => api.dispatch({ type: "close", restoreFocus: false }),
  });
  useMdyAnchoredPanel({ kind: "multiselect", panel, anchor, isOpen: open });

  const onKeyDown = (event: ReactKeyboardEvent<HTMLElement>): void => {
    // Asked at the row first, then at the control. A binding declared `on` a part is invisible from
    // the control and is the only answer from that part, which is how one key means two things
    // without either declaration shadowing the other: the horizontal arrows step the quantity of
    // the row a person is on, and mean nothing at the control at all.
    const binding = keyBindingFor("multiselect", event.nativeEvent, open, "option")
      ?? keyBindingFor("multiselect", event.nativeEvent, open);
    if (!binding) return;
    switch (binding.intent) {
      case "open":
        api.dispatch({ type: "open" });
        break;
      case "cancel":
        // This panel holds nothing worth staying for, so Tab closes it and is left to the browser;
        // Escape closes it and is consumed.
        api.dispatch({ type: "close", restoreFocus: event.key !== "Tab" });
        if (event.key === "Tab") return;
        break;
      case "move":
        api.dispatch({ type: "move", target: (binding.by ?? 1) > 0 ? "next" : "previous" });
        break;
      case "toggle":
        api.dispatch({ type: "select" });
        break;
      case "step": {
        // The per-row quantity, and the reason this key exists: the steppers sit on a row, so a tab
        // stop cannot name which row it reaches — only a key pressed on the active one can.
        const active = api.state.activeKey;
        if (active === null) return;
        api.dispatch((binding.by ?? 1) > 0
          ? { type: "increment", optionKey: active }
          : { type: "decrement", optionKey: active });
        break;
      }
      default:
        return;
    }
    event.preventDefault();
  };

  const parts = api.view.parts;

  /** One row in the panel. What it owes beyond its label is the variant's answer, not this file's. */
  const optionRow = (option: MdySelectOption<TValue>): ReactElement => {
    const key = keyFor(option);
    const count = api.state.counts.get(key) ?? 0;
    const inside: ReactNode[] = mode === "single"
      ? [createElement("span", { key: "check", className: classesOf("optionCheck"), "aria-hidden": "true" })]
      : [
        createElement("button", {
          key: "less", type: "button", className: classesOf("optionStep"),
          "aria-label": `One fewer ${option.label}`,
          onClick: (event: { stopPropagation(): void }) => {
            event.stopPropagation();
            api.dispatch({ type: "decrement", optionKey: key });
          },
        }, "−"),
        createElement("button", {
          key: "more", type: "button", className: classesOf("optionStep"),
          "aria-label": `One more ${option.label}`,
          onClick: (event: { stopPropagation(): void }) => {
            event.stopPropagation();
            api.dispatch({ type: "increment", optionKey: key });
          },
        }, "+"),
      ];
    inside.push(createElement("span", { key: "label", className: classesOf("optionLabel") }, option.label));
    if (mode === "multi") {
      inside.push(createElement("span", { key: "count", className: classesOf("optionCount") }, String(count)));
    }

    return createElement("div", { key, className: classesOf("optionWrapper") }, [
      // The element is the variant's answer: a set of toggles draws each choice as a button, while a
      // bag draws a container with its own controls inside — and a button inside a button is not a
      // thing a browser will render.
      createElement(mode === "single" ? "button" : "div", partProps(parts[key], {
        key: "option",
        ref: (element: HTMLElement | null) => {
          if (element) optionElements.current.set(key, element);
          else optionElements.current.delete(key);
        },
        ...(mode === "single" ? { type: "button" } : {}),
        onClick: () => api.dispatch({ type: "toggle", optionKey: key }),
      }), inside),
    ]);
  };

  const children: ReactNode[] = [];
  if (props.label !== undefined && props.label !== "") {
    children.push(createElement("label", {
      key: "label",
      id: defaultWidgetIdFactory.part(widgetId, "label"),
      htmlFor: parts["trigger"]?.id,
      className: classesOf("label"),
    }, props.label));
  }

  // The controller's list, not the prop: a chip is how a held value is seen and removed, and a value
  // missing from the declared options would otherwise be held with no chip at all.
  const held = api.state.options.filter((option) => api.state.selectedKeys.has(keyFor(option)));

  children.push(createElement("div", { key: "wrapper", className: classesOf("inputWrapper") }, [
    createElement("div", { key: "box", className: classesOf("box") }, [
      // What is held, as a grid: one row of cells, which is how a screen reader counts them and how
      // the arrows walk them.
      createElement("div", partProps(parts["chips"], {
        key: "chips", className: classesOf("chips"), role: roleOf("chips"),
      }), createElement("div", { className: classesOf("chipRow"), role: roleOf("chipRow") },
        held.map((option) => createElement("span", {
          key: keyFor(option), className: classesOf("chip"), role: roleOf("chip"),
        }, [
          createElement("button", {
            key: "move", type: "button", className: classesOf("chipMove"),
            "aria-label": `Move ${option.label}`,
          }),
          createElement("span", { key: "label" }, option.label),
          createElement("button", {
            key: "remove", type: "button", className: classesOf("chipRemove"),
            "aria-label": `Remove ${option.label}`,
            onClick: () => api.dispatch({ type: "toggle", optionKey: keyFor(option) }),
          }),
        ])))),
      // A button, not a text box: the placeholder lives *inside* it, and an `<input>` cannot hold
      // anything. What a person types goes in the panel's filter, not here.
      createElement("button", partProps(parts["trigger"], {
        key: "trigger", ref: anchor, type: "button",
        onClick: () => api.dispatch({ type: "toggleOpen" }),
      }), createElement("span", partProps(parts["placeholder"], { className: classesOf("placeholder") }), placeholder)),
      // The way back from a destructive act, and the one control that must exist whether or not
      // there is anything to undo: a button that appears only once something is lost is a button
      // nobody knows is there. It says so with `aria-disabled`, which leaves it in the tree and
      // announced, rather than with `disabled`, which takes it out of the reading order — a control
      // that comes and goes moves the one beside it under the hands of somebody aiming at it.
      createElement("button", {
        key: "undo", type: "button", className: classesOf("wayBackAction"),
        "aria-disabled": String(api.state.wayBack === null),
        onClick: () => api.dispatch({ type: "undo" }),
      }, "Undo"),
      createElement("button", {
        key: "clear", type: "button", className: classesOf("clearAll"), "aria-label": "Clear all",
        "aria-disabled": String(api.state.selectedKeys.size === 0),
        onClick: () => api.dispatch({ type: "clear" }),
      }),
      createElement("span", { key: "arrow", className: classesOf("arrow"), "aria-hidden": "true" }),
      createElement("span", partProps(parts["announcement"], {
        key: "announcement", className: classesOf("announcement"),
      }), (parts["announcement"] as { readonly text?: string } | undefined)?.text ?? ""),
    ]),
  ]));

  children.push(createPortal(
    createElement("div", partProps(parts["popup"], {
      ref: panel, className: classesOf("popup"), onKeyDown,
    }), [
      ...(searchable
        ? [createElement("input", partProps(parts["search"], {
          key: "search",
          type: "text",
          value: api.state.query,
          onChange: (event: { readonly target: { readonly value: string } }) =>
            api.dispatch({ type: "search", query: event.target.value }),
        }))]
        : []),
      createElement("div", partProps(parts["group"], {
        key: "group", className: classesOf("options"), role: roleOf("options"),
      }), api.state.options.map(optionRow)),
    ]),
    document.body,
    `${widgetId}__popup`,
  ));

  children.push(createElement("p", {
    key: "description",
    id: defaultWidgetIdFactory.part(widgetId, "description"),
    className: classesOf("supportingText"),
  }));

  return createElement("div", {
    className: CONTRACT.rootClasses.join(" "), ref: root, onKeyDown,
  }, children);
}
