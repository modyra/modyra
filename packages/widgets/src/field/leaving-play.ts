/**
 * What happens to an open overlay when its field leaves play.
 *
 * A field can leave play while its popup is open, and nobody has to click anything for it: a
 * document's rule takes it out when *another* field changes, so a value arriving from a fetch can do
 * it while the user is looking at the calendar. What was left behind was an overlay that looked
 * live — every cell drawn, the opener still reporting `aria-expanded="true"` — and answered nothing,
 * because the field is out of play and the click correctly does not land.
 *
 * The click doing nothing is right. The calendar still being there offering it is not.
 *
 * Only `disabled` closes it. A read-only field is still in the form and still being read: its
 * overlay may legitimately stay open to be looked at, and closing one would take away a value the
 * user is allowed to see. `blocksFocus` is the same line the native `disabled` attribute is drawn
 * on.
 */
import { reactivityRunsEffects, type MdyReactivity, type MdyWritableSignal } from "@modyra/core";
import { blocksFocus } from "../interactivity.js";
import type { MdyInteractivity } from "@modyra/core";

/**
 * Closes `open` whenever `interactivity` says the field is out of play, and returns the teardown.
 *
 * The flag is *set* to false rather than derived, so a field coming back into play does not
 * re-open a popup the user never asked for a second time.
 *
 * A reactivity that runs no effects — a server pass — gets nothing: there is no overlay open on a
 * server, and subscribing there would be work with no observer.
 */
export function closeOverlayWhenOutOfPlay(
  reactivity: MdyReactivity,
  interactivity: () => MdyInteractivity,
  open: MdyWritableSignal<boolean>,
): () => void {
  if (!reactivityRunsEffects(reactivity)) return () => undefined;
  const ref = reactivity.effect(() => {
    const out = blocksFocus(interactivity());
    // Read inside the effect so the subscription covers both, and written outside the read so the
    // write is not part of what this effect depends on.
    if (!out) return;
    reactivity.untracked(() => {
      if (open()) open.set(false);
    });
  }, { debugName: "modyra:overlay-leaves-play" });
  return () => ref.destroy();
}
