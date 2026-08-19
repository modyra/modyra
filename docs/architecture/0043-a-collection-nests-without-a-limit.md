# ADR 0043: A collection nests without a limit

Status: Accepted — amended 2026-08-14 (Studio followed) and 2026-08-19 (the path length both doors
keep); supersedes the one-positional-level rule of
[ADR 0040](0040-a-collection-owns-its-subtree.md)

## Context

ADR 0040 made a collection able to hold another, with one exception written into three places: an
array could not contain another array, at any depth below it. Its reason was addressability — *"two
positional levels make a descendant's whole path move for two independent reasons, and nothing in the
contract can tell which one moved it"* — and a document was additionally refused beyond eight levels
or five hundred nodes.

The reason stopped matching the machinery when phases B and C landed. `collectSchemaPaths` collects a
collection's path as a **pattern**: a row's key is chosen at runtime, so descending through one
substitutes `*`. A record inside an array row is `items.*.lines`; an array inside an array row is
simply `items.*`. `numericKeysToArrays` walks those patterns and shapes each level by what its
declaration says. A second positional level is named exactly as unambiguously as the first — the
restriction was a rule the path model no longer needed.

The caps were a separate thing: a number in the document validator, defended as a guard against
hostile input, and a number in the record manager that mirrored it.

## Decision

**A row may hold a field, a group, or a collection of either kind, at any depth.** There is no
positional rule and no maximum depth, in a typed schema or in a parsed document.

- The managers walk a row's shape to check that every node *is* a node — a field, a group, a
  collection — and refuse nothing else about it. The refusal that survives is the one that says the
  thing is not a form.
- `MdyAnyRowDescriptor` names what a row may be, recursively, and the `array()` and `record()`
  factories take it. `MdyDynamicArrayNode.item` is any dynamic node, as a record's already was.
- The document validator's walk is an **explicit stack**, not recursion. With no cap, the call stack
  must not be the limit: a thousand-deep document is answered on its own merits rather than
  overflowing while being read.

## Amendment: what "no limit" bounds, measured

Removing the caps made the *parser* iterative and left the walks after it recursive, so the contract
accepted documents the engine could not build — a `RangeError` at `createForm`, carrying no path and
catchable by nothing. `buildDynamicFormSchema`, `walkSchema`, `collectItemPaths`, the
collection-validator registration walk, the row-shape check and the schema normaliser now walk over
explicit stacks; a document 100,000 levels deep parses, builds and creates a form.

One bound remains and is stated rather than removed: instantiating a **row at every level** costs a
frame per level, because each level's collection manager builds the next while its own call is on the
stack. Measured, 200 levels of rows build and read back; 1000 do not. That is the runtime's stack
rather than a rule of this decision, which is why no number is pinned in a test — the check that
exists asserts the working depth and the agreement between parser and builder, not a ceiling.

## Amendment: the one length a path may not exceed, kept by both doors

A path is the payload key, the draft key, the widget id and a string every renderer carries per
field, so `MDY_MAX_DYNAMIC_PATH_LENGTH` — 512 characters — is a bound on what a *form* can hold, not
on how deep a document may nest. It is the one limit this decision's "no maximum" does not cover, and
it was kept by one door only: `parseDynamicForm` dropped the field and reported
`MDY_DYNAMIC_PATH_TOO_LONG` while `buildDynamicFormSchema` built it from the same document. A
consumer rendering the reported fields and holding data in the built form had a value in the payload
and no control on any screen.

Both doors keep it. The builder leaves out a field whose declared path is past the limit, and a group
or a collection whose whole content went that way goes with it, so the document's own shape decides
what is missing rather than an empty group appearing where the document declared a field. What the
builder measures is the **declared** path — group keys and collection names — because a row key is
data and a row's path is not known until the row exists; each row's own path is measured as it is
flattened, which is where a key long enough to pass the limit is caught.

## Consequences

**A structural change at an outer level rebuilds every collection below it.** That was already true
one level down; it now compounds with depth. A move at the top of a four-level form destroys and
re-registers the whole subtree under the rows it moved. Deep forms with many rows should expect the
cost to be proportional to what is under them, and a consumer who needs a cheaper reorder should keep
the moving level shallow.

**Paths grow with depth.** `orders.o1.lines.0.allocations.a1.bins.2` is one field's name, and every
map keyed by path — claims, bindings, initial values, sanitizers — holds strings that long.

**A document has no size the parser will refuse.** Depth and node count are the caller's to bound
now. The iterative walk removes the crash; it does not remove the cost, and a service accepting
documents from elsewhere should still bound what it accepts before handing it over. What the parser
still refuses is content: a node that is not a node, an unsafe segment name, an `initialValue` of the
wrong shape.

**Studio followed** — *amended 2026-08-14.* `studio-model`'s `ArrayNode.item` is any schema node, `studio-editor` no longer refuses an array
inside an array's row, and `studio-contract` emits the nesting rather than reporting
`UNSUPPORTED_NESTING`, a diagnostic code that no longer exists. What a project can draw and what the
engine can run are the same set again.

## Alternatives rejected

**Keep the rule and document the pattern.** The rule cost nothing to state and everything to work
around: an order with lines each holding allocations is the shape enterprise forms are made of, and
the workaround — key the middle level by a synthetic id — makes a positional list pretend to be keyed
and moves the ordering problem into the consumer's data.

**Lift the positional rule, keep a depth cap.** A cap is a number that has to be right; eight was
inherited from a validator written before collections could nest at all. A form that legitimately
needs nine levels is not a hostile document, and a hostile document is not made safe by nine.

**Keep a cap for parsed documents only.** Defensible, and rejected deliberately: the cap was doing
two jobs, and only one of them — not overflowing the stack — was real. That job is now done by the
walk itself, where it belongs.

## Verification

- `packages/core/test/nested-collections.test.mjs` — a second positional level registers and runs;
  four levels mixing both kinds keep each level's shape; a removal at the outer level takes the whole
  subtree; a twelve-level form builds and is writable.
- `packages/core/test/record-fields.test.mjs` — a document declaring an array inside an array parses
  and builds; a hundred-level document parses; unsafe row keys are still refused at any depth.
- `battle-tests/generative/properties/nested.property.test.mjs` — generated campaigns across the
  boundary, against a model that knows only "a child row lives while its parent row does".
- `packages/studio-contract/test/compile.test.mjs` — a project nesting collections of either kind
  three deep compiles with no error diagnostic, and the emitted contract carries every level.

## Security and privacy

Removing the document caps widens one surface: a parsed document is now bounded by memory and time
rather than by a number. The stack overflow that a deep document would have caused is gone — the walk
is iterative — so the failure mode is slowness under a document a caller chose to accept, not a
crash. Callers accepting documents from untrusted sources should bound the payload before parsing;
the parser's own refusals are about content, and unsafe path segments are still refused at every
level, which is what keeps a hostile key from becoming a field.
