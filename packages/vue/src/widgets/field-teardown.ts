/**
 * Closing what a field holds open when the field itself leaves the scene.
 *
 * The third way an overlay closes, and the one no renderer owned: a controller closes on an
 * intention, a component destroys at end of life, and a field taken out of the document by a rule
 * the document carries is neither. This package feels it where the others do not, because it draws
 * its panels outside the field — a freedom ADR 0131 grants explicitly, and one that costs the
 * accidental teardown the others get for free.
 *
 * The deciding is the contract's; this only says which element to watch and what closing means here.
 */
import { onMounted, onScopeDispose, type Ref } from "vue";
import { closeWhenFieldLeaves } from "@modyra/widgets";

export function useCloseWhenFieldLeaves(root: Ref<HTMLElement | null>, close: () => void): void {
  let stop: (() => void) | null = null;
  // After the element exists: the watch is on the parent it sits in, and there is no parent to watch
  // until the field has been drawn.
  onMounted(() => {
    const element = root.value;
    if (element === null) return;
    stop = closeWhenFieldLeaves(element, { close });
  });
  onScopeDispose(() => { stop?.(); stop = null; });
}
