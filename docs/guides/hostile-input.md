# What has been attacked

Modyra builds a form from a **document it does not trust** — a CMS entry, a model's JSON response, a
row from someone else's database, a draft in `localStorage` that every script on the origin can
write. That is the design (see [forms as data](ai-generated-forms.md)), and it is also the reason
this page exists: a library that renders untrusted structure owes you evidence, not assurances.

Every claim below has the command that produces it. Run any of them. Where something was **not**
proved, this page says so instead of rounding up.

```sh
node --test battle-tests/adversarial/security/*.battle.test.mjs
# 68 tests, 67 pass, 0 fail, 1 todo
```

## A document cannot reach the prototype

`__proto__` spelled in JSON is a real own-property, not the syntax trap a literal is. Fed through the
public doors — a field name, a whole-value write, a partial write, the schema builder:

```
parseDynamicForm   fields kept: ["ok"]   "__proto__" dropped with a diagnostic
setValue           a = "real"            "__proto__", "constructor" ignored, form declares no such field
patch              a = "real"            same
buildFlatFormSchema  keys: ["ok"]

Object.prototype.polluted = undefined     Array.prototype.polluted = undefined
```

The refusal is a report, not a silence: `setValue` says *`ignored "__proto__", "constructor": this
form declares no such field`* in dev, and the parser emits a diagnostic naming the field it dropped.

Held by `battle-tests/adversarial/security/hostile-paths.battle.test.mjs` — *"unsafe segments
register nothing, wherever they arrive from"* — and `hostile-values.battle.test.mjs` for the other
half: a row built from something that is not a plain object is read as data and nothing else.

Expressions do not climb the chain either. `toString`, `valueOf` and `hasOwnProperty` are properties
every object appears to have; asked about a value that does not own them, `isNotEmpty` and `exists`
both answer false — `expression-paths.battle.test.mjs`, *"a predicate reads the form's data and not
the prototype behind it"*.

## A pattern that would stop the page is refused at parse

A regular expression is the one field of a document that can be syntactically perfect and still hang
the thread. A synchronous match is the whole thread: no keystroke handled, nothing repainted.

```
^(a+)+b$          REFUSED   MDY_DYNAMIC_PATTERN_TOO_COSTLY
^(a+){15}b$       REFUSED   MDY_DYNAMIC_PATTERN_TOO_COSTLY
^(a{1,10})+b$     REFUSED   MDY_DYNAMIC_PATTERN_TOO_COSTLY
^([a-z]+){12}!$   REFUSED   MDY_DYNAMIC_PATTERN_TOO_COSTLY
(.*a){20}$        REFUSED   MDY_DYNAMIC_PATTERN_TOO_COSTLY

^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$          ACCEPTED   (IPv4)
^[a-z0-9-]+$                             ACCEPTED   (slug)
^[A-Z]{2}\d{4}$                          ACCEPTED
^\d{4}[ -]?\d{4}[ -]?\d{4}[ -]?\d{4}$    ACCEPTED   (card number)
```

The diagnostic names the shape rather than the symptom: *"the pattern has a repeated group whose body
can be divided several ways, which backtracks exponentially."* The rule reads the seam, not a
blocklist, so a counted repetition of a variable-width group — the same exponential shape with the
exponent written as a number — is refused alongside the `+` spelling of it.

Both doors a document uses are covered: `validators.pattern` on a field, and `matches` inside an
expression, which is what `rules` and `validations` are made of. The expression checker refuses the
document, and the evaluator answers `false` without running the pattern, so a host that built an
expression by hand and never checked it is not a way in either.

**The boundary, and it is the honest half.** This guards patterns that *arrive*. A `pattern()` you
write in your own schema is `regex.test(value)` and nothing else — Modyra runs the expression you
gave it. The analyser stands at the untrusted door, not at yours.

Held by `a-pattern-a-document-can-hang-the-page-with.battle.test.mjs` (each pattern measured in a
killable child process under a 1500 ms budget — a battle that hangs the suite is worse than the
defect it reports) and `the-other-door-a-pattern-comes-through.battle.test.mjs`.

## A value is sanitized whichever door it came in through

A sanitization policy is worth the number of doors it stands at. With `sanitize: "strict"`:

```
in   "<img src=x onerror=alert(1)>admin‮​"
out  "img src=x onerror=alert(1)admin"
```

`<` and `>` are gone, so the value can never form markup; the bidi override and the zero-width space
are gone, so `admin‮` cannot pretend to be `admin`. The `"text"` profile keeps everything legitimate:

```
in   "Zoë 日本語 🎉\nsecond line​"
out  "Zoë 日本語 🎉\nsecond line"
```

The doors covered are every public way a value is written — the schema's initial value, `setValue`,
`patchValue`, a cell handle's `set`, `setInitialValue` + `reset`, a collection `push` and `setAll`, a
record `upsert`, an object-valued field with markup two levels down, a restored draft, and `mutate`.
`every-door-the-policy-stands-at.battle.test.mjs` and
`a-choke-point-four-levels-deep.battle.test.mjs` hold them, and
`the-characters-the-profile-names.battle.test.mjs` holds the character ranges to the table in
[injection prevention](security.md) — including which ranges it deliberately leaves alone.

The profiles, when to choose each, and the per-field escape hatch are that page's subject. This one
is about whether the policy can be walked around.

## A draft is untrusted input, and is treated as one

`localStorage` is writable by any script on the origin, so a stored draft is an attacker-controlled
document that happens to be shaped like your form. A genuine draft, written by the form and then
edited by hand before it was read back:

```
written   {"__mdyDraft":1,"shape":"16xin6k","savedAt":…,"value":{"n":7,"s":"hello"}}

tampered  value: { n: { evil: 1 }, s: "ok" }
          n = 0 (its initial, not restored)   s = "ok"   onViolation → draft-shape:n

tampered  value: { __proto__: {polluted}, nope: "x", s: "ok" }
          fieldNames() = ["n","s"]   Object.prototype.polluted = undefined
          onViolation → draft-shape:nope
```

The wrong-typed value is refused and the field keeps its initial; the undeclared path registers
nothing; `__proto__` is inert. Each interception arrives on `onViolation` as `draft-shape` with the
path it happened at, rather than being swallowed — and the form then declines to keep a draft under
that key at all, saying so: *"a draft under `k` holds `nope`, which this form does not declare, so it
belongs to another form."* Refusing to overwrite is the right failure: a draft that half-loads is
work silently replaced.

The same door is held by `a-guard-the-input-it-guards-can-break.battle.test.mjs` — *"a draft the form
will not take is dropped and reported, not thrown"* — and what a restored draft may and may not bring
back with it by `what-the-rest-of-the-form-remembers.battle.test.mjs`.

## `sensitive` is a declaration, and it is not a privacy promise

This is the sentence worth reading twice. A field declared `sensitive: true` — by the document or by
`field(initial, validators, { sensitive: true })` — measured across the three surfaces that copy a
value out, plus the one that does not:

```
sensitivePaths()   ["apiKey"]
devtools panel     apiKey = •••          masked: "declared"
draft in storage   {"value":{"email":"ada@example.com"}}      apiKey absent
submit action      {"email":"ada@example.com","apiKey":"sk-live-DEADBEEF"}
```

**Masked in the panel, withheld from the draft, and sent to the server in full** — because that is
what the server asked for. `sensitive` means *do not copy this value into places the form controls*:
a screen a developer is looking at, a store that outlives the session. It does not mean the value
stays on the device, and a page that implied otherwise would be selling the flag as encryption.

Why a declaration and not a better guess: the panel's name heuristic matches `password|secret|token|
card|…`, which is wrong in both directions — `notes` can hold a recovery phrase, and `cardStyle` is
masked for containing "card". The panel says which of the three decided, so a masked value never
looks more protected than it is. The reasoning is [ADR 0089](../architecture/0089-a-field-that-says-it-is-a-secret-is-treated-as-one.md),
including the amendment for a secret inside a collection row, where the flag originally did not reach.

## What has not been proved

A page like this is only worth its exclusions.

**No proof of absence for `innerHTML`.** Measured rather than asserted: the renderers write HTML in
exactly two places, and neither carries a field value. Every renderer writes its own icon geometry
from `MDY_ICONS`, a frozen constant with no registration API — there is no path from a document to
it. The devtools panel builds its table as HTML and escapes every external string through
`escapeHtml`: the field path, the value, and the error messages. What nobody can give you by reading
is a guarantee that no single unescaped interpolation exists anywhere; grep does not prove absence.

**The theme compiler guards the CSS rule, not the HTML around it.** `compileMdyTheme` refuses a
hostile `seed` and a hostile `name` outright, and refuses a `selector` containing `{`, `}`, `;`, `@`
or a comment marker — each of which ends the rule and turns the rest into a stylesheet of its own.
It does **not** refuse `</style><script>…`, which contains none of those:

```
seed      "</style><script>alert(1)</script>"   REFUSED
name      "</style><script>alert(1)</script>"   REFUSED
selector  "</style><script>alert(1)</script>"   ACCEPTED, and reaches the serialized CSS verbatim
```

The compiler says so itself — *"a caller compiling themes from someone else's data still owns that
question"* — and that is the correct division as long as you know about it. If your themes come from
your own repository, this cannot reach you. If a selector can come from a user, validate it before
compiling, and never inject the result into an inline `<style>` element.

**Client-side checks are not a boundary.** Everything on this page runs in the browser, and anything
in the browser can be bypassed with curl. The whitelisting story, and the one schema that drives the
form and gates the API, are in [injection prevention](security.md#trust-model-option-whitelisting-and-anti-tampering).

## The register

Every finding above came from an adversarial campaign whose rule is that the suite uses the doors a
consumer has: it imports built packages rather than reaching into `packages/*/src`, and a test that
needs to read source instead of importing it must declare why on the line that does it. Findings that
are still open are listed in [known issues](../known-issues.md) with who each one affects, and the
compatibility policy for what a fix may change is in
[contract compatibility](../contract-compatibility.md).
