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
  createMdyAnnouncer,
  processWidgetCommands,
  type MdyElementLookup,
} from "@modyra/widgets";

/** Maps a widget part name to an element reference. */
export type MdyElementRefMap = ReadonlyMap<
  string,
  ElementRef<HTMLElement> | undefined
>;

/** Lookup for item elements inside a part (e.g. options inside listbox). */
export type MdyItemRefLookup = (part: string, key: string) => ElementRef<HTMLElement> | undefined;

/** Handlers for command side effects that need host/component cooperation. */
export interface MdyAngularCommandHandlers {
  /** Called for open-overlay / close-overlay. */
  setOpen(open: boolean): void;
  /** Called for emit-change. */
  onChange?(): void;
  /** Called for mark-touched. */
  onTouched?(): void;
  /** Called for mark-dirty. */
  onDirty?(): void;
}

/**
 * Executes a list of UI commands in an Angular runtime context.
 *
 * Focus/scroll operations are deferred with `afterNextRender` so they run
 * after the DOM has been updated by change detection.
 */
@Injectable({ providedIn: "root" })
export class MdyWidgetRuntime {
  private readonly injector = inject(Injector);
  private readonly announcer = createMdyAnnouncer("mdy-angular-announcer");

  execute(
    commands: readonly MdyUiCommand[],
    elements: MdyElementRefMap,
    itemLookup: MdyItemRefLookup,
    handlers: MdyAngularCommandHandlers,
  ): void {
    const focusQueue: Array<{ el: HTMLElement; type: "focus" | "scroll" }> = [];

    const lookup: MdyElementLookup = (part, key) => {
      const ref = key
        ? itemLookup(part, key)
        : elements.get(part);
      return ref?.nativeElement;
    };

    processWidgetCommands(commands, {
      lookup,
      handlers,
      scheduleFocus: (el) => focusQueue.push({ el, type: "focus" }),
      scheduleScroll: (el) => focusQueue.push({ el, type: "scroll" }),
      announce: (message) => this.announcer.announce(message),
    });

    if (focusQueue.length === 0) return;

    afterNextRender(() => {
      for (const item of focusQueue) {
        if (item.type === "focus") item.el.focus();
        else item.el.scrollIntoView({ block: "nearest" });
      }
    }, {
      injector: this.injector,
    });
  }
}
