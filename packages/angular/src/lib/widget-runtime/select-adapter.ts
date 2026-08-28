/**
 * Angular adapter for the Modyra headless select controller.
 *
 * Bridges the framework-agnostic controller with Angular-specific command
 * execution and signal integration. The host component creates an instance,
 * feeds it DOM refs and callbacks, and reads the reactive view contract.
 */

import {
  computed,
  ElementRef,
  Injector,
  Signal,
} from "@angular/core";
import type { MdySelectOption } from "@modyra/core";
import {
  createSelectFieldController,
  type MdySelectFieldController,
  type MdySelectFieldControllerOptions,
  type MdySelectIntent,
  type MdySelectState,
} from "@modyra/widgets";
import { angularReactivity } from "../core/reactivity-angular";

import {
  MdyAngularCommandHandlers,
  MdyWidgetRuntime,
} from "./widget-runtime";

/**
 * What this adapter needs, which is what the field controller needs.
 *
 * `onChange` is gone with the standalone controller: the field controller holds the handle and
 * writes through it, so a caller supplying its own writer would be a second thing owning the value.
 */
export type MdyAngularSelectAdapterOptions<TValue> = MdySelectFieldControllerOptions<TValue>;

export class MdyAngularSelectAdapter<TValue = string> {
  private readonly controller: MdySelectFieldController<TValue>;
  private readonly runtime: MdyWidgetRuntime;

  /** Reactive Angular signal wrapping the controller state. */
  readonly state: Signal<MdySelectState<TValue>>;

  /** Reactive Angular signal wrapping the view/ARIA contract. */
  readonly view: Signal<ReturnType<MdySelectFieldController<TValue>["view"]>>;

  /** Current open state, useful for binding to the overlay panel. */
  readonly open: Signal<boolean>;

  /** Registry of part element refs. */
  private readonly elements = new Map<string, ElementRef<HTMLElement>>();

  /** Registry of item element refs keyed by `part:key`. */
  private readonly itemElements = new Map<string, ElementRef<HTMLElement>>();

  /** Callbacks to the host component. */
  private handlers: MdyAngularCommandHandlers = { setOpen: () => { /* no-op until the host registers handlers */ } };

  constructor(
    options: MdyAngularSelectAdapterOptions<TValue>,
    runtime: MdyWidgetRuntime,
    injector: Injector,
  ) {
    this.runtime = runtime;

    const reactivity = angularReactivity(injector);
    this.controller = createSelectFieldController(options, reactivity);

    // Bridge Modyra signals to Angular signals so templates can read them
    // idiomatically.
    this.state = computed(() => this.controller.state());
    this.view = computed(() => this.controller.view());
    this.open = computed(() => this.state().open);
  }

  /** Register a part element ref. */
  registerPart(name: string, ref: ElementRef<HTMLElement>): void {
    this.elements.set(name, ref);
  }

  /** Register an item element ref (e.g. an option). */
  registerItem(part: string, key: string, ref: ElementRef<HTMLElement>): void {
    this.itemElements.set(`${part}:${key}`, ref);
  }

  /** Connect host callbacks for command execution. */
  connectHandlers(handlers: MdyAngularCommandHandlers): void {
    this.handlers = handlers;
  }

  /** Dispatch an intent and execute the resulting commands. */
  dispatch(intent: MdySelectIntent): void {
    const commands = this.controller.dispatch(intent);
    this.runtime.execute(
      commands,
      this.elements,
      this.lookupItem.bind(this),
      this.handlers,
    );
  }

  /** Replace the option list. */
  setOptions(options: readonly MdySelectOption<TValue>[]): void {
    this.controller.setOptions(options);
  }

  /** Update the open state programmatically without emitting commands. */
  setOpen(open: boolean): void {
    this.controller.setOpen(open);
  }

  /** Update the readonly state. */
  setReadonly(readonly: boolean): void {
    this.controller.setReadonly(readonly);
  }

  /** Which of the two texts under the field the trigger describes itself by. */
  setDescribedBy(shown: { readonly errorsVisible?: boolean; readonly descriptionVisible?: boolean }): void {
    this.controller.setDescribedBy(shown);
  }

  /** Whether the panel's contents are in the document — this renderer builds them on open. */
  setPopupRendered(rendered: boolean): void {
    this.controller.setPopupRendered(rendered);
  }

  /** Update the loading state. */
  setLoading(loading: boolean): void {
    this.controller.setLoading(loading);
  }

  /** Release resources. */
  destroy(): void {
    this.controller.destroy();
  }

  private lookupItem(part: string, key: string): ElementRef<HTMLElement> | undefined {
    return this.itemElements.get(`${part}:${key}`);
  }
}
