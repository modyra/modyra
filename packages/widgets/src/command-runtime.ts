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
  commands: readonly MdyUiCommand[] | null | undefined,
  context: MdyWidgetCommandContext,
): void {
  const dom = context.capabilities?.dom ?? true;
  // Nothing to do is a legitimate answer, and it arrives as `undefined`: a controller handles the
  // intents its kind has — a text field has no popup, a checkbox no step, a select no cancel — and a
  // `dispatch` that met one it does not know returns nothing rather than an empty list. The guide's
  // headless recipe feeds `dispatch` straight into `execute`, so a host driving every widget from
  // one generic handler — which is the reason to go headless — crashed on the first widget that did
  // not have the intent under the cursor. An intent nobody declared is the same class of input as an
  // operator nobody declared, and this is the same answer: it does nothing.
  for (const command of commands ?? []) {
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

/** What marks a live region as shared by the whole page rather than owned by one widget. */
export const MDY_SHARED_REGION_ATTRIBUTE = "data-mdy-shared-region";

/**
 * The one live region on the page, named by the contract rather than by each renderer.
 *
 * Eight adapters each spelled their own — `mdy-plain-announcer`, `mdy-lit-announcer`, six more — so a
 * page carrying two of them carried two polite regions. Two regions speaking in the same instant are
 * read in an order nothing specifies: every screen reader has its own policy, and one announcement
 * cuts the other off partway. The loss is the same with one region, but with one there is somewhere
 * to put the queue that prevents it.
 *
 * Identity belongs in the message, not in the region: a reader speaks the text, never who wrote it.
 * Two regions saying "open" leave a person hearing "open" twice with nothing to attach it to, which
 * is why "Città: elenco aperto" is the fix and a second region is not.
 */
export const MDY_SHARED_REGION_ID = "mdy-live-region";

/**
 * The queue, and why announcing is not just writing text.
 *
 * A screen reader announces a *change* to a region it already knows. Three consequences the plain
 * write does not have:
 *
 * - **The region must exist before the first message.** Created and filled in the same instant, it is
 *   often skipped: the reader meets it already full and there is no change to read. So it is created
 *   empty, and written after.
 * - **The same text twice running is not a change.** "Errore corretto" written over "Errore corretto"
 *   is silent. Cleared first, then written, with a turn of the loop in between.
 * - **Two messages in one instant overwrite each other.** One is lost. Serialised, they are both
 *   heard.
 */
const SPOKEN_GAP_MS = 150;
const queue: string[] = [];
let draining = false;

function liveRegion(elementId: string): HTMLElement {
  const existing = document.getElementById(elementId);
  if (existing) return existing;
  const region = document.createElement("div");
  region.id = elementId;
  region.setAttribute(
    "style",
    "position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0;",
  );
  region.setAttribute("aria-live", "polite");
  region.setAttribute("aria-atomic", "true");
  // Marked as the page's own. One region serves every widget and has to outlive each of them — a
  // region created and removed around a message is a region the reader was not watching when the
  // text arrived — so a teardown check has to tell it apart from an element an instance left behind.
  region.setAttribute(MDY_SHARED_REGION_ATTRIBUTE, "");
  document.body.appendChild(region);
  return region;
}

function drain(elementId: string): void {
  const next = queue.shift();
  if (next === undefined) {
    draining = false;
    return;
  }
  const region = liveRegion(elementId);
  // Cleared, then written a turn later. The clear is what makes a repeat of the same words a change;
  // without it the second "3 results" after a first is silence.
  region.textContent = "";
  setTimeout(() => {
    region.textContent = next;
    setTimeout(() => drain(elementId), SPOKEN_GAP_MS);
  }, 100);
}

/**
 * Creates the page's live region if it is not there yet, and announces through it.
 *
 * The id is the contract's. It is still accepted so a renderer outside this repository keeps
 * working, but passing one means keeping a second region on the page, with everything above.
 */
export function createMdyAnnouncer(elementId: string = MDY_SHARED_REGION_ID): MdyAnnouncer {
  // Created here rather than at the first message: a region the reader has never seen is a region it
  // does not yet watch, and the first announcement of a page is the one most likely to be lost.
  if (typeof document !== "undefined") liveRegion(elementId);
  return {
    announce(message: string): void {
      if (typeof document === "undefined") return;
      queue.push(message);
      if (draining) return;
      draining = true;
      drain(elementId);
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
  /**
   * A live region of this host's own, where it must not share the page's.
   *
   * Omitted, the host announces through {@link MDY_SHARED_REGION_ID} — one region for the page,
   * which is what a person listening to two renderers at once needs. Naming one here gives this host
   * a second region, and two regions speaking at once are read in an order nothing specifies.
   */
  readonly announcerId?: string;
  readonly defer: MdyCommandDefer;
}

export interface MdyCommandRuntime {
  /**
   * Runs what a controller answered with.
   *
   * `commands` may be nothing: a controller handed an intent its kind does not have answers with
   * `undefined`, and the documented headless path feeds `dispatch` straight into this call.
   */
  execute(
    commands: readonly MdyUiCommand[] | null | undefined,
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
