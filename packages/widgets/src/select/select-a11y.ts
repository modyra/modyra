/**
 * Select accessibility projection.
 */

import type { MdyPartContract } from "../contract.js";
import type { defaultWidgetIdFactory } from "../ids.js";

export interface MdySelectA11yOptions {
  readonly widgetId: string;
  readonly open: boolean;
  readonly activeKey: string | null;
  readonly selectedKey: string | null;
  readonly disabled: boolean;
  readonly readonly: boolean;
  readonly invalid: boolean;
  readonly loading: boolean;
  readonly idFactory: typeof defaultWidgetIdFactory;
  /** Keys of options currently visible to the user. */
  readonly visibleKeys: readonly string[];
}

export interface MdySelectA11yProjection {
  readonly trigger: MdyPartContract;
  readonly listbox: MdyPartContract;
  readonly option: (key: string) => MdyPartContract;
}

export function projectSelectA11y(
  options: MdySelectA11yOptions,
): MdySelectA11yProjection {
  const { widgetId, idFactory, open, activeKey, selectedKey, disabled, readonly, invalid, loading, visibleKeys } = options;

  const trigger: MdyPartContract = {
    id: idFactory.part(widgetId, "trigger"),
    role: "combobox",
    classes: buildTriggerClasses(open, disabled, readonly, invalid, loading),
    attributes: {
      "aria-haspopup": "listbox",
      "aria-expanded": open,
      "aria-controls": idFactory.part(widgetId, "listbox"),
      "aria-activedescendant": activeKey ? idFactory.item(widgetId, "option", activeKey) : undefined,
      "aria-disabled": disabled || readonly,
      "data-loading": loading || undefined,
    },
  };

  const listbox: MdyPartContract = {
    id: idFactory.part(widgetId, "listbox"),
    role: "listbox",
    classes: buildListboxClasses(open),
    attributes: {
      "aria-labelledby": idFactory.part(widgetId, "trigger"),
      "aria-hidden": !open,
    },
  };

  const option = (key: string): MdyPartContract => ({
    id: idFactory.item(widgetId, "option", key),
    role: "option",
    classes: buildOptionClasses(key === selectedKey, key === activeKey, visibleKeys.includes(key)),
    attributes: {
      "aria-selected": key === selectedKey,
    },
  });

  return { trigger, listbox, option };
}

function buildTriggerClasses(
  open: boolean,
  disabled: boolean,
  readonly: boolean,
  invalid: boolean,
  loading: boolean,
): readonly string[] {
  const classes = ["mdy-select__trigger"];
  if (open) classes.push("mdy-select__trigger--open", "mdy-control--open");
  if (disabled) classes.push("mdy-select__trigger--disabled", "mdy-control--disabled");
  if (readonly) classes.push("mdy-select__trigger--readonly");
  if (invalid) classes.push("mdy-select__trigger--invalid", "mdy-control--invalid");
  if (loading) classes.push("mdy-select__trigger--loading");
  return classes;
}

function buildListboxClasses(open: boolean): readonly string[] {
  const classes = ["mdy-select__listbox"];
  if (open) classes.push("mdy-select__listbox--open");
  return classes;
}

function buildOptionClasses(
  selected: boolean,
  active: boolean,
  visible: boolean,
): readonly string[] {
  const classes = ["mdy-select__option"];
  if (selected) classes.push("mdy-select__option--selected");
  if (active) classes.push("mdy-select__option--active");
  if (!visible) classes.push("mdy-select__option--hidden");
  return classes;
}
