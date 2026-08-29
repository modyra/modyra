/**
 * A controller driven by hand, with no wrapper between.
 *
 * The four reactivity adapters other than React ship two wrappers where React ships seven, and that
 * gap is deliberate: a wrapper is ergonomics, not capability. This panel is the proof — it builds a
 * datepicker from the controller directly, does the two things a wrapper would do, and renders the
 * parts from `view()` without importing a renderer at all.
 *
 * It is also the check on the recipe in `docs/guides/headless-recipes.md`: a snippet nobody runs is
 * a snippet that stops compiling and nobody notices.
 */
import { createForm, field as mdyField, observerFor, required as mdyRequired } from "@modyra/core";
import {
  createCommandRuntime,
  createDatepickerFieldController,
  subscribeController,
} from "@modyra/widgets";
import { action, readoutPrinter, toolbar } from "./shell.js";

export const headlessPanel = {
  id: "headless",
  title: "Headless",

  /**
   * The public names this panel drives.
   */
  exercises: [
    "MDY_ADAPTER_CONTRACT_VIOLATION",
    "MDY_ANY_PRINTABLE_KEY",
    "MDY_ASYNC_FEATURE_DISABLED",
    "MDY_BACKDROP_ATTRIBUTE",
    "MDY_CALENDAR_VIEW_MODES",
    "MDY_CHIP_CLASSES",
    "MDY_CHIP_DRAG_THRESHOLD",
    "MDY_COLOR_PRESETS",
    "MDY_CONTRACT_VOCABULARIES",
    "MDY_CROSS_RUNTIME_OBSERVATION",
    "MDY_CSS_PROPERTIES",
    "MDY_DISABLED_BLOCKS_TRANSITIONS",
    "MDY_DRAFT_KEY_IN_USE",
    "MDY_DRAFT_NOT_RESTORED",
    "MDY_DYNAMIC_DIAGNOSTICS",
    "MDY_DYNAMIC_FIELD_KINDS",
    "MDY_DYNAMIC_INVALID_FIELD",
    "MDY_DYNAMIC_MEMBERS",
    "MDY_EFFECTS_UNAVAILABLE",
    "MDY_EVERY_TIME",
    "MDY_FIELD_KINDS",
    "MDY_FIELD_SHELL_CLASSES",
    "MDY_FIELD_STATE_CLASSES",
    "MDY_FORM_SHELL_CLASSES",
    "MDY_FORM_SHELL_STRUCTURE",
    "MDY_I18N_DEFAULT_TAGS",
    "MDY_I18N_MESSAGES_DE",
    "MDY_I18N_MESSAGES_DEFAULT",
    "MDY_I18N_MESSAGES_ES",
    "MDY_I18N_MESSAGES_FR",
    "MDY_I18N_MESSAGES_IT",
    "MDY_I18N_PRESETS",
    "MDY_ICONS",
    "MDY_ICON_GRID",
    "MDY_ICON_SPANS",
    "MDY_ICON_STROKE",
    "MDY_ID_DELIMITER",
    "MDY_LAYOUT_BREAKPOINTS",
    "MDY_LAYOUT_CLASSES",
    "MDY_LAYOUT_COLUMN_COUNT_PROPERTIES",
    "MDY_LAYOUT_COLUMN_COUNT_PROPERTY",
    "MDY_LAYOUT_COLUMN_DISPLAY_PROPERTIES",
    "MDY_LAYOUT_COLUMN_START_PROPERTIES",
    "MDY_LAYOUT_MAX_DEPTH",
    "MDY_MARKS_REQUIRED",
    "MDY_MAX_EXPRESSION_DEPTH",
    "MDY_OVERLAY_GAP",
    "MDY_OVERLAY_PORTAL_CLASS",
    "MDY_OVERLAY_VIEWPORT_MARGIN",
    "MDY_PART_NAMES",
    "MDY_PART_PRESENCE",
    "MDY_PART_PRESENCES",
    "MDY_PART_REQUIRES",
    "MDY_POPUP_CLASS",
    "MDY_POPUP_OPENERS",
    "MDY_PRESENCE_RESOLUTION",
    "MDY_SCOPE_DESTROYED",
    "MDY_SEMANTICS_REQUIRING_NAME",
    "MDY_SHARED_REGION_ATTRIBUTE",
    "MDY_SHARED_REGION_ID",
    "MDY_SSR_SNAPSHOT_MISMATCH",
    "MDY_STATE_EXPRESSION",
    "MDY_TIMEPICKER_ADVANCE_MS",
    "MDY_TIMEPICKER_DEFAULT_FORMAT",
    "MDY_TIMEPICKER_INITIAL_VIEW",
    "MDY_TIMEPICKER_INNER_RING",
    "MDY_TIMEPICKER_NUMBER_SIZE",
    "MDY_TIMEPICKER_RING_BAND",
    "MDY_TYPEAHEAD_IDLE_MS",
    "MDY_UNSUPPORTED_ADAPTER_OPTION",
    "MDY_VALIDATION_MESSAGES",
    "MDY_VALIDATION_MESSAGES_DEFAULT",
    "MDY_VALIDATOR_FACTS",
    "MDY_VALUE_CONTRACTS",
    "MDY_WIDGET_CONTRACTS",
    "MDY_WIDGET_CONTRACT_VERSION",
    "MDY_WIDGET_KEYBOARD",
    "MDY_WIDGET_KINDS",
    "MDY_WIDGET_RELATIONS",
    "MDY_WIDGET_TRANSITIONS",
    "MdyFormEngine",
    "MdyTypedForm",
    "MdyTypedFormBase",
    "NO_CONSTRAINTS",
    "assertUsableWidgetId",
    "blocksFocus",
    "blocksValueChange",
    "calendarDayId",
    "createCommandRuntime",
    "createDatepickerFieldController",
    "createForm",
    "createMdyAnnouncer",
    "datepickerFieldPartIds",
    "datepickerFieldRootClasses",
    "defaultWidgetIdFactory",
    "errorsVisible",
    "factsOf",
    "factsOfAll",
    "field",
    "fieldCanBeInvalid",
    "fieldDescribedBy",
    "fieldShellRootClasses",
    "getFieldHandleOwner",
    "holdsUneditedValue",
    "isSafeFieldPath",
    "isValidWidgetId",
    "mergeFacts",
    "observerFor",
    "processWidgetCommands",
    "projectDatepickerFieldA11y",
    "projectOverlayOpenerA11y",
    "reactivityRunsEffects",
    "registerHandleForm",
    "registerHandleOwner",
    "required",
    "shownErrors",
    "showsAsInvalid",
    "ssrRuntimeCapabilities",
    "subscribeController",
    "timepickerPlaceholder",
    "vanillaReactivity",
    "withFacts",
  ],

  blurb:
    "A datepicker built from the controller with no wrapper and no renderer — the two things a host has to do are the subscription and the command execution, and both are one call each. Everything on screen below is drawn from `view()`.",
  invariant:
    "A controller is enough. `observerFor` resolves the runtime that owns the handle — building a fresh one works by accident and stops working, silently, the moment the handle belongs to another adapter's form.",

  mount(work, readout) {
    const form = createForm({ when: mdyField(null, [mdyRequired()]) });
    const handle = form.f.when;
    const runtime = observerFor(handle);

    // Exactly the recipe: the controller, and nothing that knows about a framework.
    const controller = createDatepickerFieldController({ widgetId: "headless", handle }, runtime);

    // Declared before `draw` uses it: this renderer's effects land on a task, so the readout is
    // printed on the beat the host paints on rather than during the write that caused it.
    let print = () => {};

    const bar = toolbar(work);
    const grid = document.createElement("div");
    grid.dataset.headlessGrid = "";
    grid.style.cssText = "display:grid;grid-template-columns:repeat(7,2rem);gap:2px";
    work.append(grid);

    /** The host's own rendering, from the view contract and nothing else. */
    const draw = () => {
      const state = controller.state();
      const view = controller.view();
      grid.replaceChildren();
      for (const cell of state.cells) {
        const button = document.createElement("button");
        button.type = "button";
        const part = view.parts[cell.iso];
        button.className = part.classes.join(" ");
        for (const [name, value] of Object.entries(part.attributes)) {
          if (value !== null && value !== undefined) button.setAttribute(name, String(value));
        }
        button.textContent = String(cell.day);
        button.addEventListener("click", () => execute(controller.dispatch({ type: "select-date", iso: cell.iso })));
        grid.append(button);
      }
      print();
    };

    // The command executor. `defer` is the only part that is genuinely this host's: it is *when*
    // the host has finished rendering, and focusing before that moves focus to a node about to go.
    const commands = createCommandRuntime({
      announcerId: "mdy-headless-announcer",
      defer: (run) => { queueMicrotask(run); },
    });
    const execute = (produced) => {
      commands.execute(produced, (part) => grid.querySelector(`[id$="${part}"]`) ?? undefined, {
        setOpen: () => undefined,
        onTouched: () => undefined,
        onDirty: () => undefined,
      });
      draw();
    };

    // Both signals, not one: the view is a computed over the state today, and the contract does not
    // promise it stays that way.
    const stop = subscribeController(controller, runtime, draw);

    action(bar, "Previous month", () => execute(controller.dispatch({ type: "navigate-month", delta: -1 })));
    action(bar, "Next month", () => execute(controller.dispatch({ type: "navigate-month", delta: 1 })));
    action(bar, "Clear", () => execute(controller.dispatch({ type: "clear" })));

    print = readoutPrinter(readout, () => ({
      selected: controller.state().selectedDate,
      month: `${controller.state().viewYear}-${String(controller.state().viewMonth).padStart(2, "0")}`,
      cellsDrawn: grid.querySelectorAll("button").length,
      // The runtime the controller observes on is the form's, not one this panel invented.
      observesTheFormsRuntime: observerFor(handle) === runtime,
      formValid: form.state.valid(),
    }));

    draw();
    return () => { stop(); print.cancel(); form.destroy(); };
  },
};
