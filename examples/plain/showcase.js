// Product-page checkout demo: a compact contract-driven form beside its live value, with a
// packaged-theme switcher and an explicit light/dark toggle in the top bar.
import {
  createForm,
  email as mdyEmail,
  field as mdyField,
  group as mdyGroup,
  maxLength as mdyMaxLength,
  minLength as mdyMinLength,
  pattern as mdyPattern,
  required as mdyRequired,
} from "@modyra/core";
import { renderField } from "@modyra/plain";

const THEMES = {
  modern: "modyra-modern.css",
  material: "modyra-material.css",
  ios: "modyra-ios.css",
  // The compiled salience build carries its own seeded light and dark token sets, so the page's
  // generic dark overrides step aside for it through `data-mdy-theme`.
  salience: "modyra-salience.theme.css",
};
const SALIENCE_THEME_NAME = "modyra-salience";

const root = document.documentElement;
const themeLink = document.getElementById("modyra-theme");
const statePre = document.querySelector("[data-showcase-state]");
const validChip = document.querySelector("[data-showcase-valid]");
const submitButton = document.querySelector("[data-showcase-submit]");
const successNote = document.querySelector("[data-showcase-success]");

// The company block is declared like every other field and is in play only for a company
// account: out of play it is not validated and not submitted, and what was typed into it is kept.
const form = createForm({
  name: mdyField("", [mdyRequired()]),
  email: mdyField("", [mdyRequired(), mdyEmail()]),
  country: mdyField("it"),
  account: mdyField("personal"),
  company: mdyGroup(
    {
      name: mdyField("", [mdyRequired()]),
      vat: mdyField("", [
        mdyRequired(),
        mdyMinLength(11, "A VAT number has 11 digits"),
        mdyMaxLength(11, "A VAT number has 11 digits"),
        mdyPattern(/^\d{11}$/, "Digits only"),
      ]),
    },
    { when: (_section, rootValue) => rootValue.account === "company" },
  ),
  terms: mdyField(false, [mdyRequired("You must accept the terms to continue")]),
});

const FIELDS = [
  { name: "name", kind: "text", label: "Full name", placeholder: "Ada Lovelace" },
  { name: "email", kind: "email", label: "Work email", placeholder: "ada@example.com" },
  {
    name: "country",
    kind: "select",
    label: "Country",
    options: [
      { value: "it", label: "Italy" },
      { value: "fr", label: "France" },
      { value: "de", label: "Germany" },
      { value: "us", label: "United States" },
    ],
  },
  {
    name: "account",
    kind: "select",
    label: "Account",
    options: [
      { value: "personal", label: "Personal" },
      { value: "company", label: "Company" },
    ],
  },
  { name: "company.name", kind: "text", label: "Company name", placeholder: "Acme S.r.l." },
  { name: "company.vat", kind: "text", label: "VAT number", placeholder: "01234567890" },
  { name: "terms", kind: "checkbox", label: "I accept the terms of service" },
];

for (const descriptor of FIELDS) {
  const host = document.querySelector(`[data-field-host="${descriptor.name}"]`);
  if (!host) throw new Error(`Missing field host for "${descriptor.name}".`);
  const handle = descriptor.name.split(".").reduce((node, part) => node[part], form.f);
  renderField(host, descriptor, handle, form.reactivity);
}

const conditionalSection = document.querySelector("[data-showcase-conditional]");

// Out of play is a data property — the group is not validated and not submitted — not a visual
// one: the renderer draws every declared field, so the page hides the block itself, keyed to the
// interactivity the form reports rather than to the raw value.
const companyInPlay = () => form.f.company.name.interactivity() !== "disabled";

// The panel reads the form, not DOM events: a select answers through a combobox option click and
// a checkbox through a change, and both land here because the value is what the effect tracks.
form.reactivity.effect(() => {
  conditionalSection.hidden = !companyInPlay();
  statePre.textContent = JSON.stringify(form.getValue(), null, 2);
  const valid = form.state.valid();
  validChip.textContent = valid ? "valid" : "invalid";
  validChip.classList.toggle("valid", valid);
});

submitButton.addEventListener("click", () => {
  successNote.classList.remove("visible");
  form.submit(() => {
    successNote.classList.add("visible");
  });
});

// ── Top bar ────────────────────────────────────────────────────────────────

for (const button of document.querySelectorAll("[data-showcase-themes] button[data-theme]")) {
  button.addEventListener("click", () => {
    themeLink.href = `./themes/${THEMES[button.dataset.theme]}`;
    if (button.dataset.theme === "salience") {
      root.dataset.mdyTheme = SALIENCE_THEME_NAME;
    } else {
      root.removeAttribute("data-mdy-theme");
    }
    for (const other of button.parentElement.children) {
      other.setAttribute("aria-pressed", String(other === button));
    }
  });
}

for (const button of document.querySelectorAll("[data-showcase-mode] button[data-mode]")) {
  button.addEventListener("click", () => {
    root.dataset.mdyMode = button.dataset.mode;
    for (const other of button.parentElement.children) {
      other.setAttribute("aria-pressed", String(other === button));
    }
  });
}
