import { mount } from "svelte";
import App from "./App.svelte";
import { MDY_WIDGET_CONTRACTS, MDY_WIDGET_KEYBOARD } from "@modyra/widgets";
import { legendWhenReady } from "../shared/legend.js";

mount(App, { target: document.getElementById("app") });

// The legend that says what each control on this page is, which keys it claims and which parts it
// draws. Shared with every other example: the demos differ in how they mount a form, not in what a
// form is, and a legend written per demo would drift per demo.
legendWhenReady("#app", { contracts: MDY_WIDGET_CONTRACTS, keyboard: MDY_WIDGET_KEYBOARD });

