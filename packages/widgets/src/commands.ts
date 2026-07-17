/**
 * Command contract.
 *
 * Commands describe side effects requested by a controller. The framework
 * adapter is responsible for executing them at the correct lifecycle moment
 * (e.g. after the next render, after hydration, inside a layout effect).
 */

/** Abstract reference to a widget part or item. */
export interface MdyElementTarget {
  readonly part: string;
  readonly key?: string;
}

/** UI command produced by a widget controller. */
export type MdyUiCommand =
  | { readonly type: "focus"; readonly target: MdyElementTarget }
  | { readonly type: "restore-focus"; readonly target: MdyElementTarget }
  | { readonly type: "scroll-into-view"; readonly target: MdyElementTarget }
  | { readonly type: "announce"; readonly message: string }
  | { readonly type: "open-overlay"; readonly anchor: MdyElementTarget }
  | { readonly type: "close-overlay" }
  | { readonly type: "emit-change" }
  | { readonly type: "mark-touched" }
  | { readonly type: "mark-dirty" };
