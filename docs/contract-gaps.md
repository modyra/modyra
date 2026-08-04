# Contract gaps

The widget contract's known open defects, measured 2026-08-02 against the built package and the
shipped stylesheets. `contract-compatibility.md` says what a change to the contract costs; this says
what is currently wrong with it.

Each finding is classified by the evidence behind it:

| | |
| --- | --- |
| **Observed** | reproduced against `packages/widgets/dist` or the shipped CSS |
| **Probable** | supported by code paths, not executed |
| **Possible** | plausible, undemonstrated |

The shape almost all of them share: **a rule that is declared, correct, and wired to nothing.** The
contract is in better shape than the things that check it, which is why most of these are invisible
to a green suite.

**Status.** The headings below are the source of truth; this list is a convenience for a reader who
does not want to scroll, and `npm run test:docs` fails if the two disagree.

- **Fixed** — A1, A2, A3, B1, B2, B3, C1, C3, C5, D, E1, G1, G2, G3, G4, H, I, J1, J2, J3, J4a, J4b
- **Partly fixed** — C2, E2, F, L, M — derived but not painted; most scripts reachable; kind-keyed
  tables narrowed and part-keyed ones key-checked; three engines running, their disagreements open;
  the colour metric decided and its estimate still approximate
- **Closed without a fix, deliberately** — C4 (no honest consumer to add), E3 (a scope boundary,
  documented)
- **Open** — K, N

Nothing here is urgent, and every entry carries the reason it is where it is.

The J findings share one shape: **anatomy the contract cannot express, because the thing that needs
constraining sits one level below the part list.** Each is a decision about what a widget *is*,
binding on every renderer, which is why each needed a record before a change.

J3, J4a and J4b are closed, and the decision they turned out to share is
[ADR 0014](architecture/0014-the-contract-names-the-responsible-element.md): the contract names the
element responsible for something, not the region that contains it. J1's decision is likewise already
made — [ADR 0012](architecture/0012-a-choice-is-a-radio-by-role-or-by-tag.md) — so what remains there
is implementation rather than a question. J2 is last on purpose: it is the only one requiring
conditional anatomy, and designing that machinery before the others closed would have been designing
it without evidence.

The step that made the closures believable was not a fix. A suite that cannot observe a violation
will not prove a new rule caught it, so every finding got a fixture first, asserting the wrong
behaviour it was still exhibiting; each was inverted in the commit that closed its gap.

One lesson recurs across E1, H and the `contract-diff` capability comparison: **a check is only as
good as the set of candidates it considers.** A rule that is correct, and a suite whose fixtures
never reach the branch it guards, are indistinguishable from green.

---

## A1 — `statesFor` stripped shell states on redeclaration, not on difference — **fixed**

**Observed.** `packages/widgets/src/catalog.ts:232`

```ts
if (name !== "root" && shape.classes?.[name] !== undefined) return [];
```

A widget that gives a part a class of its own has made it a different part, and that part does not
inherit the shell's states. The rule is right; the guard tests the wrong thing. It asks *whether a
class was declared*, not *whether it differs* — so a kind that redeclares a part with the shell's own
class loses the states anyway.

`checkbox` declares `label: [MDY_FIELD_SHELL_CLASSES.label]`, byte-identical to the fallback:

```
partClasses("checkbox", "label", { filled: true })  ->  throws
partClasses("text",     "label", { filled: true })  ->  mdy-label mdy-label--filled
```

Both parts carry `mdy-label`; only one can be told it is filled.

Affected by accident, the class being identical: `checkbox.label`, `checkbox.requiredMarker`,
`toggle.requiredMarker`. Affected correctly, the class being genuinely different:
`checkbox.inputWrapper`, `toggle.inputWrapper`, `toggle.label`, `multiselect.inputWrapper`.

The fix is a value comparison against `SHELL_CLASS_FALLBACK[name]`. Any correction here must leave
the second group still throwing — `mdy-multiselect` is the chip grid, and giving it
`mdy-multiselect--disabled` would mint a class no theme has styled.

## A2 — Seven kinds cannot express `disabled` or `error` on their wrapper — **fixed**

**Observed.**

`MDY_FIELD_STATE_CLASSES` (`structure.ts:61`) is documented as the state classes every field carries
independent of kind, and names `mdy-input-wrapper` with `disabled` and `error`. That is true of ten
kinds and false of seven:

| kind | wrapper part | class |
| --- | --- | --- |
| slider | track | `mdy-slider-container` |
| checkbox | inputWrapper | `mdy-checkbox` |
| toggle | inputWrapper | `mdy-toggle` |
| radio | group | `mdy-radio-group` |
| segmented | group | `mdy-segmented` |
| multiselect | inputWrapper | `mdy-multiselect` |
| file | dropzone | `mdy-file-container` |

Nothing is broken on screen: the themes reach these states structurally instead, through
`.mdy-checkbox__control:disabled + .mdy-checkbox__indicator` and `:has([aria-invalid="true"])`.

The defect is that the contract's class vocabulary and the themes' attribute selectors are two
independent mechanisms for one idea, and `widgetStateClasses` — which the style audit compares the
CSS against — can only see the first. Half the expression of "this field is unusable" is outside
what the contract can check.

**Resolved.** `MDY_STATE_EXPRESSION` declares per kind whether the state is shown by a **class** on
the wrapper or reached **structurally** from the native control, and the style audit checks the
declared one — so the mechanism the class comparison could not see is now checked rather than
invisible. Adding state classes to those seven was rejected: it would mint seven nothing paints and
contradict `statesFor`'s narrowing.

Declaring the mechanism found a defect the finding had not: **`file` used neither.** Twelve declared
classes and no theme rule anywhere touching `:disabled` or `aria-invalid`, so a disabled file field
looked exactly like a usable one in all four themes. Fixed structurally, like its siblings.

## A3 — `MDY_FIELD_STATE_CLASSES` restated the shell states in a second vocabulary — **fixed**

**Observed.** `structure.ts:61` hand-maintains what `catalog.ts:194` and `SHELL_CLASS_FALLBACK`
already derive, in a different spelling: `labelStates: ["filled", "has-error"]` — modifier text —
against `SHARED_STATES.label: ["filled", "hasError"]` — state names. `rendererOpen:
"mdy-renderer--open"` restates `stateClass("mdy-renderer", "open")`.

Two tables for one fact, in two files, in two vocabularies. `ssr.ts` states the rule this breaks: a
second hand-maintained table drifts the moment a kind gains a part, and it drifts silently.

## B1 — `Tab` was declared in one of the two keyboard paths — **fixed**

**Observed.**

```
widgetKeyIntent("select", "Tab", open)         ->  null
keyBindingFor("select", "Tab", true)           ->  null
selectKeyboardAction({ key: "Tab", open })     ->  { type: "close", restoreFocus: false }
```

`MDY_WIDGET_KEYBOARD` (`transitions.ts:113`) never declares `Tab`, and `widgetKeyIntent` derives from
it. `behavior.ts:281` and `:354` both close on it. A renderer that consults the declarative table
leaves its list open behind a user who has tabbed away; one that calls `selectKeyboardAction` does
not.

Two contract paths to one behaviour — the same shape already recorded for `ArrowDown`, where
`select-controller.ts:222` opens on a `move` the policy cannot perform.

## B2 — Two derivations of "what lives inside the popup" — **fixed**

**Observed.** `widget-states.ts:138` (`overlayOnlyParts`) roots its walk on the part **named**
`popup`. `ssr.ts:56` (`dynamicParts`) roots on the part whose **element is** `popup`.

They agree on all seventeen kinds — by accident. Every popup-element part (`calendar`, `clock`)
happens to sit under the part named `popup`, so the two predicates select the same subtree. A kind
whose popup-element part sits elsewhere splits them, and nothing would report it.

`ssr.ts` carries the fixed-point walk and the reversed-order test that proved it. `overlayOnlyParts`
has neither, and is the one with real consumers.

## B3 — The overlay coordinate projection was incomplete, and a renderer filled the gap differently — **fixed**

**Observed.** `overlayStyleProperties` (`overlay.ts:64`) emits five of the eight `--mdy-overlay-*`
properties. It has no `transform`, no `maxHeight`, no `width` — so a host positioning a panel from
`MdyOverlayCoords` must supply the rest itself.

Angular does, and disagrees. `overlay-panel.component.ts:199` writes `--mdy-overlay-max-height: 80vh`
for a modal placement; `anchorOverlay` computes the same case as `viewport.height * 0.7`. The same
widget, given up on its anchor and centred, is a different height depending on which renderer drew
it.

## C1 — The `right` popup class existed in three spellings, none of them the contract's — **fixed**

**Observed.** `POPUP_PLACEMENT_STATES` (`catalog.ts:247`) declares `above`, `overlay` and `right` on
all six popup kinds. For `right`:

- `popupPlacementClass` (`overlay.ts:214`) takes a *placement* and returns `null` for anything but
  `above` and `overlay`. Nothing derives the alignment class.
- No theme styles `mdy-select__dropdown--right` or any sibling.
- Angular (`overlay-panel.component.ts:47`) and Lit (`popup-styles.ts:349`) each hardcode
  `mdy-overlay-panel--right`, which no stylesheet matches either.

`mdy-select__dropdown--right` currently sits in the style audit's allowlist as a **stale entry** —
recorded evidence that a renderer once emitted the contract's spelling and stopped.

`popupPlacementClass` exists because this happened once before, to `--above`, in two adapters at
once. It has happened again to `--right`, in a case the function does not cover.

## C2 — Eighteen popup placement classes declared, six styled — **derivation fixed, painting still open**

**Observed.**

```
UNSTYLED  mdy-select__dropdown--above        styled    mdy-select__dropdown--overlay
styled    mdy-multiselect__dropdown--above   UNSTYLED  mdy-multiselect__dropdown--overlay
UNSTYLED  mdy-datepicker__popup--above       styled    mdy-datepicker__popup--overlay
UNSTYLED  mdy-timepicker__popup--above       styled    mdy-timepicker__popup--overlay
UNSTYLED  mdy-colors__dropdown--above        UNSTYLED  mdy-colors__dropdown--overlay
          all six --right                              none styled
```

**Now derived for all six kinds, including the range picker it silently got wrong** (see C1), and
`--right` is derived at all for the first time. Painting is the half still open: the select gained the
`--above` rule its anatomy wanted, because its popup is `search` then `listbox` exactly like the
multiselect's and that widget has flipped its column for as long as the class existed. The remaining
13 stay allowlisted with the reason stated — a placement class earns a rule only where the popup has
an asymmetry to answer, and a calendar has nothing to flip.

Historically: `--above` was derived for six kinds and painted for one. A select that flipped above its anchor carried
a class no rule matches, so nothing about it adapts — the arrow still points the wrong way.

## C3 — The runtime-capability contract had no enforcement path — **fixed**

**Observed.** `runtime.ts` states that the controller consults the capability report to avoid
emitting commands that cannot be executed, focus during SSR being the named example. No controller
does:

- `browserRuntimeCapabilities` and `ssrRuntimeCapabilities` have no consumers outside their own
  spec, the README and a changeset.
- No controller accepts an `MdyWidgetRuntimeCapabilities`. `createCatalogWidgetController` emits
  `{ type: "focus" }` unconditionally.
- `processWidgetCommands` never consults capabilities; it relies on the element lookup returning
  `undefined`.
- `createMdyAnnouncer` runs its own `typeof document === "undefined"` check, which is the decision
  the capability report exists to centralise.

The report was corrected once already — it used to assert a DOM rather than probe for one, and
reported a browser from a bare Node process. Nothing consumed it then either, which is why nothing
caught it. **Open decision**: either thread capabilities into the controllers, or say what the
report actually is. The doc comment and the code state different contracts and only one can stay.

## C4 — `staticParts` and `isFullyServerRenderable` have no consumer — **closed as deliberate**

**Observed.** Declared, self-consistent, proved against the catalogue, and consumed by nothing but
their own spec. The same criticism the SSR batch made of the capability report.

**`dynamicParts` is excluded**: `scripts/support/observe-renderer.mjs:56` consumes it to decide
whether a renderer builds its overlay eagerly or lazily, which is what produced the measured
divergence in the conformance manifests — Plain eager on all six overlay kinds, Lit lazy on all six.
Two of the three symbols are unconsumed, not three.

**Closed without wiring one.** They answer "what would a server emit", and the server half of the
roadmap was scoped out by an explicit decision — so no code here has that question. The reason is now
stated beside the export rather than left looking unfinished. Adding a consumer to make the number
look better would be a consumer that exists to be counted.

Narrowed from three symbols to two: `dynamicParts` **is** consumed, by
`scripts/support/observe-renderer.mjs`, which uses it to decide eager versus lazy overlays for the
conformance manifests.

## C5 — The accessible-name half of the relations contract was not exported — **fixed**

**Observed.** `relations.ts:127` declares `MdyAccessibleNameSource`,
`MDY_SEMANTICS_REQUIRING_NAME` and `partsRequiringName` — how a part comes by the name a screen
reader announces. `partsRequiringName` is used internally by `testing/dom-tests.ts`. None of the
three is exported from `index.ts`, so an adapter writing its own checks cannot reach any of them.

## D — Three declared capabilities carried no information — **fixed (major)**

**Observed.** `define()` (`catalog.ts:339`) hardcodes `keyboard: true` and `focus: true` for all
seventeen kinds, and sets `dismissOnOutsidePointer` to exactly `overlay`. Verified: both distinct
value sets are `[true]`, and the third is equal to `overlay` on every kind. A consumer branching on
any of them is branching on a constant. `MDY_DISABLED_BLOCKS_TRANSITIONS = true` is the same shape.

`dismissOnOutsidePointer` names its own exception — a popup a click elsewhere cannot dismiss would
have to be declared as one — which the derivation makes unexpressible.

It was also **underspecified where it does apply**, and that had already produced a divergence: the
contract did not say which event delivers the dismissal. Plain and Lit listened on `pointerdown`,
Angular on `click`. A drag that starts outside an open popup fires `pointerdown` and never `click`,
so the same gesture dismissed on two renderers and not the third. A capability that says *whether*
but not *how* leaves the renderers to agree by luck.

**That half is now closed too.** `dismissOnOutsidePointer` is
`false | { event: "pointerdown" | "click" }` and the answer is `click`; Plain and Lit read the event
from the capability instead of naming one. The shape can express either answer rather than recording
the one chosen.

And naming the event proved **necessary but not sufficient**: with the pointer path correctly
declining to fire, Plain's select still closes on that drag — through `focusout`, a **second
dismissal path the contract does not name**. That is the open remainder of this finding.

**Withdrawing a capability is a major change**, and so was reshaping this one: `boolean` became a
union, so `=== true` no longer type-checks. See `contract-compatibility.md`.

## E1 — The style audit could not see a class the contract declares and nobody paints — **fixed**

**Observed, and closed.** `scripts/audit-contract-style-coverage.mjs:202` classified over

```js
kind: where && themes ? "drift" : where ? "unstyled" : "dead",
```

whose candidate universe is *what renderers emit* ∪ *what themes style*. A class the **contract
declares** that neither touches was not a candidate at all and produced no finding in any of the
three categories — which is where every placement class of C1 and C2 sat.

A fourth category, `unpainted`, now takes its candidates from the contract instead, with its own
allowlist under `_unpainted` and its own `--check` gate. **36 contract classes go unpainted**, each
now carrying the reason it is acceptable; 6 are still marked `unreviewed`, which is a to-do rather
than a verdict.

The category is deliberately *not* phrased as "and no renderer emits it". Emission is detected by
scanning string literals, and a renderer that asks the contract for its classes — `rootClasses`,
`partClasses` — writes no literal to find; claiming those unemitted would report a defect that is not
there. `mdy-renderer--text` is the example: unpainted by design, emitted by every text renderer.

**Two things this surfaced that the finding had not:**

- The audit was **already failing** on 4 stale allowlist entries, and nothing ran it (see E2). Those
  are now cleared.
- `mdy-select__trigger--disabled`, `--invalid`, `--loading`, `--open`, `--readonly` — the select
  trigger declares five states and **no theme paints any of them**. A whole part's state vocabulary
  is unadopted, which C2 had not isolated.

## E2 — Most test scripts were unreachable from `npm test` — **mostly fixed**

**Observed.** `npm test` reached only `test:core`, `test:adapters`, `test:widgets`, `test:angular`
and `test:guides` — **18 of 24 scripts unreachable, including every contract audit.**

That is how the style-coverage audit came to be red without anyone noticing: it had been failing on
4 stale allowlist entries, and no aggregate ran it.

`test:contracts` is now inside `npm test`, and `test:contract-coverage` inside `test:contracts`.
**9 of 24 remain unreachable**, and the split is now deliberate rather than accidental:

| still out | why |
| --- | --- |
| `test:e2e`, `test:studio` | need a browser or a separate app build |
| `test:perf`, `test:bundle`, `test:core-bundle`, `test:form-scale`, `test:angular-renderer-budget` | budgets and benchmarks, not correctness gates |
| `test:themes`, `test:styles-architecture` | pass today; left out as a styles concern rather than a contract one — an open question, not a decision |

## E3 — Conformance covers three adapters — **documented, not a defect**

**Observed.** `dom-contract`, `state-matrix` and `equivalence` suites exist for **plain**, **lit**
and **angular**. `react`, `vue`, `solid`, `preact` and `svelte` have a widgets test and a reactivity
test, and no contract conformance.

Consistent with the stated adapter priority, so this is a scope boundary rather than a defect — but
it is a boundary a consumer of those five packages cannot currently read anywhere.

**Closed as a documented boundary.** The five headless adapters do not lack fixtures — they
**render nothing**: no component, no element registry, no mount. A conformance fixture for them would
assert the absence of parts.

What was actually wrong was the README telling a consumer that *"other adapters share the same
conformance suite"*. The boundary is now stated in the project status note, the package table, all
five package READMEs, and `conformance-manifest.mjs`, which distinguishes "renders, checked
elsewhere" from "renders nothing, so there are no kinds to report".

## F — Contract tables keyed by bare `string` — **partly fixed**

**Probable.** `MDY_POPUP_OPENERS`, `ANCHORING`, `LABEL_TARGET`, `DESCRIBED_BY_CARRIER`,
`PARENT_CANDIDATES`, `SHELL_CLASS_FALLBACK`, `PART_SEMANTICS` and `SHARED_STATES` are all
`Record<string, …>`. A stale or misspelled kind or part key is silently ignored rather than failing
to compile.

`relationsFor` (`relations.ts:83`) compounds it. Each lookup is guarded by `declared.has(target)`, so
a wrong key **drops the relation** instead of erroring — a field whose errors reach no assistive
technology, which is the failure the relations table was declared to make catchable.

`PART_SEMANTICS` throws on a missing key. That is the right pattern, and it is now joined by the
four **kind-keyed** tables — `MDY_POPUP_OPENERS`, `ANCHORING`, `LABEL_TARGET`, `DESCRIBED_BY_CARRIER`
— which take `MdyWidgetKind` instead of `string`, so a stale or misspelled kind fails to compile.
Narrowing them immediately found `projectOverlayOpenerA11y` and `overlayControlledId` accepting a
bare `string`; both now take a kind.

**Still open: the part-keyed tables.** `PARENT_CANDIDATES`, `SHELL_CLASS_FALLBACK` and
`MDY_SHELL_PART_STATES` are keyed by part names that differ per kind, so there is no single union to
narrow them to without deriving one from the catalogue. Left as it is rather than half-done.

## G1 — The opener-is-a-toggle rule was applied to openers that are text inputs — **fixed**

**Observed**, and it has already produced a divergence.

`transitionsFor` (`transitions.ts`) declares, for every kind with an overlay, that a pointer press on
the opener while open closes it — an opener is a toggle, not a one-way switch. For `datepicker` and
`timepicker` the opener is `control`: the typeable input. The contract therefore states that clicking
into the text field of an open date picker dismisses its calendar.

One renderer implements it literally and one does not:

| | binds the toggle to |
| --- | --- |
| `packages/plain/src/fields/datepicker-field.ts:87` | the toggle button **and the control** |
| `packages/plain/src/fields/timepicker-field.ts:122` | the toggle button **and the control** |
| `packages/angular/.../datepicker.component.ts:98` | the toggle button only |

So clicking into the input of an open date picker closes the calendar in one renderer and not the
other, and the contract sanctions the worse of the two.

**Recommendation, not yet applied.** `opener` is carrying two jobs. For the ARIA relation it is
right that the opener is `control`: the combobox pattern requires `aria-expanded` and `aria-controls`
on the typeable element. For the *transition* it is wrong, because a press on a text input is the
user reaching for the caret, not for a switch. The two uses should be separated rather than the
declaration changed — changing it would move the ARIA relation off the element the pattern requires.

## G2 — `ArrowUp` did not open a closed overlay — **fixed**

**Possible.** `ArrowDown` opens; `ArrowUp` is declared by neither the table nor the policy, and APG's
combobox pattern specifies both. The two paths agree, so this is a gap rather than a disagreement.

**Resolved.** Declared on all six overlay kinds in `MDY_WIDGET_KEYBOARD` *and* in
`selectKeyboardAction`, because the `Tab` defect was one path fixed and not the other, twice.

The open question — whether opening upwards should also move to the last option — answered itself:
`listboxNavigationIndex` already returns the **last** option for `ArrowUp` from nothing-active and
the **first** for `ArrowDown`. Opening with nothing active and letting the next arrow resolve gives
the specified behaviour, so declaring a move on the opening press would restate one layer up what
already holds one layer down.

## G3 — `Space` was the Tab defect again — **fixed**

**Observed.** The same two-paths shape as B1, and it survived that batch:

```
selectKeyboardAction(" ", closed)  ->  { type: "open" }
keyBindingFor("select", " ", false)  ->  null
```

The policy opens a closed select on Space; the declarative table claims the key for no overlay kind.

**Deliberately not fixed with B1**, and the reason is the gate. `Tab` could be declared in
`keyboardFor` because it means the same thing on all six overlay kinds. `Space` does not: declaring
it there would give it to `datepicker` and `timepicker`, whose opener is a typeable control where
Space must type a space character. Making the table agree with the policy therefore needs a decision
about *which kinds* Space opens, not a one-line addition — which is exactly the kind of question the
contract should be asked before a renderer answers it by accident.

## G4 — `stepTimeField` had no finite guard — **fixed**

**Possible.** `time-bounds.ts:98` computes from `Math.round(current)`; a non-finite `current`
propagates to `NaN`. Stepping is documented as how a user leaves a bad value, so it is the one
operation that should not refuse — a `NaN` current should be brought into range like any other.

## H — The `aria-describedby` fallback was unfulfilled — **fixed, `480c514`**

**Observed, and resolved.** Kept here because the reason it stayed hidden generalises.

`MDY_WIDGET_RELATIONS` declares `aria-describedby` pointing at `["errors", "supportingText"]` — the
error list while there is one, the supporting text otherwise. No element in the Angular package
carried the `<fieldId>__description` id. Four kinds bound the shared projection and named an id that
existed nowhere; the other eleven used a helper that only ever names the error list, so their
supporting text was rendered, styled and announced to nobody. Measured on the demo: **0 → 36**
controls with a non-empty computed accessible description, **4 → 0** dangling references.

The checker had the right rule the whole time — `RELATION_MISSING` (`testing/dom-tests.ts:627`) fires
when a carrier holds no reference while a target is rendered. It never fired because **Angular's
`describedby.spec.ts` drives fixtures that render errors, so the description branch was never under
test.** The gap was in the fixture, not the rule.

The generalisable part: every accessibility check in this repository stopped at the attribute — is
`aria-describedby` present, does it resolve *in this fixture*. Nothing asked the browser what
description it actually computed. `e2e/screen-reader.spec.ts` now does.

**This is E1's shape a third time**, and the sharpest statement of it: a rule that is correct, and a
suite whose fixtures never reach the branch the rule guards, are indistinguishable from green.

## I — The number field's spin buttons were styled, emitted, and declared nowhere — **fixed**

**Observed.** Found by a guard added for a different reason.

`PARENT_CANDIDATES` (`catalog.ts`) was keyed by `decrement` and `increment`. **No kind declares
either part.** The keys had been looked up on every widget build since they were written and matched
nothing, which is the failure mode that made a key check worth adding: a table entry that matches
nothing is indistinguishable from one that is simply never needed.

Deleting them is correct — but the reason they were written is not resolved by deleting them.
`@modyra/angular` really does render spin buttons, through the opt-in
`number-spin-buttons.directive.ts`:

- they carry `mdy-spin-btn` and `mdy-spin-btn-up` / `--down`, so they wear the shared vocabulary;
- `modyra.css:365` **styles them**, and four custom properties configure them;
- the widget contract declares **no part** for either, so no anatomy, relation, state or equivalence
  check has ever looked at them;
- **no other renderer has them at all**;
- they are `tabIndex = -1` and positioned with inline styles rather than by a theme rule.

So they are the inverse of the audit's usual shape. Everything else here is *declared and wired to
nothing*; this is **emitted and styled and declared by nothing** — invisible to the contract in the
one direction the contract cannot see, because every audit starts from what the contract declares.

**Not decided.** Three coherent answers and they are genuinely different products:

1. **Declare them optional** on `number`. Then the contract covers them, Angular conforms, and the
   other renderers stay conformant by not rendering them.
2. **Take the Modyra classes off them.** If they are a host-level affordance rather than part of the
   widget, they should not wear the shared vocabulary or be styled by the shared themes.
3. **Drop the directive.** `<input type="number">` has native spinners; these are `tabIndex = -1`, so
   they add a pointer affordance and no keyboard one.

Whichever is chosen, the current state — styled by the theme, named by no contract, present in one
renderer — is the one answer that is not defensible.

**Resolved.** `number` declares `increment` and `decrement` as **optional** parts with `button`
semantics and those classes — optional because the native control has its own spinners and a renderer
that leaves them to the platform is complete without them.

Confirmation the gap closed rather than moved: the three `mdy-spin-btn` classes had been sitting in
the style audit's off-contract allowlist, and the audit reported them as **stale entries** once the
parts existed. Removed.

## J1 — `segmented` leaves its `option` element unconstrained — **fixed**

**Observed.** `packages/widgets/src/catalog.ts`, the `segmented` shape declares
`elements: { option: "presentation" }`.

A segmented choice can be built two ways, and both are defensible:

- a `<label>` wrapping `<input type="radio">`, the same native pattern `radio` uses;
- a `<button>` in a toolbar of pressed buttons.

They are not the same control to a screen reader. One is a radio in a radiogroup; the other is a
toggle button reporting `aria-pressed`. The contract cannot require either without breaking whichever
adapter chose the other, so it currently requires neither.

Declaring `presentation` is honest — it says the contract has no opinion — but it means no anatomy
check has ever looked at what a segmented option actually is. A renderer could emit a `<div>` with a
click handler and conform.

**Not decided.** Picking one is a cross-renderer equivalence decision, not a contract-authoring one:
it cannot be made without deciding what a segmented control *is*, and that binds every adapter.

**Fixed**, and not the way [ADR 0012](architecture/0012-a-choice-is-a-radio-by-role-or-by-tag.md)
expected. Its decision — a choice is a radio, by tag or by role — was sound; its claim that no
renderer would change was not, and the measurement is what found that:

| renderer | element carrying the `option` part | a radio? |
| --- | --- | --- |
| Plain | `<label>` wrapping `<input type="radio">` | no — the radio is its child |
| Lit, Angular | `<button role="radio">` | yes |

Applying the ADR literally would have made Plain non-conformant, so the anatomy names both halves
instead, exactly as `radio` always has and as
[ADR 0014](architecture/0014-the-contract-names-the-responsible-element.md) requires: `option` is the
labelled container, `optionControl` is the radio inside it, and both are required. Lit and Angular
moved to the native pattern rather than Plain moving away from it — which also lets a theme reach
`:checked`, `:disabled` and `:focus-visible` structurally instead of through a class a renderer has
to remember to apply.

`contract:diff`: **major**, two entries — a new required part and an element change.

**A stale claim corrected while here.** This finding recorded that segmented's `required` named
`optionControl`, a part it did not have. It did not: that is `radio`'s list, and segmented required
only parts it declared. The plan repeated the claim and it was wrong in both places.

## N — focusing a hidden native radio ends the page on one engine — **open**

**Observed.** WebKit, the Angular demo. Calling `focus()` on a visually hidden `<input type="radio">`
ends the page — from the driver and from inside the page alike, in under a second.

**Not caused by the anatomy change that found it**, and that was checked rather than assumed: the
untouched `radio` kind crashes identically, and did so before a segmented option was a radio at all.
It surfaced only because a keyboard test that used to focus a `<button>` now focuses a radio.

**Not reproduced in isolation.** A minimal page hiding a radio the same four ways — `clip`,
`clip-path`, zero opacity, and not hidden at all — focuses cleanly every time. So it is not the
hiding technique on its own, and what else the demo contributes is unknown.

The consequence is not theoretical: a keyboard user reaching any radio in that demo on that engine
loses the page. `e2e/keyboard.spec.ts` skips the row there with this finding named, rather than
working around it.

## J2 — `multiselect` anatomy depends on its mode, and the contract cannot say so — **fixed**

**Observed.** `packages/widgets/src/catalog.ts`, the `multiselect` shape declares
`elements: { option: "presentation" }` for the same reason as J1, but a sharper one.

`option` is genuinely a different element per mode:

- **toggle mode** — a `<button>` carrying a tick;
- **counter mode** — a `<div>` holding its own `+`/`−` step buttons and a count, which cannot be a
  `<button>` because it contains buttons.

The contract has no way to express "this part's element depends on that option". Declaring either
one would assert a shape only half the renderers meet, so `option` is declared unconstrained.

Two things follow, and only the first is recorded elsewhere:

1. `optionCheck` is toggle mode's part and cannot be required, since a counter chip has a count
   between two steppers and no tick to draw.
2. Whether a multiselect should be a listbox with `aria-multiselectable` at all, rather than a grid
   of chips, is undecided. The current answer — a grid — is what every renderer implements, but it
   is not written down as a decision anywhere, which is what makes it look accidental.

**Not decided.** Either the contract grows conditional anatomy (a part whose element varies by a
declared option), or multiselect splits into two kinds, or the mode stops being a runtime option.


**Decided** by [ADR 0016](architecture/0016-a-multiselect-is-one-kind-and-the-mode-is-not-the-contracts.md):
one kind, and the mode stays out of the contract. An `option` must be **operable** — either it is a
button, or it contains at least one `optionStep` — which both modes satisfy and a clickable `<div>`
does not. No public surface is added: not a kind, not a config field, not a discriminant.

Three measurements decided it. The mode is absent from `@modyra/core`'s field config entirely, so a
discriminant would have to *enter* the document format two SDKs carry. Of 25 parts only three are
mode-specific, so two kinds would duplicate 22 to separate 3. And `mode` is a public property on the
Lit element and a signal on the Angular component, so "fixed at construction" is unenforceable
without first adding the concept the ADR declines to add.

**Fixed.** [ADR 0017](architecture/0017-a-varianted-kind-names-its-anatomy-per-configuration.md)
supersedes 0016, which decided this on a premise that turned out to be false — `mode` was already in
the Dynamic Form Contract, in `dynamic-config.ts`, spelled `"single" | "multi"`. With that corrected,
the anatomy is declared **per variant**: in `single` the option *is* the control, in `multi` it
contains them. Both named, which is what ADR 0014 asks and what the disjunction 0016 chose could not
give.

**The rule was nearly enforced against nothing, again.** No conformance fixture mounted counter mode,
so both adapters reported CONFORMANT having rendered one of the two shapes — J2's own defect one
level up. The anatomy pass now mounts each declared variant; removing a stepper from Plain's counter
chip fails it, naming `multiselect[multi]`, and that same mutation was invisible before.

**One defect the decision already found.** `@modyra/lit`'s steppers are icon-only buttons with no
accessible name — a chip whose two controls announce nothing. Plain names them "Decrease ⟨label⟩" and
"Increase ⟨label⟩"; Angular uses its i18n strings.

**The listbox-versus-grid question is deferred explicitly**, not forgotten: whether a multiselect
should be a listbox with `aria-multiselectable` rather than a grid of chips is a question about what
the widget *is*, independent of how many modes it has. Plan 42 left the popup contents loose for it.

## J3 — `timepicker` segments hide their real control one level down — **fixed**

**Observed.** `hour` and `minute` were declared `group`: the containers the header lays out. Each
holds an `<input type="number">` — the element a user types into, and the one carrying the accessible
name — and that input was **not a declared part**, so no anatomy, relation, state or equivalence
check reached it.

**Fixed by naming the control**, not by widening the check. `hourControl` and `minuteControl` are
optional parts of `timepicker` with the `input` semantic, parented to their segment, carrying
`mdy-timepicker-segment-input` — which left the presentation list in the same change, so the style
audit now covers it as a part class. Classified `minor` by `npm run contract:diff`: two new optional
parts describing elements all three renderers already drew.

### Two defects the naming exposed

**The accessibility projection and the catalogue disagreed about what `hour` meant.**
`projectTimepickerFieldA11y` returned a `hour` part carrying `role="spinbutton"`, `aria-label` and
`aria-valuenow` — control semantics — and Plain applied it to the input while separately building a
segment `<div>` with the same classes. Two elements therefore claimed to be `hour`, and the resolver
took the first. The projection now returns `hour` (the segment's classes and its `focused` state) and
`hourControl` (the id, the class, the spinbutton semantics) as separate parts, each applied to its
own element.

**`inspectWidgetDom` could not resolve two parts that share their classes.** Its fallback lookup —
used for any part a caller does not name — matched on classes alone, so both segment inputs resolved
to both parts and a correct widget was reported as ambiguous. `daterange`'s `startControl` and
`endControl` have shared classes since long before this, and any harness that did not name them
explicitly had the same hole. Both resolvers now read the same rule, `partsSharingClassesWith`:
declared order among the parts that share a selector.

**Verified adversarially.** A `<div>` in place of Plain's hour input does **not** fail on its own —
the renderer's projection puts `role="spinbutton"` on whatever element it is given, and a
`<div role="spinbutton">` satisfies the `input` semantic by design, the same principle as
[ADR 0012](architecture/0012-a-choice-is-a-radio-by-role-or-by-tag.md). Removing the role as well
produces `PART_ELEMENT:hourControl` against the real renderer, which is the check biting.

## J4a — A state satisfies from any part, not the one responsible for it — **fixed**

**Observed.** `packages/widgets/src/testing/state-tests.ts`.

Where a widget exposes a state depends on its anatomy — a text field puts it on the input, a radio
group on the group, a select on its trigger. Rather than guess, `state-tests.ts` accepted the
attribute on *any* declared part. The claim it could make was therefore only "the widget exposes the
state somewhere an assistive technology will meet it", not "on the right element". A widget that
moved `aria-expanded` from its trigger to its root still passed.

**Fixed** by `ARIA_STATE_CARRIERS` in `packages/widgets/src/widget-states.ts`, read through the
exported `stateCarriers(kind, state)`. `open` is **not** in the table: its carrier is the part that
opens the overlay, which the contract already names as `MDY_POPUP_OPENERS[kind].opener`, and
restating it would be a second derivation of one fact. The other three states are declared, because
nothing existing answers for them — the catalogue's per-part `states:` is a *class* vocabulary
(which element a theme paints `--disabled` on), and it names `inputWrapper` where `aria-disabled`
goes on the control, `option` where it goes on the group, and nothing at all for `invalid` in
sixteen kinds of seventeen. That was measured before the table was written, and it is why derivation
was rejected.

The check asserts **presence on every declared carrier**. Extras are still tolerated — see the
remaining half below.

### Three defects the narrowing exposed

Every one of these was a renderer announcing a state where nothing listens, invisible while any part
would do:

- **Lit's multiselect** never set `aria-disabled` on its `searchButton`. The button is the opener,
  the label names it, and it was the one element that did not say the field was unavailable.
- **Angular's multiselect** had the same hole, with the attribute on the options group instead —
  a container the user never lands on.
- **`colors` had no correct carrier to name.** The first table said `control` *and* `hexInput`.
  Angular's `control` is the native `<input type="color">`, which is deliberately `aria-hidden`: a
  swatch with no readable text, kept for what a form post and an autofill see. Requiring ARIA on an
  element removed from the accessibility tree is not a contract, and Plain's own source already said
  which element is the real one — *"the hex field is the one a user types into, so it is the control
  the state is about"*. The carrier is `hexInput` alone.

The first two were fixed in the same change, because a red conformance run cannot be committed. That
is a deviation from this plan's scope, which reserved renderer attribute placement for a finding
rather than a fix; the fix is one attribute per renderer and is recorded here rather than only in the
commit.

### What is still not constrained

**Extras are unconstrained.** The check asks whether the carrier announces the state; it does not ask
whether anything *else* does. Plain's multiselect also puts `aria-disabled` on `option` and
`listbox`, Lit's on `inputWrapper`, and both pass. `inspectUnsupportedStateAria` already rejects ARIA
for a state a kind does not declare, so the uncovered case is narrow: a supported state announced in
more places than the anatomy makes responsible. Whether that is noise or redundancy is a question
about assistive-technology behaviour, not about the contract, and it is left open deliberately.

## J4b — A popup may legally frame nothing — **fixed**

**Observed.** `packages/widgets/src/testing/dom-tests.ts` declares `popup: undefined` — a popup is a
positioning container, and its accessible semantics live on what it *contains* (the listbox, the
grid, the dialog). Constraining the box itself would force a role that says nothing.

Containment itself **is** checked: `PART_NOT_CONTAINED` rejects a part rendered outside its declared
parent, `listbox`-inside-`popup` included. What is missing is *presence*. Four of the six overlay
kinds declare no **required** part inside their popup, so an empty popup violates nothing:

| kind | parts inside the popup | required |
| --- | --- | --- |
| `select` | `search`, `listbox`, `empty` | — |
| `multiselect` | `search`, `listbox`, `empty` | — |
| `timepicker` | `dialog`, `container` | — |
| `colors` | `presets` | — |
| `datepicker` | `calendar`, `actions` | `calendar` |
| `daterange` | `calendar`, `actions` | `calendar` |

`datepicker` and `daterange` are already covered, and by an ordinary required part rather than a
special popup rule — which is the shape a fix should follow rather than invent.

An earlier statement of this finding claimed containment was unchecked. That was wrong, and the
fixture written to demonstrate it failed instead of passing, which is how it was caught.

**Fixed**, and with no new vocabulary. `required` already said "this part must be there", and
`overlayOnlyParts` already gated it to an open widget — the mechanism `datepicker` used for its
calendar. Four names were added to four `required` lists:

| kind | now requires | measured in |
| --- | --- | --- |
| `select` | `listbox` | Plain `ul[role=listbox]`, Lit `ul[role=listbox]` |
| `multiselect` | `listbox` | Plain `div[role=group]`, Lit `div[role=group]` |
| `timepicker` | `container` | Plain `div`, Lit `div[role=dialog]` |
| `colors` | `presets` | Plain `div[role=listbox]`, Lit `div[role=listbox]` |

Multiselect's `listbox` is required to be *present*, not to be a listbox: what role a chip grid
should carry is the mode question ADR 0016 settles, and presence does not pre-empt it.

### The rule was enforced against nothing

The larger defect, found while checking the fix rather than while writing it: the conformance CLI
inspected every widget **at rest only**. A part required inside a popup is skipped at rest — a closed
picker renders no popup — so all four new requirements would have been unenforced against every
renderer, and the run would have stayed green either way.

`modyra-conformance.mjs` now has a second anatomy pass that drives each overlay kind open and
inspects it there. Six kinds per renderer. Emptying Plain's select popup makes it fail with
`PART_MISSING: listbox`; before this pass, the same mutation was invisible.

### `timepicker.dialog` is a part nobody draws

`dialog` is declared inside `popup` with the `dialog` semantic and the class
`mdy-timepicker__dialog`, allowlisted `unreviewed` by the style audit. Plain applies the part to the
popup element itself, so one element is both; Lit puts `role="dialog"` on `container` and never emits
the class. No renderer draws the element the contract describes, and the two put the dialog role in
two different places.

Requiring it would have required markup neither renderer has, so `container` is what the popup must
frame and this stays open — a smaller, separate question than J4b: **where does a timepicker's dialog
role belong?**

### Still untested: a genuinely portalled popup

A portalled popup conforms — asserted directly, since a naive containment check would report every
one of them as broken. But under jsdom both renderers keep the popup inside the field root, so the
conformance run never exercises the portalled path. That needs the browser suites.

## K — the accessibility projections have no classification path — **open**

**Observed.** `scripts/contract-diff.mjs` snapshots the catalogue: parts, where they hang, what they
are, what refers to what. The `project*A11y` functions are exported from the package root and are
what a renderer actually applies to its elements — and nothing compares them against anything.

Closing J3 moved `role="spinbutton"`, `aria-label` and `aria-valuenow` off
`projectTimepickerFieldA11y`'s `hour` part and onto a new `hourControl`. For a consumer applying
`parts.hour` to its input that is a silent loss of the control's role and value: the attributes moved
rather than disappearing, so TypeScript reports nothing and the differ reported `minor` — correctly,
for the only surface it can see.

The change shipped as `major` on the author's reading rather than the tool's, which is the outcome
the project instructions § *Standing authority* asks for when the two disagree. It is not a repeatable one.

**It recurred immediately, and not on a projection.** Closing J4a added `stateCarriers` to the
package root and left the catalogue untouched, so the differ reported `patch` for a change that adds
public surface. The finding is therefore wider than its heading: *anything exported from the root
that is not catalogue anatomy is invisible to classification* — the projections, this function, and
whatever is added next. Two instances in one day is the argument for fixing it before 1.0 rather
than adjudicating each one by hand.

**Not decided.** A projection returns attribute maps whose values depend on state, so the snapshot
cannot be the returned object; it would have to be the shape — which parts exist, and which attribute
names each carries. Whether that is worth freezing before 1.0, or whether the honest answer is that
these helpers are not part of the promise and should stop being exported from the root, is the
question. The second reading is cheaper and narrows the 1.0 surface, which is the direction
`ROADMAP.md` is already pointing.

## L — every browser claim was Chromium's — **partly fixed**

**Observed.** `playwright.config.ts` ran `browserName: "chromium"` and nothing else. Overlay
placement, focus restoration, the dismissal gesture, the affordance column, the caret angle and the
field heights were all verified on one engine.

**Fixed:** the config now crosses three renderers with three engines — nine projects. Chromium keeps
the bare project name so every recorded result still means what it did; Firefox and WebKit suffix the
engine, because a failure that cannot name the engine that disagreed is not actionable.

**Not fixed:** what the other two engines then said. Every exception below is recorded with its
engine, which is what this finding stays open for.

### Two predictions, both dismissed

`:has()` and `:focus-visible` were expected to be the first casualties. Neither failed on any engine.
The affordance column and the focus-ring finding hold on all three.

### A real defect, on the platform it matters most on — WebKit

`e2e/plain/dismiss.spec.ts:30` and `e2e/touch.spec.ts:36`: **a tap outside an open popup does not
dismiss it on WebKit.** Measured directly, tapping an `<h1>` with the list open:

| engine | events delivered |
| --- | --- |
| Chromium | `pointerdown` `touchstart` `pointerup` `touchend` `mousedown` `mouseup` `click` |
| WebKit | `pointerdown` `touchstart` `pointerup` `touchend` — **and nothing else** |

ADR 0013 completes the dismissal gesture on `click`, deliberately: a drag that ends on a different
element produces no click, and that is exactly the gesture a touch user makes to scroll the page
behind an open popup. Completing on `pointerup` would dismiss there.

WebKit only synthesises mouse events and a click for elements it considers clickable. A page's own
background is not one, so on Safari — desktop and iOS — the pair never completes and the popup stays
open. This is user-facing, on the engine every iOS browser uses.

The discriminator ADR 0013 actually wants is *movement*: a tap has none, a scroll has plenty. `click`
was standing in for that, and one engine does not supply it. Resolving this amends ADR 0013 and is
tracked separately.

### A regression the routine suite could not see — every engine — **fixed**

`e2e/rtl.spec.ts` failed on **Chromium too**, and had done so before the engines were added —
verified by running the unmodified config. `.mdy-input-prefix` and `.mdy-input-suffix` set
`padding-left`/`padding-right` where the roomy side is the *outer* one, so under `dir="rtl"` the
suffix sat 8px inside where it belonged, in all four packaged themes. Now logical. All sixteen
families mirror on three engines.

It is the same defect as `.mdy-input-wrapper__inliner`, one level out, missed by the sweep that fixed
that one — which is the argument for the fixture existing rather than for a wider grep.

**The part that is not fixed:** `npm test` does not run Playwright. `test:e2e` exists and is not in
it, so the browser suite was red with nothing routine saying so. That is the larger finding — a suite
outside the default command is a suite nobody is watching — and it belongs with the release gates.

WebKit needs a 2.5px mirroring tolerance where the other two hold 1.5px. Measured rather than
assumed: `daterange` lands exactly 2.0px out in three themes and **passes** under `modyra-material`,
the one that removes the inputs' borders — a 1px border on each of two inputs rounds one way in LTR
and the other in RTL. Per-engine, not global: reverting the suffix to physical padding still fails on
WebKit at 2.5px, so the widened tolerance does not blind the check.

### Engine differences in the themes — Firefox

| spec | difference |
| --- | --- |
| `demo.spec.ts:291` | `modyra-material`'s slider track computes `background-image: none` where a `linear-gradient` split is expected |
| `palette.spec.ts:107` | the derived `on-*` colours resolve to near-black — `on-primary #0b0a08 on #18181b = 1.12:1` — where Chromium picks a legible one. Twenty pairs below the contrast floor across `brand` and `monochrome` |

The palette one is the more serious: the theme's colour derivation is what fails, so a Firefox user
sees unreadable text rather than a wrong gradient.

`demo.spec.ts:162` and `:390` failed in the full run and passed in isolation. Flaky, not an engine
difference — recorded so the next reader does not chase them.

### What WebKit found that no suite was looking for

Three defects came from someone opening the demo in WebKit and looking at it. Every one is
reproducible in the engine the suite now runs, and **none of them is a test that failed** — they are
in places no assertion reaches.

- **The multiselect popover collapsed** to its search box with nothing under it.
  `.mdy-multiselect-overlay__grid` sized itself with `max-height: 100%` against a parent that states
  a `max-height` and no `height`. A percentage against an indefinite containing block is undefined
  territory: Blink resolves it to `none`, WebKit to zero. Fixed with `flex: 1 1 auto; min-height: 0`.
- **The multiselect's `+` and `−` buttons were empty.** `.mdy-renderer svg` gives every icon one
  size, and a portalled popup is not a descendant of any `.mdy-renderer`. Nothing sized the icons
  inside it, so an `<svg>` carrying only a `viewBox` fell to each engine's default for a replaced
  element with no intrinsic size: 32×32 in Blink, **0×0** in WebKit. `.mdy-popup` and
  `.mdy-overlay-panel` are now named beside `.mdy-renderer`.
- **Colours reported as rendering differently**, on the datepicker's day circles. **Not reproduced.**
  Every cell state in the default theme computes byte-identical between the two engines, to
  serialisation precision — the day circle is `2px solid var(--mdy-sys-color-primary)`, a plain token
  with nothing in its path to diverge. Open.

The two that were real share a shape, and it is not an engine's fault: **a percentage or a default
resolved against something indefinite.** Neither construct is correct on its own terms in any
engine — one engine was simply the one that charged for it.

The adjacent suspect for the colour report, already measured failing elsewhere: `--mdy-on-*` derives
through `oklch(from … pow() … cos() …)` relative-colour syntax. That is the newest colour maths in
the tree, and it is what makes Firefox resolve twenty `on-*` pairs below the contrast floor above. A
derivation that already breaks on one engine is where to look when a second reports colour.

**What this says about the suite**, which is the part worth carrying: three defects in the rendered
result, none of them caught by a green nine-project run. The browser suites assert behaviour and
geometry; nothing asserts that a widget *looks the same on two engines*. That is what plan 49's
screenshot baselines are for, and this finding is the argument for them.

### Tests that asserted Chromium rather than the contract — resolved

Six failures were the harness. `newCDPSession` is Chromium-only, and three specs used it:

- **a real `pointercancel`** — only CDP can make a browser send one, and a dispatched event would
  assert the handler rather than the browser. Skipped off Chromium with that reason stated; the rule
  itself is asserted engine-independently in `packages/widgets/test/dismissal.spec.mjs`.
- **the computed accessibility tree** — no other engine exposes one to an automation client, and a
  name computed in JavaScript would be this repository's opinion of the algorithm. The dangling-
  reference half of that spec is DOM-only and still runs everywhere; only the tree assertions stop.

## M — a readable text colour is estimated, never measured — **partly fixed**

**Observed.** `packages/styles/src/modyra-base.css`. Filed when twenty `on-*` pairs fell below the
contrast floor on one engine; reopened when a selected date rendered black on a saturated blue and
the estimate turned out to be faithful to a metric that was itself wrong.

**Fixed: the metric.** The derivation maximised the WCAG 2 contrast ratio, whose luminance formula
weights blue at a fourteenth of green and therefore rates dark text on saturated colour far above
what a reader experiences. [ADR 0015](architecture/0015-light-text-while-it-is-readable.md) replaces
it: **light text while light clears a floor, the higher ratio below that.** The same defect was in
`onColorFor` in `@modyra/core/color-utils`, which is exact rather than estimated — so precomputing
the palette would not have fixed it, and both implementations changed.

**Still open: the estimate, and where it runs.**

A stylesheet cannot compute a contrast ratio — it holds the colour in OKLCH and the ratio wants sRGB
luminance — so it compares an *estimated* luminance against a threshold. Two tiers, two accuracies:

| tier | condition | disagrees with the rule | worst pair |
| --- | --- | --- | --- |
| chroma-corrected | `pow()`/`cos()` in a colour channel | 1.4% of 6000 | 3.32:1 |
| lightness pivot | relative colour only | 4.6% of 6000 | 3.11:1 |
| fixed mix | no relative colour | — | unbounded |

The third remains what an engine without relative colour gets, and it is not a fallback: a fixed mix
toward white is 95% white whatever the background is.

Two residuals sit under the estimate itself. **Gamut clipping**: the stylesheet decides on the colour
it was asked for, the browser paints it clipped into sRGB, and clipping moves lightness —
`color-utils` round-trips through hex before deciding and CSS has no equivalent. **No chroma term**
on the lower tier, which cannot separate two colours of equal lightness and unequal brightness.

**Not decided.** The gap is now *when* the arithmetic runs, not what it computes. Live derivation
buys a primary the host sets at runtime with no JavaScript on the page — the reason the OKLCH model
exists in this shape — and pays for it with an estimate and three tiers. Generating the palette ahead
of time with `color-utils` is exact and gives that up. ADR 0015 holds either way, since the metric is
the same; what changes is whether anything still approximates it.
