/**
 * Rows that come and go, and the two ways a collection can be keyed.
 *
 * An array is keyed by position: reordering it moves every row after the one that moved, and a
 * handle held across that move must follow its row rather than its index. A record is keyed by data:
 * what is mounted must not decide what exists, so a row can be removed while its controls are on
 * screen and a row can exist before anything has drawn it.
 */
import { createForm, array as mdyArray, field as mdyField, group as mdyGroup, record as mdyRecord, required as mdyRequired } from "@modyra/core";
import { renderField } from "@modyra/plain";
import { action, readoutPrinter, toolbar } from "./shell.js";

export const collectionsPanel = {
  id: "collections",
  title: "Collections",
  blurb:
    "An array of rows and a record keyed by name, both live. Add, remove, move and rename while the controls are mounted; the readout shows what the form holds against what is drawn.",
  /**
   * The public names this panel drives.
   *
   * Declared rather than inferred: `audit-coverage-and-demo` used to search the demo sources for
   * a name, which counted an import line as a demonstration and made almost everything look
   * covered. What a panel exercises is a claim its own browser test checks.
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
    "NO_CONSTRAINTS",
    "applyPart",
    "array",
    "blocksValueChange",
    "createCommandRuntime",
    "createForm",
    "createTextFieldController",
    "defaultWidgetIdFactory",
    "field",
    "fieldAccessibleName",
    "fieldCanBeInvalid",
    "group",
    "mdyEmptyValueFor",
    "messagesForLocale",
    "observerFor",
    "record",
    "renderField",
    "required",
    "shellStateClasses",
    "ssrRuntimeCapabilities",
    "timepickerPlaceholder",
    "visibleErrorsOf",
  ],

  invariant:
    "A row exists because it was declared, not because it was mounted. Removing the elements does not remove the row, and moving a row carries its handle, its errors and its touched state with it.",

  mount(work, readout) {
    const form = createForm({
      items: mdyArray(mdyGroup({ name: mdyField("", [mdyRequired()]), qty: mdyField(1) }), {
        initial: [{ name: "Bolt", qty: 4 }, { name: "Nut", qty: 8 }],
      }),
      people: mdyRecord(mdyField("", [mdyRequired()]), { initial: { ada: "Ada", alan: "Alan" } }),
      // A row that owns a collection of its own: the order is keyed by data, and so are its lines.
      orders: mdyRecord(mdyGroup({
        customer: mdyField("", [mdyRequired()]),
        lines: mdyRecord(mdyGroup({ sku: mdyField(""), qty: mdyField(1) })),
      })),
    });
    form.f.orders.upsert("o1", { customer: "Ada", lines: { l1: { sku: "SKU-1", qty: 2 } } });

    let print = () => {};

    const arrayBar = toolbar(work);
    const arrayHost = document.createElement("div");
    arrayHost.dataset.arrayHost = "";
    work.append(arrayHost);

    const recordBar = toolbar(work);
    const recordHost = document.createElement("div");
    recordHost.dataset.recordHost = "";
    work.append(recordHost);

    const nestedHost = document.createElement("div");
    nestedHost.dataset.nestedHost = "";

    /**
     * Redraw both collections from the handles. The rows decide; the DOM follows.
     *
     * It prints as well as draws. Drawing touches no signal, so an effect watching the model would
     * never re-run — and the readout would keep reporting the number of rows that were on screen
     * before the redraw, with the authority of a current measurement.
     */
    /** Renderer teardowns from the last draw; a redraw disposes them before replacing the nodes. */
    let rendered = [];

    const draw = () => {
      for (const d of rendered) d?.();
      rendered = [];
      arrayHost.replaceChildren();
      form.f.items.rows().forEach((row, index) => {
        const line = document.createElement("div");
        line.className = "grid";
        line.dataset.row = String(index);
        arrayHost.append(line);
        rendered.push(renderField(line, { name: `items.${index}.name`, kind: "text", label: `Item ${index + 1}` }, row.name, form.reactivity));
        rendered.push(renderField(line, { name: `items.${index}.qty`, kind: "number", label: "Qty" }, row.qty, form.reactivity));
      });

      recordHost.replaceChildren();
      for (const key of form.f.people.keys()) {
        const line = document.createElement("div");
        line.className = "grid";
        line.dataset.key = key;
        recordHost.append(line);
        rendered.push(renderField(line, { name: `people.${key}`, kind: "text", label: key, ariaLabel: `Person ${key}` }, form.f.people.row(key), form.reactivity));
      }

      // The nested lines are real controls, not just readout: each order row draws its own lines
      // through its own handle, so a removed order takes its inputs off the screen with it.
      nestedHost.replaceChildren();
      for (const orderKey of form.f.orders.keys()) {
        const order = form.f.orders.row(orderKey);
        for (const lineKey of order.lines.keys()) {
          const line = document.createElement("div");
          line.className = "grid";
          line.dataset.line = `${orderKey}.${lineKey}`;
          nestedHost.append(line);
          rendered.push(renderField(line, { name: `orders.${orderKey}.lines.${lineKey}.sku`, kind: "text", label: `Line ${lineKey}`, ariaLabel: `Line ${lineKey} SKU` }, order.lines.row(lineKey).sku, form.reactivity));
          rendered.push(renderField(line, { name: `orders.${orderKey}.lines.${lineKey}.qty`, kind: "number", label: "Qty", ariaLabel: `Line ${lineKey} qty` }, order.lines.row(lineKey).qty, form.reactivity));
        }
      }
      print();
    };

    action(arrayBar, "Push a row", () => { form.f.items.push({ name: "", qty: 1 }); draw(); });
    action(arrayBar, "Insert at 0", () => { form.f.items.insert(0, { name: "First", qty: 1 }); draw(); });
    action(arrayBar, "Move 0 → last", () => { form.f.items.move(0, form.f.items.length() - 1); draw(); });
    action(arrayBar, "Remove last", () => { form.f.items.remove(form.f.items.length() - 1); draw(); });
    // Deliberately without a redraw: the rows are gone from the model and still on screen. The
    // readout is what tells the truth, and the two disagreeing is the point being demonstrated.
    action(arrayBar, "Clear the model only", () => form.f.items.setAll([]));
    action(arrayBar, "Redraw", draw);

    action(recordBar, "Upsert 'grace'", () => { form.f.people.upsert("grace", "Grace"); draw(); });
    action(recordBar, "Rename ada → ada2", () => { form.f.people.rename("ada", "ada2"); draw(); });
    action(recordBar, "Remove alan", () => { form.f.people.remove("alan"); draw(); });
    action(recordBar, "Touch everything", () => { form.markAllTouched(); });

    // A collection inside a row. Nothing here reaches for a path: the row hands back its own
    // collection, and removing the order takes its lines with it.
    const nestedBar = toolbar(work);
    const lines = () => form.f.orders.row("o1").lines;
    action(nestedBar, "Add a line", () => {
      lines().upsert(`l${lines().keys().length + 1}`, { sku: `SKU-${lines().keys().length + 1}`, qty: 1 });
      draw();
    });
    action(nestedBar, "Rename the first line", () => {
      const [first] = lines().keys();
      if (first) lines().rename(first, `${first}-renamed`);
      draw();
    });
    action(nestedBar, "Remove the order", () => { form.f.orders.remove("o1"); draw(); });
    action(nestedBar, "Declare the order again", () => {
      form.f.orders.upsert("o1", { customer: "Ada", lines: { l1: { sku: "SKU-1", qty: 2 } } });
      draw();
    });
    work.append(nestedHost);

    draw();

    print = readoutPrinter(readout, () => ({
      items: form.f.items.rows().map((row) => ({ name: row.name.value(), qty: row.qty.value(), touched: row.name.touched() })),
      itemsDrawn: arrayHost.querySelectorAll("[data-row]").length,
      people: Object.fromEntries(form.f.people.keys().map((k) => [k, form.f.people.row(k).value()])),
      peopleDrawn: recordHost.querySelectorAll("[data-key]").length,
      formValid: form.state.valid(),
      orders: form.f.orders.keys(),
      // Read through the row's own handle, which is the whole point: no path is spelled out here.
      orderLines: form.f.orders.has("o1") ? form.f.orders.row("o1").lines.keys() : [],
      nestedDrawn: nestedHost.querySelectorAll("[data-line]").length,
      nestedValue: form.getValue().orders,
    }));

    const effect = form.reactivity.effect(() => {
      form.state.valid();
      form.f.items.length();
      form.f.people.keys();
      form.f.orders.keys();
      for (const row of form.f.items.rows()) { row.name.value(); row.name.touched(); }
      print();
    });

    return () => { effect.destroy(); print.cancel(); for (const d of rendered) d?.(); form.destroy(); };
  },
};
