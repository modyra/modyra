/**
 * Select accessibility projection.
 */

import { projectOverlayOpenerA11y } from "../opener-a11y.js";
import { MDY_WIDGET_CONTRACTS } from "../catalog.js";
import { fieldShellPartIds } from "../field/shell-a11y.js";
import type { MdyPartContract } from "../contract.js";

const SELECT = MDY_WIDGET_CONTRACTS.select;
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
  /**
   * Whether the error list and the supporting text are on screen.
   *
   * `aria-describedby` must name an element that exists, so what the trigger describes itself by
   * follows what was *rendered* rather than what is wrong. The renderer knows both; this projection
   * cannot see the DOM.
   */
  readonly errorsVisible?: boolean;
  readonly descriptionVisible?: boolean;
}

export interface MdySelectA11yProjection {
  readonly trigger: MdyPartContract;
  /** The filter field. It lives inside the popup, not over the trigger's own text. */
  readonly search: MdyPartContract;
  readonly listbox: MdyPartContract;
  readonly option: (key: string) => MdyPartContract;
}

export function projectSelectA11y(
  options: MdySelectA11yOptions,
): MdySelectA11yProjection {
  const { widgetId, idFactory, open, activeKey, selectedKey, disabled, readonly, invalid, loading, visibleKeys } = options;
  const { descriptionId, errorId } = fieldShellPartIds(widgetId);
  const describedBy = options.errorsVisible
    ? errorId
    : (options.descriptionVisible ?? true) ? descriptionId : null;

  const trigger: MdyPartContract = {
    id: idFactory.part(widgetId, "trigger"),
    role: "combobox",
    classes: buildTriggerClasses(open, disabled, readonly, invalid, loading),
    attributes: {
      "aria-haspopup": "listbox",
      ...projectOverlayOpenerA11y("select", { widgetId, open })?.attributes,
      "aria-activedescendant": activeKey ? idFactory.item(widgetId, "option", activeKey) : undefined,
      "aria-invalid": String(invalid),
      // The relation every other kind's projection already made, and this one did not: without it a
      // select's errors reach no assistive technology at all.
      "aria-describedby": describedBy,
      // Disabled alone: a read-only control still takes focus and can be copied from.
      "aria-disabled": String(disabled),
      // The native attribute, not only the ARIA. A trigger that says `aria-disabled="true"` and
      // stays clickable is disabled in appearance only — the multiselect trigger has carried this
      // all along, and the two were inconsistent for no reason.
      disabled,
      "data-loading": loading || undefined,
    },
  };

  const search: MdyPartContract = {
    id: idFactory.part(widgetId, "search"),
    classes: ["mdy-select__search"],
    attributes: {
      role: "combobox",
      "aria-expanded": String(open),
      "aria-controls": idFactory.part(widgetId, "listbox"),
      "aria-activedescendant": activeKey ? idFactory.item(widgetId, "option", activeKey) : undefined,
      "aria-autocomplete": "list",
    },
  };

  const listbox: MdyPartContract = {
    id: idFactory.part(widgetId, "listbox"),
    role: "listbox",
    classes: buildListboxClasses(open),
    attributes: {
      "aria-labelledby": idFactory.part(widgetId, "trigger"),
      "aria-hidden": String(!open),
    },
  };

  const option = (key: string): MdyPartContract => ({
    id: idFactory.item(widgetId, "option", key),
    role: "option",
    classes: buildOptionClasses(key === selectedKey, key === activeKey, visibleKeys.includes(key)),
    attributes: {
      "aria-selected": String(key === selectedKey),
      // Filtering is the contract's, not the adapter's: an option the query does not match is
      // hidden here, so every renderer filters identically by applying the part.
      hidden: !visibleKeys.includes(key),
    },
  });

  return { trigger, search, listbox, option };
}

function buildTriggerClasses(
  open: boolean,
  disabled: boolean,
  readonly: boolean,
  invalid: boolean,
  loading: boolean,
): readonly string[] {
  const classes = [...SELECT.parts.trigger.classes];
  if (open) classes.push("mdy-select__trigger--open", "mdy-control--open");
  if (disabled) classes.push("mdy-select__trigger--disabled", "mdy-control--disabled");
  if (readonly) classes.push("mdy-select__trigger--readonly");
  if (invalid) classes.push("mdy-select__trigger--invalid", "mdy-control--invalid");
  if (loading) classes.push("mdy-select__trigger--loading");
  return classes;
}

function buildListboxClasses(open: boolean): readonly string[] {
  const classes = [...SELECT.parts.listbox.classes];
  if (open) classes.push(...SELECT.parts.listbox.classes.map((c) => `${c}--open`));
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
