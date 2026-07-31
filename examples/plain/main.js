// Full-catalog demo for the framework-free renderer: every packaged theme, every palette engine,
// explicit light/dark/auto mode, and the live contract verdict for what is on screen.
import { MDY_PALETTE_MODELS } from "@modyra/core/color-utils";
import { compileMdyTheme, serializeMdyThemeCss } from "@modyra/core/theme-compiler";
import { mountMdyForm } from "@modyra/plain";
import { MDY_WIDGET_CONTRACTS } from "@modyra/widgets";
import { inspectWidgetDom } from "@modyra/widgets/testing";

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

/**
 * This field's popup, wherever the renderer put it.
 *
 * A portalled popup is the one part legitimately outside its field's root, so it cannot be found by
 * containment — but it must not be found by searching the document for a matching class either,
 * which returns whichever field rendered first and makes a two-instance page report nonsense. It is
 * found through the relationship the widget itself declared: the id its own trigger names.
 */
function portalFor(widgetRoot) {
  for (const element of widgetRoot.querySelectorAll("[aria-controls]")) {
    const target = document.getElementById(element.getAttribute("aria-controls"));
    if (target && !widgetRoot.contains(target)) return target;
  }
  return null;
}

function findPart(widgetRoot, kind, part, resolved = {}) {
  const definition = MDY_WIDGET_CONTRACTS[kind];
  const contract = definition.parts[part];
  const classes = contract?.classes ?? [];

  const parent = definition.structure.nodes.find((node) => node.part === part)?.parent;
  const within = parent && resolved[parent] instanceof Element ? resolved[parent] : null;
  const portal = portalFor(widgetRoot);
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
