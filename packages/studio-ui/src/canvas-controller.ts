/**
 * DOM/lifecycle boundary for Studio's central canvas.
 *
 * Patch 3 deliberately keeps the existing tree renderer. The controller
 * isolates viewport state, node-to-element lookup and disposable runtime
 * sessions now, so the tree can later be replaced by a persistent Plain
 * canvas without teaching the application shell about renderer details.
 */

export interface DisposableRuntimeSession {
  dispose(): void;
}

/** Owns at most one renderer/runtime session and disposes replacements exactly once. */
export class StudioRuntimeSession<T extends DisposableRuntimeSession> {
  #current: T | null = null;

  get current(): T | null {
    return this.#current;
  }

  replace(next: T | null): T | null {
    if (next === this.#current) return this.#current;
    const previous = this.#current;
    this.#current = next;
    previous?.dispose();
    return this.#current;
  }

  dispose(): void {
    this.replace(null);
  }
}

/** Stable node-ID lookup owned by the canvas rather than ad-hoc document queries. */
export class StudioElementRegistry {
  #byNodeId = new Map<string, HTMLElement>();

  refresh(root: ParentNode): void {
    this.#byNodeId.clear();
    root.querySelectorAll<HTMLElement>("[data-node]").forEach((element) => {
      const nodeId = element.dataset.node;
      if (nodeId) this.#byNodeId.set(nodeId, element);
    });
  }

  get(nodeId: string): HTMLElement | null {
    return this.#byNodeId.get(nodeId) ?? null;
  }

  clear(): void {
    this.#byNodeId.clear();
  }
}

interface CanvasViewportSnapshot {
  readonly scrollLeft: number;
  readonly scrollTop: number;
}

/**
 * Boundary used by mountStudio around the existing full-shell render.
 * Today it preserves the tree canvas viewport and indexes its nodes. In the
 * Plain-canvas migration this class becomes the owner of the persistent mount.
 */
export class StudioCanvasController {
  readonly elements = new StudioElementRegistry();
  #viewport: CanvasViewportSnapshot = { scrollLeft: 0, scrollTop: 0 };
  #canvas: HTMLElement | null = null;

  capture(): void {
    if (!this.#canvas) return;
    this.#viewport = {
      scrollLeft: this.#canvas.scrollLeft,
      scrollTop: this.#canvas.scrollTop,
    };
  }

  connect(canvas: HTMLElement | null): void {
    this.#canvas = canvas;
    this.elements.clear();
    if (!canvas) return;
    this.elements.refresh(canvas);
    canvas.scrollLeft = this.#viewport.scrollLeft;
    canvas.scrollTop = this.#viewport.scrollTop;
  }

  elementForNode(nodeId: string): HTMLElement | null {
    return this.elements.get(nodeId);
  }

  dispose(): void {
    this.#canvas = null;
    this.elements.clear();
    this.#viewport = { scrollLeft: 0, scrollTop: 0 };
  }
}
