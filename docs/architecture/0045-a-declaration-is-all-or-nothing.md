# ADR 0045: A declaration is all or nothing

Status: Accepted

## Context

A collection declares a row in two steps: it commits the key — or the row count — and then registers
the row's fields from the value it was given. Reading that value can raise. The realistic source is
not a hand-written getter but an ORM entity behind a lazy association, or a proxy over a store that
refuses a column nobody loaded, and a consumer passing one catches the error and carries on.

What it carried on with was a form that would not describe itself consistently:

```js
form.f.rows.upsert("bad", { get code() { throw new Error("not loaded"); } }); // throws
form.f.rows.keys();     // ["ok", "bad"]
form.getValue().rows;   // { ok: … }   — "bad" is not there
```

A positional collection said it more plainly, because `length()` and the value are the same sentence
twice: the count included the row, the value did not. A consumer iterating `keys()` and reading each
row out of `getValue()` found `undefined` — the shape of hole that
[ADR 0043](0043-a-collection-nests-without-a-limit.md)'s work removed from one direction, arriving
from another.

Rewriting a row that already existed was already consistent: the read raised before anything was
written, so the row kept what it had.

## Decision

**A declaration takes effect or it does not.** When reading a row's value raises, the collection is
left as it was and the error is rethrown: a key that was new is withdrawn, and a positional
collection goes back to the rows it had. A row that already existed keeps the row it had, which is
what the failing rewrite already left behind.

Rolling back rather than completing from the template — the answer
[ADR 0026](0026-a-row-exists-because-it-was-declared.md)'s successor gives an `upsert` with *no*
value — because the two calls say different things. A caller who passes no value is stating that the
row exists and letting the template say what it holds. A caller whose value raised stated nothing the
form could read, caught an error, and would reasonably assume nothing happened.

**A row reads the object it was given, prototype chain included.** A class instance or an ORM entity
keeps cells on its prototype — a computed column, a getter over a loaded association — and a row
built from one has to see them. This is the consumer's own object: untrusted shapes arrive through
other doors (a document, a draft, a patch), and those are filtered to the paths the schema declares.

**A schema is read by its own properties.** The normaliser accumulates into a plain object, so a
polluted `Object.prototype` answered for names the schema never declared and `createForm({ note:
field("") })` failed with `Schema key "note" is declared twice` — a message naming a defect in a
schema that had none.

## Consequences

A positional rebuild reads its current rows before writing the new ones, so that the state it may
have to restore is plain data that cannot raise in turn. That is one extra read of the collection per
structural change, on top of the registration it was already doing.

The rollback restores *structure*, not interaction: a list that goes back to its rows is rebuilt, and
what a structural change rebuilds it rebuilds clean, as ever.

Reading the prototype chain means a row can pick up a value from a base object the consumer did not
intend as data. That is the price of supporting entities, it is bounded by the consumer's own code
choosing what to pass, and the ingress paths that carry data from elsewhere do not share it.

## Alternatives rejected

**Complete the row from the template when the value raises.** Consistent with a valueless `upsert`,
and it invents a row out of a call that failed — worse, it can mix template defaults with the cells
the object managed to yield before it raised.

**Let the exception escape and leave the collection as it lands.** What was happening. It makes every
read after a caught error suspect, and the error is one a consumer is right to catch.

**Read own properties only.** It would make an attacker-supplied base object inert — and it breaks
the case that motivates passing an object at all, since a class instance keeps its accessors on the
prototype.

## Verification

- `packages/core/test/record-fields.test.mjs` — a row whose value raises is not declared; a rewrite
  that raises leaves the row it was rewriting.
- `packages/core/test/array-fields.test.mjs` — a push whose value raises does not lengthen the list;
  a `setAll` whose second row raises leaves the rows that were there.
- `packages/core/test/security.test.mjs` — a form builds while `Object.prototype` carries a name the
  schema uses; a row built from a class instance reads its inherited cells.
- `battle-tests/adversarial/security/hostile-values.battle.test.mjs` — the attack that found it,
  covering frozen objects, proxies with counted traps, and one object declared into two forms.

## Security and privacy

The rollback closes a state a hostile or merely lazy value could leave behind: a collection whose
membership and whose value disagree, reached through an error the consumer caught. Reading the
prototype chain is a deliberate trust boundary — a row value is the consumer's own object, while
documents, drafts and patches are filtered to declared paths before they reach a collection. The
`Object.hasOwn` change removes a way for unrelated prototype pollution to break form construction,
which was a denial of service with a misleading message rather than an injection.
