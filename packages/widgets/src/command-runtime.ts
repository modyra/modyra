/**
 * Framework-agnostic widget command execution.
 *
 * Adapters supply an element lookup, host callbacks, a focus/scroll scheduler
 * and an announcer; this module turns the headless controller's
 * {@link MdyUiCommand}s into real DOM/overlay side effects.
 */

import type { MdyUiCommand, MdyElementTarget } from "./commands.js";
import type { MdyWidgetRuntimeCapabilities } from "./runtime.js";

/**
 * The commands that need a real DOM to mean anything.
 *
 * Focus, scrolling and announcing all reach for an element or the document. The rest are the
 * controller telling its host what changed, which is as true on a server as in a browser.
 */
const DOM_COMMANDS: ReadonlySet<MdyUiCommand["type"]> = new Set([
  "focus", "restore-focus", "scroll-into-view", "announce",
]);

/** Looks up a widget part element, optionally by item key. */
export type MdyElementLookup = (
  part: string,
  key?: string,
) => HTMLElement | undefined;

/** Host callbacks for command side effects that need framework cooperation. */
export interface MdyWidgetCommandHandlers {
  /** Called for open-overlay / close-overlay. */
  setOpen(open: boolean): void;
  /** Called for emit-change. */
  onChange?(): void;
  /** Called for mark-touched. */
  onTouched?(): void;
  /** Called for mark-dirty. */
  onDirty?(): void;
}

/** Context supplied by each adapter when processing commands. */
export interface MdyWidgetCommandContext {
  readonly lookup: MdyElementLookup;
  readonly handlers: MdyWidgetCommandHandlers;
  /**
   * Both the element as it is now and the target that named it.
   *
   * A caller that acts immediately uses the element. One that defers until the host has rendered
   * needs the target, because the render is what may replace the node — resolving before it and
   * focusing after it is how focus lands on something no longer in the document.
   */
  scheduleFocus(el: HTMLElement, target: MdyElementTarget): void;
  scheduleScroll(el: HTMLElement, target: MdyElementTarget): void;
  announce(message: string): void;
  /**
   * What the runtime can do, from {@link browserRuntimeCapabilities}.
   *
   * Optional, and omitting it keeps every command executing as before. Supplying it is what makes
   * the capability report mean something: with no DOM the commands that need one are dropped here
   * rather than attempted. `runtime.ts` has always said a controller consults the report "to avoid
   * emitting commands that cannot be executed" — nothing did, so the report was a description of
   * behaviour that existed nowhere.
   */
  readonly capabilities?: MdyWidgetRuntimeCapabilities;
}

/**
 * Walks a list of UI commands and invokes framework-specific side effects
 * through the provided context. Focus/scroll operations are only scheduled;
 * the adapter flushes them with its own DOM timing.
 *
 * Commands that need a DOM are skipped where the runtime says there is none. The state-changing
 * ones — opening, closing, marking touched — still run: they are the controller's own bookkeeping
 * and mean the same thing on a server as in a browser.
 */
export function processWidgetCommands(
  commands: readonly MdyUiCommand[],
  context: MdyWidgetCommandContext,
): void {
  const dom = context.capabilities?.dom ?? true;
  for (const command of commands) {
    if (!dom && DOM_COMMANDS.has(command.type)) continue;
    switch (command.type) {
      case "focus":
      case "restore-focus": {
        const el = context.lookup(command.target.part, command.target.key);
        if (el) context.scheduleFocus(el, command.target);
        break;
      }
      case "scroll-into-view": {
        const el = context.lookup(command.target.part, command.target.key);
        if (el) context.scheduleScroll(el, command.target);
        break;
      }
      case "announce": {
        context.announce(command.message);
        break;
      }
      case "open-overlay": {
        context.handlers.setOpen(true);
        break;
      }
      case "close-overlay": {
        context.handlers.setOpen(false);
        break;
      }
      case "emit-change": {
        context.handlers.onChange?.();
        break;
      }
      case "mark-touched": {
        context.handlers.onTouched?.();
        break;
      }
      case "mark-dirty": {
        context.handlers.onDirty?.();
        break;
      }
    }
  }
}

/** Visually hidden live region used by all adapters for screen-reader announcements. */
export interface MdyAnnouncer {
  announce(message: string): void;
}

/**
 * Creates a lazy-initialized live region with the given element id.
 * Multiple callers with the same id share the same DOM element.
 */
export function createMdyAnnouncer(elementId: string): MdyAnnouncer {
  return {
    announce(message: string): void {
      if (typeof document === "undefined") return;
      let el = document.getElementById(elementId);
      if (!el) {
        el = document.createElement("div");
        el.id = elementId;
        el.setAttribute(
          "style",
          "position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0;",
        );
        el.setAttribute("aria-live", "polite");
        el.setAttribute("aria-atomic", "true");
        document.body.appendChild(el);
      }
      el.textContent = "";
      setTimeout(() => {
        if (el) el.textContent = message;
      }, 100);
    },
  };
}

/**
 * How a host defers work until after it has rendered.
 *
 * The only thing that genuinely differs between adapters. A microtask for the ones whose scheduler
 * has already flushed by then, a frame for the ones that batch into one, a host promise for the ones
 * that publish "I have finished rendering" — and focus is the reason it matters: focusing an element
 * the host is about to replace moves focus to a node that will not be there.
 */
export type MdyCommandDefer = (run: () => void) => void;

export interface MdyCommandRuntimeOptions {
  /** The live region this host announces through. Idempotent by id, so one per host costs nothing. */
  readonly announcerId: string;
  readonly defer: MdyCommandDefer;
}

export interface MdyCommandRuntime {
  execute(
    commands: readonly MdyUiCommand[],
    lookup: MdyElementLookup,
    handlers: MdyWidgetCommandHandlers,
  ): void;
}

/**
 * Executing widget commands, written once.
 *
 * Seven adapters had this function and it was the same function seven times: collect focus and
 * scroll into a queue, run everything else now, then drain the queue after the host has rendered.
 * What differed was the id of the live region and one call — `queueMicrotask`, `requestAnimationFrame`,
 * `afterNextRender`, `host.updateComplete.then`. A copy per adapter is how one of them comes to defer
 * with the wrong primitive and focus lands on a node the host has already replaced.
 */
export function createCommandRuntime(options: MdyCommandRuntimeOptions): MdyCommandRuntime {
  const announcer = createMdyAnnouncer(options.announcerId);

  return {
    execute(commands, lookup, handlers): void {
      // The target, not the node. Deferring exists *because* the host is about to render, and a
      // render replaces elements: resolved before it and focused after it, `focus()` lands on a
      // detached node — silently, since focusing one is a no-op with no error and no warning, and
      // the only symptom is a keyboard user quietly returned to the body.
      const deferred: Array<{ readonly target: MdyElementTarget; readonly type: "focus" | "scroll" }> = [];

      processWidgetCommands(commands, {
        lookup,
        handlers,
        scheduleFocus: (_el, target) => deferred.push({ target, type: "focus" }),
        scheduleScroll: (_el, target) => deferred.push({ target, type: "scroll" }),
        announce: (message) => announcer.announce(message),
      });

      if (deferred.length === 0) return;
      options.defer(() => {
        for (const item of deferred) {
          // Resolved again, after the render. A target that no longer resolves is left alone rather
          // than chased through the node it used to be: focus stays on something the document still
          // contains, which is what a removed trigger has to leave behind.
          const el = lookup(item.target.part, item.target.key);
          if (!el) continue;
          if (item.type === "focus") el.focus();
          // Every browser has `scrollIntoView`; some minimal DOM implementations — the one every
          // adapter's own suite runs under — do not implement it at all. A missing scroll affordance
          // must not take the whole interaction down with it.
          else el.scrollIntoView?.({ block: "nearest" });
        }
      });
    },
  };
}
