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

`browser/a-time-that-vanished.spec.ts` — **green, closed**, verified here. All four assertions pass,
including the correction guard added while the repair was in flight.

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

The two renderers do not agree about it. `a-refusal-in-two-renderers.spec.ts:158` runs the same
document through both: **lit renders all three, plain renders two.** So the rendering half is a plain
defect rather than a property of the contract, and a fix that only repairs plain leaves the other
half — the value `"pro"` naming two different options — standing in every renderer.

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

`browser/an-error-with-nowhere-to-go.spec.ts` — **green, closed**, verified here. Was 2 red, 1 green.
The contract gained the form's own error region, Plain and Angular render it, and Lit ships an element
the host places — which is the half this tier had to write itself.

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

`adversarial/validation/a-value-the-form-already-refused.battle.test.mjs` — **green, closed**,
verified here. Was 1 red, S2.
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

`adversarial/validation/a-section-nobody-took-out-of-play.battle.test.mjs` — **green, closed.** S1.

**Verified independently after the repair**, with `said=0` throughout, so the battle passes on the
effect and not on a report:

```
setDisabled("sect", signal)   inner.disabled=true   payload {"plain":"p"}                    section out
setInactive("sect", signal)   inner.disabled=true   payload {"plain":"p"}                    section out
setReadonly("sect", signal)   inner.readonly=true   payload {"plain":"p","sect":{"inner":"i"}}  section stays
```

The `readonly` row is the one worth naming: it must **not** leave the payload, because a field the
user may read but not change is still a field they answered. The assertion carries a per-method
expectation for that reason rather than one rule for all three.

**The assertion had to be rewritten first, and that was this battle's own defect.** It read
`said.length > 0` — whether the call *reported* something — which was written on the assumption the
capability would not be built. Once it was, the call went silent because it had nothing to report: it
had done the thing. A check that reads a report instead of an effect passes and fails for the wrong
reasons in both directions.
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

`browser/a-slider-that-shows-a-different-number.spec.ts` — **green, closed**, verified here, both
halves: the declared-bound one by the rule the bound now compiles, and the rest under finding 70. Was
4 green, 2 red, both renderers, UI-006 read as its mirror, S1.

**Closed half, verified:** a bound written beside the field now compiles the same rules as the same
bound written as a rule, so `slider max:50` holding `150` is invalid with "Maximum value is 50" and
the page no longer disagrees in silence. The green beside it holds too — a value *inside* the range
is still valid, checked at the boundary — which was the assertion a too-wide generated rule would
have broken.

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

## 69. A list of choices, printed the way JavaScript prints an object

`adversarial/validation/a-list-a-person-cannot-read.battle.test.mjs` — 3 green, 1 red. **S2.**
Sibling of 68: same sentence, the other way of failing it.

`oneOf` names the offered list in its refusal, which is right — somebody told their answer is not on a
list needs to see the list. An option is not always a string: a domain writes `{ id, label }`, the
value contracts allow it, and `oneOf` is named there as what decides membership. So:

```
oneOf(["one", "two"])              refusing "three"      "Value must be one of: one, two"
oneOf([{id:1,…}, {id:2,…}])        refusing {id:3,…}     "Value must be one of: [object Object], [object Object]"
```

The primitive list is the control: the sentence works, and what fails is the option that is not a
string.

**Bounded rather than excused, and asserted:** `oneOf(options, message)` takes the sentence a
consumer wants, and it is used — green in the battle, so a repair cannot remove it. What is filed is
the default, which is what ships and what somebody gets before they know there is a second argument.

The repair has a place to read from that the project already declares: `MdyControlOption` carries
`label` beside `value`, which is exactly the readable name this message wants.

Reached through the same door as the option-identity finding — a domain whose options are objects is
the ordinary case, not an exotic one.

**Also swept, and clean.** Every built-in validator's message under edge parameters:

```
required, minLength(0 / 1e6), maxLength(0), min/max(-0, ±Infinity, 1e21), integer, email, pattern
                                                    all produce whole, readable sentences
min(NaN), max(NaN), min/max(undefined)              never fire — a NaN bound cannot be exceeded
```

One near-miss recorded: calling `min("5")` directly returns `[null]`, which looked like a malformed
error entry. In a form it is `{ kind: "validation", message: "Minimum value is 5", path: "n" }` —
the bare call returns a pre-normalisation shape, and reading it as the public one is the probe's
error, not the engine's.


## 70. Two renderers inventing the same default, and a step with no rule to generate

`browser/a-slider-that-shows-a-different-number.spec.ts` — **green, closed.** All six rows pass in
both renderers, verified here after the repair. Was: the two rows of finding 67 that its repair did
not reach, S1, both renderers.

**Verified after the fix:**

```
plain: a value inside the slider's range is the number it shows          ✓
plain: a number field holds and shows the same value, and explains it    ✓
plain: a slider showing a number the form does not hold says so          ✓
lit:   the same three                                                    ✓
```

The repair puts the range decision in one shared place and lets the track widen where nobody declared
a bound — and keeps the declared-bound row narrow, because there a rule now explains the difference
and widening the track would make the `max` attribute promise less than the rule, which is the drift
VAL-004 exists to prevent. The step gives way to the value: an increment is a convenience, showing the
number the form holds is not.

```
slider, initialValue 150, NO bound declared    holds 150   shows 100   nothing said
slider, initialValue 7,   step 5               holds   7   shows   5   nothing said
```

**The first cause is a default nobody declared.** Measured in both renderers, each arriving at it
alone:

```
packages/plain/src/fields/text-field.ts        offered().max ?? 100
packages/lit/src/components/slider-field.ts    this.max ?? constraints.max ?? 100
```

Nothing can be generated here: the document declared no limit, so refusing `150` would assert a bound
nobody wrote. The contract does not say what range a slider without limits has, and two renderers
each answered `100` on their own. It is the shape of findings 34 and 56 — neither renderer is wrong
by itself, and the result is a drawn track showing a number the form does not hold.

The repair is a decision about defaults in the contract: either a default range accommodates the value
it is given — a slider cannot show a value outside its own track — or it says so.

**The second cause is that `step` has no rule to compile.** `min` and `max` beside a field now generate
validators; `step` does not, so a value off the step is valid, the track snaps to the nearest
multiple, and the two disagree with nothing said. Whether a step *should* constrain a value is a
contract question — a number off the step may be perfectly legitimate — but the current answer is the
one this campaign keeps refusing: neither enforced nor explained.

The battle's controls stay green under any repair: a value inside the range is the number shown, and
a `number` field with the same bound holds, shows and explains it.

## The Angular tier, widened — still the tier no CI job runs (finding 36)

`pnpm battle:angular` was three battles. It is now five, and the two new ones cost nothing: the
packed-consumer runner is memoised, so one `npm pack` + `npm install` answers every question the tier
asks instead of one install per battle.

What the two new ones ask, inside a **consumer installed from tarballs** rather than the workspace:

```
upsertValidators on a declared path            applied                    the control
upsertValidators on a name the schema lacks    refused, by name
addValidators on a name the schema lacks       refused, by name
setInitialValue on a name the schema lacks     refused, by name
canSubmit afterwards                           true                       no ghost blocked the form

setDisabled("sect") on the adapter's own group descriptor
  the field inside reports disabled            true
  what a submit would carry                    {"plain":"p"}              the section left it
```

Both are green. They are worth having anyway, and for a reason this campaign keeps meeting: the
Angular guide names `upsertValidators` as **how a component registers what it enforces**, and the name
it passes is a string somebody wrote. Findings 63–65 were about exactly that string reaching an
engine that used to swallow it. The engine refuses it now; nothing until here checked that an
*installed* Angular consumer meets the same refusal, and an adapter is the surface where a refusal can
be lost without anybody noticing.

The tier still runs in no CI job. Five green battles nobody runs are five green battles nobody runs —
finding 36 stands, and it is worth more now than when it was filed.

## Batch map: the eleven dynamic-contract reds are four causes

The node tier has 38 reds and eleven of them are `DYN-001`/`DYN-003`. Read as eleven findings they
look like a parser that is broken in eleven places. Read by their break messages they are **four
causes and four singletons**, which is the difference between eleven repairs and four.

Grouped from the messages themselves, not from the titles:

**A — the tree parser is silent where the flat parser reports. CLOSED, verified here** — all four
gone from the failing list, and the cause was one thing plus one: `parseDynamicFields` reports through
a diagnostic sink that the flat path installs and the tree walk ran outside of, so a leaf the parse
refused was dropped with nobody listening. The counter half had a different cause upstream — a schema
the validator refuses wholesale never reaches the walk, so there was nothing to count — and now
`accepted + rejected` is what the document *declared* rather than what survived.

The same defect written two ways used to get two different answers, and the tree — the shape a CMS
sends — was the quiet one:

```
a kind nobody declared          reported as a flat field list, silent as a v2 document
a select with no options        dropped from a v2 document with nothing said; reported when flat
a node kind nobody declared     three children parsed, 0 came back, 0 reported as rejected
strict mode                     approved a select document and kept none of its fields
```

The last is the sharpest: `ok: true`, `fields: []`, `diagnostics: []`. Strict mode approving a
document it emptied is the same silence one level up.

**B — a refusal blames a name that is correct. CLOSED, verified here** — two symptoms, one line:
`validLayoutNode` answered a bare `false` for every reason and the caller reported them all as
`MDY_DYNAMIC_UNKNOWN_FIELD_REFERENCE`. The documents refused are the same ones; what changed is what
they are told. `MDY_DYNAMIC_UNSUPPORTED_VERSION` was already in the published table and already fired
for an unknown version — it just never reached the case where the version is known and the construct
predates it, which is where an author needs it most.

Two constructs refused for the right reason used to report the wrong code:

```
a construct refused for its VERSION   reported as MDY_DYNAMIC_UNKNOWN_FIELD_REFERENCE,
                                      and every reference in it resolves
a layout refused for its DEPTH        the same code, and the field it names is declared
                                      in the same document
```

An author reading either goes looking for a misspelled field that is not misspelled.

**C — the parser is more permissive than the published schemas.** Three ways round, one direction:

```
an option whose value is an object    outside the published types; taken without a word
the envelope the prompt asks for      parses, and every published schema underlines it as wrong
an envelope version                   accepted by the parser, described by no published schema
```

The consequence is the same each time: an author's editor and their form disagree about the same
file, and the editor is the one that is right on paper.

**D — one value under two labels.** Two breaks, one cause:

```
a document offering one value twice   parses clean; the page shows one of the two
a value the form holds                names more than one option, so neither the control nor
                                      the submission can say which was chosen
```

**The four singletons**, which do not join a group and are listed so nobody assumes they are covered:
a validation reading `""` kept with no diagnostic and unable to fire; a path that is a condition in
one half of the format and not in the other; the author-time check disagreeing with the parser; a
rebuilt record that accepted a row and holds `{}`.

A note on reading this: the grouping is from the break messages, which name what was measured. It is a
map for sequencing repairs, not a claim that one fix closes each group — a shared symptom can still
have two sources, and the battles stay separate for that reason.

## Batch map: the browser reds are six groups

Same exercise on the other tier. 48 pass, 17 fail, and the seventeen are six groups — three of which
already have a finding number and three of which are the same finding seen from both renderers.

**A — what an accessibility auditor still has to say (5).** `every declared kind renders a form the
auditor has nothing to say about`, its `when it is required` variant, its `opened and filled` variant,
and the Lit twins. Findings 33 and 58 — the contract-level ones, since both renderers carry them.

**B — a popup only a mouse can open (2).** `every control that declares a popup opens it from the
keyboard`, in both renderers. Finding 35, and the fact that it is *both* is what places it in the
contract rather than in either renderer's markup.

**C — an option a person cannot choose (3).** `every option a document declares is one a person can
choose` in both renderers, plus `an option whose value has a space is pointed at properly too`.
Findings 48 and 49, whose repair I argued and the peer accepted: not an index — **do not derive the id
from the value at all**, and where a native element does the job it needs no id.

**D — a range that throws away what is typed into it (3).** Both halves of finding 66 plus the Lit
one. The peer's picker batch stops short of `daterange` by declaration, and the cause turned out not
to be the one that batch repaired: a *well-formed* date is discarded too, so the inputs are not wired
to the value.

**E — a mount that stopped halfway (2).** `a mount that refuses a field leaves nothing of the fields
it had already painted` and `the control a refused field left behind can still be referenced`. One
sequence, two consequences: a refused field mid-mount leaves the page holding what it had already
drawn.

**F — two singletons.** `a required field nobody has reached is not painted as failing` — finding 23,
the other half of 34's pair, an error where there is none. And `controls left on the page after the
form ended are not still offering to edit it`.

Both maps are for sequencing. A shared symptom can still have two sources, which is why the battles
stay separate whatever the map says.

## 71. The same form open twice, and the tab that finished first

`adversarial/persistence/a-draft-that-went-backwards.battle.test.mjs` — **green, closed**, verified
here. Was 2 green, 1 red, S1.
New claim **PER-004**: *a draft is not replaced by one saved before it.*

A draft key identifies the form, not the window it is in — which is what makes a draft survive a
reload. So **two tabs of one form share a key by design**, and that is the ordinary arrangement rather
than a misuse.

```
tab A saves            {"savedAt": …957878, "value":{"note":"A is writing something long"}}
another view saves     {"savedAt": …018229, "value":{"note":"B finished first"}}     newer
tab A saves again      {"savedAt": …958629, "value":{"note":"A is writing something long and…"}}

did A read before writing?   []      it did not
```

B's work is gone. What makes it more than last-write-wins is the third line: the stored stamp has gone
**backwards by 59 seconds**. The draft now in storage claims to be older than the one it replaced, so
the one field that could tell a later reader something is wrong tells them the opposite.

The engine owns this protocol — it defined the envelope, it writes `savedAt` on every save, and it is
the only thing that reads one. **A field written and never read promises a freshness it does not
check.** The security guide already states the threat model in these words: *a draft lives where every
script on the origin can write it.*

Either repair closes it: read before writing and refuse or report a stamp newer than the last one this
form wrote, or say in the draft contract that a key must be unique per view. What the battle refuses
is the third thing — a silent replacement that also falsifies the record of when it happened.

Two controls, green: the draft protocol saves what was typed, and the envelope carries a numeric
stamp — so there is something to compare against and the finding is the comparison never happening.

## Checked and clean: two forms sharing one initial-value object

Measured alongside, because aliasing between forms would be worse than either of the above:

```
two forms over a record whose row initial is the SAME object
  one.rows.r1.code.set("changed by one")
  one   {"rows":{"r1":{"code":"changed by one"}}}
  two   {"rows":{"r1":{"code":"start"}}}          untouched
  the shared object itself   {"code":"start"}     untouched
```

The engine copies. Neither form can reach the other's value, and neither mutates what it was handed.

## Checked and clean: a server's refusal when the form changes underneath it

A surface nobody had walked, and one that looks broken until the pieces are read together. A server
refuses `rows.a.code` with "already taken", and then the form changes:

```
right after the refusal        shown on the field, held in lastSubmitErrors, form invalid
rename a -> z                  shown on NEITHER z.code NOR a.code — the message does not migrate
                               onto a new identity and does not stick to a path that left
remove the row                 form valid and submittable again
remove, then a new row
with the same key              the new row does not inherit the refusal
the user edits the cell        the message stops being shown
```

Every visible behaviour is right, including the two this campaign has repeatedly found wrong
elsewhere: a message migrating onto a new identity, and one surviving on a path nobody renders.

**An asymmetry that turned out not to be one.** `lastSubmitErrors` is cleared by a later successful
submit when the entry is form-level (`path: null`) and not when it is field-level — which read like
one list with two rules. It is not: a field-level refusal makes the field invalid, so the second
submit is **refused locally** and never reaches the handler (`submitCount` stays 1). The form-level
one attaches to no field, leaves the form submittable, and a real second submit clears it. Two
different outcomes because two different things happened.

**One edge worth knowing, not filed.** `lastSubmitErrors` keeps a field-bound entry after the user
edits the field, and after the row it names has been removed — it is a record of the last submit, and
the name says so. A consumer rendering the whole list would show a message for a row that is gone on a
form that is fine. ADR 0062 already states which of them a form-level region renders — the ones with
`path: null` — so the engine's own answer is there; anything wider is a consumer's choice.

## Checked and clean: a binding still belongs to its row after the read-time verdict

The repair for finding 64 composes interactivity at read time rather than pushing it down at the call,
which touches every field of every form. ADR 0044 — *a binding belongs to the row* — is the property
most at risk from that, so it was re-measured across every identity change:

```
record: disable a.code, rename a -> z   z.code disabled, its value out of the payload   the binding followed
array:  disable [1], move 1 -> 2        the same row stays out, the others stay in
array:  disable [1], remove [0]         the disabled row is still the disabled one
record: disable, remove, re-create
        a row with the same key         the new row is NOT disabled — a reused key is a new row
```

All four hold. The last is the one worth naming: a claim does not attach itself to whatever arrives
later under the same name.


## 72. A Zod schema that describes no form, and the internal that reaches the consumer

`adversarial/schema-adapters/a-schema-that-is-not-an-object.battle.test.mjs` — **green, closed**,
verified here; closed by 73's repair rather than separately. Was 2 green, 1 red, S2 under API-001.

A form has named fields, so a schema that is not an object has no fields to name. `z.array(...)`,
`z.string()` and `z.tuple([...])` are all legitimate Zod schemas and none of them describes a form.
Refusing them is right. What arrives instead:

```
createZodForm(z.array(z.object({v: z.string()})))   TypeError: Cannot convert undefined or null to object
createZodForm(z.string())                           the same
createZodForm(z.tuple([z.string()]))                the same
```

It names no schema, no shape and no call, and the three different mistakes are indistinguishable from
each other and from a bug in the bridge. Same species as the `select` with no `options` reaching a
consumer as `Cannot read properties of undefined (reading 'map')`.

**The bridge's fallback is the control, and it is good** — this is not "unusual shapes break it". A
shape the engine has no structure for becomes one opaque leaf and Zod goes on validating it in full:

```
a union            {"k":"ok"} and {"j":3} accepted; {"nope":true}, "a string", 42 refused
a discriminated
union              {t:"a",x:"ok"} accepted; {t:"a",x:3} → "expected string";
                   {t:"c"} → "Invalid discriminator value. Expected 'a'…"
```

Also swept and clean: every Zod message reaches the field readably — an author's own message, Zod's
default, a refinement with and without a message, a nested path, and an enum's generated sentence.

**How this battle first passed for the wrong reason.** The check looked for the words `schema`,
`object` or `form` in the error text as evidence of a real refusal — and *"Cannot convert undefined or
null to object"* contains "object". It now reads the error's **kind**: a raw `TypeError` is not
something this library throws on purpose. A check for a word is a check a string can satisfy by
accident.

## Recorded, not filed: a disabled row moves the rows after it

`adversarial/submission/a-row-that-moves-because-another-left.battle.test.mjs` — green, and written to
record rather than to object.

```
positional, first row disabled    {"list":[{"tag":"second"},{"tag":"third"}]}   the rest moved up
keyed, first row disabled         {"rows":{"b":…,"c":…}}                        the rest are where they were
```

It is the only thing the engine could do — an array cannot carry a hole, and a `null` in the gap would
put a value in the payload nobody entered. But it is the one interactivity change that alters the
*meaning of a position* rather than only the set of values, and the keyed collection has no
equivalent. Written down because it is discovered in production by somebody correlating by index, and
because a change to it would change what a payload means without any type moving.

## 73. The first door a consumer touches

`adversarial/validation/the-first-door-a-consumer-touches.battle.test.mjs` — **green, closed**,
verified here. Was 1 green, 1 red, S2; finding 72 is its Zod-shaped instance and closed with it.

ADR 0057 is called *an argument is refused where it arrives*, and it hardened seven entry points for a
reason it states plainly: a value that cannot be used should be refused at the call rather than left
to damage the form and fail later. **Every one of those seven is a setter.** The doors that take a
schema were not among them, and they are the first door a consumer touches.

Three doors × six things that are not a schema — **sixteen internals, two silent builds, zero named
refusals**:

```
createForm             array / string / null / undefined   TypeError: Cannot convert undefined or null to object
                       42 / true                           BUILT — a form with no fields, canSubmit true
buildFlatFormSchema    array / string                      TypeError: Cannot read properties of undefined (reading 'length')
                       42 / null / undefined / true        TypeError: fields is not iterable
buildDynamicFormSchema  array / string / 42 / true          TypeError: Cannot convert undefined or null to object
                       null / undefined                    TypeError: Cannot read properties of … (reading 'children')
```

**The two silent builds are the worse half**, and they are the case ADR 0057's own reasoning is
about: `createForm(42)` returns a form with no fields that reports itself valid and submittable. A
form that cannot be read is worse in production than a thrown error the caller can see — those are
the record's words about a different door.

The internals are the same species as 72 and as the `select` with no `options`: three different
mistakes answered by one sentence that names no argument, so a consumer cannot tell them apart, or
tell any of them from a bug in the library.

The control is green: a real schema builds a real form through the same door, so what is asserted is
the argument rather than the doors being shut.

Either repair closes it, and the two halves may want different ones: refuse by name, or — for the
values that currently build — say why nothing was built.

## 74. Four ways to turn the sanitiser off by accident

`adversarial/security/four-ways-to-turn-it-off-by-accident.battle.test.mjs` — **green, closed**,
verified here. Was 2 green, 1 red, S2 under API-001, with the security consequence noted below.

```
createForm({ a: field("") }, { security: "strict" })
  → [modyra] security takes a policy object, received a string: { sanitize, maxValueLength, onViolation }
```

**The battle had to be corrected before it could see the repair.** Its helper read only the built
path, so a refusal at the call — one of the two repairs the battle explicitly admits — arrived as a
throw that killed it. Reading only the outcome you expected turns a repair into a crash in the test
that asked for it. Same class as finding 64's assertion reading a report instead of an effect.

The sanitiser is an option, its profile is a closed set — `"off" | "text" | "strict"` or a function —
and **off is the default**, deliberately: a form library that rewrote values uninvited would be worse
than one that does not. That default is what makes every way of getting the option wrong
indistinguishable from asking for nothing.

Four spellings a consumer plausibly writes, all with `devWarnings: true`:

```
{ security: { sanitize: "strict" } }   correct — the value is sanitised          the control
{ security: "strict" }                 markup kept, nothing said
{ sanitize: "strict" }                 markup kept, nothing said
{ security: { sanitise: "strict" } }   markup kept, nothing said       the en-GB spelling
{ security: { sanitize: "stict" } }    markup kept, nothing said       a typo in the value
no options at all                      markup kept, nothing said       correct: off is the default
```

**The last is the sharpest.** The key was read. Its value is outside a **closed vocabulary**. And the
answer is the least protective member of that vocabulary rather than "there is no sanitiser by that
name". An unknown key can be argued about; an unknown member of a closed set falling back to `off`
cannot.

**On the classification.** The battle first came out S0 by citing SEC-003 — *a sanitized value cannot
form markup, wherever it entered the form* — and that is not what happened: the value was never
sanitised, because the option never took. The engine did exactly what it was configured to do. The
defect is that it did not say the configuration was wrong, which is API-001. Filed there rather than
inflating a security claim the engine did not break. What a reader should weigh is that this is the
one member of the API-001 family whose silence has a security consequence: a consumer who wrote any of
the four believes their form sanitises.

Both controls are green, and the second is a boundary on the repair: **no option means no sanitising,
on purpose**, so a fix cannot be "sanitise by default" — that is a larger change than this asks for.

Measured in the same pass and not filed separately: `{ draft: { key: "k" } }` with no `storage` also
builds and says nothing, and nothing is ever saved. Same shape, smaller consequence.

**The per-field door was checked separately and the repair reached it too**, with a message that names
the closed set rather than only the mistake:

```
field("", [], { sanitize: "stict" })   [modyra] There is no sanitizer called "stict". Name one of off, text, …
field("", [], { sanitize: 42 })        the same
```

It is now a row of the same battle, so a repair that reached only the form-level option would show as
red rather than as nothing.

## 75. An operator nobody declared, and the section it opens

`adversarial/security/an-operator-nobody-declared.battle.test.mjs` — 2 battles, 1 red each.
**S1** under DYN-003/VAL-003 for the first, **S0** under DYN-003/SEC-004 for the second.

`MdyExpressionOp` is a closed set of twelve. Two published functions read it, and they do not agree
about a thirteenth:

```
validateExpression({ op: "eqals", … }, "when")   →  ["when: unknown operator \"eqals\""]
evaluateExpression({ op: "eqals", … }, value)    →  true
```

One refuses it by name. The other answers — and answers **`true`**, which for a visibility condition
is the most consequential answer available. Measured through a group gated on the condition:

```
op "equals",  country IT    {"country":"IT"}                              closed, correct
op "equals",  country FR    {"country":"FR","extra":{"vat":"secret"}}     open, correct
op "eqals",   country IT    {"country":"IT","extra":{"vat":"secret"}}     OPEN
op "nonsense" / ""          the same
```

A section meant to appear only for one country is shown to everybody, and the value inside it is in
what the form sends. For a *validation* expression the same answer means a rule that always passes.

This is the asymmetry the expression depth limit already has — checked where a document is read,
unguarded where a value is evaluated — except that here the unguarded side does not merely fail to
protect: **it decides.**

Both controls are green and both are needed: spelled correctly the condition closes the section when
it is false and opens it when it is true, so the finding is the misspelling rather than a gate that
never works or always does.

Either repair closes it: refuse the operator where it is evaluated too, or answer the way a condition
nobody can read should answer — closed.

**The second half is worse: a condition that cannot be read at all takes the submit with it.**

```
matches with a pattern that does not compile   submit() throws  Invalid regular expression: /[/
an expression that is null                     submit() throws  Cannot read properties of null
a well-formed condition                        submits          the control, green
```

The form builds, holds its value, and then the button the person pressed raises a raw JavaScript error
out of the library. Both are refused by `validateExpression` where a document is read, and both escape
where the value is evaluated — which for a `when` is during a submit.

**The whole pattern, swept.** Every malformation `validateExpression` refuses, `evaluateExpression`
either answers `true` or throws. Not one of them produces the careful answer:

```
equals with no operands / operands missing   refused    →  true
and with no operands                         refused    →  true
not with no operand                          refused    →  true
a plain string as the expression             refused    →  true
matches with an uncompilable pattern         refused    →  throws
a null expression                            refused    →  throws
```

Correct and left alone, measured in the same pass: `equals` with one operand answers `false`,
`greaterThan` between text and a number answers `false`, `or` with no operands answers `false`,
`isEmpty` on a path nobody declared answers `true` because an absent path is empty.

## Checked, and one of them widens 74: two more closed vocabularies

Swept after 74, since a closed set falling back to a member is the shape:

```
MdySanitizeProfile per FIELD   field("", [], { sanitize: "stict" })    falls back to "off", silently
                               field("", [], { sanitize: 42 })         the same
MdySubmitMode                  "alwyas" / "nonsense" / 42              falls back to valid-only, silently
```

The per-field sanitiser is **finding 74 one level down** and the repair should reach both. `submitMode`
is the same silence with the opposite consequence: the fallback is the *more* careful member — a form
that will not submit — so a consumer who misspells it sees a Submit that refuses rather than a
protection that is off. Recorded rather than filed on its own.

## 76. The other door a pattern comes through

`adversarial/security/the-other-door-a-pattern-comes-through.battle.test.mjs` — 4 green, 1 red.
**S0** under SEC-004: *a document cannot make the form stop answering.*

ADR 0050 put a cost check on patterns arriving in a document's `validators.pattern`, and it works. A
pattern arrives through a **second** door: `matches` is one of the twelve expression operators and its
right-hand operand is a pattern string, so every `when` on a section and every condition on a field
can carry one. That door has no cost check.

Measured side by side, same pattern, same input — thirty `a`s and a `!`, which is something a person
could type:

```
buildDynamicValidators({ pattern: "(a+)+$" })   answered in 13 ms      ADR 0050's guard
evaluateExpression matches "^a+$"               answered in 0 ms       the door works
evaluateExpression matches "(a+)+$"             KILLED at 1000 ms      still running
                        "^(a|a)*$", "^(a*)*$"   the same
```

And the author-time half says nothing:

```
validateExpression({ op: "matches", operands: [{ path: "v" }, "(a+)+$"] }, "when")   →  []
```

Accepted, with no diagnostic, by the same function that refuses a misspelled operator by name.

**A `when` is read whenever the form is read.** So a document carrying one condition of this shape
does not make a slow form — it makes a form that stops answering between one keystroke and the next.

Both doors are in the battle rather than one, because the finding *is* the difference between them:
the guarded door answering in milliseconds is what makes the other one a gap rather than an absence.
The ordinary pattern through the same expression door is the second control, so what is asserted is
the cost and not `matches` being unusable.

Measured in a child process under a budget, as `document-patterns` does — a pattern that does not
terminate cannot be timed from inside the process it is hanging.

Sibling of 75: the same two functions, the same closed vocabulary, and the same shape of gap — what
the author-time check knows is not what the evaluator enforces.

**Closed, verified here.** `evaluateExpression` now passes through the same gate `validateExpression`
uses: `matches "(a+)+$"` against thirty `a`s answers `false` in 0 ms where it used to be killed at
1000, the ordinary pattern still answers, and the author-time check now reports the cost it used to
accept in silence.

## 75 again: two classes the repair did not reach — **both closed**, verified here

Verified after the repair. The unknown **operator** is closed — `"eqals"` answers `false` and the
section stays shut — and a plain string as the expression now answers `false` too. Two classes remain,
and both are the same principle unapplied:

**Arity.** An operator can be one of the twelve and the expression still be unreadable:

```
equals with no operands / operands missing   validateExpression refuses  →  evaluate answers TRUE, section opens
and with no operands                         the same
not with no operand                          the same
```

**Expressions that cannot be read at all still throw, and the throw comes out of `submit()`:**

```
matches with a pattern that does not compile   submit() throws  Invalid regular expression: /[/
an expression that is null                     submit() throws  Cannot read properties of null
```

The second is the one the repair's own reasoning argues against: *a condition is evaluated on every
read, so throwing turns a document defect into a form that does not render.* That is why the repair
answers `false` for an unknown operator rather than raising — and these two shapes still raise.

Both classes are now rows of the battle rather than sentences in a message, so a repair that reaches
only one of them shows as red rather than as nothing.

**Closed, verified here.** Every shape above now answers `false`, and the four well-formed controls
still answer `true`. The arity is declared beside each operator rather than inferred, so an expression
that is too short is unreadable even when the operator is spelled correctly.

**And an existing battle stopped the repair from going too far** — the first time this campaign has
worked in that direction rather than a repair falsifying an assertion. The same fix uniformly applied
"unreadable does not open" to the **depth cap** as well, and
`security/expression-paths.battle.test.mjs` refused it: *the depth limit refuses a document and does
not decide what a caller may evaluate.* A cap on how deep a **document** may nest is not a statement
about an expression a caller built in code, which is still readable however deep it is. Restored, and
the exclusion is now a written clause in the record rather than something the next reader would have
to rediscover.


## Checked and clean: every door into a value is a door the security policy is told about

`adversarial/security/every-door-the-policy-stands-at.battle.test.mjs` — green, and kept.

`onViolation` is the only channel a security policy has: a consumer wiring it to their telemetry
learns that a value arrived over the limit and was cut. What that channel is worth depends entirely on
how many doors it stands at — a policy that hears about a `set` and not about a restored draft reports
a clean origin while the hostile one goes past it.

Eight doors, `maxValueLength: 10`, a fifty-character value:

```
field.set · patch · setValue · a cell of a row · upsert a new row · patch a row ·
setInitialValue then reset                        one violation each, value cut to 10
a draft somebody rewrote in storage               one violation, value cut to 10
a value within the limit                          no violation, value untouched
```

Complete, including the door the security guide names as the threat model in those words. Written as a
battle rather than a note because a ninth door added later would pass every other test in this suite
while being invisible to the policy, and because nothing else asserts that the channel is **complete**
rather than merely present.

## Checked and clean: the exports nothing had ever imported

Applying the rule that has produced most of this register — *measure what is not in the list* — to the
export surface itself. Seven names in `@modyra/core` appeared in no battle:

```
MDY_FIELD_KINDS  MdyFormEngine  MdyTypedFormBase  MdyUnsupportedCapabilityError
NO_CONSTRAINTS   registerHandleForm  withFacts
```

Most are low-level seams reached through something else. Two are now held directly, in
`adversarial/validation/two-lists-that-must-agree.battle.test.mjs`, green:

**Five lists of seventeen that must be the same seventeen, across two packages.** `MDY_FIELD_KINDS`
says what a field may be; `MDY_VALUE_CONTRACTS` says what a value of each kind may hold; and in
`@modyra/widgets`, `MDY_WIDGET_KINDS` plus three per-kind tables — `MDY_WIDGET_KEYBOARD`,
`MDY_WIDGET_RELATIONS`, `MDY_WIDGET_TRANSITIONS` — each answer for one kind at a time. All five carry
the same seventeen, with no orphan in either direction.

A kind added to core and not to the widget tables ships a control whose keyboard, whose relations and
whose transitions **nobody declared** — and a conformance suite cannot check what is not declared. The
guard crosses the package boundary on purpose: both lists are published, and the point is that a
reader on either side cannot see the other one drift.

The original pair, still the sharpest of the five: Every part of the engine assumes
they agree — a kind with no value contract has no shape to check against, a value contract naming no
kind is a rule nothing can reach — and **nothing checked it**. They are a `const` array and an object
literal, not two views of one source, so a kind added to one and not the other is a defect the type
system does not see. Measured: 17 and 17, no orphan either way.

**`withFacts` carries what it was given and does not change what the rule decides.** It is the only
way a hand-written rule reaches a native constraint, so what it declares is what a control promises
the browser.

**Two measurements taken alongside and deliberately not filed:**

- `withFacts(() => [], { minLength: 99, required: true })` produces a field that is valid while empty
  and projects `minlength="99"` and `required` to the browser. A validator declaring what it does not
  enforce is a consumer stating something untrue about their own function, and the engine cannot check
  a function's behaviour. VAL-004 guards the other direction — a constraint promising *less* than the
  rule — and this promises more.
- Through the **document** path the parser filters the same nonsense before it renders:
  `validators: { minLength: "three" }` and `{ pattern: "[" }` produce no attribute at all;
  `{ minLength: -5 }` renders `minlength="-5"`, which browsers ignore. So the door that takes data
  from outside is the one that checks, which is the right way round.

## Checked and clean: the widgets contract's untouched half

`@modyra/widgets` exports 181 names and **124 appear in no battle by name**. Most are reached through
the renderers — a class helper or an ARIA projection is exercised whenever a control is rendered — but
the pure decision functions are not: they have no state to set up, which is exactly what makes a
regression in one cheap to introduce and invisible.

Two are now held in `adversarial/widgets/a-day-that-does-not-exist-next-month.battle.test.mjs`, green,
and both get the hard case right:

**`calendarKeyboardTarget`.** Its contract states *month/year jumps clamp the day (Jan 31 → Feb 28)*,
and the interesting half is what it does not do:

```
Jan 31 2026 → PageDown       Feb 28 2026     the documented clamp
Jan 31 2024 → PageDown       Feb 29 2024     NOT over-clamped in a leap year
Feb 29 2024 → PageDown+shift Feb 28 2025     a leap day jumped a year lands where there is room
Feb 29 2024 → PageUp+shift   Feb 28 2023     and backwards too
May 31 → PageDown            Jun 30
Dec 31 → ArrowRight          Jan 1 next year
Jan 1 → ArrowUp (a week)     Dec 25 previous year
Home / End                   the first / last of the month
Tab                          null — a key it does not use moves nothing
```

**`messagesForLocale`.** Five locales ship. What matters is not a wrong translation but a **missing
key**: a table is read by key and a missing one renders as nothing. All five carry all 42, none blank,
and an unsupported locale answers with the **complete** English table rather than a partial one —
falling back key by key would leave one English word in the middle of a sentence.

Three strings are identical to English across locales and were checked rather than counted as
untranslated: `"OK"` is `"OK"` in all five, and `"Minute"` is the German and French word.

**`nativeConstraintAttributes`**, added to the same file. It decides what a rule may say to the
browser, per kind, and its contract states the reason: *a `maxlength` on a number input is ignored by
the platform, and offering it would be a promise the widget does not keep.* Seventeen kinds, one
answer each, and nothing asserted any of them:

```
text / email / password   minlength maxlength pattern inputmode
textarea                  minlength maxlength inputmode          — no pattern: <textarea> has none
number / slider           min max step                           — not minlength/maxlength/pattern
the other eleven kinds    nothing                                — their value is not what a native input holds
a kind nobody declared    nothing                                — no attribute invented for an unknown control
```

The `textarea` row is the contract's own example, and it holds. Checked in both renderers as well:
the function returns `pattern: null` there rather than omitting the key, and neither renderer writes
`pattern="null"` into the markup.

**One measurement recorded without filing.** `listboxNextIndex(key, activeIndex, optionCount)` clamps
correctly at both ends and answers `null` for keys it does not handle and for an empty list. Given an
active index *past* the end — `listboxNextIndex("ArrowUp", 9, 3)` — it answers `8`, still out of
range, where `ArrowDown` from the same state clamps to `2`. Whether a controller can hold an active
index that outlived its option list was not established: two attempts to reach it through the
multiselect failed on this tier's own selectors, since that listbox renders into an overlay portal
outside the field's host. Recorded so the next reader of that function has the measurement, not filed
as a finding without a path to it.

## A gap in the instruments, closed: generated sequences across every runtime

`differential/runtimes/generated-on-every-runtime.test.mjs` — green, and new.

The two strongest tools in this suite had never been crossed:

```
the generative campaigns   thousands of sequences   against an independent model   on ONE runtime
every-runtime              six published adapters   against each other             on ONE sequence
```

That sequence is twelve operations written by hand. A divergence belonging to a *runtime* that those
twelve do not reach had never been looked for — and a reactivity is a scheduling decision as much as
a data structure: when a computation re-runs, what it re-reads, whether a batch collapses two writes.

This drives **generated** sequences across all six. The property is narrower than the campaigns' and
different: not "the engine is right", which is their job against a model, but **whatever the engine
means, every runtime means the same thing**, for a sequence nobody chose. Vanilla is the baseline
because the campaigns already hold it against a model, so a difference reported here belongs to a
runtime rather than to the engine.

```
240 generated sequences × 6 runtimes across three fixed seeds — 1,440 drives, no divergence
```

**Widened to history**, which is where a reactivity is asked to re-run the most at once and where two
schedulers are most likely to differ. The generator's own histogram over 120 sequences confirms the
widening is real rather than nominal:

```
record.upsert 25.3%  field.set 13.9%  mount 10.9%  unmount 8.8%  record.remove 8.5%
record.patch 5.5%  record.rename 5.4%  UNDO 4.6%  record.setAll 3.1%  field.touch 2.8%
reset 2.5%  field.disable 2.5%  field.dirty 2.2%  REDO 2.2%  field.enable 1.8%
```

Green there too. Checking the histogram rather than trusting the flag is the same discipline the draft
campaigns needed: a `withHistory` that drew no undo would have widened nothing while reading as if it
had.

Two controls, because a green cross-product can mean nothing:

- **every adapter is the one it claims to be** (`reactivity.kind === name`). A runtime that quietly
  resolved to the framework-agnostic fallback would agree with vanilla for a reason that is not
  agreement — which is exactly what happened to Solid once and is written into `every-runtime`'s
  header;
- **the sequences built something**: six runtimes agreeing about an empty collection is six runtimes
  agreeing about nothing.

**One exclusion, and it is this harness's rather than the product's.** Every context in one battle
shares the console capture, so a later runtime's snapshot carries the diagnostics of the ones before
it — comparing them would report the order they ran in. Found by the first red this file produced,
which pointed at `diagnostics[16]`.

## 77. A batch that ended at the first await

`adversarial/persistence/a-batch-that-ended-at-the-first-await.battle.test.mjs` — **green, closed**,
verified here. Was 4 green, 1 red, S1. The check sits after the callback returns rather than in a
`catch`, which is the shape the finding needed: an async function that throws after an `await` does
not throw toward its caller at all — it returns a rejected promise — so a `catch` would never see it,
and that is the same reason the defect is invisible to whoever writes it.

`mutate` exists for one promise, stated in the feature tour's own comment: `form.mutate(() => { … })`
gives *one history entry, not three*, so an undo returns to where the batch started.

It keeps that promise under every shape a batch can take, and each is asserted so a repair cannot lose
one:

```
three writes in one mutate      1 undo step        the promise
the same three, unbatched       3 undo steps       the control that makes 1 mean something
a nested mutate                 1 undo step        the inner collapses into the outer
a callback that throws          the write before the throw is kept, its batch closed
a callback that changes nothing 0 steps            no empty entry
```

The shape it does not keep it under is a callback that **waits**:

```
mutate(async () => { set a; await …; set b; await …; set c })    3 undo steps, nothing said
```

`mutate(fn: () => void)` is typed as synchronous and **TypeScript does not stop this**: a function
returning `Promise<void>` is assignable where `void` is expected — the rule that makes callbacks
ergonomic, and here a footgun. The batch closes when the synchronous part returns, so every write
after the first `await` lands outside it, and the caller gets exactly the history `mutate` exists to
prevent.

The engine can tell the difference: a callback that returns a thenable is one that has not finished.
Either repair closes it — refuse it where it arrives, or say that the batch ended before the callback
did. What the battle refuses is neither.

Same family as 60–65 and 73–75: a published call that cannot do what it was asked, not saying so. It
is the first one where what the caller loses is not a value or a section but **the thing they called
the method for**.

## 78. The same mistake, through two doors to one check

`adversarial/validation/two-doors-to-one-check.battle.test.mjs` — 2 green, 1 red.
Tagged **API-001 + VAL-001**, which makes the battle read S0; the honest severity is **S1** — the
consequence is a page that does not render, not a payload that is wrong.

A field can be given an asynchronous check two ways, and they reach the same runner:
`serverValidator()`, which the guides lead with, and `asyncValidators` on `field()`'s options, offered
in those words — *still available if you'd rather write the validator function directly*.

The documented failure is handled on both: *a rejected promise becomes an `"async"` error with the
rejection message*. What is not documented, and not the same, is a check that throws **synchronously**
— a property read on something undefined before the first `await`, which is the ordinary shape of a
bug in a consumer's own service call:

```
asyncValidators, a promise that rejects    the field carries "service is down"          as documented
serverValidator, a SYNCHRONOUS throw       the field carries the message                the working door
asyncValidators, a SYNCHRONOUS throw       createForm THROWS — the form never exists
```

So one field's buggy check stops the page rendering, and the same bug one call away is a message under
the field.

**The working door is the control and the shape to copy**: the mechanism already does the right thing
with this, which is what makes it a gap rather than a decision.

Measured alongside, all through `asyncValidators`, and all coherent — so the finding is the throw and
not the door being fragile: a promise resolving to a list of errors is carried; a check returning a
bare string is read as one message; a check returning nothing leaves the field valid.

## Checked and clean: the draft storage a phone has

`adversarial/persistence/a-store-that-cannot-answer-at-once.battle.test.mjs` — 3 battles, green, and
new. `@modyra/core/async-draft-storage` had **no battle at all**, and it is the path an application on
a phone takes: `MdyDraftStorage` is synchronous by design and React Native's storage is
Promise-based, so the two meet through this cache.

Its record states two things the shape does not make obvious, and both hold:

```
a read before hydration finishes        null — "no draft", never something a form would restore
                                        as the user's; after `ready`, the stored draft is there
a key outside the hydration list        null — a key/value store cannot be enumerated portably,
                                        so hydration reads what it is told to

a store that cannot be READ             `ready` does not reject, the cache is empty,
                                        onError is told
a store that cannot be WRITTEN          `write` does not throw, the value stays readable in the
                                        cache, onError is told, nothing reached the backend
the same with no onError                silent, and the draft still survives
a form, end to end                      writes through the cache, and gets its draft back
                                        through a second one after `ready`
```

The unwritable case is the one worth naming: the user keeps typing and their draft survives in memory
even though the device's storage refused it, and the form never learns. That is the documented
bargain — *the same one the default `localStorage` storage already makes with quota errors* — and it
is now held rather than assumed.

## Checked and clean: the truth table for whether a field is in play

`adversarial/validation/one-answer-however-many-are-asking.battle.test.mjs` — green, and new.

The conditions subsystem states its rule in a sentence: *the signal a field's interactivity reads is
true while **any** condition refuses it — one signal per field however many conditions there are, so a
field's activity is one question with one answer, not a stack of overrides where the last writer
wins.*

That is a truth table, and almost every test in this suite exercises **one row of it**: a single
condition, on one node. A refactor turning "any refuses" into "the innermost decides" or "the last one
set wins" would pass all of them, because with one condition every rule agrees.

The rows that tell them apart:

```
section  field    kept
true     true     yes
true     false    no
false    true     no        ← the row "the innermost decides" would get wrong
false    false    no

three levels, any one of the three saying no        the leaf is out
three levels, all three saying yes                  the leaf is in     the control

a schema `when` allowing + a runtime setInactive refusing     the section is out
```

The last row is the one worth naming: a `when` written in the schema and a `setInactive` called at
runtime are **different mechanisms**, and "one answer" is a claim about them together. It also
cross-checks finding 64's repair — the imperative refusal composes with the declarative one rather
than replacing it or being replaced.

**And the whole life of a conditional required field**, added as a second battle in the same file,
because each step is a different claim and only the first is the one people test:

```
closed, empty        the form is VALID and sends, without the section        VAL-003 in its own words
opened, empty        invalid, cannot be sent, the field says it is required
answered            valid, sends, the section is in what it sends
closed again        the section is not sent — and the answer inside it is STILL HELD,
                    so reopening finds what was there
```

The last row is two claims at once: what a closed section keeps, and what it does not send. Losing
either would be quiet — a value silently dropped on close, or one silently sent when nobody was asked
for it.

## Checked and clean: the arithmetic a calendar runs on

`adversarial/validation/the-arithmetic-a-calendar-runs-on.battle.test.mjs` — green, and new.
`@modyra/core/datetime` publishes **35 functions and two battles imported from it**.

Two traps, both avoided:

**The platform's.** `new Date(2026, 1, 31)` is the 3rd of March — JavaScript rolls an impossible day
forward instead of refusing it — so a naive `addMonths` turns "the 31st of January, a month later"
into March. No test of a single month catches it:

```
Jan 31 + 1 month          Feb 28 2026          not Mar 3
the same in a leap year   Feb 29 2024          not over-clamped either
Jan 31 + 13 months        Feb 28 2027          multi-month, still clamped
Feb 29 + 1 year           Feb 28 2025
Feb 29 + 4 years          Feb 29 2028          lands on another leap year
Mar 1 − 1 day, leap       Feb 29 2024
Mar 1 − 1 day, ordinary   Feb 28 2026
Jan 1 − 1 day             Dec 31 2025
```

**The Gregorian rule in full.** A year divisible by four is a leap year unless divisible by a hundred,
unless divisible by four hundred:

```
2026-02   28      2024-02   29      2000-02   29      1900-02   28
```

The last two are what tells a complete implementation from one that stops at the first clause, and
both are right.

**The clock dial**, added to the same file. A dial is a circular mapping and the wrap is the trap:
the top of a twelve-hour dial is **twelve, not zero**, and an implementation that divides an angle by
thirty gets zero there and is right everywhere else — so a round trip through the middle of the dial
proves nothing.

```
hour 12 ↔ 0°   1 ↔ 30°   3 ↔ 90°   6 ↔ 180°   9 ↔ 270°   11 ↔ 330°
minute 0 ↔ 0°  15 ↔ 90°  30 ↔ 180°  45 ↔ 270°  59 ↔ 354°

what a finger produces, none of it an error to report:
  0° → 12    360° → 12    359° → 12    1° → 12    −30° → 11    720° → 12
  0° → 0m    360° → 0m    −6° → 59m    720° → 0m
```

A drag does not stop at the top: it goes past it, round more than once, and backwards. All of them
land where the dial shows them.

**One lax answer, not filed.** `daysInMonth(2026, 0)` and `daysInMonth(2026, 13)` both answer `31`
rather than refusing a month that does not exist. Nothing reachable from a calendar produces a month
outside 1–12, and the callers all derive it from a real date — recorded rather than filed for want of
a path to it.

## Checked and clean: what the rest of the form remembers about a policy's work

`adversarial/security/what-the-rest-of-the-form-remembers.battle.test.mjs` — 2 battles, green, new.

Sanitising and truncating are transformations: the value the user typed is not the value the form
keeps. **Three things remember values for later** — history, drafts and the change set — and each is a
separate answer to *which* value it remembers. Getting any of them wrong undoes the policy quietly:

```
undo after a sanitised write      brings back the sanitised value, not the markup
undo after a truncated write      brings back ten characters, not forty
the draft on disk                 carries the sanitised value; reopening restores that
a write the policy cut back to
exactly the initial               getChanges() {} and dirty false — no change to report
a write the policy cut to
something new                     getChanges() reports it            the control
```

Each is a composition of two features that are correct on their own, which is where this campaign's
sharper findings have come from — 61 was `setValue` meeting the return-to-initial rule, 71 was a draft
key meeting `savedAt`, 77 was `mutate` meeting an async callback. These three are the same shape and
they hold; holding them is what keeps them true while both halves keep moving.

The change-set edge is the one worth naming: what the user typed is not the question a change set
answers. A write the policy turns back into the initial is not a change, however much was typed.

## 79. A field a document declared without a label, and the control nobody can name

`browser/a-control-nobody-named.spec.ts` — 2 green, 1 red. **S1**, accessibility.

**A label is optional in the contract**, measured rather than assumed: `parseDynamicForm` accepts a
field with no `label` key, with an empty one and with a whitespace one, in **both lenient and strict
mode**, for every kind — including `daterange` and `select`. Only `label: null` is refused, and for
its type rather than its absence.

The widgets contract says something else about the result. `MDY_SEMANTICS_REQUIRING_NAME` is a
published list of the roles that must carry an accessible name — `listbox`, `dialog`, `grid`. A
`daterange` with no label renders `role="grid"` with neither `aria-label` nor `aria-labelledby`. A
text field renders an input with no `aria-label`, no `aria-labelledby`, and a `<label for>` element
that is **empty**.

So the two halves of the contract disagree about the same field, and the renderer resolves it by
producing a control a screen reader announces as its role and nothing else.

**Nine of the fifteen are closed**, verified here: text, email, password, textarea, number, slider,
checkbox, toggle, select. `fieldAccessibleName({ariaLabel, label, name})` puts the order in one place
so the renderers do not each invent it — which is the cause 34 and 56 both had.

**Six remain, and all six are composite controls**: `radio`, `segmented`, `datepicker`, `daterange`,
`timepicker`, `file`. The reason is the same for each — the name belongs on the element a person
operates, and there it is not the one the shared insert receives: a radiogroup has a container with a
role, a daterange has *two* inputs, a file has a button beside a hidden input. Which part carries the
name is a per-kind decision, and belongs in the contract rather than in a shared line.

**And the auditor now catches one of the six.** axe reports `label` on `file` and says nothing about
the other five, whose unnamed part is a **role** rather than an input. The third test was rewritten
for that and is written to expire: when the last composite kind is named it fails, and the right
response then is to delete it rather than repair it.

Originally, **fifteen of the seventeen kinds** had at least one part with no accessible name when the
label was omitted: text, email, password, textarea, number, slider, checkbox, toggle, select, radio, segmented,
datepicker, daterange, timepicker, file. The two that hold are `multiselect` and `colors` — and
`colors` only because its swatch listbox carries a static `"Presets"` that has nothing to do with the
field.

**And an auditor does not see all of it**, which is why the check is written by hand and asserted as
its own test:

```
text with no label        axe: label(critical)         caught
select with no label      axe: button-name(critical)   caught
checkbox with no label    axe: label(critical)         caught
daterange with no label   axe: nothing                 role="grid" with no name
```

A role with no name is not a rule axe runs here, and it is the one the widgets contract names
explicitly. The third test asserts both halves of that, so "axe is green" can never be read as "every
control has a name" — and so it fails if axe ever starts catching it.

Either repair closes it: require a label where a document is read, or give a control the field's own
name when nobody wrote one.

**A probe artefact worth recording**, because it nearly reversed the finding. A first measurement had
axe silent about the labelless text field too. It was mounting a *labelled* text field first: both
inputs took `id="f"`, so the association resolved to the earlier, labelled one and the second looked
named. Two forms on one page with the same field name collide by id — an artefact of the probe, and
worth knowing when reading any per-field measurement on a shared stage.

## 80. A refusal that says how to fix it, and names something the caller cannot reach

`adversarial/dynamic-contract/a-refusal-that-points-at-nothing.battle.test.mjs` — **green, closed**,
verified here. Was 3 green, 1 red, S2. Finding 73's repair, held to its own message.

The message now names what the function takes — `buildDynamicFormSchema(document.schema)` — and a v3
document does carry an optional `schema` beside its `fields`, so following it works. `{}` and
`{ node: "group" }` are refused by name too.

**The battle needed correcting twice**, and both were mine. Its extractor matched
`parseDynamicForm(document).X`, which was the *wrong* instruction — so when the instruction was
corrected the match stopped firing and the battle stopped describing anything; it now follows whatever
expression the message names and evaluates it. And its assertion demanded the advice work for a
document carrying only `fields`, which has no tree for this function to take at all: too strong, and
`buildFlatFormSchema` is that document's call.

`buildDynamicFormSchema` refuses what it cannot use, by name and in production — that is 73 closed.
Its message goes further than most and tells the caller how to fix it:

```
[modyra] buildDynamicFormSchema takes a parsed document's root node, received a undefined.
Parse the document first: parseDynamicForm(document).schema.
```

**`parseDynamicForm` returns no `schema`.** Its result carries `ok`, `version`, `fields`, `layout`,
`rules`, `validations`, `collections`, `diagnostics`, `acceptedCount`, `rejectedCount` — for a flat
document and a tree one alike. A caller who does what the message says gets `undefined`, which
produces the same refusal again. **The instruction is a circle.**

What the function does take is the document's own root — `{ children }`, with or without a `node`
beside it — which is what the caller already had before parsing anything.

And two shapes still arrive as a JavaScript internal rather than as that refusal:

```
buildDynamicFormSchema({})                  TypeError: Cannot convert undefined or null to object
buildDynamicFormSchema({ node: "group" })   the same
buildDynamicFormSchema(undefined/null/[]/42/"nope")   the named refusal        the control
```

`{}` is the empty document and `{ node: "group" }` is a section somebody left unfinished. Both are
exactly the shape the refusal exists for, and both miss it — an object with no `children` is the one
case the check does not reach.

**A message that names a property is a promise the property is there.** Same species as 68 and 69: a
sentence that cannot be acted on. This one is sharper because it was added *by* the repair — the
refusal is new, and its instruction has never worked.

The battle reads the property name **out of the message** rather than hard-coding `schema`, so a
repair that renames it is followed rather than broken.

## 81. "Pass {} to empty the form", and {} does not empty it

`adversarial/validation/a-whole-value-that-names-nothing.battle.test.mjs` — **green, closed**,
verified here. Was red on a new assertion in the battle that held finding 61. **S2.** Sibling of 80.

Reworded to *"Pass {} to return every field to its initial deliberately."* — the assertion fired only
while the verb was `empty`, so rewording satisfied it rather than breaking it, which is what it was
written for.

The refusal `setValue` now gives for a whole value that names nothing:

```
[modyra] setValue names none of this form's fields: "nope". Pass {} to empty the form deliberately.
```

And what `{}` does, on a form somebody filled in:

```
the user filled it in     {"plan":"enterprise","note":"typed"}
after setValue({})        {"plan":"pro","note":""}          ← the initials, not empty
```

`plan` goes back to `"pro"`. ADR 0057 says so in its own consequence paragraph — *`setValue({})` no
longer empties a field to `null` but returns it to its initial* — so the message and the record
contradict each other about the same call, and the message is the one a caller reads at the moment
they are deciding what to do.

A consumer following it to clear a form gets a form full of default values and believes it is empty.
Where an initial is `""` the two coincide, which is why it reads as correct in most tests.

**Either repair closes it and they are not the same size:** change the sentence to name what `{}`
does, or make `{}` mean what the sentence says — the second is a contract change and ADR 0057 decided
against it deliberately, so the first is almost certainly right.

The assertion reads the advice **out of the message** (`Pass (\S+) to (\w+)`) and only fires when the
verb is "empty", so rewording the sentence satisfies it rather than breaking it.

**Found by sweeping every named refusal for whether its instruction can be followed**, which is what
80 suggested doing. Ten refusals, all added or hardened tonight; eight instruct correctly —
`setValue` on a non-object, the security policy naming its three keys, the sanitiser naming its closed
set, the initial-value type, `buildFlatFormSchema`, `createForm`, the reactive-argument message, and
the two path refusals which explain rather than instruct. Two do not: this and 80.

## 82. A rule that cannot be compiled, and a strict parser that approves it

`adversarial/dynamic-contract/a-rule-that-cannot-be-compiled.battle.test.mjs` — 3 green, 1 red.
**S1** under DYN-003 and VAL-004.

`validators.pattern` is a string in a document, and a string is not always a regular expression. The
engine knows — the layer that compiles it skips an unparseable source and says so:

```
buildDynamicValidators({ pattern: "[" })       0 validators
                                               [modyra] Skipped dynamic pattern validator: invalid RegExp source "["
buildDynamicValidators({ pattern: "^a+$" })    1 validator, nothing said            the control
```

The parser above it does not:

```
parseDynamicForm({ …, validators: { pattern: "[" } })
  diagnostics   []
  strict.ok     true
  kept          { "pattern": "[" }        the rule survives into the output
```

So a document whose pattern cannot be compiled **passes the gate an author runs before saving**, and
produces a field with no pattern rule on it. What the author is told at the moment they could still
fix it is nothing; what they are told later is a `console.warn` in development, which production
removes — and a rule they believe protects their data is not there.

Both doors are in the battle because the finding is the difference between them: the lower one knows,
so the parser could.

Sibling of finding 76 — the same operand, the other way of being unusable. That one was a pattern that
runs forever; this one is a pattern that never runs.

**Two more lax answers measured alongside and not filed**, because neither loses a rule the author
wrote: `validators: { minLength: -5 }` is kept and compiled (a bound nothing can fail), and
`validators: { nonsense: 1 }` is kept in the output and compiles to nothing. The second is finding
60's family on a smaller surface — an unknown key ignored — and is worth folding into any repair that
reaches here.

## Checked and clean: every parser diagnostic says where, not only what

Swept while looking for the above. Each carries the field's name, a JSON pointer, and the specific
problem:

```
MDY_DYNAMIC_UNKNOWN_KIND         /fields/1   Dropped dynamic field "bad" with unknown kind "wormhole".
MDY_DYNAMIC_DUPLICATE_NAME       /fields/1   Dropped duplicate dynamic field name "dup".
MDY_DYNAMIC_UNSAFE_NAME          /fields/0   Dropped dynamic field "__proto__": name is reserved…
MDY_DYNAMIC_OPTIONS_REQUIRED     /fields/0   Dropped dynamic field "sel": kind "select" requires…
MDY_DYNAMIC_INVALID_FIELD        /fields/0   Dropped dynamic field without a name: {…}
MDY_DYNAMIC_UNSUPPORTED_VERSION  /fields     Unsupported dynamic form config version 99 — expected 1, 2 or 3.
```

An author reading any of them knows which field and why. The gap is not in what they say — it is the
one that is never said, above.

## 83. A name a document may declare and a page cannot draw

`browser/a-name-the-page-cannot-carry.spec.ts` — **green, closed**, verified here. Was 2 green, 1 red,
S2. A name carrying whitespace is now refused where the document is read, so the two halves of the
same sentence are enforced in the same place.

A widget id is built from a field's name, and the renderer states the rule in one sentence:

```
[modyra] "a b" cannot be a widget id: it must be non-empty, and may contain neither
whitespace nor "__". Whitespace splits an attribute list…
```

Both halves have the same reason — `aria-describedby` is a space-separated list of ids — and **the
parser enforces one of them**:

```
"a__b" / "__b" / "a__"    strict.ok=false, MDY_DYNAMIC_INVALID_FIELD    refused where the document is read
"a b" / "a\tb" / "a\nb"   strict.ok=true, kept, no diagnostic           and the page will not draw them
```

So an author runs the gate, is told the document is fine, saves it, and the field never appears. The
half that *is* enforced proves the parser knows about widget ids; the half that is not is in the same
sentence of the same message.

The renderer's refusal is good — it names the field, the rule and the reason — and the battle does not
ask for the name to be accepted. It asks for the author to be told at the gate they ran first. The
third test asserts the enforced half, so if `__` ever stops being refused the finding above is a
different one and says so.

**Also measured, the same disagreement the other way and not filed**: the parser refuses `a.b` as
`MDY_DYNAMIC_UNSAFE_NAME` and the renderer mounts it. A renderer more permissive than the contract
costs nobody a document that passed.

**And clean, swept alongside**: every other name that mounts associates correctly — `a"b`, `a'b`,
`a#b`, `a[0]`, `a:b`, `à-ünï` and an eighty-character name all get `label[for]` matching the input id
and an `aria-describedby` that resolves. The engine builds ids and `for` attributes rather than CSS
selectors, which is what makes characters that break a selector harmless here.

## Checked and clean: what the devtools panel masks, and why the guess is acceptable

Added to `adversarial/security/devtools-masking.battle.test.mjs`, green.

`isSensitivePath` decides whether a value is masked in the panel, and its contract is unusually honest
about its own limits: *the name heuristic is a guess, and it is wrong in both directions — `notes` can
hold a recovery phrase and `cardStyle` is masked for containing "card". So a declaration wins wherever
there is one, and the guess only fills the silence.*

Measured, and the guess is indeed partial: `password`, `secret`, `token`, `ssn`, `creditCard`,
`cardNumber`, `cvv` are masked; `pwd`, `pass`, `apiKey`, `api_key`, `pin`, `otp`, `passphrase`,
`bearer`, `private_key`, `sessionId` are not. **That is inside the declared limitation, not a
finding** — the sentence above says so before anybody measures it.

What is worth holding is the sentence that makes the guess acceptable, and it holds in both
directions:

```
notes      declared sensitive        masked        the guess said no
notes      declared not sensitive    shown
password   declared not sensitive    shown         the guess said yes
password   nothing declared          masked
cardStyle  nothing declared          masked        the guess's own stated false positive
cardStyle  declared not sensitive    shown         and the way to correct it
```

The guess may be widened or narrowed at any time and nobody would notice. A declaration that stopped
winning would leave a consumer with no way to correct either kind of error, and nothing asserted it.

## Checked and clean: the conformance kit refuses three subtler adapters too

`adversarial/reactivity/what-conformance-catches.battle.test.mjs` — the mutation list grows from seven
to **ten**, still green.

The kit is what a third-party adapter author runs to certify their reactivity, so what it refuses is
what "conformant" means for every adapter nobody here wrote. The seven already fed to it are pieces
that are **missing** — a signal that never notifies, a computed that never recomputes, an effect that
runs once, a scope whose destroy does nothing, an untracked that tracks, a claimed capability that is
not implemented.

Three added, all pieces that do **slightly too much**, which is the shape a working-but-wrong adapter
actually has:

```
a signal that notifies on a write of the same value    refused
a scope that destroys only its first effect            refused
an effect that subscribes twice                        refused
```

The second is the realistic teardown bug — a partial destroy, which is what leaves work alive after a
form is gone — and the third is a double subscription, which a wrapper around a framework's own
primitives produces by accident.

**The battle's structure already guards the vacuous case**: a mutation the kit crashed on rather than
refused would report zero checks and zero failures, and zero failures is what the assertion collects
as "declared conformant". Green means each of the ten ran the kit and at least one check failed on it.

## Checked and clean: one error shape from six sources

`adversarial/submission/one-shape-from-six-sources.battle.test.mjs` — green, and new.

`MdyFormError` is `{ path, kind, message, payload? }` and a renderer reads all four: `path` to place
the message under a field or in the form's own summary, `kind` to tell a rule from a check from
something the server said, `payload` for anything else. The errors arrive from six places, written by
different code at different times, and **nothing asserted they agree** — so every renderer is written
against whichever one its author happened to try.

They agree:

```
a synchronous rule                     kind "validation"   path "a"
an asynchronous check that answered    kind "async"        path "a"
one that rejected                      kind "async"        path "a"
a server refusal on a field            kind "unknown"      path "a"
a server refusal on the form           kind "unknown"      path null
a rule inside a collection row         kind "validation"   path "rows.r1.code"
```

No source carries a key the shape does not declare, and every one has a non-empty `kind`, a string
`message` and a `path` that is a string or `null` — which is what lets a renderer place it without
guarding.

The three normalisations a server refusal goes through are pinned separately, because each is a
decision rather than a consequence:

```
no kind given             becomes "unknown"        a value saying the engine does not know,
                                                   not a missing property to guard
a kind of its own         survives                 including "validation", colliding with a local rule
a payload                 survives                 the one slot declared for anything else
httpStatus: 409           dropped                  outside the shape; `payload` is where it goes
```

## 84. A correct document that reports something was lost

`adversarial/dynamic-contract/a-rejection-with-no-reason.battle.test.mjs` — 3 green, 1 red. **S2.**
In the counter added for group A, hours old.

`acceptedCount + rejectedCount` is what a document *declared*, which is what makes the pair worth
reading. The counter is deliberately the least informed reader of the shape — *it counts, it does not
interpret* — and a node that is neither a field nor a container it knows how to walk counts as a
declaration that did not become a field.

**A collection is one of those, and it is not a loss.** It is understood: it is reported in
`collections`, by path and by kind. Its cells are not flat fields because a document cannot name rows
that do not exist yet. So:

```
two leaves                       ok=true   accepted=2  rejected=0  diagnostics=[]                    the control
a leaf and a broken field        ok=false  accepted=1  rejected=1  diagnostics=[UNKNOWN_KIND]        a real rejection
a leaf and a RECORD              ok=true   accepted=1  rejected=1  diagnostics=[]  collections=[rows]
a leaf and an ARRAY              ok=true   accepted=1  rejected=1  diagnostics=[]  collections=[list]
```

**A rejection with no reason is the tell.** Everything else that raises the count says why. An author
reading "1 rejected" on a document with nothing wrong with it is told something was lost and given
nothing to look at — and the same author was given a `collections` list containing exactly the thing
the count is about.

Either repair closes it: count a collection as accepted, since it is understood and reported, or give
every rejection a reason. What the battle refuses is a number that says a thing was lost and cannot
name it.

The second control is the one that makes the silence legible: a genuinely refused node is counted
**and** carries a diagnostic, so a reason is what separates the two cases rather than the count.

## Checked and clean: two more pairs that must agree

Added to `adversarial/validation/two-lists-that-must-agree.battle.test.mjs`, green.

**The sizes a document may author and the sizes a renderer paints.** The reason is stated where the
type is declared: *a document declares placements against these names and a renderer paints them, so
the two sets have to be the same or a document can author a size nothing draws.* It is solved by
derivation — the widget contract derives its breakpoints from the document's, which makes a fourth
size a compile error on the side that would otherwise stay silent.

```
MDY_LAYOUT_BREAKPOINTS   { base: "0", sm: "40rem", md: "64rem", lg: "80rem" }
```

Derivation protects the **source**. It does not protect a **build**: a package published from a stale
compile carries whatever it carried, and a consumer installs the two separately. This is the runtime
half, and it costs nothing.

**A layout that points at a field the parse dropped.** A document has two halves naming the same
fields — the list and the layout — and the parse may drop from one:

```
a layout naming two fields that survived   kept, no diagnostic, both modes         the control
a field the parse dropped                  MDY_DYNAMIC_UNKNOWN_FIELD_REFERENCE, layout dropped
a field nobody wrote                       the same
```

Both dangling references are caught, and the layout does not survive the reference it names being
gone. Worth holding now rather than earlier: until group B was closed, that code was also what a
version refusal and a depth refusal reported, so it meant three things and asserting it meant little.

## 85. A document that declared five fields, and a parse that says none

`adversarial/dynamic-contract/a-document-that-declared-nothing.battle.test.mjs` — 5 green, 1 red.
**S2.** The same number as finding 84, from the other side.

`acceptedCount + rejectedCount` is what a document *declared* — the sentence that makes the pair worth
reading. 84 was a collection counted as a **loss**; its repair made a collection count as nothing, and
a document whose fields all live inside one now reports declaring nothing at all.

Measured on the project's **own published fixtures**, not on a document written for the occasion:

```
v3/keyed-rows.json            accepted 5   rejected 0     a field outside the collection    the control
v3/nested-collections.json    accepted 0   rejected 0     declares 5 fields
v3/positional-nesting.json    accepted 0   rejected 0     declares 4 fields
```

Both parse cleanly with their collections found and reported by path and kind. A field inside a
collection is declared and is legitimately not a flat field — a document cannot name rows that do not
exist yet — but it *was* declared, and the pair is the one place that says so.

Between 84 and this is the sentence the pair is supposed to satisfy: a collection is not a loss, and
what is inside it is not nothing.

The fixtures are read from disk rather than written into the battle: a synthetic document proves the
parser does it, and the corpus proves the contract's own documentation is one of the documents it
happens to.

## Checked and clean: every published fixture builds the form it describes

Added as a second battle in the same file, green. The corpus is the contract's documentation, and a
fixture that parses and then cannot be **built** is documentation that does not work.
`audit-contract-schema` validates the fixtures against the published JSON schema, which is a different
question from whether the engine can make a form out of them:

```
v2/checkout-recursive   {"items":[{"sku":"TSHIRT-BLK-M","qty":2}],"country":"IT","coupon":"","ship…}   7 names
v3/keyed-rows           {"lines":{"12":{…},"tmp:1":{…}}}                                              6 names
v3/nested-collections   {"orders":{},"shipments":[]}                                                  2 names
v3/positional-nesting   {"orders":[],"matrix":[]}                                                     2 names
```

The last two are the shape assertion worth naming: a **record** declared in a document arrives as an
object and an **array** as a list, both empty — because a document declares a shape and rows come from
data. It is also what makes finding 85 legible: five fields are declared inside a row template, and
two names exist at the top, because a cell only exists once a row does.

## Checked and clean: every published fixture parses the way its name says

Swept while finding the above. The corpus encodes its expectations in its filenames, and the parser
agrees with all nine:

```
v2/valid · v2/nested-layout · v2/checkout-recursive     strict.ok=true, no diagnostics
v2/invalid-reference                                    strict.ok=false, UNKNOWN_FIELD_REFERENCE + INVALID…
v2/duplicate-layout-reference                           strict.ok=false, UNKNOWN_FIELD_REFERENCE
v3/keyed-rows · v3/placement                            strict.ok=true
v3/nested-collections · v3/positional-nesting           strict.ok=true — and the counts above
```

## Checked and recorded: the order only `keys()` can keep

`adversarial/collections/the-order-only-keys-can-keep.battle.test.mjs` — green, and new.

The feature tour promises it in four words: `form.f.lines.keys()` gives *declared keys, in declaration
order*. It is kept, including for the case that breaks it everywhere else:

```
rows declared "10", "2", "1"
  keys()                          ["10","2","1"]     the documented order
  Object.keys(getValue().rows)    ["1","2","10"]     JavaScript's, for integer-like keys
```

**Not a defect.** A record's value is a plain object and JavaScript orders integer-like keys ascending
whatever the insertion order was; `COL-004` promises numeric keys stay *keys* rather than becoming
positions, and they do. It is a **trap**: both answers are correct and only one is the documented one,
so a consumer who iterates the value instead of `keys()` gets a different order and nothing says so —
including the server, which receives the JSON.

Held so the promise stays where it is: if `keys()` ever started agreeing with the object, the
documented order would be the one that was lost.

Three order decisions measured alongside, none of them stated anywhere else:

```
removing a row          the others keep their order
declaring it again      it arrives at the END — a key that comes back is a new declaration
renaming a row          it keeps its place — a rename changes a name, not a position
```

**And one measured without a promise behind it, so not filed.** `getValue()`'s own key order follows
the schema for leaves (`z, y, x` declared gives `z, y, x`) and does not when a group or a collection
is among them: `a, rows, b` gives `rows, a, b`, and `a, sect, b, list` gives `list, a, b, sect` —
collections first, groups last. Nothing documents the value object's key order, and JSON object order
is not semantically meaningful, so this is a surprise rather than a breach. It is worth knowing for
anyone diffing a payload against the document it came from.

## Checked and clean: four sentences of contract about writing to a collection

`adversarial/collections/rewriting-merging-and-saying-so.battle.test.mjs` — 2 battles, green, new.

The guide states the whole of it in a paragraph, and nothing held any of it:

```
upsert("r1", { a: "new" })    a="new"     b back to its schema's initial "ib"    rewrites
patch({ r1: { a: "merged" } }) a="merged"  b left exactly alone "vb"              merges
touched and dirty              survive BOTH                                       as documented
```

Everything else about collections is built on this: a renderer reading `dirty` to decide whether to
warn before leaving, a form writing a server's response back with `patch` and expecting the user's
half-finished edits to stay.

**And the dev warnings, which are the counterpoint to this campaign's largest family.** All four fire,
each naming the collection, the call and what it could not do — and a call that works says nothing:

```
cell("r1.nope")             [modyra] cell("r1.nope", undefined) on "rows" addresses nothing…
rename onto a taken key     [modyra] rename on "rows" ignored: "r2" already names a row…
patch with a string row     [modyra] patch on "rows.r1" ignored a string: this row is a group…
setAll with a string        [modyra] setAll on "rows" ignored a string: it takes an object keyed by…
a patch that works          nothing
```

Findings 60 to 65 were about doors that could not do what they were asked and said nothing. **The
vocabulary those findings asked for already existed one call away, and this is where** — the
collection, which is where the habit was designed in. Holding it matters because it is the reference
the rest of the engine was measured against.

## 86. A change set ready for a PATCH request, that cannot say which row it patches

`adversarial/submission/a-patch-that-cannot-say-which-row.battle.test.mjs` — 2 green, 1 red. **S1.**

`getChanges()` is documented in those words: *minimal nested patch — only the fields whose value
differs from the schema's initial values, **ready for an API PATCH request***. The collections guide
adds the rule that makes it minimal: *changed values, not structure*, so a removal, a move and an
insertion leave it empty. All of that holds, and is now held.

For a **keyed** collection it composes into something a server can act on:

```
edit row "c"        getChanges()  {"rows":{"c":{"t":"EDITED"}}}      says which row
```

For a **positional** one it does not. The change set is a compacted list of the rows that changed,
with nothing saying where they were:

```
edit index 0        {"list":[{"t":"EDITED"}]}
edit index 1        {"list":[{"t":"EDITED"}]}      the same body
edit index 2        {"list":[{"t":"EDITED"}]}      the same body
edit 0 and 2        {"list":[{"t":"A"},{"t":"C"}]} reads as indices 0 and 1
```

A server applying that positionally writes to index 0 — **the wrong row in two cases out of three**.

The keyed collection is the control and the shape that avoids it: the engine already answers this
question wherever the collection can be addressed. The second control is that an array edit *does*
produce a change, so the finding is which row rather than arrays being left out.

Either repair closes it: carry the index, or say in the contract that a positional collection's change
set is not addressable and the whole list must be sent. The second is a documentation fix with a
consequence on a wire.

**Two questions that look like one**, added as a second battle in the same file, green. The guide
states the first in a line — *`dirty` is set by user interaction in renderers (and `markAsDirty()`)* —
and `getChanges()` answers the other:

```
                                dirty    changed
nothing happened                false    false
a value written in code         FALSE    true
the same value written again    false    false
a person interacting            TRUE     false
a patch from a response         false    true
a whole value written           false    true
written and put back            false    false
```

A consumer asking `dirty` to mean "are there unsaved changes" misses every write that did not come
from a person — a restored draft, a server prefill, a `patch` from a response. That is right, and it
is only right because the other question has its own answer. The two rows in capitals are where they
disagree, and they are the ones worth holding.

Everything else in that paragraph was measured and holds, and is recorded rather than filed: removing
a seeded row, adding one, renaming one and moving one all leave the change set empty; removing item 0
then editing the new item 0 reports the edit and not the removal — so a row is compared against **its
own** initial rather than against whatever now sits at its index, which is what a naive positional
diff would get wrong.

## Checked and clean: the characters the sanitiser's contract names

`adversarial/security/the-characters-the-profile-names.battle.test.mjs` — green, and new.

The security guide is precise about `"text"`, in a table: it strips control characters (except tab and
newline), DEL/C1, **zero-width characters (`U+200B–200D`, `U+FEFF`)**, **bidi overrides/isolates
(`U+202A–202E`, `U+2066–2069`)** and line/paragraph separators, while *all legitimate text — accents,
emoji, CJK, newlines — is preserved*.

Measured, one representative per range: **all thirteen are removed**, under both `text` and `strict`,
including `U+202E` — the character the guide itself uses to explain why the profile exists
(`"admin‮"` looks like `admin` and is not). And legitimate text survives whole:
`Café — 日本語 — 🎉` with a newline and a tab comes back unchanged.

**Four invisible characters survive, and the contract does not name any of them**: `U+200E` and
`U+200F` (the bidi *marks*, which are neither overrides nor isolates), `U+00AD` and `U+2060`. Held as
they are, both halves, so a future widening is a decision somebody takes rather than a drift — and a
narrowing shows up as the attack coming back.

**One guide says it less precisely, and that is the only thing wrong here.** `headless-recipes.md`,
under *Notes and combos → Security*, advises pairing headless fields with
`security: { sanitize: "text" }` because *pasted bidi/zero-width characters are* removed — without the
qualification the security guide's table carries. A reader of the recipes believes every bidi
character is stripped; two of them are not. The behaviour is correct and the precise guide is correct;
the sentence that gives the advice is the one that overstates. Not asserted as a battle: a check
demanding more than the contract states would be inventing a requirement.

## Checked and clean: three sentences from the mental model

`adversarial/reactivity/three-things-the-model-says-it-is.battle.test.mjs` — 3 battles, green, new.
The guide states the engine's shape in prose, and nothing held any of it.

**`undo()` restores recorded values only, never touched, dirty or errors.**

```
before undo   value "one"     touched true   dirty true
after undo    value "start"   touched TRUE   dirty TRUE
```

A step of history is a value the form held, not a session it was in — undoing a write does not
un-visit the field, and a person who has been somewhere has still been there.

**The engine never deep-compares and never uses `JSON.stringify` to decide equality.**

```
set({x:1}) over an initial {x:1}    getChanges() {"a":{"x":1}}   a new object is a new value
                                    an effect watching it re-runs
set(theSameReference)               getChanges() {}              the control: the rule is identity
```

Identity is the rule, which is the only honest one for a value the engine cannot look inside — and a
cost a consumer needs to know: a mapper that rebuilds an object on every render writes on every
render. A deep comparison introduced as an optimisation would make that quiet.

**`disabled` and `readonly` are one value, so they cannot disagree.**

```
asked to be BOTH        interactivity "disabled"   disabled true    readonly FALSE
disabled alone          interactivity "disabled"   disabled true    readonly false
readonly alone          interactivity "readonly"   disabled false   readonly true
```

Two flags would answer "both"; one value has to choose, and it chooses the stricter. That is what
makes `disabled && readonly` unrepresentable rather than merely unlikely — including when a consumer
asks for it.

## Checked and clean: what the six shipped adapters actually publish

The multi-framework guide's package policy says each of `@modyra/vue`, `react`, `solid`, `preact`,
`svelte` and `lit` ships *a reactivity adapter + typed form factory (+ hooks/controller/composable)*.
Measured, and it holds — with three different shapes that match what each section describes:

```
vue solid svelte    a named reactivity + createVueForm / createSolidForm / createSvelteForm
react preact        a named reactivity + core's createForm, which is what "the engine runs on
                    vanillaReactivity()" means for them
lit                 a named reactivity + MdyFormController, the "controller" in that sentence
```

Every one exports a reactivity whose `kind` matches its name, and Solid's fallback announces itself in
as many words when the server build is what resolved — the thing that once made it look conformant
for the wrong reason now says so out loud.

**One non-obvious fact worth writing down**: `createForm` exported from all six is **literally core's
function** — `m.createForm === coreCreateForm` for every package. So importing it from `@modyra/vue`
builds a form on the framework-agnostic graph, not on Vue's.

That reads like a hazard and is not one, because the project answers it a layer up: a handle belongs
to the runtime its form was built with, `observerFor` reads that owner from the registry, and
observing from a foreign runtime is reported rather than silently stale —
`adversarial/reactivity/cross-runtime-observation.battle.test.mjs` holds it. The framework hooks go
through that path; the bare re-export is the lower-level door.

**An attempt to measure it directly failed and is recorded as a failure**: driving Vue's `computed`
and then its `effect` from a bare Node script reported *all three* forms as unobserved — including
`createVueForm`, which is the control. Three identical answers including the control is an instrument
that is wrong, not a product that is broken, and the right tool for that question is the differential
tier, which drives all six runtimes properly.

## An operational note on every number in this register

Twice during this campaign a single suite measurement disagreed with the four around it — once
`374/333/41` against a stable `374/335/39`, once `417/382/35` against `417/383/34`. Both times three
consecutive re-runs afterwards produced **identical failure sets, title by title**, so the suite is
stable and the reading came from outside it: this repository is a working tree two sessions write to,
and a `dist` rebuilt mid-run is enough.

Any number here that moved a conclusion was re-measured before being written. A single reading is not
evidence when somebody else may be building.

## The register, audited against the tiers

A register that says a finding is open when it is closed is worse than no register: it sends whoever
reads it to look at something that is already fixed, and it hides how much ground has actually moved.

Checked mechanically — every numbered finding that names a battle file, against the current state of
the tier that runs it. **Eighty-five findings, five stale entries**, all in the same direction: the
register said open where the tier said green.

```
34  a date or a time the field could not read      closed by the picker batch
55  every shape now reaches somebody               already titled Closed; the audit's own pattern missed it
56  an error the form holds and the page cannot show   closed by the form's error region
67  a slider at its maximum                        both halves closed
83  a name a document may declare                  closed within the hour of being filed
```

Nothing was stale in the other direction: no entry claimed closed while its battle was red.

Worth repeating rather than doing once. Two sessions are writing here, one of them repairing as fast
as the other files, and a register drifts in exactly one direction — the one where somebody else did
the work.

## Checked and clean: everything the troubleshooting guide predicts

`adversarial/submission/what-the-troubleshooting-guide-predicts.battle.test.mjs` — 2 battles, green,
new.

A troubleshooting guide is a list of falsifiable predictions, none of which was held anywhere, and a
wrong one is worse than a missing one: somebody reads it while already confused and goes looking in
the place it names. **None of them is wrong.**

```
a form-level refusal (path null)         errorsFor("")     the form
a refusal naming NO registered field     errorsFor("")     "not lost", exactly as the guide says
a refusal naming a real field            errorsFor("a")    the field, and NOT the form
a cross-field validator that failed      errorsFor("")     the same place, so it is one answer
                                                           rather than a bucket for leftovers

canSubmit, on a valid form   valid-only true   always true   manual FALSE
a run that never resolves,
under timeoutMs: 120         pending settles false, kind "async-timeout", "Validation timed out"
```

The routing is asserted as a **partition** rather than three separate checks: each message reaches
exactly one of the two places — never both, never neither. That is the property a renderer depends on
when it draws a field's list and the form's summary side by side, and it is stronger than any of the
three predictions on its own.

**One thing it settles about finding 65.** A *server* refusal on a path nobody declared surfaces on
`errorsFor("")`. A *rule* attached to one used to sit invisible — and now cannot exist at all, because
`addValidators` refuses the name. The two mechanisms answered differently and only one of them was a
finding; the guide was describing the half that was already right.

## 87. Two published guides that still describe what `setValue` used to do

`adversarial/validation/two-guides-that-say-null.battle.test.mjs` — **green, closed**, verified here
within minutes of being filed. Was 3 green, 1 red, S2. Same species as 81, in the pages rather than in
the message — and repaired in both.

ADR 0057 changed it and said so in its own consequences: *`setValue({})` no longer empties a field to
`null` but returns it to its initial.* Two published guides still say the old thing:

```
docs/guides/troubleshooting.md:72   "fields absent from the passed object are reset to `null`"
docs/guides/typed-forms.md:61       "schema fields absent from `v` are reset to `null`"
```

And the behaviour, on a form whose initials are not empty — which is the only kind where the two
answers differ, and why the sentence survived:

```
the user filled it in         {"plan":"enterprise","note":"typed","n":99}
after setValue({note})        {"plan":"pro","note":"kept","n":7}     the initials, not null
```

The troubleshooting one is the more expensive, because it is filed under *Why did my value reset to
null after `setValue()`?* — a person reads it while already confused, is told to look for a `null`,
and finds `"pro"`.

**The check is anchored to the behaviour, not to wording**: it fails only while a guide claims `null`
*and* the engine returns the initial. Rewriting the sentence satisfies it; so would changing the
engine, which ADR 0057 decided against. It reads each file whole rather than line by line, because one
of the two sentences wraps across a newline and a line-at-a-time check finds the other and calls the
page clean — which is how the first version of this battle reported one guide instead of two.

81 was this sentence in the refusal message, and was repaired where it was written. These two were
not, which is the ordinary shape of a decision that lands in code before it lands in prose.
