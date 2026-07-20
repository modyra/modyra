/**
 * Lit adapter for the Modyra headless select controller.
 *
 * Wraps the controller, triggers Lit re-renders when its signals change,
 * and executes commands via the Lit runtime.
 */

import type { MdySelectOption } from "@modyra/core";
import { vanillaReactivity } from "@modyra/core";
import {
  createSelectController,
  type MdySelectController,
  type MdySelectControllerOptions,
  type MdySelectIntent,
  type MdySelectState,
} from "@modyra/widgets";
import type { LitElement } from "lit";

import {
  executeLitCommands,
  type MdyElementLookup,
  type MdyLitCommandHandlers,
} from "./widget-runtime.js";

export interface MdyLitSelectAdapterOptions<TValue>
  extends Omit<MdySelectControllerOptions<TValue>, "onChange"> {
  readonly onChange?: (value: TValue | null) => void;
}

export class MdyLitSelectAdapter<TValue = unknown> {
  private readonly host: LitElement;
  private readonly controller: MdySelectController<TValue>;
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
    this.controller = createSelectController(options, vanillaReactivity());
  }

  get state(): MdySelectState<TValue> {
    return this.controller.state();
  }

  get view(): ReturnType<MdySelectController<TValue>["view"]> {
    return this.controller.view();
  }

  dispatch(intent: MdySelectIntent): void {
    const commands = this.controller.dispatch(intent);
    executeLitCommands(this.host, commands, this.lookup, this.handlers);
  }

  setValue(value: TValue | null): void {
    this.controller.setValue(value);
  }

  setOptions(options: readonly MdySelectOption<TValue>[]): void {
    this.controller.setOptions(options);
  }

  setOpen(open: boolean): void {
    this.controller.setOpen(open);
  }

  setDisabled(disabled: boolean): void {
    this.controller.setDisabled(disabled);
  }

  setReadonly(readonly: boolean): void {
    this.controller.setReadonly(readonly);
  }

  setInvalid(invalid: boolean): void {
    this.controller.setInvalid(invalid);
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
