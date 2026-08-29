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
  /**
   * Whether the form is asking for an answer here.
   *
   * A combobox is not a native control and carries none of a field's rules on its own: without this
   * a required select announced nothing about being required, while its two siblings said so — and
   * the renderers that said it were each deciding for themselves what the contract had not.
   *
   * Optional so a caller with no field behind the widget says nothing rather than guessing.
   */
  readonly required?: boolean;
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
  /**
   * Which of the kind's two shapes this is, as `variantOf` answers it.
   *
   * The custom combobox is a control this library builds, so it carries the whole opener relation —
   * expanded, controls, the cursor it points at. The native chooser is the platform's, and the
   * platform owns that popup: those attributes describe a list this projection does not draw, and
   * on an element whose role does not admit them they are dropped without a word. What both shapes
   * share is the field's own verdict — wrong, required, described by, out of play — and that is
   * what stays unconditional. ADR 0176.
   *
   * Defaults to the custom shape, which is what every caller drew before the variants were declared.
   */
  readonly variant?: string;
}

export interface MdySelectA11yProjection {
  readonly trigger: MdyPartContract;
  /** The filter field. It lives inside the popup, not over the trigger's own text. */
  readonly search: MdyPartContract;
  readonly options: MdyPartContract;
  readonly option: (key: string, disabled?: boolean) => MdyPartContract;
}

export function projectSelectA11y(
  options: MdySelectA11yOptions,
): MdySelectA11yProjection {
  const { widgetId, idFactory, open, activeKey, selectedKey, disabled, readonly, invalid, loading, visibleKeys } = options;
  const { descriptionId, errorId } = fieldShellPartIds(widgetId);
  const describedBy = options.errorsVisible
    ? errorId
    : (options.descriptionVisible ?? true) ? descriptionId : null;

  const native = options.variant === "native";
  const trigger: MdyPartContract = {
    id: idFactory.part(widgetId, "trigger"),
    // A `<select>` carries the role already, from being one. Naming it again is at best a repetition
    // and at worst a disagreement with the element underneath.
    ...(native ? {} : { role: "combobox" as const }),
    classes: buildTriggerClasses(open, disabled, readonly, invalid, loading),
    attributes: {
      ...(native
        ? {}
        : {
            ...projectOverlayOpenerA11y("select", { widgetId, open, controlsRendered: options.popupRendered ?? true })?.attributes,
            "aria-activedescendant": activeKey ? idFactory.item(widgetId, "option", activeKey) : undefined,
          }),
      /**
       * The caption, then what the field holds — in that order, and only on the shape that needs it.
       *
       * A `<label for>` names a button, and that is the problem rather than the fix: the computation
       * takes the caption and stops, so the button's own content — which for this control *is* the
       * chosen value — is never appended. A person reaching the field hears what it asks and not
       * what it holds.
       *
       * Two references solve it, the second being the trigger itself: a self-reference in
       * `aria-labelledby` contributes the element's own content, so the name reads "Country, France"
       * without the value needing an id of its own. The `<label for>` stays — it no longer supplies
       * the name, but it is what makes clicking the caption reach the control.
       *
       * The platform's own chooser needs none of this. A `<select>` has a value the reader announces
       * separately, so `for` alone gives "Country, combo box, France", and overriding it would take
       * apart what the platform already does right.
       */
      ...(native
        ? {}
        : { "aria-labelledby": `${fieldShellPartIds(widgetId).labelId} ${idFactory.part(widgetId, "trigger")}` }),
      "aria-invalid": String(invalid),
      ...(options.required === undefined ? {} : { "aria-required": String(options.required) }),
      // The relation every other kind's projection already made, and this one did not: without it a
      // select's errors reach no assistive technology at all.
      "aria-describedby": describedBy,
      // Disabled alone: a read-only control still takes focus and can be copied from.
      "aria-disabled": String(disabled),
      // And read-only said in its own word. The controller refuses the change either way; without
      // this a trigger that will not open its list looks identical to one that will.
      "aria-readonly": readonly ? "true" : null,
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
      "aria-controls": idFactory.part(widgetId, "options"),
      "aria-activedescendant": activeKey ? idFactory.item(widgetId, "option", activeKey) : undefined,
      "aria-autocomplete": "list",
    },
  };

  const optionList: MdyPartContract = {
    id: idFactory.part(widgetId, "options"),
    role: "listbox",
    classes: buildListboxClasses(open),
    attributes: {
      "aria-labelledby": idFactory.part(widgetId, "trigger"),
      "aria-hidden": String(!open),
    },
  };

  const option = (key: string, optionDisabled = false): MdyPartContract => ({
    id: idFactory.item(widgetId, "option", key),
    role: "option",
    classes: buildOptionClasses(key === selectedKey, key === activeKey, visibleKeys.includes(key), optionDisabled),
    attributes: {
      "aria-selected": String(key === selectedKey),
      // An option a document closed says so before it is pressed. The press is refused either way —
      // the controller will not take it — and an option drawn exactly like an available one invites
      // the press, answers nothing, and explains nothing: a person who cannot see the list reads
      // that as a broken control, and one who can reads it as their own misclick.
      "aria-disabled": String(optionDisabled),
      disabled: optionDisabled,
      // Filtering is the contract's, not the adapter's: an option the query does not match is
      // hidden here, so every renderer filters identically by applying the part.
      hidden: !visibleKeys.includes(key),
    },
  });

  return { trigger, search, options: optionList, option };
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
  const classes = [...SELECT.parts.options.classes];
  if (open) classes.push(...SELECT.parts.options.classes.map((c) => `${c}--open`));
  return classes;
}

function buildOptionClasses(
  selected: boolean,
  active: boolean,
  visible: boolean,
  disabled: boolean,
): readonly string[] {
  const base = SELECT.parts.option.classes[0] ?? "mdy-select__option";
  const states: ReadonlyArray<[boolean, MdyStateName]> = [
    [selected, "selected"], [active, "active"], [!visible, "hidden"], [disabled, "disabled"],
  ];
  return [base, ...states.filter(([on]) => on).map(([, state]) => stateClass(base, state))];
}
