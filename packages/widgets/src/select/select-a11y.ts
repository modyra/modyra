/**
 * Select accessibility projection.
 */

import { projectOverlayOpenerA11y } from "../opener-a11y.js";
import { MDY_WIDGET_CONTRACTS } from "../catalog.js";
import { fieldShellPartIds } from "../field/shell-a11y.js";
import { stateClass, type MdyStateName } from "../state.js";
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
  /**
   * Whether the listbox is in the document.
   *
   * Not the same question as `open`: an eagerly-mounted popup is present and hidden while closed, a
   * lazily-mounted one does not exist until it opens. Defaults to true.
   */
  readonly popupRendered?: boolean;
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
      ...projectOverlayOpenerA11y("select", { widgetId, open, controlsRendered: options.popupRendered ?? true })?.attributes,
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
  // The trigger's own declared states, and only those. A parallel `mdy-control--*` spelling of the
  // same states is not emitted here: no theme styles one, so it would put classes on the trigger
  // that paint nothing.
  // Derived from the declared vocabulary rather than spelled out. `state.ts` exists because a
  // renderer writing `mdy-select__trigger--open` and a theme writing a rule for it agree only by
  // coincidence — and this file was writing eight of them by hand.
  const base = SELECT.parts.trigger.classes[0]!;
  const states: ReadonlyArray<[boolean, MdyStateName]> = [
    [open, "open"], [disabled, "disabled"], [readonly, "readonly"],
    [invalid, "invalid"], [loading, "loading"],
  ];
  return [
    ...SELECT.parts.trigger.classes,
    ...states.filter(([on]) => on).map(([, state]) => stateClass(base, state)),
  ];
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
  const base = SELECT.parts.option.classes[0] ?? "mdy-select__option";
  const states: ReadonlyArray<[boolean, MdyStateName]> = [
    [selected, "selected"], [active, "active"], [!visible, "hidden"],
  ];
  return [base, ...states.filter(([on]) => on).map(([, state]) => stateClass(base, state))];
}
