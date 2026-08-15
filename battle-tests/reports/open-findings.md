# What is red, and why

Thirty battles fail on purpose, out of a suite of three hundred and three. Each is a claim the suite
makes about published behaviour that the engine does not currently keep, reduced to the smallest
sequence that shows it, and each names what would turn it green — usually two answers, because most
have more than one defensible repair and the battle asserts the property rather than the fix.

Two of the thirty are not pins. `generative/properties/history.property.test.mjs` and the positional
campaign beside it draw a fresh seed each run and reach their defect most times but not every time;
their green is not evidence, and the battles beside them are. `adversarial/studio/every-target` packs
seven packages and can fail on a loaded machine for that reason, which its first assertion says in
those words.

One cause below is **withdrawn**: it was the reference model rather than the engine, and it is left
in place rather than deleted so that anyone who read it finds out.

The list is grouped by cause. Twenty-four causes, one of them withdrawn. All but the last run under `npm run battle`; the last needs `npm run battle:browser`.

---

## 1. Five setters keep an argument they cannot use

`adversarial/reactivity/signal-shaped-arguments.battle.test.mjs`

`setDisabled`, `setReadonly`, `setInactive`, `addValidators` and `upsertValidators` accept a value
they cannot call and return normally. Every later read that composes it — `disabled()`, `readonly()`,
`state.valid()`, `submitValue()`, `errorsFor()` — throws a `TypeError` naming `disabledSignal`, an
internal the caller never wrote. `getValue()` keeps answering, so the form looks alive.

    form.setDisabled("rows.a.code", true)   // the documented shape is () => true

**Green when** the setter refuses the argument at the call, or holds something the reads survive.
`getField` already refuses everything that is not a path, at the call — the house style to copy.

## 2. A whole-value write that is not one empties the form

`adversarial/validation/a-whole-value-that-is-not-one.battle.test.mjs` — two battles.

`setValue` given a string, a number, `null`, nothing, an array or an object whose keys the schema
does not know leaves every field `null` and every collection empty. The engine's own
`explainValueMismatch` calls the result `text cannot hold null` while `state.valid()` reads true.
`setInitialValue` plants the same value where `reset()` returns for the rest of the form's life.

**Green when** the argument is refused or the form is left as it was. `patch`, `patchValue`,
`rows.upsert`, `rows.patch`, `rows.setAll` and `items.setAll` all take the same six values and damage
nothing.

## 3. Undoing a write that ended several rows returns a state that never existed

`adversarial/persistence/undo-of-a-whole-write.battle.test.mjs` — two battles.

Three rows, `reset`, one undo → one row. The rows come back one per undo in reverse declaration
order, so the first undo lands on a collection the form was never in. `rows.setAll({})` does the
same, and so does a restored draft: three rows restored are four undo steps.

**Green when** the write is one history entry. `form.patch` and `form.patchValue` write two rows and
undo as one step — the precedent inside the same engine.

## 4. A claim waiting for its row dies at a whole-value write

`adversarial/collections/claim-waiting-for-its-row.battle.test.mjs`

ADR 0044 names both things that keep a binding alive: a claim, or a claim waiting for its row. Claims
are counted correctly and a claim made after the row survives `setAll`; one made while the collection
was empty does not. The count is then one short, the next `removeField` releases a claim a mounted
control still holds, and a cell the consumer excluded is submitted.

The pair that locates it, same claim count and same whole-value write on both sides:

    mount (no row yet), push, mount, setAll [], unmount, push   → the claim is gone
    push, mount, mount, setAll [], unmount, push                → one claim is left, as it should be

Re-derived after cause 5 above turned out to be the model rather than the engine. This one is not:
the pair differs in nothing a claim count can see.

## 5. Withdrawn — it was the reference model

`regressions/disabled-across-insertion.battle.test.mjs` is **green** and no longer claims a defect.

It asserted that a binding waiting at an index wins over one a row carries into it. The engine's rule
is the opposite and it is consistent: without a carried binding the waiting one applies, and the same
holds in a keyed collection through a rename. Removing the *first* pending binding makes the second
apply — which a lost binding does not do.

Two campaigns had "confirmed" it, and both read the rule from the same reference model. Two campaigns
finding one divergence are not two pieces of evidence when they share a model.

What is open is the record rather than the code: ADR 0044 says what releases a binding and not which
of two competing ones wins. The file now asserts what holds either way — the two collection kinds
agree, and a binding is never simply lost.

## 6. A rebuilt collection holds nothing

`adversarial/dynamic-contract/flattened-and-put-back.battle.test.mjs`

`flattenDynamicForm` → `buildFlatFormSchema` keeps the collection's kind, which is what DYN-002
promises, and loses the row template: the flattened field list is empty because the cells live inside
the item. The rebuilt keyed collection then accepts `upsert("k", …)`, reports `keys()` as `["k"]` and
returns `{}` from `getValue()`; the positional one accepts `push` and stays empty.

**Green when** the row is refused or held. The two contradictory answers are the part that is wrong
under any reading.

## 7. The v2 tree parser drops field defects in silence

`adversarial/dynamic-contract/what-the-parser-says-it-did.battle.test.mjs` — three battles.

A kind nobody declared, a field with no kind, a select with no options, a select whose options are
not a list and a pattern that backtracks exponentially are each named by the flat parser and dropped
without a word by the v2 tree. `acceptedCount` and `rejectedCount` then disagree with the outcome —
three children in, none accepted, none reported rejected — and `strict` leaves `ok` true for a
document whose only field it emptied, because its rule is that any diagnostic makes `ok` false and
there is no diagnostic.

The parser has the machinery: rules, validations and layout defects are all reported, and a name the
contract forbids is refused in both shapes. The silence is only about fields.

## 8. An index that is not one names row zero

`adversarial/collections/an-index-that-is-not-one.battle.test.mjs`

`remove(-1)`, `remove(99)` and `remove(Infinity)` change nothing, which is right. `remove(NaN)`,
`remove(undefined)`, `remove(null)`, `remove({})` delete the first row — so a parse that failed or a
lookup that missed takes a row and its values. `insert` and `move` put the row at the front instead.
The keyed collection already answers correctly for every one of these values.

## 9. A destroyed form contradicts itself

`adversarial/lifecycle/answers-after-destroy.battle.test.mjs`

Keeping a destroyed form answering is deliberate and not in dispute. Whether the answers agree was
never decided: `getValue` holds the row, `keys()` lists it, `cell.value()` is null, `submitValue()`
is empty, `fieldNames()` is empty, and `canSubmit()` is true. `if (canSubmit()) send(submitValue())`
in a teardown sends an empty payload for a form that just called itself submittable.

## 10. `clearDraft` removes but does not re-baseline

`adversarial/persistence/discarding-does-not-rebaseline.battle.test.mjs`

The guide documents both halves in one sentence. After the discard, `getChanges()` still reports every
edited field, so a `PATCH` built from it sends what the consumer just decided to throw away.
`setInitialValue` moves the baseline and empties the change set — the mechanism exists.

## 11. An option that came back as a fresh object is shown twice

`adversarial/lifecycle/a-value-the-list-does-not-know.battle.test.mjs`

`oneOf` calls a structurally equal object an offered option and `defaultOptionKey` gives it the
option's key, both per ADR 0051. `sameChoice` does not: objects are the same choice only by
reference. So a draft restore, a refetch or an import turns two options into three rendered entries,
two sharing a key, one labelled with its own JSON. `optionsWithUnrecognizedValues` shares the cause,
so one repair covers both.

## 12. A server's answer rendered as `[object Object]`

`adversarial/validation/what-the-server-said.battle.test.mjs`

A `serverValidator` check that hands back the response instead of a message puts `[object Object]`
next to the field. `async (value) => (await response.json())` is the ordinary shape of this code and
its type is `any`, so the signature does not stop it. The package has already written down why that
is the worst answer, about option labels — *cleared is visibly empty, while that looks like a value
and gives nothing to act on* — and the rule has not reached here.

The four real endings all hold and are green beside it: nothing said, something said, a check that
threw, and a check that never answered.

## 13. Two Studio targets call a broken project compatible

`adversarial/studio/every-target.battle.test.mjs`

`studio-model` raises `SELECT_WITHOUT_OPTIONS` at severity error for a select declaring no options.
The json target reports it, answers `compatible: false` and emits no contract. React and Angular
answer `compatible: true`, report nothing and emit both files — so an author generates a form and is
told nothing, which is the half of STU-003 that fails: the field neither reaches usable output nor is
reported as dropped. The emitted document then holds a select `buildDynamicFormSchema` cannot build.

The json target is the control that the finding is reachable, and a project with nothing wrong is
compatible on all three.

## 14. The keyed bulk write does not scale

`adversarial/collections/a-list-that-does-not-scale.battle.test.mjs`

Same three cells, same async validator, same row count, doubling each time: `items.setAll` costs
9 → 21 → 40 → 84 ms and `rows.setAll` costs 35 → 100 → 345 → 1289 ms. The positional bulk write is
linear and the keyed one is not. Declaring one at a time is worse again — `items.push` in a loop is
25 seconds for two thousand rows — but a loop has a bulk alternative to point at, and `rows.setAll`
is the alternative. Reads are fine: `getValue`, `submitValue`, a cell write, `keys()` and a single
`remove` all scale.

Nesting compounds it. Orders each holding lines, both levels written in bulk: 10×20 costs 25ms,
25×20 costs 185ms, 50×20 costs 1151ms and 100×20 costs 8044ms — a hundred orders of twenty lines is
eight seconds where reading them back is seven milliseconds, and four times the orders costs about
ten times as much per order.

Nothing is asserted in milliseconds; every assertion is a ratio, so a slower machine moves the
numbers together and no ratio moves.

## 15. A synchronous validator that throws makes the form unreadable

`adversarial/validation/a-validator-that-breaks.battle.test.mjs`

A validator is application code called on every write, so it can throw. `set()` returns normally and
the exception comes out of `state.valid()` instead — and out of `errorsFor` and `getValue`, and out
of every later read while the value stays one the validator chokes on. The form cannot be rendered
and the stack points at whatever read it last rather than at the write.

The engine answers this on the other side of the same feature: a `serverValidator` check that throws
becomes an error on the field carrying the message, and the form stays readable. That is the green
battle beside it. Either repair is admitted — throw at the write, or turn it into a verdict — and not
a form nobody can read.

`asyncWhen` is the same mistake one step earlier and with a larger blast radius: the predicate that
decides whether a server check runs is read while the form is being built, so one that throws makes
`createForm` throw and nothing exists to render.

## 16. A draft storage that refuses stops the form being built

`adversarial/persistence/storage-that-refuses.battle.test.mjs` — two battles.

Two of the three ways `localStorage` fails are already handled: a `write` that throws is swallowed
and the form keeps what was typed, and a `read` returning something that is not a draft is ignored. A
`read` that *throws* takes `createForm` with it — which is Safari in private browsing, a blocked
third-party context, an enterprise policy. A draft is an optional convenience; failing to read one
should mean there is no draft, not that there is no form.

`clearDraft` is the smaller version: a `remove` that throws comes out of the call, where the write
path swallows its own failure.

## 17. A skipped server check is silent where it matters

`adversarial/reactivity/a-check-nobody-runs.battle.test.mjs`

Async validation needs an effect-capable reactivity, and skipping the check rather than half-starting
it is the documented answer. What a consumer is told is not: in development a console line names the
field, and in production, with `devWarnings` off, there is nothing at all — no console, and nothing
in the `diagnostics` sink in either mode. The form reports `valid` and `canSubmit` for a value the
server never saw, and `MDY_ASYNC_FEATURE_DISABLED` is exported for this situation and never reaches
the sink.

## 18. A document nested past what the walk can carry

`adversarial/security/a-document-too-deep.battle.test.mjs`

A schema nested fifty thousand levels throws a `RangeError` out of `parseDynamicForm` in both modes,
and out of `buildDynamicFormSchema`. The layout half of the same document at the same depth comes
back as `MDY_DYNAMIC_INVALID_LAYOUT` with no exception, because `MDY_LAYOUT_MAX_DEPTH` is tested
before the walk goes further. The depth at which it gives way moves with whatever else is on the
stack; that there is one at all is what is asserted.

## 19. Activate persists only when it is a resume

`adversarial/lifecycle/paused-without-losing-anything.battle.test.mjs`

A form that was active, paused, written to and resumed writes its draft on resuming. One built with
`autoActivate: false` and then activated does not — it waits for an unrelated edit. React and Preact
construct that way, so a form hydrated from a payload in the tick it was built keeps nothing until
the user types.

## 20. getChanges never reports a row the user added

`adversarial/submission/a-row-nobody-sends.battle.test.mjs`

`reset()` throws a declared row away, so the baseline has no such row; `getChanges()` reports
nothing, so there is nothing new. Only what was written to a row *after* it was declared is
reported, so a form where a user added three lines and typed in none produces an empty patch.

## 21. A validator or a predicate that throws takes more than itself

`adversarial/validation/a-validator-that-breaks.battle.test.mjs` — two battles.

A synchronous validator that throws makes `state.valid()` throw, and every later read with it, so
the form cannot be rendered. `asyncWhen` that throws makes `createForm` throw. The async path turns
the same failure into a verdict on the field and keeps the form readable, which is the repair
pattern for both and the green battle beside them.

## 22. A refusal the server sent that reaches nobody

`adversarial/security/what-the-server-refused.battle.test.mjs`

`path: null` lands form-level, a path naming a field lands on it, and a path the form does not have
is surfaced form-level as the guide says. `path: ""` — the explicit way to say *this is about the
whole form* — is dropped entirely, not even into `lastSubmitErrors`. Omitting `path`, which is what
`{ message }` from a server response looks like, produces a form-level error reading `Cannot read
properties of undefined (reading 'length')` on the surface an application shows a person.

## 23. The Plain renderer paints a verdict nobody has earned

`browser/an-error-before-anyone-typed.spec.ts` — **runs under `npm run battle:browser`, not
`npm run battle`.**

`errorsVisible` is `touched && shownErrors(...)`, and its comment says why the second half is there.
Angular calls it, Lit calls it in five places, and Plain never does — its fields render
`shownErrorsOf`, which knows `disabled` and not `touched`. A freshly mounted Plain form paints "This
field is required" in a visible block eighteen pixels tall and marks the control `aria-invalid`, so a
screen reader announces every required field as invalid before the user has reached any of them.

Only a real DOM shows it: the handle is failing either way, and every check that reads the engine
agrees with the engine.

## 24. Reported without a repair path

- `adversarial/submission/submit-contract.battle.test.mjs` — an action returning something that is
  not a list of errors puts `errors.filter is not a function` on the form-level error surface, the
  one an application renders to the person filling in the form. The smallest of these findings.
- `adversarial/reactivity/duplicated-core.battle.test.mjs` — a second copy of the package under a
  dependent's `node_modules` turns the cross-runtime guard off: the nested copy's registry knows
  nothing, so `observerFor` says nothing about a handle from the other copy.
- `generative/properties/keyed-nested.property.test.mjs` — `record.upsert` on an existing key keeps
  nested rows and nulls their cells, where a remove-then-upsert behaves as documented.

## 25. Three artefacts disagree about which document versions exist

`adversarial/dynamic-contract/the-versions-nobody-published.battle.test.mjs`

The parser accepts envelope versions 1, 2 and 3, plus a bare field array. `spec/` publishes a schema
for 2 and 3. Neither of the remaining two shapes is described by anything an editor can read.

That would be a documentation gap and not much more, except for which version it is:
`docs/guides/ai-generated-forms.md` tells a model, in the prompt it publishes for copying, to respond
with `{ "version": 1, "fields": [ ... ] }`, and names the bare array as accepted. So the recommended
path is the underlined one. `scripts/audit-contract-schema.mjs` states in its own header why that
costs more than it looks: the schema is the only diagnostic an author writing JSON gets for free, and
one that rejects a valid document teaches them to distrust it.

The audit cannot see this. It walks `spec/fixtures/dynamic-form/*` and reports a corpus with no
schema; there is no `v1/` corpus, so there is nothing for it to walk.

Green when a v1 schema is published, or when the parser stops taking a version nothing describes.
Both sides are measured in the battle — the versions by probing the parser, the schemas by reading
the directory — so neither can drift away from it silently.

## 26. A refusal that names a cause the document does not have

`adversarial/dynamic-contract/refused-for-the-wrong-reason.battle.test.mjs`

`spec/fixtures/dynamic-form/v3/placement.json` with its version number moved to 2 is refused, which is
correct: the v2 schema's own description says a placement slot and a section's per-size placement are
"both of which the parser refuses below v3". It is refused as `MDY_DYNAMIC_UNKNOWN_FIELD_REFERENCE`,
twice. All five names the fixture references — `first`, `last`, `street`, `city`, `notes` — are
declared in the same document. An author reads that and goes looking for a typo that is not there.

`MDY_DYNAMIC_UNSUPPORTED_VERSION` is already in `MDY_DYNAMIC_DIAGNOSTICS` and already fires for a
version the parser does not know. It is not reached when the version is known and the construct is one
that version predates, which is the case where the author most needs to be told what is wrong.

The battle asserts the refusal as well as the cause, so accepting the document is not a way to turn it
green.

## Closed since this file was written

- **A document's pattern could stop the form answering** —
  `adversarial/security/document-patterns.battle.test.mjs` was red and is now green.
  `MDY_DYNAMIC_PATTERN_TOO_COSTLY` is published in `MDY_DYNAMIC_DIAGNOSTICS`, ADR 0050 records the
  decision, and all three catastrophic patterns now answer inside the 1s budget in a clean child
  process.

## Not a finding, but stale

`scripts/audit-contract-schema.mjs` says in its header that checking whether the schema accepts each
fixture "needs a JSON Schema validator, which is a dependency this repository does not carry". Line 28
imports `ajv/dist/2020.js` and line 125 does exactly that check. The comment describes the file before
`34a87f9e`.

## 27. A write that arrives after the end gives two answers

`adversarial/lifecycle/a-write-after-the-end.battle.test.mjs`

Three operations: fill a field, destroy the form, write to the field again.

```
handle.value()        ""                          the write landed
getValue().name       "typed"                     frozen at the end
handle.errors()       ["This field is required"]  a validator ran
handle.valid()        false
state.valid()         true
state.canSubmit()     true
```

That a destroyed form answers is deliberate — a renderer torn down in the other order keeps reading,
and throwing would turn an ordinary unmount race into a crash. The write is the case underneath it,
produced by the same race: a control's change handler firing as its host is disposed. A control still
on screen shows what the user typed and an error explaining why it is wrong, about a form that holds
neither and will submit neither.

Asserted as the two surfaces agreeing rather than which one wins, so refusing the write and landing it
everywhere both turn it green.

Bounded by the second battle in the same file, which is green: no async validator runs after destroy.
The work that reaches outside the process stays stopped.

## 28. A cross-field check that is kept and never runs

`adversarial/dynamic-contract/a-rule-that-never-fires.battle.test.mjs`

`validateExpression` states its own purpose: an expression from a document is checked at parse time
"rather than surfacing later as a rule that silently never fires". Every malformed path in a
`validations` condition is refused — `__proto__`, `a..b`, `.a`, `a.` as not being field paths, `ghost`
and `ghost.deep` as naming nothing the document declares. The empty string is not. It parses, is kept,
and becomes a dependency on a path no field has, so the check never runs against any value the form
can hold, including against `undefined`, which is what that path reads.

The same value as a rule's `when.field` is refused with `MDY_DYNAMIC_INVALID_RULE`. The two condition
surfaces disagree about exactly one input, and it is the one that fails silently.

A document here is written by a model as often as by a person — that is what the guide's published
prompt is for — and a generated `""` is a check that looks present in the document, parses `ok`, and
defends nothing.

## 26 has a second witness

Nesting sections one past `MDY_LAYOUT_MAX_DEPTH` reports `MDY_DYNAMIC_UNKNOWN_FIELD_REFERENCE` about a
field the same document declares — the same code the version boundary reports about five correct
references. Two routes to one message make it the walk's answer for stopping at all: whatever ends the
walk, the field it never reached is reported as one the document does not have. Both refusals are
correct and the battle asserts them; the depth limit itself holds exactly at 6 and terminates on 5000
sections in under a millisecond.

## 29. The author-time check is silent about a version it does not know

**Now pinned**: `adversarial/dynamic-contract/the-rule-and-the-parser.battle.test.mjs`, 1 red, since
`@modyra/eslint-plugin` reached the root manifest. Seven documents through both the rule and the
parser; they agree on six and disagree on one.

`modyra/valid-dynamic-form` decides a literal is a document by finding "a version the parser knows"
beside one of the two slots that carry a form. A `{ version: 4, fields: [...] }` literal is therefore
not a document to it, and it reports nothing — while the parser refuses that document at runtime with
`MDY_DYNAMIC_UNSUPPORTED_VERSION`. The rule is silent exactly where the parser is most certain, and
the signal the heuristic reads is the thing that is wrong.

Everything else about the rule holds and was checked: versions 1, 2 and 3 all reported, with and
without the parse call, duplicate names and unsafe names alike.

## Dismissed with evidence

- **Array inside an array.** The plan recorded it as refused by `assertNotNestedCollection`. The
  published `v3/positional-nesting.json` fills three positional levels and a list whose rows are
  lists, with no refusal. ADR 0043 landed; the matrix was stale.
- **A collection's `errors()` empty while a row is invalid.** It is the right scope: it carries what
  is attributed to the collection's own path — a form-level validator targeting `orders` does appear
  there — and `validOf(key)` is the surface that answers for a row.
- **Async validators after destroy.** They do not run. Measured with a counter, with the control that
  the validator was reachable while the form was alive.
- **The lint rule's blindness to assembled documents and to `parseDynamicFields`.** Both are stated
  limits with reasons: ADR 0024 for the first, and the rule's own comment for the second — a bare
  array is a valid v1 document, and detecting it would make every array literal a candidate.

## 30. Controls that outlive the form they render keep offering to edit it

`browser/a-form-that-ended-under-the-controls.spec.ts` — **runs under `npm run battle:browser`.**

Finding 27 seen from the page. Both teardowns are published and are not the same operation:
`MdyPlainForm.dispose()` "unmounts every field, destroys their controllers/effects, and deactivates
the form", while `form` is exposed beside it as "the real, running @modyra/core form backing every
rendered field". Ending that one is what a host does when the model's owner goes first — an
`ngOnDestroy` runs and the nodes stay until an animation or the scheduler takes them.

In that window the controls are enabled, take typing and paint it, because a text input holds its own
value. The form keeps the one it had. Nothing on the page distinguishes a control whose edits land
from one whose edits reach a form that has ended.

The second test in the file is green and bounds it: no message is painted after the end, because the
renderer's effects are gone. The divergence is the value alone.

Asserted as the two disagreeing, so disabling the controls when the form they render ends and taking
the write both close it.

## Also stale, alongside the ajv comment

`packages/core/src/flat-schema.ts` says validators "come from {@link applyFieldValidators}". The
exported name is `applyFlatValidators`. A consumer who reads that comment — and they will, because
`buildFlatFormSchema` is documented as validator-free and builds a form that accepts everything on its
own — is sent to a function that does not exist under that name.

Both routes agree once the real call is made: required mark, verdicts and projected constraints are
identical to the tree route's. Measured, and now held by
`adversarial/accessibility/the-signal-behind-aria-required.battle.test.mjs`.

## 31. A mount that refuses a field keeps what it had already painted

`browser/a-mount-that-stopped-halfway.spec.ts` — **runs under `npm run battle:browser`.**

`assertUsableWidgetId` is deliberately loud rather than repairing — "an id is consumer-visible, so
rewriting one silently would change what a host's tests and stylesheets look for" — and the refusal is
right. The battle asserts the refusal and its message; that is not what is under attack.

Mounting paints as it goes. A four-field list whose last field cannot have a usable id leaves three
controls in the container: the two before it, and the beginnings of the one refused. The throw takes
the return value with it, so the caller never receives the handle whose `dispose()` is the only
published way to unmount what was painted.

The stray control is narrower than "an inaccessible control appeared": it carries `aria-label`, so it
has an accessible name. It has no id, so its `<label>` carries `for=""` and associates with nothing,
and no ARIA reference can ever point at it. The page's own dangling-reference check cannot see this,
because `for=""` points at no id rather than at a missing one — which is why the battle reads the
association rather than the check.

Only what mounting owns is asserted. The container is the caller's.

## 32. `aria-label` on an element that cannot carry it

`browser/every-kind-under-an-auditor.spec.ts` — **runs under `npm run battle:browser`.**

axe-core, WCAG 2.0/2.1 A and AA, over one form of every kind the vocabulary declares, reports one
violation:

```
aria-prohibited-attr   serious   .mdy-select
<div class="mdy-select" aria-label="Label select">
aria-label attribute cannot be used on a div with no valid role attribute.
```

It is six elements, not one. axe reports `.mdy-select` as a violation and five more as *incomplete*,
which the battle prints rather than fails on:

```
.mdy-slider-container    aria-label="Label slider"
.mdy-multiselect         aria-label="Label multiselect"
.mdy-plain-datepicker    aria-label="Label datepicker"
.mdy-plain-daterange     aria-label="Label daterange"
.mdy-timepicker          aria-label="Label timepicker"
```

Every composite widget wraps itself in a role-less `div` and labels the wrapper. Which one axe calls a
violation and which five it leaves undecided is axe's business; they are the same construction.

The attribute is discarded by the accessible-name computation, so what it says never reaches anyone.
The practical effect is bounded and worth stating: the trigger inside each wrapper is separately
labelled, and every kind was measured to have an accessible name, so no control is anonymous. What is
lost is the intent, and a WCAG-tagged rule this project's own conformance promises are read against.

Fixing it is either dropping the attribute or giving the wrapper a role that permits it.

Green alongside, and the durable half: the auditor is shown catching a bare unlabelled input before
anything is trusted, the rendered count is held against the kind list so a page that failed to render
cannot pass clean, and the audit runs twice — settled, then with a value typed and a listbox open.
The second state adds no violation, which is the part worth knowing.

## 33. A required multiselect carries an attribute its role does not permit

`browser/every-kind-under-an-auditor.spec.ts` — **runs under `npm run battle:browser`.**

Only reachable in the state where a control is required, which is why the settled and opened audits do
not see it: the attributes exist only when the field is.

```
aria-allowed-attr   critical   #ms__trigger
ARIA attribute is not allowed: aria-required="true"
<button class="mdy-multiselect__search-btn" type="button" aria-label="Search options"
        aria-haspopup="listbox" aria-expanded="false" aria-controls="ms__popup"
        aria-labelledby="ms__label" aria-invalid="true" aria-required="true" ...>
```

A plain `button` does not permit `aria-required`, so a required multiselect is not announced as
required. The precedent is the widget next to it: the select's trigger declares `role="combobox"`,
where `aria-required` and `aria-expanded` are both legitimate. The multiselect carries
`aria-haspopup="listbox"`, `aria-expanded` and `aria-controls` on a bare button — the combobox
markup without the combobox role.

`aria-invalid` is not part of this: it is global and permitted anywhere.

Measured alongside, and not yet a finding on its own: with every kind required and untouched, 17
controls report `aria-invalid="true"`, 16 carry an error list and 15 of those hold text. Two controls
say a value is wrong without saying why, and one list is empty. That page state is the one finding 23
already covers — Plain paints a verdict before anyone has typed — so the counts are recorded here
rather than filed twice.

## 34. A date or a time the field could not read is erased without a word

`browser/a-time-that-vanished.spec.ts` — **runs under `npm run battle:browser`.**

Refusing is right, and the engine does it: `parseLocalizedDate` answers `null` for a day that does not
exist, and `adversarial/validation/localized-dates.battle.test.mjs` holds that. This is what the
person who typed it is told.

Nothing. On blur the text is erased, the value becomes `null`, `aria-invalid` stays `"false"`, and no
message appears in the control's error list or its supporting text.

| typed | into | outcome |
| --- | --- | --- |
| `14:30` | timepicker | erased, value `null`, nothing said |
| `banana` | timepicker | erased, value `null`, nothing said |
| `not a date` | datepicker | erased, value `null`, nothing said |
| `31/02/2026` | datepicker | erased, value `null`, nothing said |

`14:30` is the one that matters most: it is how most of the world writes a time, the control's default
locale is 12-hour, and the only way to discover that is to guess. `2:30 PM` and `2:30pm` both work and
are asserted alongside, so this is about the erasure rather than about a control that takes nothing.

Either repair closes it: keep the text so it can be corrected, or clear it and say why.

Pairs with finding 23 from the other side. Plain paints "This field is required" before anyone has
typed, and says nothing when someone types something it cannot use — an error where there is none, and
none where there is.

## 35. A popup only a mouse can open — in both renderers

`browser/a-popup-only-a-mouse-can-open.spec.ts` — **runs under `npm run battle:browser`.**

`role="combobox"` with `aria-haspopup` and `aria-controls` tells assistive technology the control owns
a popup and the keyboard opens it. That is what makes a screen reader announce it as collapsed.

| kind | trigger | role | opens on a click | opens on a key |
| --- | --- | --- | --- | --- |
| select | button | combobox | yes | ArrowDown |
| multiselect | button | *none* | yes | four of six |
| datepicker | input | combobox | yes | **none of six** |
| timepicker | input | combobox | yes | **none of six** |

Keys tried: both arrows, `Alt+ArrowDown`, `Enter`, `Space`, `F4`.

**Lit does the same.** `browser/a-popup-lit-cannot-open-either.spec.ts` asks the same question of
`@modyra/lit`: its datepicker and timepicker declare `role="combobox"` with `aria-haspopup` and open
on none of six keys, against controls a pointer opens. Two renderers built from one contract failing
the same way is what makes this the contract's rather than one renderer's.

Bounded, and the bound is green in the same file: a value can still be typed into both — `03/04/2026`
and `2:30 PM` are taken — so neither control is unusable from a keyboard. What is unreachable is the
popup itself, the calendar a person browses when they do not already know the date.

The two findings compound. The popup is the discoverable path and it is mouse-only; the typed path
works and, per finding 34, says nothing when the format is wrong. A keyboard user who does not already
know this control wants `2:30 PM` has no way to find out.

Also measured, not filed: `daterange` and `colors` have triggers with no `id` at all, carrying
`aria-controls` pointing at their popups. No reference resolves to them and no check reported a
problem, so it is recorded rather than raised.

## 36. A tier nothing runs

Not a defect in the framework — a defect in how this suite is watched, which is worse in one way: it
decays without anyone seeing it.

`.github/workflows/battle-tests.yml` runs `battle:audit`, `battle`, `battle:browser` and
`battle:campaign`. It does not run `battle:angular`, which is the only thing that executes
`battle-tests/angular/*.battle.mjs` — those files end in `.battle.mjs`, so the `**/*.test.mjs` glob
behind `npm run battle` never sees them.

Two of the three battles there are load-bearing for something stated elsewhere.
`differential/runtimes/every-runtime.test.mjs` explains that Angular is absent from the cross-runtime
comparison partly because "it would not agree if it were here, and is not supposed to" — the
documented degradation — and says that degradation is "pinned by
`angular/degraded-reactivity.battle.mjs`". Nothing pins it on any automated run.

Measured now, in the exact command form:

```
pnpm run battle:angular
  3 tests, 3 pass, 0 fail — build 4.0s, tests 9.7s
```

So it is healthy and unwatched, which is the moment to wire it rather than after it breaks. Adding a
CI step is a change to frozen configuration, so it is reported rather than made.

Angular is second in adapter priority and has three battles; the cross-runtime differential carries
six runtimes and cannot carry this one.

## 37. A capability a renderer is invited to report, and nothing reads

Measured, not battled — a battle would have to encode a guess about what the capability should change,
and that guess is the decision.

`MdyWidgetRuntimeCapabilities.hydrated` is declared, set to `false` in `ssrRuntimeCapabilities`,
computed by `browserRuntimeCapabilities({ hydrated })`, and documented at length:

> `hydrated` is the one dimension no global can answer — a browser that has parsed server markup but
> not yet attached to it is indistinguishable from one that has. It follows `dom` by default, which is
> right once the client owns the page, and a renderer that knows it is still hydrating says so.

Saying so changes nothing. Every reference to `hydrated` in `packages/*/src` is inside `runtime.ts`
itself — the type, the SSR constant, the comment, the option and the assignment. No consumer reads it.

Measured through `processWidgetCommands`, which is the surface that consults the report:

| capabilities | what ran |
| --- | --- |
| none given | open, close, touched, dirty, change, focus, scroll, announce |
| `dom: true, hydrated: true` | the same eight |
| `dom: true, hydrated: false` | **the same eight** |
| `dom: false` (either `hydrated`) | the five that do not need a DOM |

`dom` is consulted exactly as documented — that half is right and is what SSR-001's battles hold. A
renderer that correctly reports it is mid-hydration gets focus and scroll executed against markup the
framework is about to replace.

Same class as the four unemitted diagnostic codes in finding 27's postscript: published surface a
consumer is invited to use, that does nothing. Either it gates something, or it is not a capability.

## 38. Two published error classes nothing ever produces

Same class as findings 27's postscript and 37, and the most complete case of it: an entire diagnostic
pathway on the public surface that cannot fire.

Throw sites across the whole workspace, `dist` included:

| class | thrown | constructed |
| --- | --- | --- |
| `MdyDestroyedScopeError` | 12 sites — core, solid, vue | yes |
| `MdyUnsupportedCapabilityError` | 1 site — angular | yes |
| `MdyCrossRuntimeObservationError` | never | 1 site, to borrow its message |
| `MdyActivationError` | **never** | **never** |
| `MdyAdapterContractError` | **never** | **never** |

`MdyAdapterContractError` is the complete case: the class exists, `MDY_ADAPTER_CONTRACT_VIOLATION`
exists beside it as a diagnostic code, and neither is ever produced by anything. Its own comment says
what it is for — "an adapter violated one of the conformance rules (e.g. a fictitious capability, a
silent no-op)" — which is a real thing an adapter can do, and the conformance runner does check for it.
It just never reports it this way.

`MdyActivationError` is documented as "a feature requiring an active runtime context — a host
framework's injector — was used before activation". `autoActivate: false` exists and defers exactly
those features, so the situation is reachable; nothing raises this when it happens.

**A defect of mine, corrected in the same commit.** The header of
`adversarial/reactivity/published-diagnostics.battle.test.mjs` stated that these two "are thrown, so
`catch` plus `instanceof` is the way". They are not, and a reader following that comment would write a
catch block for something that never arrives. The header now says what is true and explains why the
battle still pins what the classes say: that part is what a `catch` reads if they ever do start being
thrown.

## 39. Exported constants are outside the contract classifier

`scripts/audit-type-surface.mjs` snapshots the exported type surface so a change to it is a diff. Its
extractor handles interfaces, type aliases, classes and functions — `isInterfaceDeclaration`,
`isTypeAliasDeclaration`, `isClassDeclaration`, `isFunctionDeclaration`. There is no
`isVariableStatement`, so an exported `const` is not in the snapshot.

Measured: the baseline records 582 shapes and **zero** `MDY_` constants. `@modyra/core` alone exports
seventeen a consumer can reach.

What that leaves unclassified:

- `MDY_DYNAMIC_FIELD_KINDS` — the vocabulary. Removing a kind breaks every document that uses it.
- `MDY_VALUE_CONTRACTS` — what each kind holds. A `shape` or `nullable` change is a break for every
  renderer.
- `MDY_LAYOUT_MAX_DEPTH` — a published limit, currently 6.
- `MDY_ID_DELIMITER` — every generated id derives from it.
- `MDY_DYNAMIC_DIAGNOSTICS` — the codes a consumer switches on.

This is the same shape as the gap that audit's own header calls finding **K** and says has been hit
four times: a category no differ has ever seen, so a change to it reports `patch` because there was
nothing to compare.

Not unwatched, and worth saying so: `audit-contract-schema.mjs` compares the kinds against the
published schema, and battles now pin the layout depth, the value contracts, the diagnostics list and
the delimiter. What none of those do is *classify* — and `contract:diff` is the authority a release
proceeds on.

## 40. A property that fails early explores one run

Fixed rather than filed — the harness is this package's own.

A campaign report recorded the seed, the sequence and the divergence, and nothing about which run
failed. That number is what says how much of the configured search actually happened: a property stops
at its first divergence, so one that fails at run 1 explores one run whatever `MDY_BATTLE_RUNS` says.
A report from a 400-run CI job and one from a 200,000-run night were the same document.

`BattleBreak` now carries a `search` field, `buildReport` records it, `formatSummary` prints it:

```
Search: 9 of 30 run(s), minimized in 48 attempt(s)
Search: 1 of 40 run(s), minimized in 27 attempt(s)
```

The consequence is a priority rather than a bug: every property with a known red is capped at that
red's run index. A 200,000-run campaign is only deep on the properties that pass, and closing the
early-failing reds is what unlocks the search behind them.

## 41. A renamed row moves to the end

`adversarial/collections/a-renamed-row-changes-places.battle.test.mjs` — 2 red, 1 green.

Found by surveying past the first divergence (finding 40's tool). The property this lives in stops at
run 0 on a known red; this kind first appears around run 35, and reduces to three operations:

```js
form.f.orders.upsert("b", { ref: "A1" });
form.f.orders.upsert("c", { ref: "A1" });
form.f.orders.rename("b", "a");
// keys(): ["c", "a"] — the renamed row is last
```

The record contract defines `rename` against the operation it is not:

> Moves a row to a new key, carrying value, validity and `touched`. `remove` followed by `upsert`
> reaches the same value; what only this can keep is the state the user produced — a field they
> visited stays visited.

It keeps that, and the green battle asserts it: `touched` survives a rename and does not survive
remove-then-upsert. The finding is what happens besides.

| three rows, `two` renamed to `zzz` | keys after | touched |
| --- | --- | --- |
| `rename("two","zzz")` | `["one","three","zzz"]` | `true` |
| `remove("two")` + `upsert("zzz")` | `["one","three","zzz"]` | `false` |

Identical order. On the one axis a person looking at a table can see, the two operations are the same
operation. A user who renames the second row of five watches it jump to the bottom. The same happens
one level down, which is where a rename is likeliest to be used and least likely to be noticed.

Order is not mentioned in the contract, which is what makes this a finding rather than a preference: a
consumer reading that sentence has no way to learn it, and the case that would teach them — renaming
the last row — is the one where nothing appears to happen.

Either resolution closes it: keep the row where it was, or say in the contract that a rename reorders.
The battle asserts the position, because that is what a rendered list shows; a documented move would
make this battle wrong on purpose, which is a better outcome than silence.

## 42. A bulk write costs one undo per row, and comes back backwards

`adversarial/collections/one-edit-one-undo.battle.test.mjs` — 3 red.

Found by surveying past the first divergence. This class first appears around run 60 of the history
campaign, which stops at run 9 on a different one.

Measured, one call affecting three rows, counting presses to return to the value before it:

| call | undos to return |
| --- | --- |
| `array.setAll` (3 rows) | **1** |
| `record.patch` (3 rows) | **1** |
| `form.patch` | **1** |
| one cell write | 1 |
| `record.setAll` (3 rows) | **3** |
| `record.setAll({})` — clearing | 6, and never returns |
| `form.setValue` | 9, and never returns |

The list is the precedent and it is right. `record.patch` is right. `record.setAll` on the same handle
is not — so this is two methods on one handle disagreeing, not "bulk writes are hard".

**Each press in between shows a table that never existed.** Undoing a three-row write leaves some rows
updated and some not.

**"Never returns" is about order, not values.** Clearing three rows and undoing brings them all back,
one at a time, in the order they were removed:

```
undo #1  {"c":…}
undo #2  {"c":…,"b":…}
undo #3  {"c":…,"b":…,"a":…}    every row and value back, reversed
```

The state the person was in is not on the path. Same cause as finding 41 — a row re-declared is a row
appended.

**`form.setValue` also passes through a state the form cannot produce**: its undo path holds
`{"c":{"code":null}}`, and a text cell holds `""` everywhere else. That is shown to a person as
something they had.

Each battle is written so either resolution closes it: one step per call, or a documented cost; a path
that passes through the state the person was in, or a documented reordering.

## 43. A row that carries a collection survives being told to leave

`regressions/a-row-that-would-not-go.battle.test.mjs` — 2 red. The generative campaign has reported
this class for a while; what is new is the reduction and the condition.

The record manager states the rule in its own words: re-declaring replaces what is there. An `upsert`
on a key that already names a row is not a patch — the row it describes is the row there is
afterwards, including the collections it does or does not carry.

Three operations:

```js
form.f.orders.upsert("a", { ref: "first",  lines: [] });
form.f.orders.row("a").lines.push({ sku: "S1", allocations: [] });
form.f.orders.upsert("a", { ref: "second", lines: [] });
// lines: [{ allocations: [], sku: null }]
```

**The condition is the finding**, because without it this reads as "sometimes a row stays":

| a line holding | after re-declaring with `lines: []` |
| --- | --- |
| one text cell | `[]` — gone |
| two text cells | `[]` — gone |
| a text cell and a nested list | `[{ allocations: [], sku: null }]` — stays |
| a text cell and a nested map | `[{ allocations: {}, sku: null }]` — stays |
| nothing but a nested list | `[{ allocations: [] }]` — stays |

What decides is whether the row carries a collection of its own, not how many cells it has.

The surviving row's text cell holds `null`, which is not a value a text field holds anywhere else —
asserted separately, because it stands whichever way the first half is resolved.

## 44. A reference model that could not write, and the twenty-six findings it invented

Fixed rather than filed — the models are this package's own — and recorded because the shape is worth
remembering.

The keyed-nested reference model read a path's row index as the cell it names: for
`orders.a.lines.0.allocations.0.bin` it took segment five (`"0"`) instead of six (`"bin"`), so
`allocationNames.includes("0")` was false and **every write at that depth was dropped**. Silently: the
model kept the value the row had been declared with, the engine took the write, and the campaign
reported the engine as wrong once per run.

Surveying measured the cost. Before the fix the campaign met **35 distinct kinds** over 300 runs;
after, **9**. Twenty-six of them were this.

The nine reduce to two families, both now filed with reductions: finding 43 and finding 41.

`generative/model-audit.battle.test.mjs` audits the two flat models rule-by-rule. The four nested ones
were not audited at all, which is where this lived. `generative/nested-model-audit.battle.test.mjs`
now holds the smallest rule that would have caught it — a write reaches the cell it names, at every
depth the model declares — and is falsified by putting the off-by-one back.

## 45. Closing on Tab puts focus back, and the Tab is undone

`browser/a-combobox-in-a-page.spec.ts:71` — the assertion already exists and passes on the one engine
the tier runs. It fails on Firefox.

The spec's own comment names the shape: "A control that closed and kept focus is the same trap more
politely." That is what happens. Tab out of an open combobox in Firefox: the list closes,
`aria-expanded` goes to `false`, and focus is still on the trigger.

**Not the platform.** macOS restricts Tab between buttons in some engines, which would explain it away,
so it was measured directly in the same page:

| | Firefox | WebKit |
| --- | --- | --- |
| bare `<button>` → bare `<button>` | **moves** | skips to the input |
| the combobox **closed** → next control | **moves** | moves |
| the combobox **open** → next control | **stays on the trigger** | moves |

Firefox tabs between bare buttons and tabs out of the closed trigger. It only fails when something
closed on the way out. WebKit does not tab between bare buttons at all, which is the macOS
convention — so WebKit passing this is partly its own behaviour rather than the widget's.

The probable mechanism, stated as probable: closing restores focus to the trigger, and nothing
distinguishes *why* it closed. Restoring is right for Escape — the Escape test asserts it and passes
on every engine — and wrong for Tab, where the user has already said where they are going. The
ordering of the restore against the browser's own focus move is what decides whether it is visible,
which is why one engine sees it and two do not.

**The tier runs one engine.** `battle-tests/playwright.config.ts` declares a single project and says
why: it "must be free to run alone, on one engine". Running the same twenty-eight specs on WebKit and
Firefox produced exactly one Modyra-attributable difference — this one. Every other failure is the
same on all three, and every other pass is too.

Adding a project changes what `npm run battle:browser` does, and CI runs it, so it is reported rather
than made.

## Checked and clean, this pass

Recorded because a negative result costs the same to produce and saves the next person the trip.

- **A closed popup is out of the tab order.** All six popup widgets keep their popup off-screen with
  no offset parent, and twenty-four consecutive `Tab` presses across five of them never land inside
  one — including the datepicker's forty-two calendar buttons and the daterange's forty-four.
- **`aria-controls` resolves in every case.** All six triggers point at an element that exists. Only
  the select additionally marks it `aria-hidden`; the rest rely on being `display:none`, which removes
  them from the accessibility tree as well.
- **High contrast, dark mode and reduced motion add no violations.** The same audit under
  `forcedColors: active`, `colorScheme: dark` and `reducedMotion: reduce` reports exactly the same
  ones as the default.
- **A draft preserves key order**, for maps and lists, and after a rename. Findings 41 and 42 are the
  in-memory path, not serialisation.
- **Two forms on one storage key** overwrite each other last-writer-wins and the reopened form gets
  the last write. Inherent to a shared key rather than a defect, and recorded so it is not re-derived.
- **An empty collection round-trips through a draft.** The flat encoding stores `rows: null` as the
  marker that a path is a collection; an empty map comes back `{}` and an empty list `[]`.

## 46. Two spellings of a bound, one control, one rule

`adversarial/dynamic-contract/two-ways-to-say-a-bound.battle.test.mjs` — 2 red, 1 green.

`spec/dynamic-form-v3.schema.json` lets a document say a number's limits in two places, and both are
declared: `min`/`max`/`step` beside the field, and `min`/`max` inside its `validators`.

They render the same control. Measured in the browser: both produce `min="0" max="10"` on the input,
so the browser refuses what a person types either way.

Only one is a rule.

| `{ kind: "number", min: 0, max: 10 }` | `{ kind: "number", validators: { min: 0, max: 10 } }` |
| --- | --- |
| `set(-999)` → **valid** | `set(-999)` → invalid |
| `setValue({n:-999})` → **valid** | invalid |
| `patch({n:-999})` → **valid** | invalid |
| a draft carrying `-999` → **valid, submittable** | invalid, not submittable |
| `constraints()` → `min: null, max: null` | `constraints()` → `min: 0, max: 10` |

The draft row is the one that matters. The security module states the threat model in its own words —
values are attacker-controlled more often than not, and a draft is writable by any script on the
origin. Under the field-level spelling a tampered draft restores into a form that reports itself
submittable.

An author who writes the field-level spelling watches the browser refuse `-1` and reasonably concludes
the form enforces it.

Bounded by the green battle in the same file: `constraints()` does tell the two apart, and it is the
only surface that does — the rendered control does not.

Either resolution closes it: the field-level spelling holds the value to the bound too, or the
contract says plainly that it is a control hint and not a rule. What cannot stand is two spellings of
one sentence that render identically and mean different things.

## 47. A field a document called sensitive is printed in the panel

`adversarial/security/a-field-that-said-it-was-sensitive.battle.test.mjs` — 1 red, 1 green.

The masking rule states why the declaration exists, in its own words: the name heuristic "is wrong in
both directions — `notes` can hold a recovery phrase and `cardStyle` is masked for containing 'card'.
So a declaration wins wherever there is one, and the guess only fills the silence."

Every part works except the wire between them:

- `sensitive` is a published field property in `spec/dynamic-form-v3.schema.json`;
- `parseDynamicFields` keeps it;
- `packages/studio-contract` writes it into compiled documents;
- `isSensitivePath("notes", true)` returns `true`.

Nothing turns a document's `sensitive: true` into that second argument. `mdyFormSnapshot(form)` — the
documented call — falls back to the guess, and a field named `notes` carrying a recovery phrase is
printed in full.

The mounted panel is the sharper half. `mountMdyDevtools(form, host, intervalMs)` takes no
`MdySnapshotOptions`, so a consumer who knows about the flag and derives the callback themselves has
nowhere to hand it. Only `mdyFormSnapshot` accepts one, and the battle shows that path masking
correctly — which makes this a missing connection rather than a missing capability.

## Also noted while measuring bounds

`validators` declares `required`, `email`, `min`, `max`, `minLength`, `maxLength` and `pattern`. There
is no `step`. So a document can say "steps of two" only in the field-level spelling, which is the one
finding 46 shows does not enforce — meaning `step` cannot be expressed as a rule at all, in either
place. Recorded rather than filed: it is a gap in the vocabulary, not a behaviour that contradicts one.

## 48. Three options declared, two rendered

`adversarial/dynamic-contract/two-options-one-value.battle.test.mjs` — 2 red.
`browser/an-option-that-never-appears.spec.ts` — 1 red, 1 green.

Two fields sharing a name are refused with `MDY_DYNAMIC_DUPLICATE_NAME`, because a name builds an id
and two ids that collide stop being addressable. An option's value builds an id the same way —
`s__option__pro` — and nothing checks it.

```js
options: [
  { value: "pro",  label: "Pro monthly" },
  { value: "pro",  label: "Pro yearly"  },
  { value: "lite", label: "Lite"        },
]
```

The parser answers `ok` with no diagnostic and keeps three. The page renders two: **"Pro yearly,
Lite"**. The option that disappears is the first one the author wrote. Nobody filling the form sees it
and nobody can choose it.

The value is damaged with no renderer involved: `oneOf` accepts `"pro"`, and `"pro"` names two
different things, so neither the control nor whatever receives the submission can say which was
chosen.

Controls on both halves: a duplicate field name really is refused, and three options with distinct
values really do render as three.

Either resolution closes it: refuse the duplicate the way a duplicate name is refused, or build an
option id that does not depend on the value being unique.

## The cost of a second engine, measured

For finding 45, since the decision needs a number:

```
plain-chromium only        32 tests, 22 pass, 10 fail    8s wall
plain-chromium + firefox   64 tests, 43 pass, 21 fail   24s wall
```

Firefox costs **+16 seconds** and adds **exactly one** failure beyond doubling — 21 rather than 20.
That one is finding 45. Everything else doubles identically.

## Also checked and clean

- **Every field property a document can declare reaches the control.** `label`, `ariaLabel`,
  `placeholder`, `initialValue`, `prefix`, `suffix` all render as declared; `sensitive` correctly has
  no visible effect.
- **An `ariaLabel` unrelated to the visible label is honoured as written** — the accessible name
  becomes the `ariaLabel` and the `<label for>` association stays. axe does not flag it (its
  label-in-name rule is for elements with text content), and the author asked for it, so it is
  recorded rather than filed. Worth knowing that the visible label becomes decorative.
- **An empty options list parses and builds.** Defensible — a document may fill options later — so it
  is recorded rather than filed. Malformed entries are refused with `MDY_DYNAMIC_OPTIONS_REQUIRED`: an
  option with no label, one with no value, a null entry, and a non-list all fail.

## 49. A city called New York

`browser/an-option-with-a-space-in-it.spec.ts` — 1 red, 2 green.

Same family as finding 48, sharper consequence. `assertUsableWidgetId` refuses a widget id containing
whitespace, and its message states the reason:

> Whitespace splits every ARIA reference built from it into several, each resolving to nothing, so the
> control ends up with no accessible name.

That guard stands over the widget id. An option's id is built from the option's **value**, and nothing
stands there.

`{ value: "New York" }` — a city, a plan name, a country — produces `id="city__option__New York"`.
`aria-activedescendant` is a space-separated IDREF list, so pointed at that it reads as two
references:

```
city__option__New   → nothing
York                → nothing
```

The list opens with its first option active, so a combobox whose first option carries a space is
pointing at nothing from the moment it opens. A screen reader announces nothing for it. `ArrowDown` to
`Paris` and everything works — which is what attributes the failure to the value rather than to the
widget, and is asserted as a green control.

`getElementById` is not the check: it accepts a string containing a space and finds the element, so a
page that asked it would report everything fine. The split is the check, because the split is what
assistive technology does. The battle asserts on the split.

Either resolution closes it: refuse an option value that cannot be part of an id, the way a field name
that cannot be is refused, or build an option id that does not embed the value.

## Status, mid-session

Findings 41 and 43 moved while this file was being written, on a fix that is in the working tree and
not yet committed. Recorded here rather than rewritten above, so the entries keep saying what was
found and this says what happened next.

- **43 is closed.** `regressions/a-row-that-would-not-go.battle.test.mjs` is green, both battles,
  including the `sku: null` half. The cause was not the one either of us guessed: a collection
  registers a field at its own path so its errors have somewhere to surface, that field is not a leaf,
  and the teardown of a replaced subtree walked leaves. A row carrying a collection therefore left one
  behind, and reconciliation re-declared it empty. The condition this file recorded — whether the row
  carries a collection of its own — is what made the cause findable.
- **41 is half closed, and the other half is new.** `rename` now keeps the row's position in
  `keys()`, and the nested battle is green. `getValue()` and `submitValue()` still put the renamed row
  last, so the handle and the value now disagree. Measured across five operations: only `rename`
  disagrees; `upsert` on an existing key, `remove`, and doing nothing all keep both orders together.
- **Both generative campaigns now diverge on key order alone.** 600 runs each in survey mode:
  `history` reports 177 distinct kinds and `keyed-nested` 9, and every signature in both is
  `keys[N]`. No value, validity, pending or error signature remains. Those two campaigns were capped
  at the run index of the row-that-would-not-go class until it was fixed — finding 40 in practice.

## A file field through a draft, checked and clean

A `File` JSON-stringifies to `{}`, and a draft is JSON, so this was worth asking about carefully. It
holds:

- The file field's key is **omitted** from the stored value, not written as `{}` or `null`.
- Every other field survives. A form holding a name, a textarea of typing and an email keeps all three
  when a file is attached; the draft simply stops carrying `doc`.
- Reopening restores the typing and gives the file field its empty value.
- A **required** file field is invalid again after the round trip, with "This field is required". That
  is true — the file genuinely cannot be restored and the user does have to re-attach — so it is
  correct rather than a finding.

The one thing worth carrying elsewhere: that error arrives on an untouched field, which is the shape
finding 23 is about. Here the error is true, so painting it immediately helps rather than misleads.

## 50. Undo puts the row back last

`regressions/undo-puts-the-row-back-last.battle.test.mjs` — 2 red.

Three operations, and no rename is needed:

```js
upsert("a"); upsert("b"); upsert("c");
remove("a");
undo();
// keys(): ["b","c","a"]   — expected ["a","b","c"]
```

All three restore paths do it:

| | after | expected |
| --- | --- | --- |
| `remove("a")` + `undo` | `["b","c","a"]` | `["a","b","c"]` |
| `rename("a","z")` + `undo` | `["b","a"]` | `["a","b"]` |
| `rename` + `undo` + `redo` | `["b","z"]` | `["z","b"]` |

Handle and value agree with each other — the rename fix holds. It is the restoring of a past state
that puts the row at the end, not the reading of it.

This is finding 42's second battle reduced from a bulk write to one removal, and finding 41's shape in
the history path rather than the rename path.

## 51. My own model was hiding it, twice

Fixed, and recorded because the shape is the one the charter's thirteenth principle is about: two
things that make the same mistake agree perfectly.

`generative/reference-model.mjs` encoded the pre-fix engine in two places:

1. **`record.rename` appended.** It did `forget(from)` then `declare(to)`, and `declare` pushes. The
   peer found this one from their side: their campaign reported the model expecting the renamed row
   last while the fixed engine kept it in place.
2. **`putSnapshot` composed orders.** It kept the current order for surviving keys and appended what
   the snapshot brought back:
   ```js
   const kept = order.filter((key) => snapshot.rows.has(key));
   order = [...kept, ...snapshot.order.filter((key) => !kept.includes(key))];
   ```
   With a comment saying "a row brought back by an undo arrives at the end rather than at the position
   it held. **Measured, not promised**."

It *was* measured — against an engine that appended. Once the engine stopped, the comment became a
photograph of a defect rather than a description of one. Correcting it is what made finding 50
visible: while both appended, model and engine agreed and the campaign was green on it.

After both corrections, with fixed seeds at 300 runs: `records` green, `keyed-nested` green, `history`
red on every seed tried, on finding 50 and nothing else.

**A measurement error of my own, worth writing down:** without `MDY_BATTLE_SEED` the seed is drawn
from the clock, so two campaign runs are not comparable. I compared them anyway, twice, and once
concluded a property was clean when its seed had simply been lucky. Fixed seeds for any comparison.

## 52. Withdrawn — the kit catches all of it, and I was not awaiting

Filed as "the conformance kit lets a broken adapter through", reported to the fixer, and wrong.

`runReactivityContractTests` has **fourteen** checks and **five of them are asynchronous**. The
harness in the battle called them and read its results without awaiting, so it saw seven checks and no
failures and concluded the kit was full of holes. The results had not arrived.

Awaited, the kit catches everything it was fed:

| broken how | checks failed |
| --- | --- |
| a signal that never notifies | 4 |
| a computed that never recomputes | 3 |
| a scope whose `destroy` does nothing | 2 |
| an `untracked` that tracks anyway | 1 |
| **an effect that runs once and never again** | **3**, one saying "effect should re-run when dependency changes" |
| one claiming `batching` whose `batch()` does not batch | 1 |
| one claiming `signalEquality` that ignores the comparator | 1 |

The claim that mattered most — that the kit would have passed the Solid build whose computations never
re-ran — is the one most clearly false. It fails three of its checks.

The one thing that survives is not a defect either: a reactivity claiming `deterministicFlush` whose
`flush()` does nothing passes, because with synchronous effects there is nothing pending and a no-op
flush is indistinguishable from a working one.

What the file holds now is the opposite claim, green:
`adversarial/reactivity/what-conformance-catches.battle.test.mjs` feeds the kit six broken
reactivities and asserts each is caught, and asserts the check count first — because a subset counted
as the whole is exactly how this went wrong. An adapter author wiring the kit into a runner that does
not await gets the same empty green.

**How it got past me.** Every other false finding tonight was caught by a control that would have
failed if the subject did nothing. This one had one — the real reactivity passed — and it did not
help, because the same harness under-counted both. A control only separates the subject from the
measurement when it can fail for a reason the measurement cannot cause. Asserting the *count* is that
control, and it was missing.

## 53. Studio compiles the option lists that build broken forms

`adversarial/studio/option-lists.battle.test.mjs` — 1 red. Packed consumer, ~2s.

Findings 48 and 49 seen from upstream. Studio is where a person assembles a form, so it is where being
told costs least — and its compiler already inspects an option list:

| the list | what Studio says | what it compiles |
| --- | --- | --- |
| three distinct values | nothing | all three |
| **no options** | `SELECT_WITHOUT_OPTIONS`, `UNCOMPILABLE_FIELD` | the field is dropped |
| **two sharing a value** | nothing | all three, and the page renders two |
| **a value with a space** | nothing | both, and one is unreachable to a screen reader |
| a value containing `__` | nothing | both |

The empty-list row is the precedent and is asserted: the same pass already looks at this list and
already refuses one shape of it. The two that build broken forms go through without a word.

Asking the compiler rather than the parser is the point. The parser sees a document somebody already
wrote; Studio is where it is still an editing session and a diagnostic is a sentence rather than a bug
report.

## 54. Withdrawn — one rule, and the sentence ADR 0044 was missing

Filed as "the same claim answers differently depending on whether a row happened to exist in
between". The measurement was right and the reading was wrong: the engine has one rule, and the two
sequences differ because their histories differ.

The rule, measured across six sequences and now pinned in
`regressions/a-claim-and-the-row-that-takes-it.battle.test.mjs` (3 green):

> A waiting claim is **taken by the first row that arrives** at the path. From then on it belongs to
> that row: it travels when the row moves, and it ends when the row ends.

| | disabled after |
| --- | --- |
| `setAll` one row | that row |
| `setAll` one, then one again | still that row — the row survived |
| `setAll` one, then two | still row 0 |
| `setAll` one, then empty | nothing — the row ended, and so did the claim |
| `setAll` one, empty, one again | nothing — a new row does not inherit it |
| `setAll` one, `remove`, `push` | nothing |
| claim taken by row 0, then `insert(0)` | **row 1** — it moved with its row |

`reset` was never the discriminator; a `setAll` that empties the collection does the same thing.

The last row of that table is what makes the rule falsifiable rather than descriptive, and it is why
the assertion now is stronger than the one it replaces: it fails if a waiting claim stops being taken,
if it stops travelling, or if it stops ending.

**Found by the fixer, from their side, after I had reported it.** The sentence about being *taken* is
the half ADR 0044 did not say, and it is now an amendment there.

**A consequence for depth:** this was the only class capping the `arrays` campaign at run ~4,973.
Since it is not a defect, the cap lifts by fixing the assertion rather than the engine — which is now
done.

## The generative tier, at depth

All seven properties green at **3,000 runs each** (seed 7) — twenty-one thousand sequences of
twenty-four operations. At **25,000 runs** one property found finding 54, at run 4,973.

Getting there took correcting three stale rules in my own models, all encoding what the engine did
before a fix:

| model | rule | found by |
| --- | --- | --- |
| `reference-model.mjs` | `record.rename` appended | the fixer, from their side |
| `reference-model.mjs` | `putSnapshot` composed orders instead of restoring the snapshot's | me, after correcting the first |
| `conditional-reference-model.mjs` | `record.rename` appended | me, surveying at 3,000 |

Each was invisible while the engine made the same mistake. `generative/nested-model-audit.battle.test.mjs`
now asserts that every keyed model keeps a renamed row in place, because three models encode that rule
separately and it has already drifted twice.

**Seven operations the harness can execute and no generator draws**: `async.resolve`, `async.reject`,
`destroy`, `draft.save`, `draft.restore`, `observe`, `submit`. Depth has stopped paying at this width;
these are where the next class lives.

## 55. Closed — every shape now reaches somebody

The cause was not the one the shapes suggested. All three silent forms were being discarded by the
guard that drops a hostile path: `isSafeFieldPath("")` is false and `isSafeFieldPath(undefined)` is
false, so a refusal was thrown away *as if it were an attack*.

Measured after the fix, at engine level:

| what the application returns | where it lands |
| --- | --- |
| `[{ path: "email", message }]` | the field |
| `[{ message }]` — no path | **form level** (was nothing) |
| `[{ path: "", message }]` | **form level** (was nothing) |
| `["Already registered"]` | **form level** (was nothing) |
| `{ errors: [...] }` — not a list | **form level**, with a readable sentence (was `errors.filter is not a function`) |
| `[{ path, message: {...} }]` | the field, with a readable sentence (was `[object Object]`) |

And on the page: the field-level ones render, and the one whose message was an object now says "The
submitted answer could not be read." where it said `[object Object]`.

`browser/what-the-server-said-on-the-page.spec.ts` is now three green, narrowed to the field-level
half. The shapes that land at form level are finding 56 and are not asserted here as well — one
finding wearing two names is harder to close than one.

## 56. An error the form holds and the page cannot show

`browser/an-error-with-nowhere-to-go.spec.ts` — 2 red, 1 green.

Not every refusal belongs to a field. A failed network call, a service that is down, a cross-field
rule only the server can check — all arrive with no path, and the engine has a place for them:

```js
form.state.lastSubmitErrors()   // [{ path: null, kind: "unknown", message: "network down" }]
```

It even turns a submit action that **throws** into one of these rather than letting the failure escape
— measured at engine level, and right.

The page has no place for them. Not an empty region: there is no form-level error surface in the
rendered DOM at all, and the message appears nowhere in `document.body.innerText`. A person who
pressed Submit while the service was down sees the button, their fields as they left them, and nothing
else.

The green control is a field-level error rendering through the same submit path, so this is about the
place rather than about errors never appearing.

More complete than finding 55, and the same boundary: that one is a message dropped on the way in,
this one is a message that arrived intact with nowhere to be rendered.

**Checked and clean on the way here:** two submits racing run the action once; a value changed during
a submit does not change what the action received; a submit on an invalid form does not run the action
and marks the field touched; and a throwing action leaves `submitting` false and the form usable.

## 58. Two renderers, two different accessibility defects, one contract checking neither

`browser/every-kind-in-lit-under-an-auditor.spec.ts` — 1 red, 1 green, beside the Plain audit that has
been there since finding 32.

`@modyra/lit` now has a host page in the browser tier, so the same rule set can be run against both
renderers. They do not fail the same way:

| | Plain | Lit |
| --- | --- | --- |
| `aria-prohibited-attr` — `aria-label` on a role-less wrapper | **6 elements** | clean |
| `aria-allowed-attr` — `aria-required` on a bare button (multiselect) | **critical** | clean |
| `aria-allowed-attr` — `aria-expanded` on a bare textbox (daterange) | clean | **critical, both inputs** |
| `nested-interactive` — the colours button | clean | **serious** |

Each renderer is clean where the other is not. `aria-expanded` needs a role that permits it, and
Plain's datepicker input carries `role="combobox"` where Lit's daterange inputs carry none — so the
fix has a shape to copy in the repository rather than one to invent.

That they fail differently is the finding underneath the four: `@modyra/widgets` describes the parts
and the relations, and none of these is checked anywhere the renderers share.

**Also measured, and it settles finding 23:** Lit holds a field's errors until the person has been
there. Plain does not. Finding 23 is no longer "Plain paints a verdict early" against a principle —
it is against a sibling renderer in the same repository doing the opposite.

## Whose defect is it: the two-renderer table

`browser/a-refusal-in-two-renderers.spec.ts` asks the same four questions of `@modyra/plain` and
`@modyra/lit`, each through its own host page built from published entry points. The pattern is worth
more than any single answer: **a defect both renderers have is the contract's; one only one has
belongs to that renderer, and the other usually shows the shape that avoids it.**

| question | Plain | Lit |
| --- | --- | --- |
| a refusal naming a field reaches the person | green | green |
| a refusal naming no field reaches the person | **green, newly** | red |
| a value the picker cannot read is kept or explained | red | red |
| every declared option is one a person can choose | red | **green** |

Where they agree, the finding moves to `@modyra/widgets`:

- **33** — a required multiselect is announced as required by neither. Plain puts `aria-required` on a
  bare `<button>`; Lit puts it on a `<div role="group">`. Neither role permits it, so the attribute is
  discarded in both. Only visible in the state where a field is required, which is why the first Lit
  audit missed it.

- **34** — a date or time the field cannot read is erased on blur, `aria-invalid` left `false`, nothing
  said. Both.
- **35** — a control declaring `role="combobox"` with `aria-haspopup` that opens on no key. Both.
- **56** — a form-level error with nowhere to be rendered. Both, and Plain's half is now closed.

Where they differ, the one that is clean shows the fix:

- **23** — Plain paints a field's error before the person has been there; **Lit waits for the visit**.
- **32** — Plain's role-less wrappers carrying `aria-label`; Lit clean.
- **48, 49** — Plain's option ids are built from the option's value, so duplicates collide and a space
  breaks an ARIA reference; **Lit renders native `<option>` elements, which need no id at all**.
- **58** — Lit's daterange inputs carry `aria-expanded` with no role, and its colours button nests an
  interactive control; Plain clean, and Plain's datepicker input carries the `role="combobox"` that
  Lit's is missing.

## A design difference, recorded rather than filed

Two forms over the same field names, on one page:

| | Plain | Lit |
| --- | --- | --- |
| ids | derived from the field name | a counter — `mdy-field-0`, `mdy-field-1` |
| duplicate ids with two forms | **123**, unless `idPrefix` is passed | none |
| clicking the second form's label | focuses the **first** form's input | focuses its own |

Plain's behaviour is documented and `idPrefix` exists for exactly this, so it is not filed as a defect.
What the comparison shows is that the burden is a choice: one renderer requires the consumer to know
about `idPrefix`, and the other cannot collide because its ids do not come from the document at all.

**A measurement error of mine, worth recording because it looked like a finding for ten minutes:** the
Lit host built its schema from initial values and dropped the document's validators, so nothing carried
`aria-required` and it read as the renderer losing them. The host now compiles the rules the way a
consumer's document does. Every earlier Lit measurement that did not involve validators is unaffected;
the required-state audit is the one that was wrong, and it is the one that found finding 33 in Lit once
it was right.

## 59. One sentence, two collection kinds

`adversarial/collections/one-sentence-two-collections.battle.test.mjs` — 1 red, 1 green.

`patch` is documented as "a deeply-typed variant of `patchValue` for nested groups" and says nothing
about what it does to a collection.

| written | keyed map | positional list |
| --- | --- | --- |
| collection omitted | unchanged | unchanged |
| `{ a: { code } }` / `[{ sku }]` | merges into row `a` | **replaces the whole list** |
| `{}` / `[]` | **nothing changes** | **emptied** |

Both readings are defensible for their own kind: a map has keys to merge by, a list has only the
positions it describes. That is not the finding. The finding is that `{}` and `[]` are the same
sentence — *this collection, holding nothing* — and mean opposite things, with the contract silent.

A consumer who learns the behaviour from a keyed map and writes the same shape for a list deletes
their rows.

Omission is the same for both and is asserted first, so this is about naming a collection with an
empty value rather than about patching.

## 60. A name nobody declared, through six doors

`adversarial/reactivity/a-name-nobody-declared.battle.test.mjs` — 1 red.

`devWarnings` is documented in one sentence: "the calls that could not do anything, and the choices a
mechanism cannot make for you." It is one switch on purpose.

It works. Renaming a row onto a key another row already has is reported, names both keys and says what
to do instead:

```
[modyra] rename on "rows" ignored: "b" already names a row, and moving onto it would replace it.
```

A name the schema does not have is the same kind of call, and six doors take one without a word — with
`devWarnings: true`:

```
patch({ emial: "x" })                 accepted, nothing changed, nothing said
patchValue({ emial: "x" })            the same
setValue({ email, emial })            the same
rows.upsert("a", { coed: "x" })       the row's declared cell reset, the unknown one dropped, nothing said
rows.patch({ a: { coed: "x" } })      the same
setDisabled("emial", fn)              the same
```

A typed consumer has their compiler. The doors this matters at are the ones where the keys come from
data — a document, a server, a saved project, a form built from a response — and there the difference
between *applied* and *silently ignored* is the difference between a form that shows what arrived and
one that does not.

The rename warning is asserted as the control, because it proves the mechanism and the vocabulary
already exist one call away.

## 61. The one door in 60 where being ignored costs everything

`adversarial/validation/a-whole-value-that-names-nothing.battle.test.mjs` — 1 red. **S0.**

Finding 60 lists six doors that take a name the schema does not have without a word. On five of them
the cost is that nothing happens. On `setValue` the cost is the whole form, because the rule that runs
after is *a field the whole value does not name returns to its initial*:

```
a form the user filled in: email="the user typed this", note="and this"

setValue({ email: "x", note: "y" })    {"email":"x","note":"y"}                    said nothing
setValue({ email: "x" })               {"email":"x","note":"initial-n"}            said nothing
setValue({ emial: "x" })   ONE TYPO    {"email":"initial-e","note":"initial-n"}    said nothing
setValue({})                           {"email":"initial-e","note":"initial-n"}    said nothing
```

One letter transposed, and every field the user filled in is back to its initial. `state.valid()` is
`true`. Nothing was reported through either console channel with `devWarnings: true`.

This is not "setValue resets", which is decided: ADR 0057 states the rule and its consequence, and
`setValue({})` is the spelling that means it. It is that **ADR 0057's own Security section states the
purpose of the check it added**:

> removes a way for a wrong-shaped or hostile response to silently erase what a user typed while the
> form goes on reporting itself valid and submittable

An object is the one shape that check admits. A wrong-shaped response — a server that renamed a
field, an object built by another layer, a key off by a letter — is an object, and it silently erases
what the user typed while the form goes on reporting itself valid. The stated goal is unmet at the
one shape that gets through, and the erasure is total rather than partial.

Two tiers, either of which closes it, and they are asserted separately:

- a **non-empty** whole value none of whose keys the form declares is not a reset anybody wrote —
  `{}` stays the deliberate spelling and is asserted as the control;
- a whole value where *some* keys match reports the ones that did not, which is the case a renamed
  server field produces and the one 60 already covers.

The battle also asserts, as its second control, that the five shapes ADR 0057 does refuse still throw
and leave the form untouched — so the finding is the admitted shape rather than a check that is gone.

## 62. Every prefix of a tax id, sent to a server that is told it is too short

`adversarial/validation/a-value-the-form-already-refused.battle.test.mjs` — 1 red. **S2.**
New claim **VAL-005**: *a server is asked only about a value the field's own rules accept.*

A `minLength(11)` tax id, `debounceMs: 120`, typed by a person who pauses between the groups they are
reading off a card:

```
IT12 typed with a pause per character    4 request(s)  ["", "I", "IT", "IT1"]
```

Every one is a value the field's own `minLength(11)` refuses. The form knows they are too short to be
a tax id, and sends them anyway.

Two things this is not, both asserted as controls in the battle so a repair cannot be aimed at them:

- **the debounce works.** The same field typed at speed — nine characters, 40ms apart, `debounceMs:
  400` — collapses to 2 requests. What the debounce bounds is the *rate*, not the validity; a pause
  settles, and a settled prefix is sent.
- **`when` stops all of them**, creation-time call included. The gate exists and is reachable.

The comparison is what makes it a divergence rather than a preference.
`docs/guides/comparison-reactive-forms.md` sets `serverValidator()` beside Angular's
`AsyncValidatorFn` in a side-by-side table, and the table lists what this one adds — debounce,
cancellation, last-wins, timeout, cross-field. The one thing `AbstractControl` does and this does not
is absent from it: **Angular runs an async validator only once the synchronous ones pass.** `mdyCva`
is a documented migration path, so a consumer arrives carrying that assumption and their service
starts being called with `""`, `"I"`, `"IT"`.

`when` is documented as the way to "skip the call for obviously invalid input" — which asks a
consumer to restate in a second predicate what the field already declares. The two drift silently the
moment either changes: a `minLength` raised from 3 to 5 leaves a `when` guarding the old bound.

Either repair closes it: gate the run on the field's own sync verdict, or say in the async section
that it is not gated and that `when` is how you gate it. The second is a documentation fix with a
consequence on a bill, which is still a finding.

## 63. The seventh door, and the only one with the refusal built into the same call

`adversarial/validation/one-call-two-arguments.battle.test.mjs` — 1 red. **S2.**
New claim **API-001**: *a published call that cannot do what it was asked says so.*
(The battle's header reads S0 because it also guards prototype pollution through this door, which
passes. The finding is the S2.)

`setInitialValue(name, value)` takes two arguments. ADR 0057 hardened one of them:

```
setInitialValue("a", "new")     applies; reset() now returns to "new"        said nothing
setInitialValue("a", 42)        THREW: The initial value for "a" must ...    the right refusal
setInitialValue({a:"new"}, …)   nothing happened                             said nothing
setInitialValue("emial", …)     nothing happened                             said nothing
setInitialValue("__proto__", …) nothing happened                             said nothing
setInitialValue(null, …)        nothing happened                             said nothing
setInitialValue(42, …)          nothing happened                             said nothing
setInitialValue("", …)          nothing happened                             said nothing
```

The value argument is refused loudly, in production, by name. The argument next to it — the one that
says *which field* — takes anything and reports nothing, with `devWarnings: true`.

This is the seventh door of finding 60, and the sharpest, because on the other six the refusal
vocabulary is somewhere else in the engine. Here **it is in this call, on the adjacent argument.**
The battle asserts both halves as controls for that reason: a repair cannot be aimed at a method that
checks nothing, because this one already checks something.

ADR 0057's own words are the standard it is being held to — *"It matches the path check, which has
always thrown."* `setInitialValue(null, "x")` does not throw.

The consequence is not at the call. It is at the `reset()` afterwards, which silently returns to the
old initial instead of the new one — so the misspelling surfaces as a form that resets to the wrong
baseline, arbitrarily far from the line that caused it.

No pollution reached a prototype through any of these, asserted alongside and green.

## Checked and clean: SEC-003 at the doors the sanitizer battle does not stand at

Applying finding 61's lesson — *when a check refuses a list, measure what is not in the list* — to
`SEC-003` ("a sanitized value cannot form markup, wherever it entered the form"). The existing battle
enters through `upsert`, a nested `set` and `patch`. Five doors it does not:

```
entering <img src=x onerror="alert(1)"> with security: { sanitize: "strict" }

set() — the control                       inert
setValue({a})                             inert
a schema that declares it as the initial  inert
a document's initialValue                 inert
a draft somebody rewrote in storage       inert
```

All five strip the angle brackets, which is what "cannot form markup" means. The draft one is the
threat model the persistence guide names in those words, and it holds.

**A note on how this was nearly filed wrong.** The first pass classified all six as breaches, control
included, because it tested for the substring `onerror` rather than for a bracket. The sanitizer's job
is to make the value unable to form a tag, not to delete the word: `img src=x onerror="alert(1)"` is
inert text. A control that fails is the signal that the classifier is wrong, not that everything is
broken.

## 64. A section a caller took out of play, and a form that never heard

`adversarial/validation/a-section-nobody-took-out-of-play.battle.test.mjs` — 1 red. **S1.**
Filed at S2 under API-001 and corrected: the severity model describes what reaches somebody, not what
the engine's internal state is, and the person who writes this call has a section in the payload that
they did the documented thing to exclude. What holds it back from S0 is that no state of the engine
ever claimed the section was excluded — it is a missing capability, not a contradiction.

The engine takes a whole section out of play at runtime, reactively, and does it correctly. Fed a
real signal through `vanillaReactivity()`:

```
group(children, { when: () => open() })
  open = true      submitted {"plain":"p","sect":{"inner":"i"}}
  open.set(false)  submitted {"plain":"p"}                        the section left the payload
  open.set(true)   submitted {"plain":"p","sect":{"inner":"i"}}   and came back
```

`setDisabled`, `setInactive` and `setReadonly` are the imperative half of the same idea. They sit on
three consecutive lines of the same interface, all taking `(name, signal)`. Given the path of a
**group**, with `devWarnings: true`:

```
setDisabled("sect", signal)   nothing. inner.disabled()=false, payload unchanged, said nothing
setInactive("sect", signal)   the same
setReadonly("sect", signal)   the same
setDisabled("sect.inner", …)  works: disabled()=true, the field leaves the payload
```

Both controls are in the battle: the capability exists, and the method works one path segment deeper.
A repair cannot be aimed at either.

**On the classification.** The severity model puts *"the submitted payload differs from the declared
data semantics"* at S0. A consumer who writes `setDisabled("billing", () => !wantsBilling())` ships a
section that stays editable and stays in the payload, and the first evidence is on a server — which is
that sentence from where they are standing. The first filing weighed it from where the *engine*
stands, where nothing was ever accepted and so nothing is contradicted, and landed on S2. That was the
wrong vantage point: the model describes what reaches somebody. S1 is where it belongs — a consequence
on a server, with no contradictory internal state to make it S0.

What the consumer reads while writing it is VAL-002 — *disabled values are retained in edit state and
excluded from submission* — which is true of every field that is disabled, and silent about a call
that failed to disable one. ADR 0044 calls `setDisabled` "how a control states what a user may do with
a field".

The same species as 63 and the 60 family: the capability is one call away, and the door that names it
says nothing. Three doors this time, not one.

## Checked and clean: what reaches submission in each interactivity state

Measured while looking for the above, and recorded because each is a promise nobody had exercised:

```
a field disabled     excluded from the payload, kept in getValue      VAL-002, as documented
a field readonly     submitted                                        correct: readonly still submits
a two-cell row, one cell disabled    {"r1":{"b":"1b"},"r2":{...}}     the row survives, the cell goes
a one-cell row, its cell disabled    {"r2":{...}}                     the emptied row is pruned
```

The one-cell case looked like a cascade — a disabled cell taking its row with it — until the two-cell
case showed it is not: the row survives whenever anything is left in it. What prunes it is being
empty. Whether a server can tell an emptied row from a removed one is a separate question and is not
filed, because the row's absence is consistent with the rule rather than an exception to it.

## 65. One transposed letter, and Submit stops working forever

`adversarial/validation/a-rule-about-a-field-that-is-not-there.battle.test.mjs` — 1 red. **S1**
under VAL-003. **The heaviest of the API-001 family, and the only one that runs the other way.**

Every other door in findings 60–64 *ignores* a name the schema does not have. This one accepts it:

```
a form somebody filled in correctly: { email: "someone@example.com" }, valid, submittable

form.addValidators("emial", [required()])      one letter transposed

valid           true  → false
canSubmit       true  → false
submit(cb)      the callback never runs
the error       exists, on path "emial", which no control is bound to
said            nothing, with devWarnings: true
fieldNames()    ["email", "emial"]
```

The rule can never be satisfied, because nothing renders a control for a path the schema never
declared. `patch({ emial: "filled" })` — the one door that names it — does nothing, which is finding
60. On the page this is a correctly filled form with a Submit button that does nothing and no message
anywhere on it.

**There is a way out, and it is the shape of the problem.** Measured, not assumed:

```
removeField("emial")             valid=true   canSubmit=true    the only one that works
removeValidators("emial", "")    no effect    addValidators never had a key to remove
removeValidators("emial", "k")   no effect
addValidators("emial", [])       no effect    adding an empty list does not replace the list
reset()                          no effect
setValue({ email: "y" })         no effect
```

So the repair requires knowing the ghost path is there, which is the one thing nobody was told.

Two controls in the battle, both green:

- the same call on the field that **does** exist works, and a value satisfies it;
- the keyed pair `upsertValidators`/`removeValidators` attached to the same ghost path **does** undo
  itself. So a rule on a ghost is not beyond reach in principle — only beyond the reach of the call
  that attached it.

VAL-003 is the claim in its own words: *hidden or unmounted controls do not alter validation
semantics.* A field that is not in the schema at all is the limit of unmounted, and here it decides
whether the form can be sent.

Either repair closes it: refuse the name at the call, or leave the form sendable. What the battle
refuses is the third thing — a Submit that stops working with nothing said anywhere.

## Checked and clean: getField invents a field, and it stays out of the value

`getField` is documented as get-or-create — *"the field at `name`, created if this is the first ask"* —
against `peekField`, *"if it already exists — without creating one, which is the difference."* Both
are on the collection-host contract; the form publishes only `getField`.

So `getField("nope")` on a form does register a field. What it does not do is put it anywhere a
consumer would send:

```
before                     getValue {"leaf":"L"}   fieldNames ["leaf"]
after getField("nope")     getValue {"leaf":"L"}   fieldNames ["leaf","nope"]
                           submit   {"leaf":"L"}
a deep invented path       getValue and submit both unchanged
```

SUB-001 holds — *submission contains no undeclared path introduced by rendering* — and a renderer
asking for a field it expects cannot inject one into the payload. `fieldNames()` and `getValue()`
disagree by design after such a call, which is worth knowing but is not a breach of either contract.

## 66. A range with two text inputs that take what you type and throw it away

`browser/a-range-that-throws-away-what-you-type.spec.ts` — 1 green, 3 red. **Both renderers.**
Filed where the peer's picker batch stops: `daterange` was declared out of that batch.

Measured, with the same string and the same locale that a single `datepicker` reads and keeps:

```
type "03/04/2026" into the start input
  inputValue() right after typing     "03/04/2026"     the input took the keystrokes
  after Tab, the input shows          ""               erased
  the form value                      {"start":null,"end":null}
  aria-invalid                        "false","false"
  error list / supporting text        empty

fill() + Enter                        the same
"not a date", "31/02/2026"            the same
```

This is **not** finding 34's shape. There the control could not read what was typed. Here a
well-formed date in the control's own locale is discarded too, so there is nothing being read
wrongly: **the text inputs are not wired to the value at all.**

The calendar is the control, and it is green: opening the popup and choosing two days gives
`{ start: "2026-08-05", end: "2026-08-09" }`. The popup is reachable from the keyboard. So the
control is usable, and this is not "the daterange is broken".

It is that its two text inputs **invite an interaction they discard**, which is worse than not
offering one. A person who types a range, tabs away and sees two empty boxes has no way to learn that
the calendar was the only door — and nothing on the page says so.

Finding 35 does *not* compound here, checked rather than assumed: the daterange popup opens from the
keyboard, so this is not a control that a mouse alone can fill.

Four assertions, in the order they cost the person typing: the calendar works (green), a readable
range typed in is kept (red), an unreadable one is kept or explained (red), and Lit does the same
(red).

**Lit discards it identically** — keystrokes accepted, `inputValue()` shows them, erased on blur, the
value never moves. By the attribution rule that has held all campaign, a defect both renderers have is
the contract's: the repair belongs in the shared controller in `@modyra/widgets`, not twice in markup.
That is the same conclusion the datepicker and timepicker batch reached, and for the same reason —
each renderer doing its own parsing is what lets them differ.

One incidental difference, not filed: the second input's placeholder is `"End date"` in Plain and
`"End"` in Lit.

## Checked and clean: which kinds discard what is typed into them, and the colour swatches

Finding 66 was found by accident on one kind, so every kind was swept the same way — type something
plausible into the first typeable input, tab away, and see whether the value moved:

```
text email password textarea number    reached the value
datepicker  "03/04/2026"               reached the value, shown back as 2026-03-04
timepicker  "2:30 PM"                  reached the value, shown back as 02:30 PM
daterange   "03/04/2026"               DISCARDED — finding 66
slider      a range input              typing is not its interaction; ArrowRight moves it 0 → 2
colors      a native colour input      typing is not its interaction; choosing sets the value
select multiselect radio segmented checkbox toggle file    no typeable input
```

So `daterange` is the only kind that takes characters and throws them away. `slider` and `colors`
were checked rather than assumed: both are native widgets where typing is not the interaction, and
both respond correctly to the one they do have.

**The colour swatches, nearly filed wrong.** An untouched `colors` control shows `#000000` while the
form holds `""` — a native colour input cannot render "unset" — and the swatch group carries
`role="listbox"`. A first probe read `aria-pressed` and `aria-checked` on the swatches, found neither,
and concluded the selection was expressed only as a CSS class. Reading the actual markup instead:

```html
<div class="mdy-colors__presets" role="listbox" aria-label="Presets">
  <button type="button" class="mdy-color-swatch" role="option" aria-label="#7067ff" aria-selected="false" …>
```

`role="option"` and `aria-selected`, which are the states a listbox's children carry — the two the
probe did not read. And the behaviour holds on the part that is usually wrong:

```
untouched                              nothing selected
choosing a swatch                      that swatch aria-selected="true"
setting the same colour through the
native picker instead                  the matching preset becomes aria-selected="true"
```

The two doors into one value agree. Recorded because checking the wrong attribute is how an
accessibility finding gets invented, and because axe reports nothing here — a purpose-built check was
the only way to know either way.

## Checked and clean: a value the form was given is a value the control shows

The reverse of finding 66's question, per kind: mount each kind with an `initialValue` — which is the
server-prefill and draft-restore direction — and see whether the control shows it.

```
text email textarea number slider     shown in the input
colors "#22c55e"                      shown, and the matching preset is aria-selected
datepicker "2026-03-04"               shown
daterange {start, end}                BOTH ends shown
timepicker "02:30 PM"                 shown
select "one"                          the trigger reads "One"
radio / segmented "one"               the matching input is checked
multiselect ["one"]                   the matching option is aria-selected
checkbox / toggle true                checked
```

Every kind holds. **The daterange showing a prefilled range is worth naming**: it confirms finding 66
is about *typing* specifically, not about the control being unwired from the value — the display
direction works there.

**A first pass reported `select`, `radio` and `segmented` as NOT SHOWN, and that was wrong.** The
probe passed `options: ["One","Two"]` — plain strings — where the contract declares
`MdyControlOption { value, label }`. The engine's own behaviour under that input is exactly what this
campaign asks for, checked directly:

```
parseDynamicFields([{ kind: "select", options: ["One","Two"] }])
  → []   and   [modyra] Dropped dynamic field "f": kind "select" requires a valid options array.
```

Refused at the door, named, with the reason. What produced `Value must be one of: undefined, undefined`
on screen was the probe mounting past the parser, not the parser. Every committed spec in this tier
was re-checked and passes `{ value, label }`, so nothing in the register rests on it.

## 67. A slider at its maximum, and a form holding three times that

`browser/a-slider-that-shows-a-different-number.spec.ts` — 4 green, 2 red. **Both renderers.**
UI-006, read as its mirror. **S1.**

UI-006 says a widget does not replace a value the model holds in order to make itself consistent, and
a slider does not — `getValue()` still answers `150`. What it does instead is **show a different
number**, because a native range input cannot render a position outside its bounds or off its step:

```
                                    the form holds   the page shows   aria-invalid   error
slider, initialValue 150, max 50         150              50            "false"      none
slider, initialValue 150, no bounds      150             100            "false"      none
slider, initialValue 7, step 5             7               5            "false"      none
```

A person sees a slider pushed to its maximum and submits three times that. Nothing on the page says
the two disagree.

**The number field is the shape that avoids it**, in the same renderer, from the same document — the
same bound carried as a rule instead of as a range:

```
number, initialValue 150, validators { max: 50 }   holds 150, SHOWS 150, aria-invalid="true",
                                                   "Maximum value is 50"
```

So the engine explains a bound where it has one. On a slider the bound moves the rendered range
instead, and the explanation never appears.

Both renderers do it identically, so the repair belongs to the shared controller. Either closes it:
show the number the form holds, or say that the two differ.

Reachable from a server prefill, a restored draft, or a schema whose `max` was lowered after values
were stored.

**On the claim.** UI-006's wording covers *replacing* the value; this keeps it and displays another.
The purpose — the screen and the payload agree, or somebody is told — is what fails, and the battle
says so in its header so the reading can be argued rather than assumed.

**A false S2 that was nearly filed.** Lit first appeared to ignore `max` as a field property while
Plain honoured it. That was this tier's Lit host, which forwarded only `label` and `options` to the
element. Fixed — it now forwards every property a document declares — and with it fixed the two
renderers agree exactly, on the bound and on the divergence. A renderer that looks like it ignores a
declared property is worth suspecting the harness for first.

## 68. A refusal that names a list and shows none

`adversarial/validation/a-sentence-with-nothing-after-it.battle.test.mjs` — 2 green, 1 red.
Filed under **UI-004**, whose S2 is the nearest registered severity. By the model this is **S3** — a
misleading diagnostic — and no registered claim sits there; the number is the claim's, not the
finding's.

An empty option list is legitimate and both halves of that are asserted green:

```
a select declared before its choices arrive, untouched   valid, submittable, nothing said
a select with options, holding a value not among them    "Value must be one of: A, B"
```

The case between them is a restored draft — a choice was saved, the form reopens, the options are
still in flight, and the value is measured against a list with nothing in it:

```
options: [], value "a"    invalid, correctly.   The message is:

    Value must be one of:
```

A sentence that ends at its colon. The person is told their choice is not on a list and shown no
list, and nothing on the page can tell them what would have been accepted.

Both controls are there because the two obvious repairs each break one of them: making an empty list
accept any value breaks the guard, and refusing an empty list at declaration breaks the select whose
choices arrive later. What is left is the sentence — name the list, or say instead that there is
nothing to choose from yet.

## Harness debt: what the generative campaigns can never generate

Not a finding about Modyra. A finding about **this suite's strongest evidence**, and it belongs in the
register because it changes what that evidence means.

Seven campaigns run green at **2000 runs across three fixed seeds — 42,000 runs**, every one
comparing the engine against an independently written reference model. What that sentence hides:

```
records campaign, 3000 sequences, 36,000 operations generated

record.upsert 27.4%   field.set 13.9%   mount 11.1%   record.remove 9.4%   unmount 8.2%
record.rename 6.3%    record.patch 6.1%  field.dirty 3.6%  field.disable 3.5%
field.touch 3.4%      record.setAll 2.8% reset 2.6%   field.enable 1.7%

never generated: submit  draft.save  draft.restore  destroy  async.resolve  async.reject
                 observe  flush  undo  redo  array.*
```

`generateOperation`'s menu has twenty entries and **no entry at all** for `submit`, `draft.save`,
`draft.restore`, `destroy`, `async.*`, `observe` or `flush`. No seed and no run count can produce
them. `undo`/`redo` appear only where a campaign passes `withHistory`, and `array.*` only in the
positional campaigns.

**What the 42,000 runs do cover, corrected after measuring rather than assumed.** The first reading of
this was that submission is untested by the campaigns, and that was wrong: the reference model
computes `submitted()` and every campaign compares it **after every operation** — roughly half a
million comparisons of what a submit would send. What is missing is the `submit()` *call* as a state
transition, and the draft, destroy and async transitions.

**Why it was not simply closed.** `draft.restore` is the one worth having — a restore rebuilds
structure, which is where several findings in this register live — and the interpreter refuses it by
design: `throw new Error("draft.restore requires a draft-aware context")`. Making a campaign
draft-aware means rebuilding the form from storage mid-sequence, which changes the shape of a run.
That is a real piece of work, not a menu entry, and doing it badly would produce green runs that mean
even less than these.

Adding `submit` to the menu was measured and rejected as near-worthless *here*: the records spec
declares no rules, so the form is always valid, and an accepted submit changes no state the campaign
compares. It would be worth having on a campaign whose spec has rules.

**What came out of measuring it** is `adversarial/submission/what-a-refused-submit-reveals.battle.test.mjs`
— green, holding behaviour nothing else asserted:

```
a refused submit    handler does not run, EVERY field becomes touched at every depth
                    including a collection cell, submitCount stays 0
an accepted submit  handler runs, NOTHING is touched, submitCount becomes 1
```

The first is why a refused submit explains itself instead of the button appearing to do nothing; the
second is why a successful one leaves the page alone. Neither was held anywhere.
