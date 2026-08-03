/**
 * Incremental render primitives for the Studio shell.
 *
 * Rebuilding the shell whole (`host.innerHTML = …`) on every state change
 * resets every scroll container, tears down the live form canvas and
 * re-attaches every listener. A {@link Region} owns one persistent container
 * and only touches the DOM when its markup actually changed, so untouched
 * parts of the UI keep their nodes, listeners, scroll and focus.
 */

/** A persistent container whose contents are rewritten only when the markup differs from last time. */
export class Region {
  #last: string | null = null;

  constructor(
    readonly root: HTMLElement,
    /** Re-attaches this region's listeners. Called only after an actual rewrite — never for a skipped update. */
    private readonly bind?: (root: HTMLElement) => void,
  ) {}

  /** Returns true when the DOM was rewritten (and therefore re-bound), false when the markup was identical. */
  update(html: string): boolean {
    if (html === this.#last) return false;
    this.#last = html;
    this.root.innerHTML = html;
    this.bind?.(this.root);
    return true;
  }

  /** Forces the next {@link update} to rewrite even if the markup is unchanged. */
  invalidate(): void {
    this.#last = null;
  }
}

interface ScrollPosition {
  readonly element: HTMLElement;
  readonly left: number;
  readonly top: number;
}

/**
 * Scroll positions of the shell's independent scroll surfaces.
 *
 * Restoration must run *after* every region (and the live form mount) has put
 * its content back: assigning `scrollTop` while the container is still empty
 * makes the browser clamp it to 0, which is exactly why the canvas viewport
 * used to jump back to the top on every command.
 */
export class ScrollMemory {
  readonly #elements: HTMLElement[] = [];
  #saved: ScrollPosition[] = [];

  track(element: HTMLElement | null | undefined): void {
    if (element && !this.#elements.includes(element)) this.#elements.push(element);
  }

  capture(): void {
    this.#saved = this.#elements.map((element) => ({
      element,
      left: element.scrollLeft,
      top: element.scrollTop,
    }));
  }

  restore(): void {
    for (const { element, left, top } of this.#saved) {
      if (element.scrollLeft !== left) element.scrollLeft = left;
      if (element.scrollTop !== top) element.scrollTop = top;
    }
  }

  clear(): void {
    this.#elements.length = 0;
    this.#saved = [];
  }
}
