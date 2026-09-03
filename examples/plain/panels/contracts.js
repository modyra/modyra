/**
 * Contracts → lines → price bands: the advanced demo.
 *
 * What it shows: a rule that spans a whole collection is checked where the collection lives, not
 * where a field is drawn. Bands that overlap or leave a gap are refused by the collection that owns
 * them, so the verdict survives collapsing every band; a currency that disagrees with its contract
 * is refused one level up; and sorting the bands for reading never renames them.
 */
import {
  createForm,
  field as mdyField,
  group as mdyGroup,
  record as mdyRecord,
  required as mdyRequired,
} from "@modyra/core";
import { renderField } from "@modyra/plain";
import {
  drawReadings,
  reading,
  readAccessibleName,
  readPartAttribute,
  readPartPresence,
} from "@modyra/widgets/testing";
import { MDY_CLASS_DOORS, MDY_WIDGET_CONTRACTS as CONTRACTS, answerDoor, partIsOwed, presentationClass } from "@modyra/widgets";
import { actionWithHint, badge, level, scenario, toolbar, verdictPrinter } from "./shell.js";

/**
 * A line's bands must tile its quantity axis: each band's minimum below its maximum, no two bands
 * covering the same quantity, and no quantity left uncovered between the lowest and the highest.
 */
export const bandsTile = (bands) => {
  const failures = [];
  const rows = Object.entries(bands ?? {}).map(([key, b]) => ({
    key,
    min: Number(b.minQty ?? 0),
    max: Number(b.maxQty ?? 0),
  }));
  for (const b of rows) {
    if (b.min >= b.max) failures.push(`band ${b.key}: min ${b.min} is not below max ${b.max}`);
  }
  const ordered = [...rows].sort((a, b) => a.min - b.min);
  for (let i = 1; i < ordered.length; i += 1) {
    const previous = ordered[i - 1];
    const current = ordered[i];
    if (current.min < previous.max) failures.push(`bands ${previous.key} and ${current.key} overlap at ${current.min}`);
    else if (current.min > previous.max) failures.push(`bands ${previous.key} and ${current.key} leave ${previous.max}-${current.min} uncovered`);
  }
  return failures;
};

/** Across a contract's lines: one currency, and a price that never rises with quantity. */
export const linesCoherent = (lines) => {
  const failures = [];
  for (const [key, line] of Object.entries(lines ?? {})) {
    const bands = Object.entries(line.bands ?? {})
      .map(([bandKey, b]) => ({ key: bandKey, min: Number(b.minQty ?? 0), price: Number(b.price ?? 0) }))
      .sort((a, b) => a.min - b.min);
    for (let i = 1; i < bands.length; i += 1) {
      if (bands[i].price > bands[i - 1].price) {
        failures.push(`line ${key}: band ${bands[i].key} costs more per unit than ${bands[i - 1].key}`);
      }
    }
  }
  return failures;
};

const bandItem = () =>
  mdyGroup({ minQty: mdyField(0), maxQty: mdyField(0), price: mdyField(0) });

export const contractsPanel = {
  id: "contracts",
  title: "Contracts",
  blurb:
    "Price bands that must tile the quantity axis without overlap or gap, a price that may not rise " +
    "with volume, and a discount the server refuses above its threshold. The rules live on the " +
    "collections they describe, so a collapsed band still gates the contract.",
  exercises: [
    "MDY_ADAPTER_CONTRACT_VIOLATION",
    "MDY_ANY_PRINTABLE_KEY",
    "MDY_ASYNC_FEATURE_DISABLED",
    "MDY_BACKDROP_ATTRIBUTE",
    "MDY_CALENDAR_VIEW_MODES",
    "MDY_CHIP_CLASSES",
    "MDY_CLASS_DOORS",
    "answerDoor",
    "MDY_CHIP_DRAG_THRESHOLD",
    "MDY_COLOR_PRESETS",
    "MDY_CONTRACT_VOCABULARIES",
    "MDY_VOCABULARIES_ELSEWHERE",
    "MDY_CROSS_RUNTIME_OBSERVATION",
    "MDY_CSS_PROPERTIES",
    "MDY_DISABLED_BLOCKS_TRANSITIONS",
    "MDY_DRAFT_KEY_IN_USE",
    "MDY_DRAFT_NOT_RESTORED",
    "MDY_DYNAMIC_DIAGNOSTICS",
    "MDY_DYNAMIC_FIELD_KINDS",
    "MDY_DYNAMIC_INVALID_FIELD",
    "MDY_DYNAMIC_MEMBERS",
    "MDY_DYNAMIC_MEMBER_ARRIVALS",
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
    "presentationClass",
    "MDY_WIDGET_CONTRACT_VERSION",
    "MDY_WIDGET_KEYBOARD",
    "MDY_WIDGET_KINDS",
    "MDY_WIDGET_RELATIONS",
    "MDY_WIDGET_TRANSITIONS",
    "MdyFormEngine",
    "MdyTypedForm",
    "MdyTypedFormBase",
    "NO_CONSTRAINTS",
    "applyPart",
    "assertUsableWidgetId",
    "blocksValueChange",
    "createCommandRuntime",
    "createForm",
    "createTextFieldController",
    "defaultWidgetIdFactory",
    "errorsVisible",
    "factsOf",
    "factsOfAll",
    "field",
    "fieldAccessibleName",
    "fieldCanBeInvalid",
    "fieldDescribedBy",
    "fieldShellPartIds",
    "getFieldHandleOwner",
    "group",
    "holdsUneditedValue",
    "isSafeFieldPath",
    "isValidWidgetId",
    "mdyEmptyValueFor",
    "mergeFacts",
    "messagesForLocale",
    "narrowConstraints",
    "nativeConstraintAttributes",
    "observerFor",
    "projectFieldShellA11y",
    "projectTextFieldA11y",
    "record",
    "registerHandleForm",
    "registerHandleOwner",
    "renderField",
    "renderTextField",
    "required",
    "shellStateClasses",
    "shownErrors",
    "showsAsInvalid",
    "ssrRuntimeCapabilities",
    "textFieldPartIds",
    "textFieldRootClasses",
    "timepickerPlaceholder",
    "vanillaReactivity",
    "visibleErrorsOf",
    "withFacts",
  ],
  invariant:
    "A rule about a whole collection is checked where the collection lives: overlapping bands are " +
    "refused with both names, and sorting them for reading never renames them.",

  mount(work, readout) {
    readout.classList.add("demo-state");
    scenario(
      work,
      "Sei al commerciale. Un contratto quadro fissa, per ogni prodotto, gli scaglioni di prezzo: " +
        "da 1 a 100 pezzi un prezzo, da 100 a 500 un altro. La demo mostra che gli scaglioni devono " +
        "coprire tutte le quantita senza buchi ne sovrapposizioni, e che l'errore nomina le due " +
        "fasce in conflitto anche quando sono chiuse.",
    );

    const form = createForm({
      contracts: mdyRecord(
        mdyGroup({
          customer: mdyField("", [mdyRequired()]),
          currency: mdyField("EUR"),
          lines: mdyRecord(
            mdyGroup({ sku: mdyField(""), bands: mdyRecord(bandItem(), { validators: [bandsTile] }) }),
            { validators: [linesCoherent] },
          ),
        }),
      ),
    });
    form.f.contracts.upsert("C-1", {
      customer: "Acme",
      currency: "EUR",
      lines: {
        l1: {
          sku: "SKU-1",
          bands: {
            b1: { minQty: 1, maxQty: 100, price: 10 },
            b2: { minQty: 100, maxQty: 500, price: 8 },
          },
        },
      },
    });

    let print = () => {};
    let descending = false;
    let collapsed = false;
    let rendered = [];

    const bar = toolbar(work);
    const host = document.createElement("div");
    host.dataset.contractsHost = "";
    work.append(host);

    /** Reading order only: the model's keys are identity, and sorting must not touch them. */
    const bandOrder = (bands) => {
      const keys = bands.keys();
      const byMin = [...keys].sort((a, b) =>
        Number(bands.row(a).minQty.value()) - Number(bands.row(b).minQty.value()));
      return descending ? byMin.reverse() : byMin;
    };

    const draw = () => {
      for (const d of rendered) d?.();
      rendered = [];
      host.replaceChildren();
      for (const contractKey of form.f.contracts.keys()) {
        const contract = form.f.contracts.row(contractKey);
        const box = document.createElement("div");
        box.className = "order-box";
        box.dataset.contract = contractKey;
        const head = document.createElement("strong");
        head.textContent = `Contratto ${contractKey} — ${contract.customer.value()}`;
        box.append(head);
        badge(head, contract.currency.value());
        for (const lineKey of contract.lines.keys()) {
          const line = contract.lines.row(lineKey);
          const lineLevel = level(box, `Riga ${lineKey} — prodotto a listino`);
          const row = document.createElement("div");
          row.className = "grid";
          row.dataset.line = `${contractKey}.${lineKey}`;
          lineLevel.append(row);
          rendered.push(renderField(row, { name: `c-${contractKey}-${lineKey}-sku`, kind: "text", ariaLabel: `SKU ${lineKey}` }, line.sku, form.reactivity));
          if (collapsed) {
            const note = document.createElement("p");
            note.className = "demo-hidden-note";
            const n = line.bands.keys().length;
            note.textContent =
              `${n} ${n === 1 ? "fascia nascosta" : "fasce nascoste"} — le regole di copertura restano attive`;
            lineLevel.append(note);
            continue;
          }
          for (const bandKey of bandOrder(line.bands)) {
            const band = line.bands.row(bandKey);
            const bandLevel = level(lineLevel, `Fascia ${bandKey} — da quanti pezzi, fino a quanti, a che prezzo`);
            const brow = document.createElement("div");
            brow.className = "grid grid--three";
            brow.dataset.band = `${contractKey}.${lineKey}.${bandKey}`;
            bandLevel.append(brow);
            rendered.push(renderField(brow, { name: `c-${contractKey}-${lineKey}-${bandKey}-min`, kind: "number", ariaLabel: `Min ${bandKey}` }, band.minQty, form.reactivity));
            rendered.push(renderField(brow, { name: `c-${contractKey}-${lineKey}-${bandKey}-max`, kind: "number", ariaLabel: `Max ${bandKey}` }, band.maxQty, form.reactivity));
            rendered.push(renderField(brow, { name: `c-${contractKey}-${lineKey}-${bandKey}-price`, kind: "number", ariaLabel: `Price ${bandKey}` }, band.price, form.reactivity));
          }
        }
        host.append(box);
      }
      print();
    };

    const bandsOf = () => form.f.contracts.row("C-1").lines.row("l1").bands;

    actionWithHint(bar, "Move the threshold", "porta la fascia b2 a partire da 80: si sovrappone a b1", () => {
      bandsOf().row("b2").minQty.set(80);
      draw();
    });
    actionWithHint(bar, "Leave a gap", "porta la fascia b2 a partire da 120: 100-120 resta scoperto", () => {
      bandsOf().row("b2").minQty.set(120);
      draw();
    });
    actionWithHint(bar, "Restore the ladder", "riporta b2 a partire da 100: gli scaglioni tornano contigui", () => {
      bandsOf().row("b2").minQty.set(100);
      draw();
    });
    actionWithHint(bar, "Add a band", "aggiunge lo scaglione oltre i 500 pezzi", () => {
      const bands = bandsOf();
      bands.upsert(`b${bands.keys().length + 1}`, { minQty: 500, maxQty: 2000, price: 7 });
      draw();
    });
    actionWithHint(bar, "Raise the top price", "porta l'ultimo scaglione sopra il precedente: il prezzo risale", () => {
      const bands = bandsOf();
      const last = bands.keys()[bands.keys().length - 1];
      if (last) bands.row(last).price.set(99);
      draw();
    });
    actionWithHint(bar, "Sort bands descending", "inverte solo l'ordine di lettura: le chiavi non cambiano", () => {
      descending = !descending;
      draw();
    });
    actionWithHint(bar, "Collapse the bands", "chiude le fasce: le regole di copertura restano attive", () => {
      collapsed = !collapsed;
      draw();
    });
    actionWithHint(bar, "Send for approval", "il server rifiuta lo sconto oltre la soglia sulla fascia b2", () => {
      form.submit(async () => [
        { path: "contracts.C-1.lines.l1.bands.b2.price", kind: "server", message: "Discount above 20% needs approval" },
      ]);
      draw();
    });

    /** The failures a validator writes, in the words the commercial team uses. */
    const readable = (message) =>
      message
        .replace(/^bands (\S+) and (\S+) overlap at (\d+)$/, "Le fasce $1 e $2 si sovrappongono a partire da $3 pezzi")
        .replace(/^bands (\S+) and (\S+) leave (\d+)-(\d+) uncovered$/, "Fra $1 e $2 le quantita da $3 a $4 non hanno prezzo")
        .replace(/^band (\S+): min (\d+) is not below max (\d+)$/, "La fascia $1 parte da $2 e finisce a $3: non copre nulla")
        .replace(/^line (\S+): band (\S+) costs more per unit than (\S+)$/, "Riga $1 — la fascia $2 costa piu di $3: il prezzo risale col volume");

    print = verdictPrinter(
      readout,
      () => ({
        contracts: form.f.contracts.keys(),
        lines: Object.fromEntries(
          form.f.contracts.keys().map((k) => [k, form.f.contracts.row(k).lines.keys()]),
        ),
        bands: form.f.contracts.row("C-1").lines.row("l1").bands.keys(),
        readingOrder: bandOrder(form.f.contracts.row("C-1").lines.row("l1").bands),
        valid: form.state.valid(),
        bandErrors: form.errorsFor("contracts.C-1.lines.l1.bands")().map((e) => e.message),
        lineErrors: Object.fromEntries(
          form.f.contracts.keys().map((k) => [k, form.f.contracts.row(k).lines.errors()]).filter(([, e]) => e.length > 0),
        ),
        serverErrors: form.errorsFor("contracts.C-1.lines.l1.bands.b2.price")().map((e) => e.message),
        value: form.getValue().contracts,
      }),
      (s) => {
        const rows = [];
        rows.push(s.valid
          ? ["ok", "Listino coerente: gli scaglioni coprono tutte le quantita e il prezzo scende col volume"]
          : ["ko", "Listino non applicabile — vedi sotto"]);
        for (const message of s.bandErrors) rows.push(["ko", readable(message)]);
        for (const errs of Object.values(s.lineErrors)) {
          for (const e of errs) rows.push(["ko", readable(e.message)]);
        }
        for (const message of s.serverErrors) rows.push(["ko", `Il server blocca la fascia b2: ${message}`]);
        rows.push(["", `Ordine di lettura: ${s.readingOrder.join(" → ")} — chiavi nel modello: ${s.bands.join(", ")}`]);
        return rows;
      },
    );

    const effect = form.reactivity.effect(() => { form.state.valid(); print(); });
    draw();

    // ── What the page says about itself, and how it was asked ───────────────────────────────────
    //
    // The inspection layer, drawing a real widget. Every row is a reading: it carries a value and
    // says where it came from, or carries the reason there is none. There is no way to put a bare
    // value in this table — `drawReadings` takes readings and has no overload that takes anything
    // else — which is the difference between a rule the authors remember and one the shape keeps.
    //
    // The point is visible in the third column: a blank cell would read as "this is empty", and
    // "empty" is a claim. Several of these rows are legitimately absent, and each says which.
    // What each door is asked on this page. A part for the one that takes a part, a presentation
    // element for the one that takes a presentation element, an appearance for the one that takes an
    // appearance: the doors do not share a signature and pretending they do shows nothing.
    const SAMPLE_CALL = {
      partClasses: ["select", "trigger"],
      presentationClass: ["select", "box"],
      popupPlacementClass: ["select", "above"],
      popupAlignmentClass: ["select", "right"],
      multiselectChipClasses: { role: "value" },
      contractParts: ["select", "trigger"],
    };
    // Every function that puts a class on an element, and what each answers for one kind.
    //
    // A renderer that spells `"mdy-select__trigger"` into its markup and one that asks the contract
    // for it produce the same page, and only the second stays correct when the name changes. The
    // doors are what a renderer asks; the rows below are what they answer, resolved here at runtime
    // rather than described. A door whose answer depends on a value says so instead of showing a
    // class it cannot know.
    const doors = document.createElement("section");
    doors.style.cssText = "margin-top:2rem;padding-top:1rem;border-top:1px solid var(--mdy-outline-variant,#ccc)";
    const doorsHeading = document.createElement("h3");
    doorsHeading.textContent = "Le porte che mettono una classe su un elemento";
    doors.append(doorsHeading);
    const doorsList = document.createElement("dl");
    doorsList.dataset.classDoors = "";
    for (const door of MDY_CLASS_DOORS) {
      const term = document.createElement("dt");
      term.textContent = door.name;
      const answer = document.createElement("dd");
      // Each door is asked something it can answer: they take different arguments, and a door shown
      // returning nothing because it was asked the wrong question teaches the opposite of the point.
      const asked = SAMPLE_CALL[door.name];
      // Asked through the contract's own reader, not by switching on which resolver it carries.
      //
      // This page did switch, and the day a door arrived that is *read* as a path rather than called,
      // the branch that assumed a `resolve` threw — and because the panel is built in one pass the
      // throw took the inspection table below it too. A manifest entry added in one package emptied a
      // page in another. `answerDoor` knows the shapes in the package that defines them, so a shape
      // added tomorrow reaches this page without it being taught anything.
      const answered = answerDoor(door, asked);
      answer.textContent = answered.unresolvable
        ? `dipende da un valore — ${answered.unresolvable}`
        : answered.path
          ? `${answered.classes.join(" ")} — letta come ${answered.path}`
          : answered.classes.join(" ") || `nessuna, per ${[asked ?? []].flat().join("/")}`;
      doorsList.append(term, answer);
    }
    doors.append(doorsList);
    work.append(doors);

    const inspection = document.createElement("section");
    inspection.style.cssText = "margin-top:2rem;padding-top:1rem;border-top:1px solid var(--mdy-outline-variant,#ccc)";
    const inspectionHeading = document.createElement("h3");
    inspectionHeading.textContent = "What this widget says about itself";
    inspection.append(inspectionHeading);

    const inspectionHost = document.createElement("div");
    inspectionHost.dataset.inspection = "";
    inspection.append(inspectionHost);
    work.append(inspection);

    const inspect = () => {
      const subject = work.querySelector(".mdy-renderer--text") ?? work.querySelector(".mdy-renderer");
      inspectionHost.replaceChildren();
      if (!subject) {
        inspectionHost.textContent = "no widget on the page to inspect";
        return;
      }
      const kind = [...subject.classList]
        .map((one) => /^mdy-renderer--(.+)$/.exec(one)?.[1])
        .find((one) => one && CONTRACTS[one]) ?? "text";

      const table = document.createElement("table");
      table.style.cssText = "width:100%;border-collapse:collapse;font-size:.82rem";
      const host = {
        row() {
          const tr = document.createElement("tr");
          table.append(tr);
          return {
            append: (...cells) => {
              for (const cell of cells) tr.append(cell);
            },
          };
        },
        cell(text, cellKind) {
          const td = document.createElement("td");
          td.textContent = text;
          td.style.cssText = "padding:.25rem .5rem;border-top:1px solid var(--mdy-outline-variant,#eee);vertical-align:top"
            + (cellKind === "unread" ? ";opacity:.7;font-style:italic" : "")
            + (cellKind === "label" ? ";font-weight:600;white-space:nowrap" : "");
          return td;
        },
      };

      const nodes = CONTRACTS[kind].structure.nodes;
      // A part is found by its classes where it has any, and by the element the structure says it
      // is where it has none — `control` carries no class of its own, which is why a selector built
      // from classes alone finds nothing and the collector correctly reports that nobody looked.
      const ELEMENT_TAG = { input: "input, textarea, select", button: "button", label: "label" };
      const partOf = (name) => {
        const node = nodes.find((one) => one.part === name);
        if (!node) return undefined;
        const classes = CONTRACTS[kind].parts[name]?.classes ?? [];
        const selector = classes.length > 0
          ? classes.map((c) => `.${c}`).join("")
          : ELEMENT_TAG[node.element] ?? node.element;
        return { name: `${kind}.${name}`, selector, node };
      };
      const control = partOf("control");
      const label = partOf("label");
      const errors = partOf("errors");
      // What actually holds right now, asked of the page rather than assumed. A stub answering
      // "false" to everything makes every optional part read as `extra`, which is a true statement
      // about the stub and a false one about the widget.
      const facts = {
        holds: (condition) => {
          if (condition === "documentDeclaresIt") return true;
          if (condition === "fieldCanBeInvalid") return true;
          if (condition === "overlayIsOpen") return subject.querySelector(".mdy-popup:not([hidden])") !== null;
          return false;
        },
        offers: () => true,
        owes: partIsOwed,
      };

      drawReadings(host, [
        ...(control ? [{ label: "control id", reading: readPartAttribute(subject, control, "id") }] : []),
        ...(control ? [{ label: "control is named", reading: readAccessibleName(
          subject.querySelector(control.selector) ?? { getAttribute: () => null, closest: () => null, textContent: null },
          control.name,
          document,
        ) }] : []),
        ...(label ? [{ label: "label present", reading: readPartPresence(subject, label, facts) }] : []),
        ...(errors ? [{ label: "errors present", reading: readPartPresence(subject, errors, facts) }] : []),
        { label: "a part nobody probes", reading: readPartAttribute(subject, { name: `${kind}.absent`, selector: ".mdy-not-drawn" }, "id") },
        // The third door, read the way a renderer would: by name. What it answers is a class the
        // page is wearing, so a reader can look for it — and asking for one this kind does not
        // declare is refused rather than answered with nothing, which is what the reading shows.
        {
          label: "a presentation class, by name",
          reading: reading(
            { source: `presentationClass("${kind}", …)`, at: kind, method: "contract" },
            () => {
              const named = Object.keys(CONTRACTS[kind]?.presentationClasses ?? {});
              if (named.length === 0) return undefined;
              return `${named[0]} → ${presentationClass(kind, named[0])}`;
            },
          ),
        },
      ], (value) => (typeof value === "object" && value !== null
        ? ("verdict" in value ? `${value.verdict}${value.presentWhen ? ` (${value.presentWhen})` : ""}`
          : `${value.name || "(no name)"} — ${value.mechanism}`)
        : String(value)));

      inspectionHost.append(table);
    };

    inspect();
    actionWithHint(bar, "Re-read the page", "asks every collector again, so an absence that has become present is seen", inspect);

    return () => { effect.destroy(); print.cancel?.(); for (const d of rendered) d?.(); form.destroy(); };
  },
};
