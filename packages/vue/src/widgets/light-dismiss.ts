/**
 * Closing an open panel when the interaction finishes somewhere else.
 *
 * A panel that only closes from its own trigger is a panel a person leaves by hunting for the way
 * out. Every overlay kind in the catalogue declares that a pointer finishing outside dismisses it,
 * and until this existed no panel in this package answered that at all: clicking the page behind an
 * open list did nothing to the list.
 *
 * **What counts as "outside" is not `contains` on the field.** The panel is drawn in the document
 * body (ADR 0130), so a pointer inside the panel is outside the field's own element — and a rule
 * written that way would dismiss on every click a person makes *in* the panel they are using. The
 * contract already answers this: it follows the widget's own `aria-controls` out to the panel, so
 * the branch a renderer declares is the field root and the reaching-out is the contract's. That is
 * why this file hands over one element and not a list.
 */
import { onScopeDispose, watch, type Ref } from "vue";
import {
  MDY_WIDGET_CONTRACTS,
  bindLightDismiss,
  createLightDismiss,
  overlayLifecycleTransition,
  type MdyWidgetKind,
} from "@modyra/widgets";

/**
 * Dismisses the panel of `kind` when a pointer interaction completes outside it.
 *
 * Bound only while the panel is open: a page carrying a document-level listener for every closed
 * widget on it pays for panels nobody opened.
 */
export function useLightDismiss(options: {
  readonly kind: MdyWidgetKind;
  readonly root: Ref<HTMLElement | null>;
  readonly isOpen: () => boolean;
  readonly close: () => void;
}): void {
  // Declared per kind, and read rather than assumed: a kind that does not dismiss this way gets no
  // listeners at all, instead of listeners that decide to do nothing.
  //
  // Read straight from the catalogue, because the declaration is not a yes or a no — it names the
  // interaction (`"light-dismiss"`), and `capabilityOf` refuses to answer a question about it with
  // a boolean. `false` is the only value that means "this kind does not do this".
  if (MDY_WIDGET_CONTRACTS[options.kind].capabilities.dismissOnOutsidePointer === false) return;

  let release: (() => void) | null = null;

  watch(options.isOpen, (open) => {
    if (!open) {
      release?.();
      release = null;
      return;
    }
    release ??= bindLightDismiss(createLightDismiss({
      isOpen: options.isOpen,
      // Read per interaction, not captured: the root is a view child that does not exist when this
      // rule is built, and a branch resolved once would hold the null it saw then.
      branch: () => ({ root: options.root.value, also: [] }),
      dismiss: () => {
        // The lifecycle still decides what an outside interaction means; this only reports that one
        // completed and does what comes back.
        const transition = overlayLifecycleTransition({ open: true }, { type: "outside", outside: true });
        if (transition.effect === "teardown") options.close();
      },
    }));
  }, { immediate: true });

  onScopeDispose(() => { release?.(); release = null; });
}
