# ADR 0135: An id is a function of the document, not of mount order

Status: Accepted

## Context

[ADR 0134](0134-the-projection-decides-an-id.md) made the projection the authority on a part's id, and
`calendarDayId` gave the three renderers one function to compute it. The shape now agrees. What the
function is handed does not:

```
plain     when__day__2026-07-26                        the field's own name
lit       mdy-field-0__day__2026-07-26                 a mount counter
angular   mdy-control-datepicker-0__day__2026-07-26    a mount counter
```

A counter is not a property of the document. The same declaration, mounted second and then alone:

```
                 mounted second                    mounted again      same
angular          mdy-control-datepicker-1__label   …-2__label         no
lit              mdy-field-1__label                …-2__label         no
plain            when__label                       when__label        yes
```

So in two renderers of three, an id depends on what else was on the page first. A consumer cannot write
`aria-describedby="when__label"` in their own markup; a stylesheet or a test naming an id works against
one adapter and no other; and server-rendered markup and a client mount disagree the moment their order
does — a hydration mismatch on an accessibility attribute rather than on visible text.

This survived 374 and 385 because both were satisfied by three renderers agreeing on a **shape**. Those
asked which parts carry an id. This asks what the id *is*.

## Decision

**A widget bound to a field derives its id from that field's path within its form's id scope. A widget
with no field gets a mount counter, and its ids are explicitly not stable.**

```
bound to a field    <scope><joiner><path>__<part>     the same document renders the same ids
no field at all     mdy-<kind>-<n>__<part>            a counter; nothing about this widget is stable
```

Three things the rule settles, because they are the first questions an implementation asks:

**The scope.** Plain already joins a page prefix to a field name with a character neither part may
contain, so two distinct prefixes provably cannot collide — `p1 + name1 === p2 + name2` forces
`p1 === p2`. That is the mechanism, and lit and Angular adopt it. Without a scope, two forms on one
page each with a field called `when` collide, and the collision argument below stops being a feature.

**Nested names.** A field inside a group or a row has a path, not a name, and plain already resolves it
that way: `fieldShellPartIds("group.rows.0.when")` gives `group.rows.0.when__label`. The path is the
identity; the other two adopt it unchanged.

**The unbound case is not an exception.** `<mdy-control-datepicker label="Appointment">` with no field
is documented in lit and Angular, and there is nothing to derive an id from. A rule with no answer
there would either forbid that usage — a larger change than this finding — or leave each renderer to
invent one, which is the mechanism being removed. The counter is what a widget with no identity gets,
and the record says out loud that its ids are not reproducible, because nothing about that widget is.

## Consequences

**Collisions become visible, and that is the point.** Two fields declared with the same path in one
scope produce one id, which a page shows you. Two counters never collide and never mean anything
either — the failure is silent and permanent instead of loud and fixable.

Every id lit and Angular publish changes. `contract:diff` will classify it and a changeset states the
migration in one line: *if you named a Modyra-generated id, it is now derived from your field's path.*
Angular mints its id per renderer — fourteen `mdy-control-<kind>-${nextId()}` sites — and lit mints one
in `base.ts`, so the code is small and the migration note is the work.

An id becomes a thing a consumer can write down in advance: in their markup, their stylesheet, their
test suite. That is the capability this decision buys and none of the three had.

## Alternatives rejected

**Keep the counters and document that ids are renderer-specific.** Cheapest, and it makes the
contract's own attributes untrustworthy — a consumer reading `aria-labelledby` off the projection
cannot know whether it resolves in their adapter, which is [385](../../battle-tests/reports/open-findings.md)
by another road.

**A hash of the path.** Stable and collision-resistant, and it throws away the thing that makes the
name useful: a consumer cannot write `aria-describedby="a3f91c"` from reading their own form. It also
hides collisions rather than showing them.

**A consumer-supplied id per field.** More control and more surface: a required option for something
that has a correct default, and every consumer who omits it is back where this started.

**Make the counter stable by resetting it per form.** Fixes the second measurement above and not the
first: the id still depends on the order fields are mounted within the form, so a conditional field
shifts every id after it.

## Verification

No battle yet, and deliberately: the sentence it will assert — **the same document renders the same
ids** — is satisfied by the path, by a hash, and by a consumer-supplied value alike, so it can be
written now and will not choose. It is owed once this lands, and its shape is: mount a declaration,
record every id, mount the same declaration after something else, and compare.

The check that fails if this is satisfied in letter and violated in spirit: a renderer deriving from
the path but omitting the scope. Two forms on one page with the same field name would then render one
id twice, and the assertion above passes — both documents render the same ids as themselves. The scope
needs its own case.

## Amendment: the two properties cannot both be automatic, and the scope is not optional

The battle written for this record asked for *two forms mounted from one document get distinct scopes
without a consumer having to know*. **That cannot be had**, and the contradiction is this record's own
two columns:

```
stability      the id depends only on the document    ⇒ two live copies get one id
no collision   the id depends on the instance         ⇒ a second mount changes the id
```

Anything that tells two mounts of one document apart has to come from outside the document — the host,
or the order they were created in. The host is the scope, which this record already requires; the order
is the counter it removed. There is no third source, so **the scope is not a nicety a careful consumer
adds: it is where the second property comes from.**

**What is decided, beyond what was written above:**

- the promise is *two **scoped** forms do not collide*, and that is what a battle asserts;
- an unscoped collision is a **documented hazard and not a defect** — the consumer supplied one
  identity for two things;
- and it **must not be silent**. Two forms with one scope produce no warning today, so a page whose
  `aria-describedby` resolves to the wrong form looks exactly like a page whose references are correct.
  That is [ADR 0121](0121-a-value-indistinguishable-from-its-own-absence.md)'s shape: a colliding id is
  indistinguishable from a working one, and the person who can fix it in one attribute is the one
  nobody tells.

**A registry was the alternative and is rejected**, though it is buildable: a widget claiming its
derived id at mount and taking a suffixed one if a live widget holds it. It would keep a single-form
page untouched and stop two live copies crossing references — and it would make the **second** form's
ids depend on mount order, which is the counter's defect returned in a corner. A visible failure a
consumer fixes with one attribute is worth more than an invisible rule that makes ids depend on paint
order.

**And the exclusion by *has no field* applies to the stability case too, not only to the fallback.** The
stability property is green today because plain never had a counter and the other two now derive from
the path — not by construction. A fixture that mounts an unbound widget will read as unstable and be
right to, so the case must exclude by *the widget has no field*, never by kind or tag: excluding by tag
stops testing anything the day someone binds that fixture.

## Security and privacy

A field's path appears in the DOM as an id where a counter did not. A path is a name the consumer
chose and already ships in their own markup, their labels and their validation messages; it carries no
value and no user data. Worth stating because *ids derived from data* would be a different decision —
this derives from the schema, which is public by construction.

