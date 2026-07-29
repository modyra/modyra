/**
 * The three columns: how wide each one is, and how it is reached when the window is too narrow to
 * hold all three.
 *
 * Studio's shell was three fixed tracks with two breakpoints layered on top, and the breakpoints
 * disagreed: one hid the inspector below 1000px, the other styled it as a slide-over below 980px
 * without ever putting `display` back. The second rule could not win, so from 1000px down the
 * properties panel, form rules, diagnostics, export and preview were not narrow — they were gone,
 * with nothing to open them. Below 760px the outline went the same way. That is not a layout that
 * adapts; it is one that amputates.
 *
 * So the columns are one mechanism with two modes. Wide enough for three tracks, the rails between
 * them are drag handles and the widths are the user's, remembered between sessions. Too narrow, the
 * same rails become tabs and the side panels slide over the canvas — still reachable, still the
 * whole of Studio. Nothing is ever `display: none` with no way back.
 */

/** Where a column may not go. Below the minimum a panel is unusable; above the maximum the canvas is. */
const LIMITS = {
  outline: { min: 160, max: 420, fallback: 224 },
  inspector: { min: 260, max: 560, fallback: 336 },
} as const;

export type StudioColumn = keyof typeof LIMITS;

/** The custom property each column's track is written to. */
const PROPERTY: Readonly<Record<StudioColumn, string>> = {
  outline: "--studio-col-outline",
  inspector: "--studio-col-inspector",
};

/** UI preference, so localStorage — the plan puts projects in IndexedDB and preferences here. */
const STORAGE_KEY = "modyra-studio:columns";

/** The width below which three tracks stop fitting and the side columns become slide-overs. */
export const COLUMNS_COLLAPSE_QUERY = "(max-width: 1000px)";

const clamp = (value: number, column: StudioColumn): number =>
  Math.min(Math.max(value, LIMITS[column].min), LIMITS[column].max);

function readStored(): Partial<Record<StudioColumn, number>> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return {};
    const out: Partial<Record<StudioColumn, number>> = {};
    for (const column of Object.keys(LIMITS) as StudioColumn[]) {
      const value = (parsed as Record<string, unknown>)[column];
      if (typeof value === "number" && Number.isFinite(value)) out[column] = clamp(value, column);
    }
    return out;
  } catch {
    // A private-mode browser, a full quota, or a stale value from another version: the columns fall
    // back to their defaults rather than the shell failing to build.
    return {};
  }
}

function persist(widths: Partial<Record<StudioColumn, number>>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(widths));
  } catch {
    // Preferences are a convenience; not being able to remember them is not an error worth raising.
  }
}

export interface StudioColumns {
  /** Current width of a column, whether it came from the user or from the default. */
  width(column: StudioColumn): number;
  /** Sets a width, clamped, applied and remembered. */
  resize(column: StudioColumn, width: number): void;
  /** Restores a column to its default width. */
  reset(column: StudioColumn): void;
  /** Whether the shell is narrow enough that the side columns are slide-overs. */
  collapsed(): boolean;
  /** Opens or closes a side column while collapsed. Does nothing when all three tracks fit. */
  toggle(column: StudioColumn, open?: boolean): void;
  dispose(): void;
}

/**
 * Wires the rails in `root` — which must contain `.studio` and one `[data-resize]` per side column.
 *
 * Dragging is done on the custom property rather than by writing `grid-template-columns`, so the
 * stylesheet keeps the whole shape of the grid and this only supplies two numbers.
 */
export function installColumns(root: HTMLElement): StudioColumns {
  const studio = root.querySelector<HTMLElement>(".studio");
  if (!studio) throw new Error("installColumns: no .studio element to lay out");

  const widths: Partial<Record<StudioColumn, number>> = readStored();
  const media = typeof matchMedia === "function" ? matchMedia(COLUMNS_COLLAPSE_QUERY) : null;
  const disposers: Array<() => void> = [];

  const apply = (column: StudioColumn): void => {
    const width = widths[column];
    if (width === undefined) studio.style.removeProperty(PROPERTY[column]);
    else studio.style.setProperty(PROPERTY[column], `${Math.round(width)}px`);
  };
  for (const column of Object.keys(LIMITS) as StudioColumn[]) apply(column);

  const collapsed = (): boolean => media?.matches ?? false;

  const toggle = (column: StudioColumn, open?: boolean): void => {
    if (!collapsed()) return;
    const attribute = column === "outline" ? "outlineOpen" : "inspectorOpen";
    const next = open ?? studio.dataset[attribute] !== "true";
    studio.dataset[attribute] = String(next);
    // One at a time: two slide-overs at this width would leave no canvas between them.
    if (next) {
      const other = column === "outline" ? "inspectorOpen" : "outlineOpen";
      studio.dataset[other] = "false";
    }
  };

  const resize = (column: StudioColumn, width: number): void => {
    widths[column] = clamp(width, column);
    apply(column);
    persist(widths);
  };

  const reset = (column: StudioColumn): void => {
    delete widths[column];
    apply(column);
    persist(widths);
  };

  for (const rail of Array.from(root.querySelectorAll<HTMLElement>("[data-resize]"))) {
    const column = rail.dataset.resize as StudioColumn | undefined;
    if (!column || !(column in LIMITS)) continue;

    const onPointerDown = (event: PointerEvent): void => {
      // Collapsed, the rail is a tab: it opens the panel rather than sizing a track that is not
      // laid out as a track any more.
      if (collapsed()) {
        toggle(column);
        return;
      }
      event.preventDefault();
      const startX = event.clientX;
      const startWidth = rail.previousElementSibling instanceof HTMLElement && column === "outline"
        ? rail.previousElementSibling.getBoundingClientRect().width
        : rail.nextElementSibling instanceof HTMLElement && column === "inspector"
          ? rail.nextElementSibling.getBoundingClientRect().width
          : (widths[column] ?? LIMITS[column].fallback);
      rail.setPointerCapture(event.pointerId);
      studio.dataset.resizing = column;

      const onMove = (move: PointerEvent): void => {
        // The outline grows as the pointer moves right; the inspector, being on the other side of
        // the canvas, grows as it moves left.
        const delta = column === "outline" ? move.clientX - startX : startX - move.clientX;
        resize(column, startWidth + delta);
      };
      const onUp = (): void => {
        delete studio.dataset.resizing;
        rail.releasePointerCapture(event.pointerId);
        rail.removeEventListener("pointermove", onMove);
        rail.removeEventListener("pointerup", onUp);
        rail.removeEventListener("pointercancel", onUp);
      };
      rail.addEventListener("pointermove", onMove);
      rail.addEventListener("pointerup", onUp);
      rail.addEventListener("pointercancel", onUp);
    };

    // A separator that only answers to dragging is a separator nobody using a keyboard can move.
    const onKeyDown = (event: KeyboardEvent): void => {
      if (collapsed()) {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          toggle(column);
        }
        return;
      }
      const step = event.shiftKey ? 48 : 16;
      const current = widths[column] ?? LIMITS[column].fallback;
      if (event.key === "ArrowLeft") resize(column, current + (column === "outline" ? -step : step));
      else if (event.key === "ArrowRight") resize(column, current + (column === "outline" ? step : -step));
      else if (event.key === "Home") resize(column, LIMITS[column].min);
      else if (event.key === "End") resize(column, LIMITS[column].max);
      else if (event.key === "Enter") reset(column);
      else return;
      event.preventDefault();
      rail.setAttribute("aria-valuenow", String(Math.round(widths[column] ?? LIMITS[column].fallback)));
    };

    // Double-click is the shortcut every splitter has: back to the default width.
    const onDoubleClick = (): void => { if (!collapsed()) reset(column); };

    rail.setAttribute("role", "separator");
    rail.setAttribute("aria-orientation", "vertical");
    rail.setAttribute("aria-valuemin", String(LIMITS[column].min));
    rail.setAttribute("aria-valuemax", String(LIMITS[column].max));
    rail.setAttribute("aria-valuenow", String(Math.round(widths[column] ?? LIMITS[column].fallback)));
    rail.tabIndex = 0;

    rail.addEventListener("pointerdown", onPointerDown);
    rail.addEventListener("keydown", onKeyDown);
    rail.addEventListener("dblclick", onDoubleClick);
    disposers.push(() => {
      rail.removeEventListener("pointerdown", onPointerDown);
      rail.removeEventListener("keydown", onKeyDown);
      rail.removeEventListener("dblclick", onDoubleClick);
    });
  }

  // Coming back to a wide window must not leave a slide-over stuck open over the canvas.
  const onMediaChange = (): void => {
    if (!collapsed()) {
      studio.dataset.outlineOpen = "false";
      studio.dataset.inspectorOpen = "false";
    }
  };
  media?.addEventListener("change", onMediaChange);
  disposers.push(() => media?.removeEventListener("change", onMediaChange));
  onMediaChange();

  return {
    width: (column) => widths[column] ?? LIMITS[column].fallback,
    resize,
    reset,
    collapsed,
    toggle,
    dispose: () => { for (const off of disposers) off(); },
  };
}
