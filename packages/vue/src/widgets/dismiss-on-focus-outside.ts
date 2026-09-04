/**
 * Closing a panel when focus settles outside the widget.
 *
 * Every kind with a popup declares `dismissOnFocusOutside`, and this package honoured it nowhere: a
 * panel left open behind a field somebody has tabbed away from covers the next question and answers
 * to a keyboard that has gone elsewhere.
 *
 * The deciding is the contract's — where focus landed, and whether that is still inside the widget
 * once the panel it opened is followed out of the field. This says only which elements are the
 * widget's here, and it says it as a function: a component's elements are refs, and a list resolved
 * when this is bound would hold the nulls it saw then.
 */
import { onScopeDispose, watch, type Ref } from "vue";
import { bindDismissOnFocusOutside, type MdyWidgetKind } from "@modyra/widgets";

export function useDismissOnFocusOutside(options: {
  readonly kind: MdyWidgetKind;
  readonly root: Ref<HTMLElement | null>;
  readonly panel: Ref<HTMLElement | null>;
  readonly isOpen: () => boolean;
  readonly close: () => void;
}): void {
  let release: (() => void) | null = null;

  // Bound only while the panel is open: a page carrying a document-level focus listener for every
  // closed widget on it pays for panels nobody opened.
  watch(options.isOpen, (open) => {
    if (!open) {
      release?.();
      release = null;
      return;
    }
    release ??= bindDismissOnFocusOutside(
      options.kind,
      // The field and the panel both. The panel is drawn outside the field (ADR 0130), so a branch
      // that named only the root would call every press inside the panel a departure.
      () => [options.root.value, options.panel.value],
      options.isOpen,
      options.close,
    );
  }, { immediate: true });

  onScopeDispose(() => { release?.(); release = null; });
}
