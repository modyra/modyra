# @modyra/zod

## 0.7.0

### Minor Changes

- db89140: A derived form starts at an empty its own schema accepts

  `createZodForm(z.object({ name: z.string() }))` seeded `null`, which `z.string()` refuses — so the
  form was invalid on arrival in the schema's own type vocabulary, and valid once the user typed and
  cleared the field, because `""` is a string. `required` made it a contradiction rather than an
  asymmetry: it meant _the piece refuses `null`_, so the field drove `aria-required` while its own
  validator accepted `""`.

  A leaf now starts at an empty its piece accepts — a default, then `null`, then `""` or `false` where
  the piece holds one — and `required` means _the piece refuses that empty_.

  **Migration.** A form of plain `z.string()` fields is now valid and submittable on arrival, which is
  what the schema says. Write `.min(1)` for a field that must be answered: it refuses the empty at
  arrival and after the user clears it, in the same words.

- b1874dd: A nested collection reaches every package that restates it

  `@modyra/core` allows a collection inside a collection at any depth. Three packages a consumer
  imports could not express that, and their suites were green throughout.

  **`@modyra/angular`** re-declares `array()` and `record()` so their handles carry Angular signals, and
  both still constrained a row to a field or a group:

  ```ts
  array(group({ lines: array(group({ sku: field("") })) })); // ok in @modyra/core, refused here
  ```

  They now take what the engine's take. The refusal bites when a row **is** a collection — a collection
  inside a group inside a row was always legal, since a group's children have always been able to hold
  one. `@modyra/studio-target-angular` generates code against these factories, so a project whose row
  is a collection generated Angular code that did not compile.
  `MdyAnyRowDescriptor`, `MdyAnyRecordDescriptor`, `MdyRecordDescriptor` and `MdyRecordHandle` are
  exported too: the array half was nameable and the record half was not.

  **`@modyra/zod`** mapped a collection's element to a group or a leaf, so `z.record(z.array(...))` and
  `z.array(z.array(...))` became one opaque value where the schema declared a list. A row is now read
  exactly like a schema key. Shapes the engine has no node for — tuple, set, map — still degrade to a
  leaf.

  **A document made of arrays** built a form whose nested collections held no rows. A row's value
  arrives flat, so a collection inside it is keyed `"0"`, `"1"` — what a record holds and what an array
  refuses — and `buildFlatFormSchema` seeded it unchanged. The value read as correct in structure and
  was empty in fact: `@modyra/plain` mounted one control out of three for a three-level document.
  Seeds are now shaped against the descriptor at every depth, so a list inside a keyed row and a keyed
  row inside a list each keep their own shape.

  **`MdyAnyRowDescriptor` is exported** from `@modyra/core`: it is the constraint of the public
  `array()` and `record()` factories, and a consumer writing a helper over row descriptors could not
  name it.

  **A nested collection's value now has the same type as a top-level one.** `MdyArrayItemValue`
  returned `ReadonlyArray` and `Readonly<Record>` for a collection directly inside a collection while
  `MdyFormValue` returned mutable ones a level up — the same value, two types depending on the depth it
  was read at. Nothing changes at runtime; a nested list is no longer typed readonly.

  Recorded as [ADR 0046](https://github.com/modyra/modyra/blob/main/docs/architecture/0046-an-adapter-states-no-less-than-the-engine.md).

- bc26268: A derived leaf is typed by what the form holds

  A form holds what a person typed and what a server sent, and validates it against the schema. It does
  not run the schema's transformations — `.trim()`, `.toLowerCase()`, `.transform()`, `z.coerce.*` —
  and the published leaf type said otherwise: mapped over `z.output` / the Standard Schema output type,
  `z.coerce.number()` declared `number | null` over a field holding `"42"`. The type promised the value
  after a transformation nobody applied, which is wrong in the direction a consumer trusts.

  Both trees now map over the **input** type, and the guide says so.

  **Migration.** Where the two differ, a leaf's type changes: `z.coerce.number()` is now
  `string | number | null` rather than `number | null`. Transform at the boundary you own — in the
  submit action, or with `.transform()` applied to the value you send — rather than expecting the form
  to have done it. Applying transformations on the way in was the alternative and it costs more than it
  buys: `.trim()` on every keystroke takes the space out of `"a b"` while it is being typed.

### Patch Changes

- 69b18ae: A door that takes a schema refuses what is not one, by name

  `createForm`, `buildFlatFormSchema`, `buildDynamicFormSchema` and the Zod bridge all took a schema and
  none of them checked it. Sixteen ways of getting it wrong produced JavaScript internals:

  ```
  createForm("nope")                  TypeError: Cannot convert undefined or null to object
  buildFlatFormSchema(42)             TypeError: fields is not iterable
  buildDynamicFormSchema(null)        TypeError: Cannot read properties of null (reading 'children')
  createZodForm(z.array(…))           TypeError: Cannot convert undefined or null to object
  ```

  Three different mistakes answered by one sentence naming neither the argument nor the call, which a
  consumer cannot tell apart from a defect in the library.

  Two were worse than an internal: `createForm(42)` and `createForm(true)` **built** — a form with no
  fields that reported itself valid and submittable.

  Each door now refuses by name and says what a schema is. A field list checks its entries too: an entry
  that is not an object, or names nothing, is reported instead of reaching a path check that reads
  `.length` off `undefined`. `createZodForm` and `buildZodTree` say that a form's schema has to name its
  fields, and to wrap the shape in `z.object({ … })`.

- 9a91beb: A derived leaf is not typed as possibly `undefined`

  `MdyZodSchemaTree` types a leaf from `z.input`, which is the right half of the decision — a form
  holds what a person typed, not what a transformation would produce. But a piece carrying a
  `.default()` has `z.input` including `undefined`, because a _parse_ may omit the key, and a form leaf
  is never omitted: it exists from the moment the form is built and holds `null` until someone fills it
  in.

  So `z.string().default("")` derived `MdyFieldHandle<string | null | undefined>` over a field that can
  only ever hold `string | null`, and every control declared for the narrower type refused the handle —
  `<mdy-control-text [field]="form.f.password">` did not compile against a schema with a default.

  `undefined` is excluded from the leaf. Nothing about the input-not-output decision changes.

- 2fa493c: A leaf derived from an optional piece starts at an empty that piece accepts. `z.string().optional()`
  parses `undefined` into `undefined` — success with no `data` — and reading that as a default seeded
  `null`, which every optional piece refuses. A form of optional fields therefore called itself valid
  while holding four values its own schema rejects, and parsing what the form holds is the last thing a
  consumer does before sending it. The seeds that already worked are unchanged: a default is its
  value, a nullable is `null`, a string is `""`, a boolean is `false`. See ADR 0086.
- 5ec4a99: How a rule was written does not decide where the field starts

  A leaf's seed is the empty its own piece accepts, and the check for "accepts it" read only the
  library's own length refusals. A `.refine()` — what an author reaches for whenever the rule is not
  one of the built-ins: a consent to tick, a code with a checksum, a list that must contain a member —
  answers `custom`, so `z.string().refine(…)` started at `null` where `z.string().min(2)` started at
  `""`.

  Two costs, and the second is the one a person meets: the seed moved with the _spelling_ of the rule
  rather than with what it says, and the author's own message never appeared, because a value of the
  wrong type never reaches the predicate carrying it — `z.boolean().refine(v => v === true, "must
accept")` opened on _expected boolean, received null_.

- Updated dependencies [435a31a]
- Updated dependencies [76509d3]
- Updated dependencies [d2cdcaa]
- Updated dependencies [27224d8]
- Updated dependencies [894699d]
- Updated dependencies [f297a3c]
- Updated dependencies [09b1c21]
- Updated dependencies [6e53749]
- Updated dependencies [25d004c]
- Updated dependencies [57c68d8]
- Updated dependencies [de7e122]
- Updated dependencies [3fa4c1a]
- Updated dependencies [45eb775]
- Updated dependencies [d2cdcaa]
- Updated dependencies [039059c]
- Updated dependencies [3f0787e]
- Updated dependencies [7ac08a7]
- Updated dependencies [4892a49]
- Updated dependencies [d9203ee]
- Updated dependencies [2904441]
- Updated dependencies [ccde959]
- Updated dependencies [1c164b7]
- Updated dependencies [5440e08]
- Updated dependencies [b9897fb]
- Updated dependencies [a9dcdb4]
- Updated dependencies [d95d4c4]
- Updated dependencies [d470286]
- Updated dependencies [f22d828]
- Updated dependencies [f47ef54]
- Updated dependencies [69b18ae]
- Updated dependencies [6690972]
- Updated dependencies [6d31da6]
- Updated dependencies [a51d3db]
- Updated dependencies [6bc3df5]
- Updated dependencies [404109c]
- Updated dependencies [5f8a35c]
- Updated dependencies [d51b2fa]
- Updated dependencies [8dde798]
- Updated dependencies [cec751a]
- Updated dependencies [95bb48b]
- Updated dependencies [f00ead6]
- Updated dependencies [0c3a770]
- Updated dependencies [1783afc]
- Updated dependencies [f47ee5e]
- Updated dependencies [b6a1325]
- Updated dependencies [3ff02a3]
- Updated dependencies [7f847da]
- Updated dependencies [3233dd4]
- Updated dependencies [d89c221]
- Updated dependencies [1b76a2c]
- Updated dependencies [a2a2bda]
- Updated dependencies [7c8e0b4]
- Updated dependencies [eab4653]
- Updated dependencies [c521845]
- Updated dependencies [599695f]
- Updated dependencies [d443319]
- Updated dependencies [5b5b2df]
- Updated dependencies [ade50ff]
- Updated dependencies [a336b22]
- Updated dependencies [0994475]
- Updated dependencies [7c53545]
- Updated dependencies [896f37b]
- Updated dependencies [86bda68]
- Updated dependencies [abb242d]
- Updated dependencies [b1874dd]
- Updated dependencies [bc1cc05]
- Updated dependencies [1c8e529]
- Updated dependencies [0a96145]
- Updated dependencies [e59d37c]
- Updated dependencies [ecca49f]
- Updated dependencies [2e005a4]
- Updated dependencies [892c01b]
- Updated dependencies [551320a]
- Updated dependencies [e6b35e4]
- Updated dependencies [e35174d]
- Updated dependencies [5e32e40]
- Updated dependencies [29849b2]
- Updated dependencies [626ec0a]
- Updated dependencies [8ad9612]
- Updated dependencies [a0f68a9]
- Updated dependencies [c5f854a]
- Updated dependencies [618a7d0]
- Updated dependencies [906115b]
- Updated dependencies [c395a2c]
- Updated dependencies [df8db70]
- Updated dependencies [9133c94]
- Updated dependencies [e712ea0]
- Updated dependencies [2066daa]
- Updated dependencies [2882c66]
- Updated dependencies [9133c94]
- Updated dependencies [c8f3eb4]
- Updated dependencies [2dd4cff]
- Updated dependencies [fe06a63]
- Updated dependencies [afb6d57]
- Updated dependencies [7695d89]
- Updated dependencies [7f739f7]
- Updated dependencies [70ccff8]
- Updated dependencies [02bbad2]
- Updated dependencies [e2ad213]
- Updated dependencies [7c299e2]
- Updated dependencies [717a69e]
- Updated dependencies [e7e15c7]
- Updated dependencies [6712836]
- Updated dependencies [2bf8290]
- Updated dependencies [095e9ef]
- Updated dependencies [9f45e15]
- Updated dependencies [c7b25ce]
- Updated dependencies [cfa1ec6]
- Updated dependencies [c228019]
- Updated dependencies [0879e90]
- Updated dependencies [44a23e5]
- Updated dependencies [daf38f2]
- Updated dependencies [d6a97f6]
- Updated dependencies [7cbcd34]
- Updated dependencies [ca1c6c3]
- Updated dependencies [aa3574c]
- Updated dependencies [c464e35]
- Updated dependencies [bbf6081]
- Updated dependencies [4914abd]
- Updated dependencies [b5c81b7]
- Updated dependencies [315a533]
- Updated dependencies [30d8a97]
- Updated dependencies [c0e0348]
- Updated dependencies [49cebaa]
- Updated dependencies [7d5dc5b]
- Updated dependencies [8802f09]
- Updated dependencies [bf0c12e]
- Updated dependencies [67aa107]
- Updated dependencies [e30a985]
- Updated dependencies [85ff99a]
- Updated dependencies [9190e59]
- Updated dependencies [ad86c08]
- Updated dependencies [0f9cf08]
- Updated dependencies [e4182c0]
- Updated dependencies [cd62884]
- Updated dependencies [59c70fe]
- Updated dependencies [211ee54]
- Updated dependencies [3fa4c1a]
- Updated dependencies [000f195]
- Updated dependencies [bd8a9ed]
- Updated dependencies [357316c]
- Updated dependencies [7997644]
- Updated dependencies [5589197]
- Updated dependencies [9f29b19]
- Updated dependencies [89e7d14]
- Updated dependencies [bda72f8]
- Updated dependencies [d2e0d7f]
- Updated dependencies [556517c]
- Updated dependencies [4749edc]
- Updated dependencies [eacc848]
- Updated dependencies [83e94a5]
- Updated dependencies [50e1211]
- Updated dependencies [2707f44]
- Updated dependencies [87ff0a4]
- Updated dependencies [621866a]
- Updated dependencies [3c7f88f]
- Updated dependencies [d9583ff]
- Updated dependencies [d51b2fa]
- Updated dependencies [8e5fef8]
- Updated dependencies [c8c8470]
- Updated dependencies [e712ea0]
- Updated dependencies [5029184]
- Updated dependencies [ca1c6c3]
- Updated dependencies [07bea5d]
- Updated dependencies [c849c60]
- Updated dependencies [e16ed4f]
- Updated dependencies [b137ea2]
- Updated dependencies [2b04e24]
- Updated dependencies [55dd238]
- Updated dependencies [4bc6e19]
- Updated dependencies [74dbda3]
- Updated dependencies [3b6ecac]
- Updated dependencies [8347116]
- Updated dependencies [bd05055]
- Updated dependencies [9133c94]
- Updated dependencies [14d74cc]
- Updated dependencies [e7b5f9c]
- Updated dependencies [bb37b4e]
- Updated dependencies [c48c9c1]
  - @modyra/core@2.2.0

## 0.6.0

### Minor Changes

- b31091b: A package depends on its siblings by range, so a tree holds one engine instead of two.

  Every package except `@modyra/angular` pinned its siblings at an exact version. The packages version
  independently, so a release that lands partially — as 2.1.1 did — is enough to install the engine
  twice:

  ```
  npm install @modyra/plain@0.7.0 @modyra/widgets@2.0.2
  → node_modules/@modyra/core                               2.1.0
  → node_modules/@modyra/widgets/node_modules/@modyra/core  2.1.1
  ```

  And two copies of `@modyra/core` are two engines. The engine keeps module-level symbols and
  registries, so a `required()` built by one is **not required** to the other: `MDY_MARKS_REQUIRED` and
  `MDY_VALIDATOR_FACTS` do not match across the boundary, and `aria-required` — along with every
  declared constraint — stops crossing it. That is what ADR 0030 exists to prevent, arriving through
  packaging instead of code.

  Sibling dependencies are now `^` ranges, which is what `@modyra/angular` already published and what a
  package manager deduplicates. `npm run test:tarballs` installs everything this repository publishes
  into a clean consumer and counts the copies: more than one fails the gate, naming the paths.

  Nothing changes for a consumer who installs a matched set. A consumer holding an older adapter now
  gets engine patches instead of being pinned away from them.

  See ADR 0033.

### Patch Changes

- Updated dependencies [34d5023]
- Updated dependencies [b31091b]
  - @modyra/core@2.2.0

## 0.5.4

### Patch Changes

- 6921584: A rule declares what it enforces, and the control offers it.

  `maxLength(50)` used to let someone type five hundred characters and hear about it afterwards: the
  constraint reached the error list and never the input. Only `min`/`max` on numbers had made the
  crossing, and each renderer wrote those by hand.

  Now every rule with a native counterpart declares it — `required`, `min`, `max`, `integer` (a step of
  one), `minLength`, `maxLength`, `pattern`, `email` — a field reports the total as
  `MdyFieldState.constraints` / `MdyFieldHandle.constraints`, and every renderer offers what its kind
  can carry. The translation lives in `@modyra/widgets` (`nativeConstraintAttributes`), once. A rule
  with no native counterpart declares nothing and stays exactly what it was.

  **A declared fact now survives composition.** `compose()` and `composeFirst()` carry the sum of what
  they combine. This fixes a silent defect as old as `compose`: `compose(required(), maxLength(3))`
  produced a field that was **not marked required** — no `aria-required`, nothing for a screen reader.
  Where two rules bound the same thing the tightest wins; two different patterns cancel, because an
  input carries one and their intersection is a rule nobody wrote.

  **A Zod schema crosses over untouched**: `z.string().min(3).max(8)` reaches `minlength`/`maxlength`.
  Only what has a native counterpart crosses — `z.number().gt(10)` deliberately does not, since
  `min="10"` would admit exactly the value it refuses.

  **The boundary is the model.** Attributes constrain typing. A value arriving from a draft, a server
  or `set()` is kept whole and judged by the rules, as ADR 0029 requires of a widget.

  Also in this change:

  - **A conditional section now covers the collections inside it**, rows already declared included.
    _Out of play if any condition says no_ was written three times and one copy did not know about the
    others; it is written once now, in `conditions.ts`.
  - **`createForm` forwards `devWarnings`.** The switch the guides promised for silencing development
    diagnostics could not be reached from a typed form at all.
  - New development diagnostics, each silent in the ordinary case: a binding that cannot put back in
    play what the schema left out, two patterns that cancel each other, and a `when` predicate that
    gives two answers for the same value.

  `MdyFieldState.bounds`, added in an unreleased changeset, is now `constraints` and carries the whole
  family. Nothing published ever had it.

  See ADR 0030.

- 596419f: `z.record()` becomes a keyed collection instead of one opaque field.

  The adapter mapped `z.object()` to a group and `z.array()` to a typed field array; everything else
  became a leaf, and `z.record()` fell there. The result was a single field holding the whole object:
  no rows, no `upsert`/`remove`, no cells, nothing a renderer could draw — and, because a record
  rejects `null`, a form invalid from its first moment with "expected record, received null" and no
  way to fix it short of `set()`ing the entire object. The engine has had keyed collections since
  ADR 0026, and `@modyra/standard-schema` already honoured them; only the adapter that _derives_ the
  tree did not.

  A `z.record(key, value)` now builds a record whose row is a group when the value is a `z.object()`
  and a leaf otherwise — the same choice the array branch already makes on its element. Its initial
  value follows the same rule as arrays: whatever the piece parses `undefined` into, else no rows.

  **Migration.** If you have a `z.record()` in a schema, `form.f.<name>` is now a record handle rather
  than a field handle: read `form.getValue().<name>` for the object, and use `upsert(key, row)`,
  `remove(key)`, `rename(from, to)` and `cell(key, field)` where you previously wrote `set()` with a
  whole object. The value shape is unchanged.

  Nothing else changes: `z.tuple()`, `z.set()` and `z.map()` stay single fields — the engine has
  no node for them, and inventing one would declare a structure the schema does not. Note that zod's
  own `z.record(z.enum([...]), …)` requires every enum key to be present, so such a record is invalid
  while it is empty; that is the schema's rule, not the adapter's.

- Updated dependencies [2e29f30]
- Updated dependencies [2e29f30]
- Updated dependencies [c47d0ac]
- Updated dependencies [6921584]
- Updated dependencies [6581883]
- Updated dependencies [2e29f30]
- Updated dependencies [cf498d8]
- Updated dependencies [985685b]
- Updated dependencies [b048e2c]
- Updated dependencies [d5c1774]
- Updated dependencies [94474e4]
- Updated dependencies [039b0b9]
- Updated dependencies [062881c]
- Updated dependencies [c090eac]
- Updated dependencies [992b36d]
- Updated dependencies [850a463]
- Updated dependencies [90fdf00]
- Updated dependencies [df1aaeb]
- Updated dependencies [c47d0ac]
- Updated dependencies [2a38f16]
- Updated dependencies [6921584]
  - @modyra/core@2.1.1

## 0.5.3

### Patch Changes

- Updated dependencies [0b64826]
- Updated dependencies [ba5f5f9]
- Updated dependencies [faf3275]
- Updated dependencies [206b0b3]
- Updated dependencies [3d8391b]
- Updated dependencies [495ff44]
- Updated dependencies [8b88c9f]
  - @modyra/core@2.1.0

## 0.5.2

### Patch Changes

- Updated dependencies [2037ba5]
- Updated dependencies [3161bad]
  - @modyra/core@2.0.0

## 0.5.1

### Patch Changes

- 342f396: These packages are now compiled by TypeScript 7.

  Nothing about the published API changes, and that is checked rather than asserted: both compilers
  emit all twenty-one projects and the results are compared file by file. Across 464 files the only
  difference is the order in which the members of a string-literal union are printed in
  `catalog.d.ts` — the same type either way. The contract snapshot is unmoved, and the Angular package
  still builds through its own TypeScript 5.9 toolchain from these declarations.

  The Angular package and Studio's embedded compiler stay on TypeScript 5.9, which their peer ranges
  and its package exports require.

- Updated dependencies [0a23bfd]
- Updated dependencies [e8b586a]
- Updated dependencies [76f4e7e]
- Updated dependencies [27c1222]
- Updated dependencies [7bafd3d]
- Updated dependencies [3bb85a6]
- Updated dependencies [186cbad]
- Updated dependencies [3068258]
- Updated dependencies [0d3fa5f]
- Updated dependencies [08cb845]
- Updated dependencies [8e67cfe]
- Updated dependencies [75d2553]
- Updated dependencies
- Updated dependencies [342f396]
- Updated dependencies [1a99bbb]
  - @modyra/core@1.0.0

## 0.5.0

### Patch Changes

- Updated dependencies [29621a7]
- Updated dependencies [b0aa545]
- Updated dependencies [2ce4ef1]
- Updated dependencies [9e8cbad]
- Updated dependencies [879b5e9]
- Updated dependencies [c4ca77d]
- Updated dependencies [207901b]
- Updated dependencies [05c5665]
- Updated dependencies [242551e]
- Updated dependencies [d568743]
- Updated dependencies [098a0af]
- Updated dependencies [a8606da]
- Updated dependencies [f5ee72d]
- Updated dependencies [9864d9a]
- Updated dependencies [6aab031]
- Updated dependencies [fd87ae7]
- Updated dependencies [1523836]
- Updated dependencies [fc6327f]
- Updated dependencies [61271c5]
- Updated dependencies [fe0dba3]
- Updated dependencies [df563d4]
- Updated dependencies [1644bf5]
- Updated dependencies [ec3d8ca]
  - @modyra/core@0.5.0

## 0.4.0

### Minor Changes

- 0e9a293: Add `serverValidate(schema, payload)` to `@modyra/zod` (sync) and
  `@modyra/standard-schema` (async) — full-schema server-side validation
  returning the same `MdyFormError[]` shape a `form.submit()` action does,
  so one schema and one error shape feed both client and server rejection.
  See the new "one schema, two sides" guide
  (`docs/guides/server-validation.md`) for Next.js/Express/Hono examples.

  Introduce `@modyra/solid`, a Solid binding for the form engine
  (`solidReactivity`, `createSolidForm`, `useSolidForm`) running on Solid's
  native signals, plus the headless widgets bridge (`useMdyField`,
  `useMdySelect`, `executeSolidCommands`) and an `examples/solid/` demo.
  The headless-recipes doc section is tracked as follow-up work.

  Introduce `@modyra/preact`, a thin variant of `@modyra/react` on
  `preact/hooks` + `preact/compat`'s `useSyncExternalStore`. Includes the
  widgets bridge, the React adapter's headless-recipes suite ported
  verbatim (same test file, same assertions — the recipes only touch the
  framework-agnostic field handle), and an `examples/preact/` demo.

  Framework examples for both new adapters are wired into
  `build:examples`/`demo:solid`/`demo:preact` and ship the same signup demo
  (schema validators, cross-field password check, draft persistence,
  undo/redo, cancellable server-side username check) already shown in
  `examples/react` and `examples/vue`.

  `docs/guides/headless-recipes.md` gains a Preact note (the recipes work
  unchanged) and a full Solid section (handles read as accessors directly
  in JSX, no subscription hook) — both verbatim-tested in their adapters'
  `headless-recipes.test.mjs`.

  Introduce `@modyra/svelte`, running the engine on `vanillaReactivity()`
  plus a `toStore()` helper that adapts any Modyra signal into a real
  Svelte `Readable` (`get()`/`$store` syntax both work, verified against
  `svelte/store` directly). Deliberately stores-based, not runes-based:
  Svelte 5's runes are compiler macros unusable in a plain `tsc`-built
  package, while `svelte/store` is ordinary JavaScript — this keeps
  `@modyra/svelte` buildable and testable the same way as every other
  adapter (`tsc` + `node --test`, no new toolchain). A runes-based
  ergonomic layer is a separate, larger follow-up decision (see the
  package README). Includes the headless widgets bridge (`useMdyField`,
  `useMdySelect`, `executeSvelteCommands`) exposing state/view as
  `Readable` stores. No `examples/svelte` yet (needs a Svelte-aware
  bundler for a real `.svelte` file, a separate decision).

### Patch Changes

- Updated dependencies [318e721]
- Updated dependencies [1bb844f]
  - @modyra/core@0.4.0

## 0.3.0

### Patch Changes

- Updated dependencies [c7dadfb]
- Updated dependencies [7554cc8]
- Updated dependencies [fc22197]
  - @modyra/core@0.3.0

## 0.2.0

### Minor Changes

- fd1e9d8: Add typed field arrays via `array()` — repeatable rows with
  `push`/`insert`/`remove`/`move`/`setAll`, wired through
  `@modyra/angular/adapter` and `@modyra/zod` (`z.array()`).

### Patch Changes

- Updated dependencies [fd1e9d8]
  - @modyra/core@0.2.0
