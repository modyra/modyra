/**
 * Deterministic ID policy.
 *
 * Generates stable identifiers for widget parts and items. The policy must
 * be SSR-safe: the same input must produce the same output on server and
 * client.
 */
import { MDY_ID_DELIMITER, handleFormOf } from "@modyra/core";

export interface MdyWidgetIdFactory {
  /** ID for a named part of a widget instance. */
  part(widgetId: string, part: string): string;
  /** ID for an item inside a named part (e.g. an option in a listbox). */
  item(widgetId: string, part: string, key: string): string;
}

/**
 * What separates the segments of a generated id.
 *
 * Re-exported from `@modyra/core`, which owns it because the dynamic parser has to reject names
 * containing it and core cannot import this package.
 *
 * It matters because a widget id may not contain it: `part("a", "label")` and a field named
 * `a__label` both land on `a__label`, in different roles. The browser allows two elements to carry
 * the same id, so `getElementById`, `label[for]` and every ARIA IDREF quietly stop being
 * deterministic — a failure invisible until two particular fields share a page.
 *
 * The delimiter is forbidden in names rather than escaped. Escaping would encode `_`, changing the
 * id of every field whose name contains one, and those ids are consumer-visible. Forbidding costs
 * nothing: an id built from a name containing the delimiter was never deterministic in the first
 * place, so nothing correct is being taken away.
 */
export { MDY_ID_DELIMITER } from "@modyra/core";

/**
 * Whether a widget id can safely be a segment of a generated id.
 *
 * Whitespace is refused for the reason the delimiter is: it makes one reference into several.
 * `aria-labelledby` and `aria-describedby` are **space-separated lists** of ids, so a widget id of
 * `"my form"` produces `aria-labelledby="my form__label"`, which an assistive technology reads as
 * two references — `my` and `form__label` — and resolves to nothing anyone rendered. The control
 * then has no accessible name at all, and the markup looks correct while it says nothing.
 *
 * The HTML rule is the same one, written from the other side: an id must not contain ASCII
 * whitespace.
 */
export function isValidWidgetId(widgetId: string): boolean {
  return widgetId.length > 0
    && !widgetId.includes(MDY_ID_DELIMITER)
    && !/[\t\n\f\r ]/.test(widgetId);
}

/**
 * Refuses a widget id that cannot be one, where a widget's part ids are built.
 *
 * {@link isValidWidgetId} is the question a host can ask; this is the answer they get if they do not.
 * A predicate only protects the renderers that remember to call it, and this package is the surface
 * third-party renderers are built on — the one nobody has written yet is who this is for.
 *
 * Not in {@link defaultWidgetIdFactory}: that is a joining primitive a consumer may replace, it is
 * documented as deterministic and reversible, and something constructing ids speculatively is
 * entitled to use it. The per-kind builders are this contract's own front door, and a widget whose
 * ids cannot be referenced is not a widget anyone can render.
 *
 * Loud rather than repaired: an id is consumer-visible, so rewriting one silently would change what
 * a host's tests and stylesheets look for. An id containing whitespace was never a usable id, so
 * nothing correct is refused.
 */
export function assertUsableWidgetId(widgetId: string): void {
  if (isValidWidgetId(widgetId)) return;
  throw new Error(
    `[modyra] "${widgetId}" cannot be a widget id: it must be non-empty, and may contain neither ` +
    `whitespace nor "${MDY_ID_DELIMITER}". Whitespace splits every ARIA reference built from it ` +
    "into several, each resolving to nothing, so the control ends up with no accessible name.",
  );
}

/** Default deterministic ID factory. */
export const defaultWidgetIdFactory: MdyWidgetIdFactory = {
  part(widgetId, part) {
    return `${widgetId}${MDY_ID_DELIMITER}${part}`;
  },
  item(widgetId, part, key) {
    return `${widgetId}${MDY_ID_DELIMITER}${part}${MDY_ID_DELIMITER}${idSafeKey(key)}`;
  },
};

/**
 * A key as a piece of an id.
 *
 * A widget id is a host's word and is refused when it cannot be one; an item key is **data** — an
 * option's value, a row's key — and refusing it would refuse the document that declared it. So it is
 * spelled instead, in the one encoding an id may carry.
 *
 * Whitespace is why: `aria-activedescendant` and its family are space-separated lists of ids, so an
 * option valued `New York` produced `city__option__New York`, which an assistive technology reads as
 * two references and resolves to neither. The person operating the list by keyboard is pointed at
 * nothing, on an option that is on screen.
 *
 * Percent-encoded rather than replaced: `%` goes first so the encoding stays reversible, and the
 * delimiter is encoded because an id carrying it a second time cannot be taken apart again.
 *
 * **Each whitespace character carries its own code**, which is what makes the encoding injective as
 * well as reversible. One sequence for all five maps `a b`, `a\tb` and `a\nb` onto a single id, and
 * the browser accepts duplicate ids without complaint — so `getElementById`, `label[for]` and every
 * ARIA IDREF resolve to whichever element the document reaches first. A tab or a newline inside an
 * option's value is what a paste from a spreadsheet produces, so the colliding keys are the ordinary
 * case rather than a hostile one.
 *
 * No code emitted here contains the delimiter or whitespace, so an id still splits into exactly its
 * three segments — widget, part, key.
 */
function idSafeKey(key: string): string {
  // Everything outside what a CSS identifier may carry, escaped as `_` and two hex digits.
  //
  // Percent-encoding was the first answer and it solved only half the problem: `%` is not a
  // character a CSS identifier may contain, so `document.querySelector("#city__option__a%20b")`
  // *throws* rather than missing — measured, not assumed. An assistive technology was always served,
  // because `getElementById` and every ARIA IDREF are exact string matches that care about none of
  // this; the path it broke is the one a person writes by hand, and it broke it with an exception
  // rather than a null, so even a caller who handles "not found" gets a stack trace.
  //
  // `_` as the escape, because it is the one punctuation character an identifier may hold. The
  // delimiter is two of them, and an escape is always `_` followed by a hex digit — which is never
  // `_` — so no encoded key can produce a delimiter, and an id still splits into exactly its three
  // segments. Reversible for the same reason `%` had to go first: the escape character escapes
  // itself, as `_5F`.
  //
  // Injective, because each character carries its own code: `a b`, `a\tb` and `a\nb` stay three ids
  // rather than one. The browser accepts duplicate ids in silence, so collapsing them would point
  // every reference at whichever element the document reaches first — and a tab inside an option's
  // value is what a paste from a spreadsheet produces.
  //
  // Above ASCII is left alone: an identifier may carry it, so `città` stays readable.
  return key.replace(
    /[^A-Za-z0-9-]/g,
    (character) => {
      const code = character.codePointAt(0) ?? 0;
      return code > 0x7f
        ? character
        : `_${code.toString(16).toUpperCase().padStart(2, "0")}`;
    },
  );
}

/**
 * The id a calendar's day cell carries.
 *
 * One rule in one place: the field controllers compute it for the part table, and a renderer that
 * cannot reach that table — a calendar drawn by a component two levels below the field — asks here
 * rather than rebuilding the string. Two places computing one id is the shape that drifts the day
 * the format changes.
 */
export function calendarDayId(widgetId: string, iso: string): string {
  return `${widgetId}__day__${iso}`;
}

/**
 * Warns when a widget publishes an id another element on the page already carries.
 *
 * Ids are the field's path (ADR 0135), so two forms built from one document claim one set of ids
 * unless the host scopes them. That is a *visible* failure by design — the record rejects renaming
 * the second form's ids, because a mount-order-dependent id is the counter's defect returned in a
 * corner — but silent it is the worst of both: `aria-describedby` resolves into the other form and
 * the page looks exactly like one whose references are right.
 *
 * So: warn, never rename. `advice` is how a renderer says which of its own doors sets the scope — the
 * fact belongs here and the spelling belongs to whoever is being read.
 *
 * Stateless on purpose — it asks the document rather than keeping a registry of live ids, so nothing
 * has to be released on teardown and a remount cannot report a collision with its own former self.
 */
export function reportIdCollision(
  element: Element,
  advice?: string,
  warn?: (message: string) => void,
): readonly string[] {
  const document = element.ownerDocument;
  if (document === null) return [];
  // The ids this widget actually put on the page, taken from the page rather than from what it was
  // going to call itself. Asked the other way round — "does anything else carry the widget id" — the
  // guard checked an id a renderer need not publish at all: plain puts `when__label` and
  // `when__trigger` on elements and nothing on `when`, so the count was always one and the check
  // always passed, in the renderer whose ids are hand-written into consumers' pages the most.
  const mine = new Set<string>();
  if (element.id !== "") mine.add(element.id);
  for (const each of Array.from(element.querySelectorAll("[id]"))) {
    if (each.id !== "") mine.add(each.id);
  }
  if (mine.size === 0) return [];

  const seen = new Map<string, number>();
  for (const each of Array.from(document.querySelectorAll("[id]"))) {
    if (mine.has(each.id)) seen.set(each.id, (seen.get(each.id) ?? 0) + 1);
  }
  const shared = [...mine].filter((id) => (seen.get(id) ?? 0) > 1).sort();
  if (shared.length === 0) return [];

  const say = warn ?? ((message: string) => console.warn(message));
  say(
    `[modyra] Two elements on this page carry the id ${JSON.stringify(shared[0])}` +
    (shared.length > 1 ? ` (and ${shared.length - 1} more from this field)` : "") +
    `. A widget's ids come from its field's path, so two forms built from the same document claim ` +
    `the same ones, and every reference to this field resolves into whichever rendered last. ` +
    (advice ?? "Give each form its own id scope."),
  );
  return shared;
}


/**
 * The scope every id of one form sits in.
 *
 * A form carries an identity of its own, and every widget bound to it derives its ids inside that
 * identity — so two forms built from the same document do not both claim `when__label`, whether or
 * not the consumer knew to ask for a scope. ADR 0146.
 *
 * The key is the **form object**, reached from a handle through core's registry, so a control that
 * only ever sees a handle — which is every control in two of the three renderers — arrives at the
 * same scope as its siblings. Pass either: a form is used as itself, a handle resolves to the form
 * that built it.
 *
 * `undefined` for a hand-built handle that no form registered, which is a shape the registry
 * documents. A caller that gets it should leave the id unscoped rather than invent one: an id that
 * changes because a test double was used is worse than one that collides where nothing else exists
 * to collide with.
 *
 * **The minted value depends on the order forms are created in**, which is why it is a fallback and
 * not the mechanism: a consumer who needs the ids written down in advance supplies the scope, and a
 * server render must. That cost is the whole subject of ADR 0146.
 */
const SCOPE_REGISTRY = Symbol.for("modyra.widgets.formScopes");

interface FormScopeRegistry {
  readonly scopes: WeakMap<object, string>;
}

const scopeRegistry = ((): FormScopeRegistry => {
  const host = globalThis as Record<symbol, unknown>;
  const held = host[SCOPE_REGISTRY] as Partial<FormScopeRegistry> | undefined;
  // Shared through the global the way core shares its handle registry: two copies of this package on
  // one page would otherwise hold two scopes for one form, and the ids of one form would depend on
  // which copy happened to draw each widget.
  if (held?.scopes instanceof WeakMap) return held as FormScopeRegistry;
  const fresh: FormScopeRegistry = { scopes: new WeakMap() };
  host[SCOPE_REGISTRY] = fresh;
  return fresh;
})();

/**
 * A short, stable name for a set of field paths.
 *
 * Deliberately a function of *what the form holds* rather than of when it was made: the same
 * document mounted again — after a remount, or on a client hydrating what a server rendered — must
 * arrive at the same scope, or every id in the page moves and the relationships recorded against
 * them stop meaning anything. FNV-1a because it is four lines and this is a name, not a digest.
 */
function signatureOf(paths: readonly string[]): string {
  let hash = 0x811c9dc5;
  for (const path of [...paths].sort()) {
    for (let index = 0; index < path.length; index += 1) {
      hash ^= path.charCodeAt(index);
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    hash ^= 0x2f;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `f${hash.toString(36)}`;
}

/** The top-level names a form holds, which is what its scope is a function of. */
function pathsOf(form: object): readonly string[] {
  const tree = (form as { readonly f?: Record<string, unknown> }).f;
  return tree === undefined || tree === null ? [] : Object.keys(tree);
}

/**
 * The scope every id of one form sits in.
 *
 * A form carries an identity of its own, and every widget bound to it derives its ids inside that
 * identity — so two forms built from the same document do not both claim `when__label`, whether or
 * not the consumer knew to ask for a scope. ADR 0146.
 *
 * The default is a function of the document, so a remount and a hydration land on the ids they had.
 * **Two forms built from the *same* document are the case that cannot be answered from the document**
 * — they are identical by construction — so the second is told apart by `taken`, a question only the
 * caller can answer because only the caller can see the page. A caller that cannot say passes
 * nothing and gets the signature, which is the single-form case and by far the common one.
 *
 * A caller that needs the scope to be a name it chose passes it instead; the renderers' own doors —
 * `idPrefix`, `id-scope`, `[idScope]` — still win over this.
 */
export function formScopeOf(form: object | null | undefined, taken?: (scope: string) => boolean): string {
  if (form === null || form === undefined) return signatureOf([]);
  const held = scopeRegistry.scopes.get(form);
  if (held !== undefined) return held;
  const signature = signatureOf(pathsOf(form));
  let scope = signature;
  // Only a *live* scope pushes the next one along, so a form that has gone takes its scope with it
  // and the document that replaces it reads the same as the one before.
  for (let ordinal = 2; taken?.(scope) === true; ordinal += 1) scope = `${signature}x${ordinal}`;
  scopeRegistry.scopes.set(form, scope);
  return scope;
}

/**
 * The scope of the form that built `handle`.
 *
 * Separate from {@link formScopeOf} rather than one function taking either: a form and a handle are
 * both objects, so a single entry point cannot tell an unregistered handle from a form and would
 * hold a scope **per control** for the first — every field of one form under a different scope,
 * which is worse than the collision this exists to end.
 *
 * `undefined` for a hand-built handle no form registered, which is a shape core's registry
 * documents. A caller that gets it should leave the id unscoped: an id that moves because a test
 * double was used is worse than one that collides where nothing else exists to collide with.
 */
export function widgetScopeOf(handle: object | null | undefined, taken?: (scope: string) => boolean): string | undefined {
  if (handle === null || handle === undefined) return undefined;
  const form = handleFormOf(handle);
  return form === undefined ? undefined : formScopeOf(form, taken);
}
