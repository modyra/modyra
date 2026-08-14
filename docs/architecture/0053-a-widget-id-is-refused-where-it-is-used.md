# ADR 0053: A widget id is refused where it is used, not only where it is asked about

Status: Accepted

## Context

Generated ids end up in `for`, `aria-labelledby` and `aria-describedby`. Two characters are
structural there: the delimiter, which makes two different widgets collide, and **whitespace**, which
makes one reference into several.

```html
<input aria-labelledby="my form__label">   <!-- read as `my` and `form__label` -->
```

Measured rather than assumed: `for` is *not* affected — it compares a single id as one string, so the
label still finds its control. That makes the failure harder to find, not easier. The association
survives, the label sits visibly beside the field, and the control announces **nothing**.

`isValidWidgetId` now refuses whitespace. That left the question of where the rule is enforced:
`@modyra/plain` calls the guard at mount and refuses; `@modyra/lit` generates its own ids and never
needs it; the third-party renderer nobody has written yet is the one at risk, and a predicate only
protects the callers who remember to call it.

## Decision

**The per-kind part-id builders refuse an unusable widget id**, throwing where the ids are built —
`textFieldPartIds`, `booleanFieldPartIds` and the six others. A widget whose ids cannot be referenced
is not a widget anyone can render, and this package is the surface third-party renderers are built
on.

**`defaultWidgetIdFactory` does not.** It stays a joining primitive: documented as deterministic and
reversible, replaceable by a consumer through `MdyWidgetIdFactory`, and legitimately usable by
something constructing ids speculatively. The split is the point — the factory is a mechanism, the
builders are this contract's front door.

**Loud rather than repaired.** An id is consumer-visible: a builder that rewrote `"my form"` into
`"my-form"` would change what a host's own tests, stylesheets and integration selectors look for,
silently, on ids they had been using. An id containing whitespace was never usable, so refusing takes
nothing correct away.

`assertUsableWidgetId` is exported, so a renderer can make the same refusal at its own boundary with
the same message.

## Consequences

A host passing a widget id with a space now gets an exception where it previously got markup that
looked correct and announced nothing. That is a breaking change in the sense that code which "worked"
stops — but what it was doing was rendering an unnameable control.

Anything that builds part ids speculatively — before knowing whether the widget id is real — has to
guard with `isValidWidgetId` first, or use the factory directly.

Eight files gained one line each. That is above the five-file threshold and is one coherent unit: the
same rule at the same boundary, in the eight functions that are that boundary.

## Alternatives rejected

**Guard only, no refusal at the builders.** What the guard alone buys is a question a careful renderer
can ask. The renderer that does not ask is the one this is for.

**Refuse in `defaultWidgetIdFactory` too.** Tried, and it is wrong: the factory is documented as
joining what it is given, a consumer may substitute their own, and a caller composing ids
speculatively has a legitimate use for a joiner that does not judge.

**Sanitise the id.** Keeps rendering working and changes ids a host already depends on, silently. The
same argument the delimiter rule already settled: forbid rather than escape, because ids are
consumer-visible.

## Verification

- `packages/widgets/test/ids.spec.mjs` — whitespace in five spellings is refused and six ordinary ids
  are not; the eight builders throw; the factory still joins what it is given.
- `battle-tests/adversarial/accessibility/whitespace-in-ids.battle.test.mjs` — the attack that found
  it, including the platform behaviour the rule is derived from, asserted with no Modyra call in it.

## Security and privacy

None. The accessibility consequence is the substance: a control with a visible label, correctly
associated, that announces nothing to a screen reader — and looks correct to every check that does
not resolve the reference list.
