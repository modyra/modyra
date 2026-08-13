/**
 * A drag, tracked on the document until the pointer lets go.
 *
 * The dial of a clock is turned by dragging, and that gesture cannot be tracked on the element it
 * started on: the pointer leaves it immediately and the rest of the drag happens somewhere else. So
 * every renderer binds `mousemove`/`touchmove` and `mouseup`/`touchend` on the document and unbinds
 * them at the end — and each one wrote that itself, with two of them byte-identical.
 *
 * The sibling of `createLightDismiss` and `createFocusCustodian`: the plumbing of a gesture, not what
 * the gesture means. What the angle *becomes* is the widget's business and stays there.
 *
 * `touchmove` is bound non-passive on purpose. A dial that does not call `preventDefault` scrolls the
 * page under the finger instead of turning, and a passive listener is not allowed to prevent it.
 */

/** Where the pointer is, from either kind of event. */
export interface MdyDragPoint {
  readonly clientX: number;
  readonly clientY: number;
}

export interface MdyPointerDragOptions {
  /** Called for every move while the drag is live. */
  onMove(point: MdyDragPoint, event: MouseEvent | TouchEvent): void;
  /** Called once when the pointer lets go, before the listeners come off. */
  onEnd?(): void;
  /** Defaults to the global document; supplied by a host that lives in another one. */
  readonly document?: Document;
}

export interface MdyPointerDrag {
  /** Begin tracking. Idempotent: a second start while live does not double-bind. */
  start(): void;
  /** Stop tracking. Idempotent, and safe to call from a teardown that does not know the state. */
  stop(): void;
  readonly dragging: boolean;
}

/** The point a mouse or touch event is at, or `null` for a touch event with no touches left. */
export function dragPointOf(event: MouseEvent | TouchEvent): MdyDragPoint | null {
  const touches = (event as TouchEvent).touches;
  if (touches !== undefined) {
    const touch = touches[0];
    return touch ? { clientX: touch.clientX, clientY: touch.clientY } : null;
  }
  const mouse = event as MouseEvent;
  return { clientX: mouse.clientX, clientY: mouse.clientY };
}

export function createPointerDrag(options: MdyPointerDragOptions): MdyPointerDrag {
  const target = options.document ?? (typeof document === "undefined" ? undefined : document);
  let live = false;

  const move = (event: Event): void => {
    if (!live) return;
    const pointer = event as MouseEvent | TouchEvent;
    const point = dragPointOf(pointer);
    if (point === null) return;
    // A dial that does not prevent the default scrolls the page under the finger instead of turning.
    if (pointer.cancelable) pointer.preventDefault();
    options.onMove(point, pointer);
  };

  const end = (): void => {
    if (!live) return;
    live = false;
    options.onEnd?.();
    unbind();
  };

  function bind(): void {
    if (!target) return;
    target.addEventListener("mousemove", move);
    target.addEventListener("touchmove", move, { passive: false });
    target.addEventListener("mouseup", end);
    target.addEventListener("touchend", end);
    target.addEventListener("touchcancel", end);
  }

  function unbind(): void {
    if (!target) return;
    target.removeEventListener("mousemove", move);
    target.removeEventListener("touchmove", move);
    target.removeEventListener("mouseup", end);
    target.removeEventListener("touchend", end);
    target.removeEventListener("touchcancel", end);
  }

  return {
    start(): void {
      if (live) return;
      live = true;
      bind();
    },
    stop(): void {
      if (!live) return;
      live = false;
      unbind();
    },
    get dragging(): boolean {
      return live;
    },
  };
}
