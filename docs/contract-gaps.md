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

- **Fixed** — A1, A2, A3, B1, B2, B3, C1, C3, C5, D, E1, G1, G2, G3, G4, H, I
- **Partly fixed** — C2 (derived, not painted), E2 (most scripts reachable), F (kind-keyed tables
  narrowed, part-keyed ones key-checked)
- **Closed without a fix, deliberately** — C4 (no honest consumer to add), E3 (a scope boundary,
  documented)
- **Open** — J1, J2, J3, J4

Nothing here is urgent, and every entry carries the reason it is where it is.

The J findings share one shape: **anatomy the contract cannot express, because the thing that needs
constraining sits one level below the part list.** They are recorded rather than fixed because each
one is a decision about what a widget *is*, binding on every renderer.

They close in a fixed order, and the first step is not a fix. A suite that cannot currently observe a
violation will not prove a new rule caught it, so the fixtures come first and assert today's wrong
behaviour. J3 follows, being the one gap that needs no decision — the timepicker's inner control is
already drawn by every renderer and only needs naming. J1 and J2 each need an architecture decision
record before any contract change, because each settles what a widget *is* for every renderer at
once. J2 comes last on purpose: it is the only one requiring conditional anatomy, and designing that
machinery before the others are closed would be designing it without evidence.

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

## J1 — `segmented` leaves its `option` element unconstrained — **open**

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

## J2 — `multiselect` anatomy depends on its mode, and the contract cannot say so — **open**

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

## J3 — `timepicker` segments hide their real control one level down — **open**

**Observed.** `packages/widgets/src/catalog.ts`, the `timepicker` shape declares
`elements: { hour: "group", minute: "group" }`.

`hour` and `minute` are the containers the header lays out. Each holds an `<input type="number">`
with its own aria-label — the element a user actually types into, and the element that carries the
accessible name. That input is **not a declared part**, so it sits one level below anything the
contract can see: no anatomy, relation, state or equivalence check reaches it.

Declaring the segments as controls instead would be worse — it would ask every renderer for a
control at a level where none exists.

**Not decided.** The fix is to name the inner control as a part of its own, not to widen the check
until the current shape passes. Widening is the failure mode this document exists to catch: a check
relaxed to fit the code stops being a check.

## J4 — Two contract checks accept an answer from anywhere — **open**

**Observed.** `packages/widgets/src/testing/state-tests.ts` and
`packages/widgets/src/testing/dom-tests.ts`.

Both are deliberate breadth, and both are recorded here because deliberate breadth and an unnoticed
hole look identical from a green suite.

**State carriers are not narrowed per kind.** Where a widget exposes a state depends on its anatomy —
a text field puts it on the input, a radio group on the group, a select on its trigger. Rather than
guess, `state-tests.ts` accepts the attribute on *any* declared part. The claim it can make is
therefore only "the widget exposes the state somewhere an assistive technology will meet it", not
"on the right element". A widget that moved `aria-expanded` from its trigger to its root would still
pass.

**Popup contents are unchecked.** `dom-tests.ts` declares `popup: undefined` — a popup is a
positioning container, and its accessible semantics live on what it *contains* (the listbox, the
grid, the dialog). Constraining the box itself would force a role that says nothing. But nothing yet
checks the contained thing, so a popup framing the wrong element, or nothing at all, is invisible.

**Not decided.** Narrowing the state carrier to one part per kind requires a per-kind table the
contract does not have; checking popup contents requires the contract to name what each kind's popup
frames. Both are the same missing capability — anatomy expressed one level deeper than the current
part list reaches — which is also J3's shape.
