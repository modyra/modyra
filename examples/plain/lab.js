/**
 * The laboratory: one page, one panel at a time, each driving a part of the engine.
 *
 * Panels are separate modules because that is the property this library asks of its consumers — a
 * page that grows a section by growing one function is the shape the library exists to avoid. Each
 * one states the invariant it demonstrates, so a reader knows what would be wrong if the panel
 * looked wrong.
 */
import { MDY_CONTRACT_VOCABULARIES } from "@modyra/widgets";

/**
 * The two catalogues the legend reads, taken from the index rather than imported by name.
 *
 * A page that names the exports it wants is a tool that has chosen a subset of the contract, which is
 * how an enumerator came to report findings about catalogues it was not reading. Asked of the index,
 * a catalogue added tomorrow is reachable here without an edit.
 */
const vocabularyNamed = (name) => MDY_CONTRACT_VOCABULARIES.find((one) => one.name === name)?.value;
const MDY_WIDGET_CONTRACTS = vocabularyNamed("MDY_WIDGET_CONTRACTS");
const MDY_WIDGET_KEYBOARD = vocabularyNamed("MDY_WIDGET_KEYBOARD");
import { legend } from "./panels/shell.js";
import { statesPanel } from "./panels/states.js";
import { validationPanel } from "./panels/validation.js";
import { collectionsPanel } from "./panels/collections.js";
import { ordersPanel } from "./panels/orders.js";
import { invoicesPanel } from "./panels/invoices.js";
import { contractsPanel } from "./panels/contracts.js";
import { lifecyclePanel } from "./panels/lifecycle.js";
import { dynamicPanel } from "./panels/dynamic.js";
import { securityPanel } from "./panels/security.js";
import { headlessPanel } from "./panels/headless.js";
import { nestedPanel } from "./panels/nested.js";
import { rendererPanel } from "./panels/renderer.js";
import { carriedPanel } from "./panels/carried.js";

const PANELS = [statesPanel, validationPanel, collectionsPanel, ordersPanel, invoicesPanel, contractsPanel, lifecyclePanel, dynamicPanel, securityPanel, headlessPanel, nestedPanel, rendererPanel, carriedPanel];

const nav = document.querySelector("[data-lab-nav]");
const host = document.querySelector("[data-lab-panel]");

let disposeCurrent = null;

/** Build a panel's frame — heading, invariant, work area and readout — and hand back the two hosts. */
function frame(panel) {
  host.replaceChildren();
  const wrap = document.createElement("div");
  wrap.className = "panel";
  wrap.dataset.panel = panel.id;

  const left = document.createElement("div");
  const heading = document.createElement("h2");
  heading.textContent = panel.title;
  const blurb = document.createElement("p");
  blurb.textContent = panel.blurb;
  const invariant = document.createElement("p");
  invariant.className = "invariant";
  invariant.dataset.invariant = "";
  invariant.textContent = panel.invariant;
  left.append(heading, blurb, invariant);

  const readout = document.createElement("pre");
  readout.dataset.readout = "";
  readout.textContent = "{}";

  wrap.append(left, readout);
  host.append(wrap);
  return { work: left, readout };
}

function show(id, { push = true } = {}) {
  const panel = PANELS.find((p) => p.id === id) ?? PANELS[0];
  disposeCurrent?.();
  const { work, readout } = frame(panel);
  disposeCurrent = panel.mount(work, readout) ?? null;
  // After the mount, because the legend reads the controls off the page rather than off a list a
  // panel would have to keep in step with what it actually renders. One call here covers every panel,
  // including the ones that build their fields some other way.
  legend(work, { contracts: MDY_WIDGET_CONTRACTS, keyboard: MDY_WIDGET_KEYBOARD, title: "What is on this panel" });
  for (const button of nav.querySelectorAll("button")) {
    button.toggleAttribute("aria-current", button.dataset.panelId === panel.id);
    if (button.dataset.panelId === panel.id) button.setAttribute("aria-current", "page");
  }
  if (push) history.replaceState(null, "", `#${panel.id}`);
}

for (const panel of PANELS) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = panel.title;
  button.dataset.panelId = panel.id;
  button.addEventListener("click", () => show(panel.id));
  nav.append(button);
}

show(location.hash.slice(1) || PANELS[0].id, { push: false });
window.addEventListener("hashchange", () => show(location.hash.slice(1), { push: false }));
