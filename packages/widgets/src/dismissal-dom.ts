/**
 * A light-dismiss policy, wired to the events a document actually delivers.
 *
 * `createLightDismiss` decides *whether* an interaction dismisses; this is the six listeners that
 * feed it. Written per renderer, the set drifts: one bound `pointerup` and another did not, and the
 * one that did not was left deciding on `click` alone — which the policy documents as the tail of
 * the gesture rather than the gesture. A dismissal that only sometimes arrives is indistinguishable
 * from an overlay that ignores the outside.
 *
 * All six are capture-phase where the DOM offers it, so content that stops propagation cannot
 * silence the decision — an overlay is dismissed by where the pointer went, not by who let the event
 * through.
 */
import type { MdyLightDismiss } from "./dismissal.js";

export interface MdyDismissalBindingOptions {
  /** Defaults to the global document; supplied by a host that lives in another one. */
  readonly document?: Document;
  /** Defaults to the global window; the blur that abandons an interaction is its own. */
  readonly window?: Window;
}

/** Binds `policy` to the document. Returns the unbind, which also resets the policy. */
export function bindLightDismiss(
  policy: MdyLightDismiss,
  options: MdyDismissalBindingOptions = {},
): () => void {
  const doc = options.document ?? (typeof document === "undefined" ? undefined : document);
  const win = options.window ?? (typeof window === "undefined" ? undefined : window);
  if (!doc) return () => policy.reset();

  const onDown = (event: Event): void => {
    const e = event as PointerEvent;
    policy.pointerdown(e.target, {
      pointerId: e.pointerId ?? 0,
      isPrimary: e.isPrimary ?? true,
      button: e.button ?? 0,
    });
  };
  const onUp = (event: Event): void => {
    const e = event as PointerEvent;
    policy.pointerup(e.target, e.pointerId ?? undefined);
  };
  const onClick = (event: Event): void => policy.click(event.target);
  const onCancel = (event: Event): void =>
    policy.pointercancel((event as PointerEvent).pointerId ?? 0);
  // An interaction whose end the page cannot observe is abandoned, not completed.
  const onAbandon = (): void => policy.reset();

  doc.addEventListener("pointerdown", onDown, true);
  doc.addEventListener("pointerup", onUp, true);
  doc.addEventListener("click", onClick, true);
  doc.addEventListener("pointercancel", onCancel, true);
  win?.addEventListener("blur", onAbandon);
  doc.addEventListener("visibilitychange", onAbandon);

  return () => {
    doc.removeEventListener("pointerdown", onDown, true);
    doc.removeEventListener("pointerup", onUp, true);
    doc.removeEventListener("click", onClick, true);
    doc.removeEventListener("pointercancel", onCancel, true);
    win?.removeEventListener("blur", onAbandon);
    doc.removeEventListener("visibilitychange", onAbandon);
    policy.reset();
  };
}
