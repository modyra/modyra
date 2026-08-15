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

Measured, not battled — pinning it needs `@modyra/eslint-plugin` as a dependency of this package,
which is a decision rather than a test.

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

`.mdy-multiselect` carries the same shape — a role-less `div` with `aria-label` — and axe reports the
select alone, which is axe's business rather than the renderer's. Both are the same thing.

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

## 35. A popup only a mouse can open

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
