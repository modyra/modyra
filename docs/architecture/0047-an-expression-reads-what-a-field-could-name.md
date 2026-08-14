# ADR 0047: An expression reads what a field could name

Status: Accepted

## Context

`MdyExpression` is the portable predicate a document carries: it decides whether a field shows,
whether a section applies, and whether a cross-field rule fires. It arrives from the same places a
field name does — a CMS, a saved project, a generator — and it addresses fields by dotted path.

Every other door filters those paths with `isSafeFieldPath`, which refuses `__proto__`, `prototype`
and `constructor`. Expressions did not:

```js
isSafeFieldPath("constructor");                                       // false — refused elsewhere
validateExpression({ op: "equals", operands: [{ path: "constructor" }, 1] }, "doc");  // no issues
evaluateExpression({ op: "isNotEmpty", operand: { path: "constructor" } }, {});       // true
```

An empty form has no cells, and a predicate asking about one answered `true`, because the read walked
the prototype chain. Nothing is written and nothing is polluted: what moves is **which branch a
document says applies**. A rule that should never fire fires, a section that should be hidden shows,
and a required field becomes optional — decided by a name no field in the form declares.

`expressionPaths` derives a rule's dependencies from the same operands, so it also handed callers
`__proto__` as a path to subscribe to.

Found from outside by `battle-tests/adversarial/security/expression-paths.battle.test.mjs`.

## Decision

**An expression may name what a field could name, and the root.** `validateExpression` applies the
engine's own path guard to every `{path}` operand it walks, so a document carrying one is refused
where it is read rather than answered later. `expressionPaths` reports only paths that pass, because
a path the engine will not register is not a dependency.

`""` stays legal and means the root value, which is how a form-level rule reads the whole object. It
is not a field path — `isSafeFieldPath("")` is false, correctly — and this is the one reference that
is checked against the contract rather than against that guard.

**A read answers from the value's own properties.** `memberAccess` consults `Object.hasOwn` at each
segment. The guard above refuses the three spellings the engine knows about; this is the layer under
it, and it holds for any name a prototype happens to carry.

## Consequences

A document that has been relying on a predicate reading an inherited member now gets `undefined` and
is refused at parse time. There is no legitimate form of that: the value an expression reads is the
form's own data, assembled by the engine.

Two checks per read — a guard at parse time and an own-property test at evaluation — where there was
none. `Object.hasOwn` runs per path segment on every evaluation, which is the same order of work the
member read already did.

`expressionPaths` silently omitting a refused path is a deliberate asymmetry: the document that
carried it is refused, so nothing downstream is left subscribing to a path with no field.

## Alternatives rejected

**Guard at evaluation only.** The read would be safe and the document would still be accepted, so a
rule that never fires stays in the project looking like a rule that does. A malformed expression has
to be reported at parse time, which is the reason `validateExpression` exists.

**Guard at parse time only.** `evaluateExpression` is exported and a consumer may call it directly
with a value assembled elsewhere. A public function that walks a prototype chain on request is a hole
regardless of who validated the input.

**Refuse `""` along with the rest.** It would make the guard one line shorter and break every
form-level rule, which is a documented use of the type.

**Filter in `parseDynamicForm` rather than in the expression module.** The parser is one caller;
`buildDynamicValidations`, the rule compiler and any consumer holding an expression are others. The
rule belongs where the expression is defined.

## Verification

- `packages/core/test/expression.test.mjs` — the three refused spellings are reported, answered
  `false` and absent from the dependency list; a nested operand carrying one refuses the whole
  expression; an inherited member is not an answer; the root reference still reads the whole value.
- `battle-tests/adversarial/security/expression-paths.battle.test.mjs` — the attack that found it,
  which also asserts the depth limit holds at `MDY_MAX_EXPRESSION_DEPTH`.

## Security and privacy

Closes a control-flow influence available to anyone who can supply a document: naming a member of
`Object.prototype` let an expression answer `true` about a form that holds nothing, and so choose
which rule, section or requirement applies. It was never a write and never an injection — no value
crosses into the form, and nothing is executed — so the exposure is which branch a form takes, and
through that which fields a user is asked for and which validation a submission must satisfy. Whether
a payload changes depends on what the document gates; the engine no longer offers the lever either
way.
