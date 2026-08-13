/**
 * Angular runtime for Modyra widget commands.
 *
 * Provides framework-specific execution of UI commands produced by headless
 * widget controllers: focus scheduling after render, scrolling, announcements,
 * and overlay/open coordination.
 */

import {
  afterNextRender,
  ElementRef,
  inject,
  Injectable,
  Injector,
} from "@angular/core";
import type { MdyUiCommand } from "@modyra/widgets";
import {
  createCommandRuntime,
  type MdyElementLookup,
  type MdyWidgetCommandHandlers,
} from "@modyra/widgets";

/** Maps a widget part name to an element reference. */
export type MdyElementRefMap = ReadonlyMap<
  string,
  ElementRef<HTMLElement> | undefined
>;

/** Lookup for item elements inside a part (e.g. options inside listbox). */
export type MdyItemRefLookup = (part: string, key: string) => ElementRef<HTMLElement> | undefined;

/**
 * Handlers for command side effects that need host/component cooperation.
 *
 * An alias, not a restatement: written out member by member it drifts the moment the contract gains
 * one, and the five reactivity adapters have always aliased it.
 */
export type MdyAngularCommandHandlers = MdyWidgetCommandHandlers;

/**
 * Executes a list of UI commands in an Angular runtime context.
 *
 * Focus/scroll operations are deferred with `afterNextRender` so they run
 * after the DOM has been updated by change detection.
 */
@Injectable({ providedIn: "root" })
export class MdyWidgetRuntime {
  private readonly injector = inject(Injector);

  /**
   * This framework renders on change detection, so focus waits for the render it schedules. A
   * microtask would fire while the view is still the previous one.
   */
  private readonly runtime = createCommandRuntime({
    announcerId: "mdy-angular-announcer",
    defer: (run) => { afterNextRender(run, { injector: this.injector }); },
  });

  execute(
    commands: readonly MdyUiCommand[],
    elements: MdyElementRefMap,
    itemLookup: MdyItemRefLookup,
    handlers: MdyAngularCommandHandlers,
  ): void {
    /** This host addresses its DOM through `ElementRef`s, which is the one thing it does not share. */
    const lookup: MdyElementLookup = (part, key) => {
      const ref = key ? itemLookup(part, key) : elements.get(part);
      return ref?.nativeElement;
    };

    this.runtime.execute(commands, lookup, handlers);
  }
}
