import type { MdyReactivity, MdySignal } from "@modyra/core";
import { vanillaReactivity } from "@modyra/core";
import type { MdyUiCommand } from "./commands.js";
import type { MdyWidgetController, MdyWidgetViewContract } from "./contract.js";
import { MDY_WIDGET_CONTRACTS, type MdyWidgetKind } from "./catalog.js";
export interface MdyCatalogWidgetState { readonly open: boolean; readonly disabled: boolean; readonly activePart: string | null; }
export type MdyCatalogWidgetIntent = { readonly type: "open" } | { readonly type: "close"; readonly restoreFocus?: boolean } | { readonly type: "focus"; readonly part: string } | { readonly type: "disable"; readonly disabled: boolean };
export function createCatalogWidgetController(kind: MdyWidgetKind, reactivity: MdyReactivity = vanillaReactivity()): MdyWidgetController<MdyCatalogWidgetState, MdyCatalogWidgetIntent> {
  const definition = MDY_WIDGET_CONTRACTS[kind]; const current = reactivity.signal<MdyCatalogWidgetState>({ open: false, disabled: false, activePart: null });
  const state: MdySignal<MdyCatalogWidgetState> = reactivity.computed(() => current());
  const view: MdySignal<MdyWidgetViewContract> = reactivity.computed(() => ({ root: definition.parts.root, parts: definition.parts, structure: definition.structure }));
  function dispatch(intent: MdyCatalogWidgetIntent): readonly MdyUiCommand[] { const value=current(); if (intent.type==="disable") { current.set({ ...value, disabled:intent.disabled }); return []; } if (value.disabled) return []; if (intent.type==="open") { if (!definition.capabilities.overlay || value.open) return []; current.set({ ...value, open:true }); return [{ type:"open-overlay", anchor:{ part:"trigger" } }]; } if (intent.type==="close") { if (!value.open) return []; current.set({ ...value, open:false }); return intent.restoreFocus ? [{ type:"close-overlay" },{ type:"restore-focus", target:{ part:"trigger" } }] : [{ type:"close-overlay" }]; } current.set({ ...value, activePart:intent.part }); return [{ type:"focus", target:{ part:intent.part } }]; }
  return { state, view, dispatch, destroy() {} };
}
