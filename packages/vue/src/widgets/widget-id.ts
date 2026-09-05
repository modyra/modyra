/**
 * The id every part of a widget is built from.
 *
 * A document may name it. Where it does not, it is derived from the field's own path — so the same
 * document renders the same ids every time, a consumer can write `aria-describedby="when__label"` in
 * their own markup, and server-rendered markup agrees with a client mount (ADR 0135).
 *
 * **Two forms built from one document are the case this exists for.** Both hold a field named
 * `when`, so both would claim `when__label`, and a reference from the second resolves into the
 * first — silently, because a duplicate id is not an error anywhere. `widgetScopeOf` answers which
 * form a handle belongs to, and the scope goes in front.
 *
 * A host that renders two forms from the same document can also say so itself with `idScope`, which
 * wins over the derived one: a name a person chose is stable across renders in a way a derived scope
 * cannot promise when the page changes underneath it.
 */
import { idSafeKey, widgetScopeOf } from "@modyra/widgets";
import type { MdyFieldHandle } from "@modyra/core";

/** What a component reads to build its ids: what it was told, and what it is bound to. */
export interface MdyWidgetIdInputs {
  readonly widgetId?: string;
  readonly idScope?: string;
  readonly field: MdyFieldHandle<never> | { readonly path?: string } | object;
}

export function widgetIdOf(inputs: MdyWidgetIdInputs): string {
  // What the document said, whole: a host that names its widgets has already solved this, and a
  // derived scope written over it would rename ids the host wrote down elsewhere.
  if (inputs.widgetId !== undefined && inputs.widgetId !== "") return inputs.widgetId;
  const path = (inputs.field as { path?: string }).path;
  // Nothing to derive from is not a failure: a field with no path is one nobody can reference by
  // name either, and an invented counter would render different ids on every mount.
  if (path === undefined || path === "") return "mdy";
  // The path is data — a document names a nested field `rows.0.name` — and the separator is a class
  // selector to a browser, so an id carrying it cannot be reached by the consumer it was published
  // for (ADR 0141).
  const safe = idSafeKey(path);
  // No page predicate on purpose. Every widget of every form on the page computes its ids during
  // setup, before any of them is mounted, so a question about what is already rendered is asked of
  // an empty document and answers "free" for a scope another form has just taken. The registry knows
  // what it has handed out whatever the render order, and that is the authority this renderer needs.
  const scope = inputs.idScope ?? widgetScopeOf(inputs.field);
  // A single character neither part may contain: the joiner's first occurrence always ends the
  // scope, so two distinct scopes cannot produce one id.
  return scope === undefined ? safe : `${scope}-${safe}`;
}
