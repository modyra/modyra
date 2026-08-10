// Full-catalog demo for the framework-free renderer: every packaged theme, every palette engine,
// explicit light/dark/auto mode, and the live contract verdict for what is on screen.
import { MDY_PALETTE_MODELS } from "@modyra/core/color-utils";
import { compileMdyTheme, serializeMdyThemeCss } from "@modyra/core/theme-compiler";
import { createForm, field as mdyField, group as mdyGroup, record as mdyRecord } from "@modyra/core";
import { mountMdyForm, renderField } from "@modyra/plain";
import { MDY_WIDGET_CONTRACTS } from "@modyra/widgets";
import { inspectWidgetDom, portalRootFor } from "@modyra/widgets/testing";

const THEMES = {
  modern: "modyra-modern.css",
  // `modyra.css` is the structural layer that `modyra-foundation.css` imports; loading it alone
  // renders the foundation without Material's field, which is not what the package ships as its
  // default. `@modyra/styles/default.css` is this file.
  default: "modyra-default.css",
  material: "modyra-material.css",
  ios: "modyra-ios.css",
  ionic: "modyra-ionic.css",
  "tokens only": "modyra-base.css",
};

const DEFAULT_BRAND = "#004cff";
const COMPILED_THEME_NAME = "modyra-salience";

const colors = [
  { value: "indigo", label: "Indigo" },
  { value: "cloud", label: "Cloud" },
  { value: "night", label: "Night" },
];

const FIELDS = [
  { name: "brand", kind: "colors", label: "Brand colour", initialValue: "#0084ff" },
  { name: "birthday", kind: "datepicker", initialValue: "2026-07-15", label: "Birthday" },
  {
    name: "country",
    kind: "select",
    initialValue: "it",
    label: "Country",
    options: [
      { value: "it", label: "Italy" },
      { value: "fr", label: "France" },
      { value: "de", label: "Germany" },
    ],
  },
  {
    name: "billing",
    kind: "segmented",
    initialValue: "yearly",
    label: "Billing",
    options: [
      { value: "monthly", label: "Monthly" },
      { value: "yearly", label: "Yearly" },
    ],
  },
  {
    name: "servings",
    kind: "multiselect",
    initialValue: ["espresso", "espresso"],
    mode: "multi",
    label: "Servings",
    options: [
      { value: "espresso", label: "Espresso" },
      { value: "cornetto", label: "Cornetto" },
    ],
  },
  {
    name: "name",
    kind: "text",
    label: "Full name",
    validators: { required: true },
    description: "As printed on the document.",
  },
  { name: "email", kind: "email", label: "Email", validators: { required: true, email: true } },
  { name: "password", kind: "password", label: "Password", validators: { minLength: 8 } },
  { name: "bio", kind: "textarea", label: "Bio", placeholder: "A line or two" },
  { name: "age", kind: "number", label: "Age", validators: { min: 18, max: 120 } },
  { name: "volume", kind: "slider", label: "Volume" },
  { name: "terms", kind: "checkbox", label: "I accept the terms", validators: { required: true } },
  { name: "newsletter", kind: "toggle", label: "Send me the newsletter" },
  {
    name: "plan",
    kind: "radio",
    label: "Plan",
    options: [
      { value: "basic", label: "Basic" },
      { value: "pro", label: "Pro" },
    ],
  },
  { name: "palette", kind: "multiselect", label: "Palette", options: colors },
  { name: "stay", kind: "daterange", label: "Stay" },
  { name: "meeting", kind: "timepicker", label: "Meeting" },
  { name: "cv", kind: "file", label: "CV", accept: ".pdf,.doc", multiple: true },
];

const root = document.documentElement;
const formHost = document.querySelector("[data-form]");
const statePre = document.querySelector("[data-state]");
const banner = document.querySelector("#conformance");
const themeBar = document.querySelector("[data-themes]");
const paletteBar = document.querySelector("[data-palette]");
const modeBar = document.querySelector("[data-color-mode]");
const structuralThemeLink = document.getElementById("modyra-theme");
const staticCompiledThemeLink = document.getElementById("modyra-compiled-theme");

if (!(formHost && statePre && banner && themeBar && paletteBar && modeBar)) {
  throw new Error("The demo document is missing one or more required hosts.");
}
if (!(structuralThemeLink instanceof HTMLLinkElement)) {
  throw new Error("#modyra-theme must be a stylesheet link.");
}

// Runtime salience output is kept separate from the static startup CSS. Once the compiler runs,
// the static file is disabled so only one compiled token set can participate in the cascade.
const compiledThemeStyle = document.createElement("style");
compiledThemeStyle.id = "modyra-runtime-compiled-theme";
document.head.append(compiledThemeStyle);

function isHexColour(value) {
  return typeof value === "string" && /^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(value.trim());
}

function normalizedBrand(value) {
  return isHexColour(value) ? value.trim().toLowerCase() : null;
}

// Structural themes are orthogonal to palette engines. Switching modern/material/iOS/etc. does not
// unset salience or a live data-mdy-palette selection.
let currentTheme = "modern";
for (const [name, file] of Object.entries(THEMES)) {
  const button = document.createElement("button");
  button.type = "button";
  button.append(Object.assign(document.createElement("span"), { textContent: name }));
  button.setAttribute("aria-pressed", String(name === currentTheme));
  button.addEventListener("click", () => {
    currentTheme = name;
    structuralThemeLink.href = `./themes/${file}`;
    for (const other of themeBar.children) {
      other.setAttribute("aria-pressed", String(other === button));
    }
    queueMicrotask(report);
  });
  themeBar.append(button);
}

const mounted = mountMdyForm(formHost, FIELDS, {
  submitLabel: "Submit",
  layout: [
    {
      kind: "section",
      id: "identity",
      label: "Identity",
      children: [
        { kind: "columns", id: "identity-row", columns: [["name"], ["email"]] },
        "password",
      ],
    },
  ],
  onSubmit: (value) => {
    statePre.textContent = `submitted\n\n${JSON.stringify(value, null, 2)}`;
  },
});

const PALETTE_OPTIONS = [
  ...Object.keys(MDY_PALETTE_MODELS).map((name) => ({ name, engine: "live" })),
  { name: "salience", engine: "compiled" },
];

let currentPalette = { name: "triadic", engine: "live" };
let appliedBrand = null;

function disableStaticCompiledTheme() {
  if (staticCompiledThemeLink instanceof HTMLLinkElement) {
    staticCompiledThemeLink.disabled = true;
  }
}

function compileSalienceTheme(seed) {
  const theme = compileMdyTheme({
    name: COMPILED_THEME_NAME,
    seed,
    model: "salience",
  });

  compiledThemeStyle.textContent = serializeMdyThemeCss(theme);
  disableStaticCompiledTheme();

  // An inline primary would outrank every layer and split the palette across two different seeds.
  root.style.removeProperty("--mdy-sys-color-primary");
  root.removeAttribute("data-mdy-palette");
  root.dataset.mdyTheme = COMPILED_THEME_NAME;

  return theme;
}

function activateLivePalette(name) {
  currentPalette = { name, engine: "live" };
  root.removeAttribute("data-mdy-theme");
  root.dataset.mdyPalette = name;
  compiledThemeStyle.textContent = "";
  disableStaticCompiledTheme();
  modeBar.parentElement.style.display = 'none';
}

function activateSalience(seed) {
  currentPalette = { name: "salience", engine: "compiled" };
  root.removeAttribute("data-mdy-palette");
  compileSalienceTheme(seed);
  modeBar.parentElement.style.display = 'flex';
}

function refreshPaletteButtons() {
  for (const button of paletteBar.querySelectorAll("button")) {
    button.setAttribute(
      "aria-pressed",
      String(button.dataset.palette === currentPalette.name),
    );
  }
}

function applyBrandColour(value, { force = false } = {}) {
  const normalized = normalizedBrand(value);
  if (!force && normalized === appliedBrand) return;
  appliedBrand = normalized;

  if (currentPalette.engine === "compiled") {
    compileSalienceTheme(normalized ?? DEFAULT_BRAND);
    return;
  }

  if (normalized) {
    root.style.setProperty("--mdy-sys-color-primary", normalized);
  } else {
    root.style.removeProperty("--mdy-sys-color-primary");
  }
}

for (const option of PALETTE_OPTIONS) {
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.palette = option.name;
  button.append(Object.assign(document.createElement("span"), { textContent: option.name }));

  button.addEventListener("click", () => {
    const brand = mounted.form.value().brand;
    const seed = normalizedBrand(brand) ?? DEFAULT_BRAND;

    if (option.engine === "compiled") {
      activateSalience(seed);
    } else {
      activateLivePalette(option.name);
      applyBrandColour(brand, { force: true });
    }

    refreshPaletteButtons();
    queueMicrotask(report);
  });

  paletteBar.append(button);
}

// The compiled theme contains independent light and dark token sets. Auto follows the OS; explicit
// data-mdy-mode values override the media query without invoking the compiler again.
const MODES = ["auto", "light", "dark"];
let currentMode = localStorage.getItem("mdy-color-mode") ?? "auto";
if (!MODES.includes(currentMode)) currentMode = "auto";

function applyColorMode(mode) {
  currentMode = MODES.includes(mode) ? mode : "auto";

  if (currentMode === "auto") {
    root.removeAttribute("data-mdy-mode");
  } else {
    root.dataset.mdyMode = currentMode;
  }

  localStorage.setItem("mdy-color-mode", currentMode);

  for (const button of modeBar.querySelectorAll("button")) {
    button.setAttribute("aria-pressed", String(button.dataset.mode === currentMode));
  }
}

for (const mode of MODES) {
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.mode = mode;
  button.append(Object.assign(document.createElement("span"), { textContent: mode }));
  button.addEventListener("click", () => applyColorMode(mode));
  modeBar.append(button);
}

const SHELL_SELECTORS = {
  label: ".mdy-label, .mdy-toggle__label",
  requiredMarker: ".mdy-label__required",
  inputWrapper: ".mdy-input-wrapper, .mdy-checkbox, .mdy-toggle",
  // Scoped to the box the contract says holds the control. `input, textarea, select` found *an*
  // input — a search box, a hidden native picker, whichever came first — and that is a coincidence,
  // not a contract check.
  control:
    ".mdy-input-wrapper > input, .mdy-input-wrapper > textarea, .mdy-input-wrapper > select," +
    ".mdy-input-wrapper__inliner > input, .mdy-input-wrapper__inliner > textarea, .mdy-input-wrapper__inliner > select",
  supportingText: ".mdy-supporting-text",
  errors: ".mdy-control__errors",
  errorItem: ".mdy-control__error",
};

function findPart(widgetRoot, kind, part, resolved = {}) {
  const definition = MDY_WIDGET_CONTRACTS[kind];
  const contract = definition.parts[part];
  const classes = contract?.classes ?? [];

  const parent = definition.structure.nodes.find((node) => node.part === part)?.parent;
  const within = parent && resolved[parent] instanceof Element ? resolved[parent] : null;
  // The contract's own lookup, not a copy of it. This example shipped its own and it was
  // subtly wrong: it took the element `aria-controls` names — the listbox — without walking
  // up to the popup holding it, so an open select reported its popup absent and the audit
  // flagged `aria-expanded="true"` beside a missing popup on a widget that was correct.
  const portal = portalRootFor(widgetRoot);
  // Never `document`. Either inside this field, or inside the popup this field declared.
  const scopes = [within ?? widgetRoot, ...(portal ? [portal] : [])];

  if (classes.length > 0) {
    const selector = `.${classes.join(".")}`;
    for (const scope of scopes) {
      if (scope.matches?.(selector)) return scope;
      const found = scope.querySelector(selector);
      if (found) return found;
    }
    return null;
  }

  const fallback = SHELL_SELECTORS[part];
  if (!fallback) return null;
  for (const scope of scopes) {
    const found = scope.querySelector(fallback);
    if (found) return found;
  }
  return null;
}

function report() {
  const rows = [];

  for (const field of FIELDS) {
    const widgetRoot = formHost.querySelector(`[data-mdy-field="${field.name}"]`);
    // A field that rendered nothing used to `continue`, which meant it counted towards a green
    // banner. A conformance report that treats "produced no DOM at all" as conforming is not a
    // report — it is the one failure that discredits every other row in it.
    if (!widgetRoot) {
      rows.push(`${field.kind}: MISSING_WIDGET_ROOT [field=${field.name}]`);
      continue;
    }

    const parts = { root: widgetRoot };
    for (const node of MDY_WIDGET_CONTRACTS[field.kind].structure.nodes) {
      if (node.part !== "root") {
        parts[node.part] = findPart(widgetRoot, field.kind, node.part, parts);
      }
    }
    delete parts.root;

    if (field.kind === "daterange") {
      parts.endControl = widgetRoot.querySelectorAll(".mdy-daterange__input")[1];
    }

    const missing = MDY_WIDGET_CONTRACTS[field.kind].structure.nodes
      .filter((node) => node.part !== "root" && !parts[node.part])
      .map((node) => node.part);

    const issues = inspectWidgetDom(widgetRoot, field.kind, {
      parts,
      absentParts: missing,
    });

    if (issues.length) {
      rows.push(
        `${field.kind}: ${issues
          .map((issue) => `${issue.code} [${issue.part}]`)
          .join(", ")}`,
      );
    }
  }

  banner.className = rows.length ? "fail" : "pass";
  // `FIELDS.length` is fields, not kinds — 18 fields over 17 kinds, because two of them share one.
  // For a conformance banner the wording is part of the claim, so it says what it counted.
  const kinds = new Set(FIELDS.map((field) => field.kind)).size;
  banner.textContent = rows.length
    ? `Contract violations in the rendered DOM:\n${rows.join("\n")}`
    : `All ${FIELDS.length} rendered fields conform to the widget DOM contract, across ${kinds} kinds.`;
}

function dumpState() {
  statePre.textContent = JSON.stringify(mounted.form.value(), null, 2);
}

// Start from salience. The static generated CSS prevents a flash before JavaScript; this first
// compilation replaces it with the palette for the form's actual initial brand (#004cff).
// activateSalience(normalizedBrand(mounted.form.value().brand) ?? DEFAULT_BRAND);
activateLivePalette(currentPalette.name);
refreshPaletteButtons();
applyColorMode(currentMode);

// Form reactivity drives both the state dump and brand updates. Only brand changes trigger a new
// compile because applyBrandColour remembers the normalized seed.
mounted.reactivity.effect(() => {
  const value = mounted.form.value();
  applyBrandColour(value.brand);
  dumpState();
  report();
});

formHost.addEventListener("click", () => queueMicrotask(report), true);


// ─── Rows keyed by data ───────────────────────────────────────────────────────
//
// The arrangement an indexed collection cannot serve: a table renders by column, so the two
// controls of one row are mounted in different places and at different moments, and they come and
// go as rows enter and leave edit mode. None of that decides what the form holds — a row exists
// because it was declared.

const rowsHost = document.querySelector("[data-rows]");
const rowsState = document.querySelector("[data-rows-state]");

if (rowsHost && rowsState) {
  const lines = createForm({
    lines: mdyRecord(
      mdyGroup({
        item: mdyField("", [(value) => (value ? [] : ["Required"])]),
        qty: mdyField(1, [(value) => (Number(value) >= 1 ? [] : ["At least 1"])]),
      }),
    ),
  });

  // The rows a server would have sent: its ids, serialised, plus one the user started here.
  lines.f.lines.setAll({
    12: { item: "Espresso", qty: 2 },
    34: { item: "Cornetto", qty: 1 },
    "tmp:1": { item: "", qty: 1 },
  });

  const editing = new Set(["tmp:1"]);
  let descending = false;
  let mountedCells = [];

  // A cell's label names its column *and* its row: read on its own — which is how a screen reader
  // reaches it — "Item" would not say which line it belongs to. The column header carries that for
  // a sighted reader, so the label is hidden visually rather than dropped.
  const cellDescriptor = (key, part) =>
    part === "item"
      ? { name: `rows-item-${key}`, kind: "text", ariaLabel: `Item, row ${key}` }
      : { name: `rows-qty-${key}`, kind: "number", ariaLabel: `Quantity, row ${key}` };

  const button = (label, onClick, primary = false) => {
    const el = document.createElement("button");
    el.type = "button";
    el.textContent = label;
    if (primary) el.className = "primary";
    el.addEventListener("click", onClick);
    return el;
  };

  const renderRows = () => {
    for (const dispose of mountedCells) dispose();
    mountedCells = [];

    const keys = [...lines.f.lines.keys()].sort((a, b) =>
      descending ? b.localeCompare(a) : a.localeCompare(b),
    );

    const table = document.createElement("table");
    table.className = "keyed-rows";
    table.innerHTML =
      "<thead><tr><th>Key</th><th>Item</th><th>Qty</th><th></th></tr></thead><tbody></tbody>";
    const body = table.querySelector("tbody");

    for (const key of keys) {
      const row = document.createElement("tr");
      if (editing.has(key)) row.classList.add("editing");

      const keyCell = document.createElement("td");
      keyCell.className = "read";
      keyCell.textContent = key;
      row.append(keyCell);

      // One cell per column: this loop is the whole point — a column knows a key and a part, and
      // never whether the row is declared. `cell()` answers either way.
      for (const part of ["item", "qty"]) {
        const cell = document.createElement("td");
        if (editing.has(key)) {
          mountedCells.push(
            renderField(cell, cellDescriptor(key, part), lines.f.lines.cell(key, part)),
          );
        } else {
          cell.className = "read";
          cell.textContent = String(lines.f.lines.cell(key, part).value() ?? "");
        }
        row.append(cell);
      }

      const actions = document.createElement("td");
      actions.className = "keyed-rows-actions";
      actions.append(
        button(editing.has(key) ? "Done" : "Edit", () => {
          if (editing.has(key)) editing.delete(key);
          else editing.add(key);
          renderRows();
        }),
      );
      if (key.startsWith("tmp:")) {
        // What a save does when the server answers with the real id: the row keeps its value and
        // what the user did to it, under its new name.
        actions.append(
          button(
            "Save",
            () => {
              const assigned = String(Math.floor(Math.random() * 900) + 100);
              lines.f.lines.rename(key, assigned);
              editing.delete(key);
              editing.add(assigned);
              renderRows();
            },
            true,
          ),
        );
      }
      actions.append(
        button("Remove", () => {
          lines.f.lines.remove(key);
          editing.delete(key);
          renderRows();
        }),
      );
      row.append(actions);
      body.append(row);
    }

    const controls = document.createElement("div");
    controls.className = "keyed-rows-actions";
    controls.append(
      button(descending ? "Sort ascending" : "Sort descending", () => {
        descending = !descending;
        renderRows();
      }),
      button("Add row", () => {
        lines.f.lines.upsert(`tmp:${Date.now()}`, { item: "", qty: 1 });
        renderRows();
      }),
      button("Close every editor", () => {
        editing.clear();
        renderRows();
      }),
    );

    rowsHost.replaceChildren(table, controls);
    reportRows();
  };

  const reportRows = () => {
    rowsState.textContent = [
      `rows valid: ${lines.state.valid()}`,
      `declared: ${[...lines.f.lines.keys()].join(", ") || "(none)"}`,
      `editors mounted: ${editing.size}`,
      "",
      JSON.stringify(lines.value().lines, null, 2),
    ].join("\n");
  };

  // The verdict follows the data, so typing in a cell updates it without a re-render.
  setInterval(reportRows, 250);
  renderRows();
}
