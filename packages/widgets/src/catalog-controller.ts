import type { MdyReactivity, MdySignal } from "@modyra/core";
import { vanillaReactivity } from "@modyra/core";
import { MDY_WIDGET_CONTRACTS, type MdyWidgetKind } from "./catalog.js";
import type { MdyUiCommand } from "./commands.js";
import type { MdyWidgetController, MdyWidgetViewContract } from "./contract.js";

export interface MdyCatalogWidgetState {
  readonly open: boolean;
  readonly disabled: boolean;
  readonly activePart: string | null;
}

export type MdyCatalogWidgetIntent =
  | { readonly type: "open" }
  | { readonly type: "close"; readonly restoreFocus?: boolean }
  | { readonly type: "focus"; readonly part: string }
  | { readonly type: "disable"; readonly disabled: boolean };

export function createCatalogWidgetController(
  kind: MdyWidgetKind,
  reactivity: MdyReactivity = vanillaReactivity(),
): MdyWidgetController<MdyCatalogWidgetState, MdyCatalogWidgetIntent> {
  const definition = MDY_WIDGET_CONTRACTS[kind];
  const current = reactivity.signal<MdyCatalogWidgetState>({
    open: false,
    disabled: false,
    activePart: null,
  });
  const state: MdySignal<MdyCatalogWidgetState> = reactivity.computed(() => current());
  const view: MdySignal<MdyWidgetViewContract> = reactivity.computed(() => ({
    root: definition.parts.root,
    parts: definition.parts,
    structure: definition.structure,
  }));
  let destroyed = false;

  /** Closing, with the commands that closing produces. Shared by `close` and by `disable`. */
  const close = (
    value: MdyCatalogWidgetState,
    restoreFocus: boolean,
  ): readonly MdyUiCommand[] => {
    if (!value.open) return [];
    current.set({ ...value, open: false });
    return restoreFocus
      ? [{ type: "close-overlay" }, { type: "restore-focus", target: { part: "trigger" } }]
      : [{ type: "close-overlay" }];
  };

  function dispatch(intent: MdyCatalogWidgetIntent): readonly MdyUiCommand[] {
    // A destroyed controller answers without acting, which is the rule the form engine already
    // holds: the renderer may have torn its elements down, and a `close-overlay` for a widget that
    // is gone is a command about nothing.
    if (destroyed) return [];
    const value = current();

    if (intent.type === "disable") {
      current.set({ ...value, disabled: intent.disabled });
      // A disabled widget is not left holding an overlay. A form disables a field because a
      // dependent value changed or an async check landed — and the user has the picker open at
      // that moment precisely because that is what they were doing when it changed.
      return intent.disabled ? close({ ...value, disabled: true }, false) : [];
    }

    // The guard is about starting something, and `close` ends something already happening. Every
    // route out of an overlay goes through it — Escape, a click away, choosing an option — so
    // refusing it while disabled left a popup over a dead control with no way out of it.
    if (value.disabled && intent.type !== "close") return [];

    if (intent.type === "open") {
      if (!definition.capabilities.overlay || value.open) return [];
      current.set({ ...value, open: true });
      return [{ type: "open-overlay", anchor: { part: "trigger" } }];
    }
    if (intent.type === "close") return close(value, intent.restoreFocus === true);

    current.set({ ...value, activePart: intent.part });
    return [{ type: "focus", target: { part: intent.part } }];
  }

  return {
    state,
    view,
    dispatch,
    destroy() {
      destroyed = true;
    },
  };
}
