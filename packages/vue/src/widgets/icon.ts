/**
 * The icon a name stands for, as real SVG geometry.
 *
 * The geometry is `MDY_ICONS`, shared with every other renderer, so a caret drawn here and a caret
 * drawn by another adapter are the same caret. An affordance the catalogue declares — the arrow of a
 * chooser, the calendar on a date field's opener — is an empty box without it: the stylesheets size
 * and colour the glyph, and have nothing to size when none is drawn.
 *
 * Decoration only: hidden from assistive technology and never a focus stop, because whatever it
 * sits on already carries the name.
 */
import { h, type VNode } from "vue";
import { MDY_ICONS, type MdyIconName } from "@modyra/widgets";

export function iconOf(name: MdyIconName): VNode {
  const icon = MDY_ICONS[name];
  // The registry holds markup, and it is the package's own constant rather than anything a caller
  // supplies, so there is no untrusted string on this path.
  return h("svg", { viewBox: icon.viewBox, "aria-hidden": "true", focusable: "false", innerHTML: icon.content });
}
