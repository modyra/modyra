/**
 * Lit adapter for the Modyra headless select controller.
 *
 * Wraps the controller, triggers Lit re-renders when its signals change,
 * and executes commands via the Lit runtime.
 */

import type { MdySelectOption } from "@modyra/core";
import { vanillaReactivity } from "@modyra/core";
import {
  createSelectFieldController,
  type MdySelectFieldController,
  type MdySelectFieldControllerOptions,
  type MdySelectIntent,
  type MdySelectState,
} from "@modyra/widgets";
import type { LitElement } from "lit";

import {
  executeLitCommands,
  type MdyElementLookup,
  type MdyLitCommandHandlers,
} from "./widget-runtime.js";

/**
 * What this adapter needs, which is now what the field controller needs.
 *
 * `onChange` is gone with the standalone controller: the field controller holds the handle and
 * writes through it, so a caller supplying its own writer would be a second thing owning the value.
 */
export type MdyLitSelectAdapterOptions<TValue> = MdySelectFieldControllerOptions<TValue>;

export class MdyLitSelectAdapter<TValue = unknown> {
  private readonly host: LitElement;
  private readonly controller: MdySelectFieldController<TValue>;
  private readonly lookup: MdyElementLookup;
  private handlers: MdyLitCommandHandlers = {
    setOpen: () => undefined, // replaced by the host element
  };

  constructor(
    host: LitElement,
    options: MdyLitSelectAdapterOptions<TValue>,
    lookup: MdyElementLookup,
  ) {
    this.host = host;
    this.lookup = lookup;
    // The field controller, which holds the handle and reads it, rather than the standalone one
    // driven by setters. The setters are not less typing to skip: they are a window between a value
    // changing anywhere else — a draft restored, a server correction, a cross-field rule — and
    // somebody in this file remembering to push it in.
    this.controller = createSelectFieldController(options, vanillaReactivity());
  }

  get state(): MdySelectState<TValue> {
    return this.controller.state();
  }

  get view(): ReturnType<MdySelectFieldController<TValue>["view"]> {
    return this.controller.view();
  }

  dispatch(intent: MdySelectIntent): void {
    const commands = this.controller.dispatch(intent);
    executeLitCommands(this.host, commands, this.lookup, this.handlers);
  }


  setOptions(options: readonly MdySelectOption<TValue>[]): void {
    this.controller.setOptions(options);
  }

  setOpen(open: boolean): void {
    this.controller.setOpen(open);
  }


  setReadonly(readonly: boolean): void {
    this.controller.setReadonly(readonly);
  }

  /** Which of the field's descriptions is on screen, so the trigger names one that exists. */
  setPopupRendered(rendered: boolean): void {
    this.controller.setPopupRendered(rendered);
  }

  setDescribedBy(next: { errorsVisible?: boolean; descriptionVisible?: boolean }): void {
    this.controller.setDescribedBy(next);
  }


  setLoading(loading: boolean): void {
    this.controller.setLoading(loading);
  }

  connectHandlers(handlers: MdyLitCommandHandlers): void {
    this.handlers = handlers;
  }

  destroy(): void {
    this.controller.destroy();
  }
}
