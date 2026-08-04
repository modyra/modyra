# @modyra/core

## 1.0.0

### Major Changes

- 27c1222: A reactivity says what it is.

  `MdyReactivity.id` and `.kind` were optional, marked "optional until every adapter is migrated". Every
  adapter has been migrated for some time: `vanilla`, `vue`, `react`, `solid`, `preact`, `svelte` and
  `angular` all declare both, measured by calling each factory and reading the fields.

  They are required now. 1.0 should not freeze an interface that describes a migration which is over —
  an optional field every implementation supplies is a field consumers must still write a branch for.

  - **`id`** identifies a reactivity by symbol rather than by name. Two adapters can both call
    themselves `"react"`; only the symbol says whether they are the same one. The headless adapters
    share vanilla's symbol deliberately — they _are_ vanilla underneath.
  - **`kind`** is what it calls itself, for diagnostics.

  **Migration:** an implementation of `MdyReactivity` written outside this repository must add both.
  Every adapter shipped here already has them, so nothing changes for anyone consuming one.

  **Classification.** `contract:diff` reports `patch` — it snapshots the widget catalogue and cannot
  see the reactivity interface. Shipped as `major`: a required field added to an interface consumers
  implement is exactly the asymmetry `docs/contract-compatibility.md` calls major.

- Modyra 1.0.

  **What 1.0 covers is two packages, and that is the whole of it.** `@modyra/core` — the form engine and
  the Dynamic Form Contract, zero dependencies — and `@modyra/widgets`, the widget contract, which
  depends only on core. The perimeter is checked rather than claimed:
  `scripts/audit-package-independence.mjs` passes, core declares no dependencies at all, and widgets
  declares exactly one.

  Studio, the Rust and Java SDKs, the five headless adapters and the three rendering adapters ship
  independently and stay on 0.x. The renderers reach 1.0 after the contract does, not with it — a
  version number over all of it would be a promise about the parts least ready to make one.

  **What you are promised** is in `docs/contract-compatibility.md`: nothing is removed or changed
  breakingly outside a major, a deprecation keeps working until the next major and never less than one
  minor, and both halves of a deprecation — `since` and a replacement — are enforced by a check.

  **What holds it up.** Every claim here has a check that has been watched to fail:

  - the widget catalogue is snapshotted and every change classified;
  - **205 exported shapes** are snapshotted too, so a type change is classified rather than invisible;
  - what the tarballs actually contain is installed into a clean consumer, imported, type-checked and
    run — all 26 entry points, with a baseline so a withdrawn one is a diff;
  - two renderers are conformance-checked against the contract, in every configured variant;
  - the browser suites run on three engines and block, with screenshot baselines per renderer, engine
    and theme.

  **Known and open**, because a 1.0 that hides its defects is worth less than one that names them:
  WebKit ends the page when a visually hidden native input is reached, which affects the radio and
  colours widgets there. It is recorded as finding **N** in `docs/contract-gaps.md`, and the rows that
  cannot run are quarantined by name rather than by making a suite permissive.

### Minor Changes

- 0a23bfd: The conformance suite checks that a declared equality capability is actually honoured.

  `capabilities.signalEquality` and `capabilities.computedEquality` are declared by every adapter and
  were verified by nothing. The one check that mentioned them asserted they are **booleans** — not that
  a `true` means anything. An adapter that accepts `options.equal` and drops it on the floor passed:
  the shape is right, the types are right, and the option is silently ignored.

  That is the "accepted but unhonoured option" the adapter contract was written to prevent, and the Vue
  adapter's own source flags it as the risk it deliberately avoided. Nothing was checking.

  Two capability-gated tests now do: a comparator that calls every value equal must suppress the write
  and must notify nothing. Every adapter passes — the suite had simply never asked. Removing the
  comparator from an adapter's `signal()` fails the new check and nothing else.

  Solid also moves onto the conformance suite directly, with a harness whose scope owns the effects the
  suite creates and is genuinely destroyed. That is 2 of 6 adapters off the compatibility shim.

- e8b586a: A date field can name its own locale.

  `MdyDynamicDateField` and `MdyDynamicDaterangeField` gain `locale`, `firstDayOfWeek`, `minDate` and
  `maxDate`. Until now the contract had no locale surface at all: `mountMdyForm` could not pass one,
  every renderer fell back to `navigator.language`, and Plain's `renderDatepickerField` carried an
  `options` parameter its own mount path could never populate — reachable only by a host calling the
  renderer directly.

  `navigator.language` is the _visitor's_ preference, not the form's. A booking form for an Italian
  office should show an Italian calendar to a visitor whose browser is in English, and only the form
  knows that.

  ```ts
  mountMdyForm(host, [
    { name: "when", kind: "datepicker", label: "When", locale: "it-IT" },
  ]);
  // L M M G V S D, in an en-US browser
  ```

  All four are optional and unset behaves exactly as before, so no existing form changes.

  `parseDynamicFields` validates them, because these arrive from config files rather than from typed
  code. The locale check is the one that matters: a malformed tag does not degrade — `Intl` throws a
  `RangeError` — so a config carrying `"en_US"` would have taken the form down at mount rather than
  rendering an approximate calendar. `firstDayOfWeek` must be an integer from 0 to 6, the dates must
  be real ISO dates (`2026-02-30` is rejected), and `minDate` may not follow `maxDate`.

  A field failing any of these is dropped with a development warning, the same way a `number` field
  with `min` above `max` already was.

- 76f4e7e: Cross-field validation is expressible in the Dynamic Form Contract, and a contract's tree can be built into a running form.

  Two additions, both filling gaps that forced callers to work around the contract rather than through it.

  **`validations`** — a new optional slot on `MdyDynamicFormConfigV2`, carrying `{ when, message, target? }`.
  `rules` could only show, hide, enable and disable, and its predicate is flat: one field, one operator,
  one value. A rule that _invalidates_ has a message and needs a tree, so "shipping is required when the
  country is not IT and the total is over 100" had nowhere to go. `when` is an `MdyExpression`, a
  portable predicate over the form value with twelve enumerated operators, addressed by path — no
  `eval`, no `new Function`, and `matches` takes its pattern only from a literal so a form's own data
  cannot choose the regular expression. Malformed expressions are reported by `parseDynamicForm`
  alongside calendar options and number bounds, never thrown at runtime. `buildDynamicValidations`
  turns them into ordinary `crossField` validators, deriving each one's dependencies from the condition
  so the two cannot disagree.

  **`buildDynamicFormSchema`** — builds a form from the contract's schema _tree_, keeping its groups and
  arrays. `flattenDynamicSchema` answers a different question: it produces one flat list of dotted names
  for a renderer drawing a sequence of controls, and in doing so fixes each array at however many rows
  its initial value happened to have. That is correct for drawing and wrong for running — a row the user
  adds afterwards has no descriptor. Until now the contract could _describe_ a nested form that nothing
  could _instantiate_, so anything needing a live nested form had to read some other model instead.

  Both are additive. A document that declares no `validations` parses exactly as before.

- 7bafd3d: The reactivity conformance suite checks that a destroyed scope stops the effects it owns.

  `@modyra/core/testing` already asked whether a scope fires its cleanups and cascades to its children.
  Neither question reaches the guarantee a scope exists for: **that what was created inside it stops.**
  An adapter whose scope registers nothing passes both of the old checks and leaks every effect a form
  ever made.

  Every adapter in the repo passes the new check — the suite had simply never asked. It fails when the
  ownership registration is removed from an adapter, which is the point.

  Vue now runs the conformance suite directly rather than through
  `core/test/reactivity-contract.mjs`. That shim hardcodes `destroy: () => {}` and a flush that
  resolves immediately, so an adapter tested through it is never asked to tear anything down and never
  asked to flush anything real. Vue's harness supplies a scope that owns every effect the suite makes
  and Vue's own `nextTick`.

  Worth knowing for anyone writing an adapter harness: `options.scope` is the ownership channel.
  `scope.run()` enters the reactive context and does not, on its own, transfer ownership.

- 3bb85a6: A select declares whether it filters.

  `searchable?: boolean` joins the option-based field config, defaulting to `false`. It selects one of
  two interaction models, and they are different controls to anyone not using a pointer:

  - **`false` is a listbox** — no filter box, focus stays on the trigger, typing accumulates into a
    typeahead that jumps to the first matching option.
  - **`true` is a combobox** — focus moves into the search input on open, typing filters.

  Both drive the list with `aria-activedescendant` rather than moving focus into it.

  It is contract data rather than a renderer input because the alternative is what exists today: it was
  a component input in two adapters, absent from the third and from the document format, so one widget
  had three behaviours and one of them matched a single character of any typeahead. A renderer cannot
  honour a distinction it has no way to read.

  Both SDKs carry it, for the reason `mode` did: a document that loses it describes a different
  control.

  [ADR 0018](https://github.com/modyra/modyra/blob/main/docs/architecture/0018-a-select-declares-whether-it-filters.md)
  records the two models and what each renderer owes them.

  **Classification.** `contract:diff` reports `patch`: it snapshots the widget catalogue, and this is a
  field on the _form_ contract, which it cannot see at all. Shipped as `minor` for an additive optional
  field — the same blind spot as finding **K**, in a part of the surface that finding had not yet
  reached.

- 186cbad: A kind whose anatomy depends on its configuration declares it.

  `multiselect` renders a choice two ways: in `single` mode an option is a `<button>` with a tick, in
  `multi` it is a container holding a count between two step buttons. No single element declaration
  fits both, so `option` was declared `presentation` and nothing checked it in either mode. That was
  finding **J2**.

  The catalogue now declares **variants**, keyed by the `mode` the field config already carries:

  ```ts
  variants: {
    single: { elements: { option: "button"    }, required: ["optionCheck"] },
    multi:  { elements: { option: "container" }, required: ["optionStep", "optionCount"] },
  }
  ```

  In `single` the option _is_ the control; in `multi` it contains them. Both named, which is what
  [ADR 0014](https://github.com/modyra/modyra/blob/main/docs/architecture/0014-the-contract-names-the-responsible-element.md)
  requires and what saying "one of these is operable" cannot give.

  **Closed, and defined once.** `MdyWidgetVariant` is an alias of `MdyMultiselectMode` — newly named in
  `@modyra/core`, the same union `mode` already used — so the variant key _is_ the value a document
  carries. An invented name is a compile error, with a runtime guard behind it for callers without
  types.

  **`container`** is a new semantic element: a part that holds controls and is not one. `presentation`
  admits everything by design, so it could not refuse a `<button>` holding a `<button>`.

  **`MdyWidgetShape` is generic over its parts.** `required: ["notAPart"]` no longer compiles — which
  needed `NoInfer` on the shape parameter, because otherwise the shape is a second inference site and a
  name appearing only there widens the part union to include it.

  **For adapters:** declare which variants you support and the conformance kit mounts each. Declaring
  none is checked exactly as before, so this is additive for the sixteen kinds that have no variants.
  `contract-diff` now snapshots and compares variants, so declaring or withdrawing one is classified.

  `@modyra/lit`'s counter steppers gain accessible names — they were icon-only buttons announcing
  nothing, a defect the rule found the moment it existed.

- 0d3fa5f: `@modyra/core/async-draft-storage` — drafts on a Promise-based store.

  `MdyDraftStorage` is synchronous by design: a field writes a draft while the user types, and there
  is nothing useful to hand a caller that cannot wait. React Native's standard storage is
  Promise-based, so the two never met. The React Native guide documented the workaround — hydrate a
  `Map`, read and write it synchronously, flush in the background — and said it was "not built, not
  tested here". This is that adapter, built and tested; the guide now links to it.

  ```ts
  const storage = createHydratedDraftStorage({
    backend: AsyncStorage,
    keys: ["checkout-draft"],
  });
  await storage.ready;
  ```

  No new dependency: the backend is an argument, so anything with `getItem`/`setItem`/`removeItem`
  returning promises works — AsyncStorage, an IndexedDB wrapper, or a test double.

  Two semantics the shape does not make obvious, both chosen deliberately and both covered by a test
  that fails when they are reversed:

  - **A read before hydration finishes returns `null`** — "no draft", never a stale or partial one. A
    synchronous read cannot block, and restoring the wrong draft is worse than restoring none. `ready`
    exists so a caller can wait before restoring, and a write that lands during hydration wins over
    what the store held: the user is allowed to be faster than the disk.
  - **A failed flush is never thrown into the form and never loses the draft.** The value stays in the
    cache, so the user keeps typing and the next write retries it. `onError` reports it; without one
    the failure is silent, which is the bargain the default `localStorage` storage already makes with
    quota errors.

- 75d2553: Text on a filled surface is light while light is readable.

  An `on-` colour was whichever of black and white had the higher WCAG 2 contrast ratio. That ratio's
  luminance formula weights blue at a fourteenth of green, so it rates dark text on a saturated colour
  far above what a reader experiences — and it put black text on a saturated blue in every theme.

  Measured, and consistent rather than marginal:

  | background | ratio, white | ratio, black | ratio picks | perceptual metric picks |
  | ---------- | ------------ | ------------ | ----------- | ----------------------- |
  | `#3B82F6`  | 3.68:1       | 5.71:1       | black       | white                   |
  | `#7067FF`  | 4.14:1       | 5.07:1       | black       | white                   |

  Across 112 pairs of a derived palette the two disagree on 37, always in that direction.

  **The rule is now: light while light clears a floor, the higher ratio below that.** The floor is
  `MDY_ON_COLOR_FLOOR`, newly exported from `@modyra/core/color-utils` — the one addition to the public
  surface. Following the perceptual metric without a bound was rejected on measurement: it puts 36 of
  those 112 pairs under AA, the worst at 2.96:1.

  `onColorFor` had the same defect. It is exact rather than estimated, and it returned black for
  `#3B82F6` too, because it was maximising the same ratio — so precomputing a palette would not have
  avoided this.

  **The floor is below AA for normal text, deliberately**, and above the 3:1 that AA asks of large text
  and UI components. [ADR 0015](https://github.com/modyra/modyra/blob/main/docs/architecture/0015-light-text-while-it-is-readable.md)
  states the cost and what to do about it under a strict audit.

  **Migration:** a host that sets its own `on-` colours sees no change. One deriving them sees light
  text where it saw dark on saturated mid tones — including `--mdy-sys-color-on-primary`, which the
  datepicker's selected day and every filled control read.

### Patch Changes

- 3068258: `@modyra/core` no longer names an adapter in its dev warnings.

  Three warnings — `enableHistory()`, `enableDraft()` and async validators — told the reader to
  "construct it with an Injector" "with the Angular adapter". A package naming its own dependent
  inverts the dependency direction in prose while the import graph stays clean, and the advice was
  wrong for every other adapter.

  They now point at whichever reactivity adapter the caller is using. Dev-only (`MDY_DEV`), so nothing
  ships differently in production.

- 08cb845: Every adapter's conformance suite runs the reactivity that package actually exports.

  `@modyra/preact`, `@modyra/react`, `@modyra/svelte` and `@modyra/lit` each ship a named
  `*Reactivity()` — core's graph re-tagged with their own `kind`, which the capability matrix
  introspects. **Every one of their conformance files ran `vanillaReactivity()` instead.** The export
  consumers import was covered by nothing, and a re-tag is a spread: the one shape that silently drops
  a member.

  It does now, plus a check that the re-tag still carries every member. Removing `createScope` from
  one of them fails eleven tests; before this it failed none.

  The backward-compatibility shim `core/test/reactivity-contract.mjs` is **gone**. It existed to adapt
  the old `runReactivityContract(name, factory)` signature for "every adapter package's own
  `test/reactivity.test.mjs`", and no adapter uses that signature any more. It also hardcoded
  `destroy: () => {}` and an immediate flush, so nothing tested through it was ever asked to tear down
  or to flush.

- 8e67cfe: Every exported shape in the 1.0 packages is classified.

  `contract-diff` snapshots the widget _catalogue_ — parts, relations, states, capabilities — and had
  never seen a TypeScript type. So every public interface was outside classification, and it showed:
  four changes in recent memory reported `patch` because the differ had nothing to compare, including
  a projection's shape and a required field added to an interface four adapters implement.

  `npm run test:type-surface` records **205 exported shapes** from the _emitted_ declarations, with
  member names and optionality, and classifies a change the way `docs/contract-compatibility.md` says:

  - optional → required, or a member removed: **major**
  - a new optional member, or a newly exported shape: **minor**

  Accept an intended change with `npm run type-surface:accept`.

  This is what freezes `MdyFormError`, `MdyDynamicDiagnostic` and the parse result: not by forbidding
  change, but by making a change to any of them a reviewable diff with a level attached.

  **What it still cannot see** is member _types_ — that `payload` exists and is optional, not that it
  is `unknown`. A widening is invisible, and saying so is better than implying otherwise.

- 342f396: These packages are now compiled by TypeScript 7.

  Nothing about the published API changes, and that is checked rather than asserted: both compilers
  emit all twenty-one projects and the results are compared file by file. Across 464 files the only
  difference is the order in which the members of a string-literal union are printed in
  `catalog.d.ts` — the same type either way. The contract snapshot is unmoved, and the Angular package
  still builds through its own TypeScript 5.9 toolchain from these declarations.

  The Angular package and Studio's embedded compiler stay on TypeScript 5.9, which their peer ranges
  and its package exports require.

- 1a99bbb: The SDKs carry the multiselect mode, and say what they ignore.

  `mode` has been in the Dynamic Form Contract all along, and neither SDK modelled it. Java's
  `MdyDynamicOptionsField` had no such component and `@JsonIgnoreProperties(ignoreUnknown = true)` on
  top; Rust's `Field` had no such member. So a server that parsed a form and re-emitted it **silently
  turned a counter multiselect into a toggle one** — and now that the widget contract picks an anatomy
  by that value, the re-emitted document describes a different widget than the one it was written as.

  Both SDKs now carry it, and both are tested by round trip rather than by inspection.

  **`@JsonIgnoreProperties(ignoreUnknown = true)` is gone from all five field records.** An SDK that
  reports success on a document it did not understand is the same silence one level up. The policy is
  now stated once in the parser instead of five times on the records, and unknown properties are
  **reported** as `MDY_DYNAMIC_UNKNOWN_PROPERTY` diagnostics rather than dropped — lenient enough that
  a document written against a later contract still parses, honest enough that nothing disappears
  without a word.

  Rust also validates the value: an unrecognised mode is `MDY_DYNAMIC_UNKNOWN_MODE`, and a mode on a
  kind that has none is `MDY_DYNAMIC_UNEXPECTED_MODE`. A mode nothing describes is worse than none,
  because the widget contract would check the field against no anatomy at all.

  The five headless adapters are unaffected: they render no markup, so no anatomy depends on the mode
  there.

## 0.5.0

### Minor Changes

- 29621a7: A field name is an identity, and two of them cannot collide

  Generated ids are `${widgetId}__${part}`. A field named `a__label` therefore lands on the same id as
  field `a`'s label, in a different role — and the browser is perfectly happy to hold two elements
  with one id, so `getElementById`, `label[for]` and every ARIA IDREF quietly stop being
  deterministic. The failure is invisible until two particular fields share a page.

  **`__` is now forbidden in a field name** rather than escaped. Escaping would have encoded `_`,
  changing the id of every field whose name contains one, and those ids are consumer-visible —
  selectors and tests are written against them. Forbidding costs nothing by comparison: an id built
  from a name containing the delimiter was never deterministic, so nothing correct is taken away. The
  dynamic parser drops such a field with a warning, as it already does for names containing `.`;
  `mountMdyForm` throws, because a typed call site can be told at the call site.

  `MDY_ID_DELIMITER` and `isValidWidgetId` are exported so a consumer can check a name before
  building one. The delimiter lives in `@modyra/core` — the parser needs it and core cannot import
  `@modyra/widgets` — and is re-exported from `@modyra/widgets` where the id policy lives.

  **`mountMdyForm` also rejects duplicate names.** Two definitions sharing one used to collapse
  silently: the second overwrote the first in the name map, the `rendered` set stopped the first from
  drawing, and the form came out with one instance where the caller asked for two — a difference
  visible only by counting. The dynamic parser already refused duplicates; the typed entry point now
  holds the same precondition, and names the duplicate.

  **If you have a field whose name contains `__`**, rename it. It was already producing colliding ids;
  this only makes the collision say so.

- b0aa545: Contract v3: a slot says where it sits and whether it shows

  v2 made a row's track count authorable per size. What it could not express is anything about one
  child of that row: a field that moves to another column on a wide screen, or that is not shown on a
  phone. Those are properties of the slot, not of the row, and there was nowhere to put them.

  **Contract v3** adds one thing — a slot that says more than its name:

  ```json
  {
    "ref": "coupon",
    "at": { "base": { "hidden": true }, "md": { "column": 2, "hidden": false } }
  }
  ```

  A bare string still means "this field, wherever the row puts it", and the two spellings mix freely
  inside one row. `column` is 1-based and refused when it names a track the row does not have;
  `hidden` is a boolean; a size that says neither is refused as the typo it usually is.

  **The row's track count stays where v2 put it.** `at` on the columns node keeps meaning what it
  means, rather than being respelled as `{ columns: n }`. One property, one spelling — a second way to
  say the same thing would leave every reader deciding which wins, and would force a v2 row to be
  rewritten to say what it already says. Everything else in a v3 document — `fields`, `schema`,
  `layout`, `rules` — is v2's, unchanged, so **a v2 document is a v3 document with the version raised**,
  and v2 keeps parsing exactly as before. A v3 slot inside a v2 document is refused: accepting it would
  make this parser disagree with every other reader of the same bytes.

  The placement lands on the **column**, not on a wrapper inside it, because the column is the grid
  item — `grid-column` and `display` are properties of one, and nothing nested inside a cell can move
  itself into a different track however it is styled. A column holding several slots takes the first
  placement it is given, which is exactly how every row Studio authors is built.

  `layoutSlotStyle` in `@modyra/widgets` turns `at` into custom properties, and the foundation reads
  them through the same mobile-first cascade the track count already uses: what a size does not say, it
  inherits from the next smaller one. Visibility is a `display` value rather than a class for that
  reason — a class cannot be undone at a larger size without a second class saying the opposite, and
  "hidden on a phone, shown from tablet" is the case worth having.

  Both config-driven renderers honour it: `@modyra/plain` and `<mdy-dynamic-form>`.

- 2ce4ef1: A third way to derive a palette, and a tonal model for the two that were already there

  Modyra derived a palette two ways: OKLCH arithmetic and Material's HCT, both live in the browser
  through relative colour syntax. A perceptual model cannot be expressed that way, because it asks a
  question CSS has no way to answer at paint time — how much chroma sRGB can actually show at this
  lightness and hue — and then moves lightness only as far as a minimum perceptual distance requires.
  So it compiles instead. `@modyra/core/theme-compiler` turns one seed into complete light and dark
  `--mdy-sys-color-*` sets, solved independently rather than one lifted from the other, and
  `@modyra/styles/salience.css` is the first theme it produced.

  It sits on its own subpath, not in the root barrel: it is build-time code, and re-exporting it took
  the core entry from 14.7 KB to 18.0 KB gzip against a 15 KB budget.

  The live models gain `tonal`, which ramps the brand hue deep-to-pale instead of rotating it, and
  per-role chroma floors so a muted brand still derives a visible accent instead of collapsing into
  grey. Colours that are actually neutral stay neutral: below c = 0.005 the hue is numerical noise,
  and amplifying it would invent a brand colour nobody chose.

  Fixes `--mdy-sys-color-tertiary` resolving to nothing on every model but `tonal`. The floors are
  read with `max()` on every model, so the one that was declared only where it bites made the whole
  declaration invalid at computed-value time everywhere else — measured empty in Chromium under
  `brand`, `monochrome` and `triadic`.

- 9e8cbad: Milestone B, dimension 6 completed: the value lifecycle, and the doorway it was missing.

  A dynamic field now guards its own shape. `oneOf` already whitelisted the option kinds against a
  value that did not come from the widget — a restored draft, a network config, a scripted `set()` —
  and every other kind had no such guard: a text field handed `42` reported itself **valid**, because
  every rule it owned asked whether the value was _empty_ and none asked whether it was a string.
  `valueShape` closes that, derived from `MDY_VALUE_CONTRACTS` rather than restated per kind.

  It deliberately leaves nullish alone. Whether a field may be empty is `required`'s question, and
  answering it here too would make an optional field invalid for holding nothing.

  The rest of the dimension — how what a field holds changes — is pinned rather than added, because
  the engine already had it right: a programmatic write does not make a field dirty, touched and dirty
  are independent of validity, and `reset` restores the value and clears both. Those semantics come
  from the engine every adapter shares, so pinning them once pins them for all three.

  **Why here and not as an event surface.** The three adapters have no common one — Angular emits
  component outputs, Lit one custom event, Plain callbacks — and `MdyUiCommand` is a list of effects a
  host performs, not events it observes. What dimension 6 actually enumerates is the value lifecycle,
  and that lives on the field handle.

- 879b5e9: Every renderer measures its popup before placing it

  Angular, Lit and the framework-free renderer now hand `anchorOverlay` the popup's own size, so the
  contract can put it where the content shows whole instead of falling back to the minimum-space rule.
  Each measures once — when the popup opens, with `scrollHeight`/`scrollWidth`, which report what the
  content wants whatever the box is currently clamped to — and holds that size while it stays open:
  re-measuring during scroll would feed the clamped box back into the decision that clamped it. The
  panel is not in the DOM on the frame the popup opens, so each renderer takes the measurement as soon
  as it is and places it again, still within the opening.

  `ComputedPosition["coords"]` carries `maxWidth`, and `getOverlayStyles` emits
  `--mdy-overlay-max-width`, so Angular's panel applies the same width ceiling the other two get from
  the foundation.

  `computeOverlayPosition` and `computeCoordsForAnchor` are deprecated. They are a second placement
  policy that no renderer calls: they know nothing of the popup's size, so they pick a side with
  enough room rather than the side where the content fits.

- c4ca77d: Add `daterange`, `file` and `colors` to the dynamic field union, so the Contract covers every
  `@modyra/widgets` catalog kind. The change is additive: parsers on earlier versions drop the new
  kinds in lenient mode and reject them in strict mode.
- 207901b: A field decides whether the devtools panel shows its value

  The panel masked values by matching the field's name against a regex — `password`, `token`, `iban`
  and a handful more — and nothing could overrule it. A guess is right often enough to be useful and
  wrong in both directions often enough to matter: `notes` can hold a recovery phrase and was printed
  in full, while `cardStyle` was masked for containing "card".

  `MdyDynamicField` gains an optional `sensitive`, and `mdyFormSnapshot` takes a `sensitive(path)`
  lookup. `isSensitivePath(path, declared)` is the rule in one place: a declaration wins, and the name
  heuristic only fills the silence — so nothing changes for a field that says nothing.

  In Studio, each field carries an eye beside its required marker. It cycles through three states
  rather than two, because "guess from the name" is a real answer and the one every field starts with:
  guess → shown in the clear → hidden → guess. A two-state toggle would make the heuristic unreachable
  the moment you touched it.

- 05c5665: A disabled field is no longer submitted or validated

  `disabled` and `readonly` were the same thing in everything but name. Both blocked interaction
  identically, both were kept in the submitted value, and both were validated. The standards say
  otherwise, and had done all along: a disabled control is neither submitted nor validated, and a
  read-only one is both.

  **Interactivity is now one value, not two flags.** `MdyFieldState.interactivity` is
  `"enabled" | "readonly" | "disabled"`, and `disabled`/`readonly` are derived from it, so the
  meaningless `disabled && readonly` combination cannot be represented. If a form sets both, disabled
  wins: it permits strictly less, and a question the form is not asking cannot also be one it is
  asserting an answer for.

  **Two value types, because there are two concepts.** `form.value()` and `form.getValue()` stay
  total — that is the live editing model, and drafts, history and cross-field validators all read it,
  so a field must not vanish from it just because it happens to be disabled. `form.submitValue()` is
  new and returns `MdySubmittedValue<S>`, which is what actually leaves the browser. `submit()`'s
  callback now receives that type.

  `MdySubmittedValue<S>` is optional at every level the schema declares and no deeper: a leaf inside a
  group can be disabled on its own, so groups recurse, while an object-valued _leaf_ like a date range
  is submitted whole or not at all. `MdyFormAdapter` gained a second type parameter for it, defaulting
  to `Partial<T>`, so adapters that do not know their schema are unaffected.

  **What changes for you.**

  - A form containing a disabled field now sends less. Read the submitted value defensively; the type
    will tell you where.
  - A form blocked by a disabled required-empty field now submits. That case was unfixable by the
    user, who could not type into the field either.
  - `MdyFormSubmitEvent.value` and `onSubmit` callbacks are typed as the submitted shape.
  - A read-only field is unaffected: still submitted, still validated, still focusable.

- 242551e: What a field holds when it holds nothing is now the contract's answer, not a renderer's.
  `mdyEmptyValueFor` moves the per-kind table into `@modyra/core`, where `required` already lives —
  two adapters answering the question separately is how one form validates differently in each.

  Two defects were sitting in the old table, both measured:

  - **A required number field could never fail.** It defaulted to `0`, and zero is a number the user
    may well mean, so `required` accepted a field nobody had filled in. It is now `null`.
  - **A slider started outside its own range.** It defaulted to `0` whatever its `min`, so a slider
    bounded 10–20 sat at 0 until the first drag. It now starts at its minimum.

  The slider is the one kind whose empty value is a real one, and deliberately so: a thumb is always
  somewhere, so an untouched slider reads as filled. Every other kind is now rejected by `required` at
  its empty value, and a test asserts exactly that across the whole kind list — which is the check that
  would have caught the `0`.

  `<mdy-dynamic-form>` used the same function instead of spelling the defaults per kind in its
  template — a third table, which defaulted only checkbox, toggle and multiselect and left a number
  field `undefined`.

  **Breaking for `@modyra/plain`**: a `number` field with no `initialValue` starts `null` rather than
  `0`, and a `slider` starts at `min`. Set `initialValue` to keep the old behaviour. The same applies to `<mdy-dynamic-form>`, where a
  number field previously started `undefined` and a slider ignored its `min`.

- d568743: A second palette engine: Material 3's HCT, alongside Modyra's OKLCH

  `deriveHctPalette` reproduces Google's algorithm — CAM16 hue and chroma over CIE L\* tone — next to
  the existing OKLCH derivation. Nothing about the OKLCH functions changed; this is an addition.

  **Implemented from scratch rather than depended on.** No new dependency: CAM16 under Material's own
  default viewing conditions (D65, adapting luminance 11.73, background L\* 50, average surround,
  illuminant not discounted), the sRGB↔XYZ matrices, and an HCT solver.

  The solver is the part worth knowing about. CAM16 inverts analytically, but **HCT does not**,
  because its tone is CIE L\* — a property of Y — while CAM16 inverts from its own lightness J. So
  `hctToHex` bisects J until the resulting Y matches the tone asked for, then walks chroma down until
  the colour fits in sRGB. Most hues cannot hold chroma 84 at tone 40; asking and taking what fits is
  what Material does too. This is also exactly why the OKLCH engine, not this one, is the one
  `modyra-base.css` mirrors: OKLCH inverts in closed form and therefore fits in a stylesheet, and a
  bisection does not.

  Checked against the values Google publishes for the `#6750A4` baseline rather than against itself:
  source HCT comes out hue 298.98, chroma 47.86, tone 40.08 where M3 documents ~299/48/40; **primary
  `#6750a4` and secondary `#625b71` are exact**, tertiary is `#7e5260` against `#7d5260`, and the
  primary palette's tone stops give `#22005d` and `#e9ddff` against M3's `#21005d` and `#eaddff` — one
  unit of 255 in each. Error comes out `#ba1a1a`, which is what hue 25 / chroma 84 / tone 40 actually
  produces; the older `#B3261E` predates that palette being generated.

  **`on-` colours are tone stops, not measurements.** M3 declares that on-primary _is_ tone 100 and
  on-primary-container _is_ tone 10, and never computes a contrast ratio at run time — the guarantee
  comes from tone distance instead. Modyra's `onColorFor` measures both candidates and keeps the
  winner. Predictable versus adaptive, and the module says so where it matters.

  **HCT numbers are not OKLCH numbers.** CAM16 is an appearance model with stated viewing conditions
  and corrections for the Helmholtz–Kohlrausch and Abney effects; OKLab has neither. Their hue angles
  are different quantities and their chroma scales differ by two orders of magnitude (0–0.4 against
  0–120). Never pass one's output to the other's constructor.

  A test prints both engines side by side for four sources, because the difference is the point rather
  than a defect. It shows M3 _assigning_ tone and chroma where Modyra _scales_ them: seeded with a
  light yellow, the OKLCH model keeps a light primary at lightness 0.91 while M3 pins it to tone 40 and
  returns a dark olive; M3's error is `#ba1a1a` for every source, while Modyra's keeps the red hue and
  takes its weight from the brand. An M3 palette looks like an M3 palette whatever seeded it, and a
  Modyra palette still looks like the colour you chose.

  Use `deriveHctPalette` to match a theme exported from Material Theme Builder; use `derivePalette` to
  theme Modyra.

- 098a0af: A column row can be authored per breakpoint

  Responsiveness was a single rule in the foundation: below `40rem` every row collapsed to one column,
  whatever it was and whatever it held. A form could not say "two columns from tablet, four from
  desktop", so a responsive layout was not something you could declare — or test.

  `MDY_LAYOUT_BREAKPOINTS` names the four sizes once — `base`, `sm` (40rem), `md` (64rem), `lg` (80rem)
  — and a contract-v2 columns row takes an optional `at` saying how many tracks it shows at each. The
  widths live in `@modyra/widgets` rather than in each theme, because a row that becomes two columns at
  `sm` has to do it at the same width everywhere or the layout cannot be tested at all.

  `layoutNodeAttributes` emits one custom property per authored size and the foundation cascades them,
  each falling back to the size below, so declaring only `sm` still behaves.

  **Behaviour is unchanged for existing layouts, but the properties moved.** A row that authors nothing
  stacks at `base` and takes its declared tracks from `sm` up — exactly what the old `max-width: 40rem`
  rule did. That means `--mdy-layout-column-count` now carries the _narrow_ count (1) and
  `--mdy-layout-column-count-sm` the declared one; anything asserting the old value reads the new
  property instead.

  `at` is validated like any other untrusted input: a track count must be an integer from 1 to 12 and
  an unknown size is rejected, because it reaches the renderer as a custom property.

- a8606da: One chip vocabulary for the multiselect, so every renderer draws Angular's chip

  The multiselect contract now names the chip anatomy the Angular renderer established — `mdy-chip`
  with `mdy-chip__check`, `mdy-chip__label`, and, in counter mode, `mdy-chip__btn` and
  `mdy-chip__count` — as the `option`, `optionCheck`, `optionLabel`, `optionStep` and `optionCount`
  parts. The controller projects `mdy-chip--centered` or `mdy-chip--counter` per mode and
  `mdy-chip--selected` per option, so an option looks the same whichever framework rendered it.
  Plain renders that anatomy; the theme draws the tick for renderers that ship no icon set.

  The chips a closed trigger shows now carry `mdy-chip--value`, which distinguishes a readout of the
  current selection from an option a user can pick.

  `MdyDynamicOptionsField` gains `mode: "single" | "multi"`, so a multiselect whose options can be
  taken several times is expressible in a form config rather than only through a renderer argument.

- 6aab031: The relational maths behind a palette, at `@modyra/core/color-utils`

  A palette is not a list of colours, it is one colour and a set of relationships. Modyra's already
  was — measured in OKLCH, the stock secondary sits at the primary's hue +24°, the tertiary at +96°,
  the error at a fixed red with 0.83× the primary's lightness. Those relationships were real and
  frozen as hex literals, so picking a new brand colour left the rest of the palette where it stood: a
  green brand still got violet chips and coral accents.

  This module holds the relationships as numbers, so the palette can follow. `modyra-base.css` will
  hold the same numbers as custom properties and let the browser do the arithmetic live; a later test
  binds the two copies together, because two copies of a number is exactly what drifts.

  Four models ship — `brand` (default), `monochrome`, `complementary`, `triadic` — each a set of hue
  offsets and chroma/lightness multipliers, nothing more. `brand` uses round +30°/+90° rather than the
  measured +24°/+96°, so the stock palette shifts slightly and deliberately.

  **Error keeps a pinned red hue** and takes only its weight from the primary. It is the one colour in
  a palette whose meaning is not decorative, and an error that has gone green because the brand did is
  no longer an error.

  OKLCH rather than HSL: HSL's "lightness" is not lightness — `hsl(60 100% 50%)` and
  `hsl(240 100% 50%)` claim the same 50% while one is blinding and the other nearly black, so rotating
  hue in HSL changes perceived brightness and the derived palette comes out uneven.

  **Contrast is the part CSS cannot check for itself**, so it lives here: `contrastRatio` is WCAG 2.1,
  and every `on-` colour is chosen by measuring both candidates rather than guessing. Three findings
  came out of writing that, each from a test failing rather than from reasoning:

  - **The lightness pivot was wrong.** Solving for where black overtakes white puts the crossover
    between 0.508 and 0.590 OKLCH lightness, mean 0.562 — not the 0.62 first assumed. At 0.62 an
    indigo of lightness 0.607 was handed white text at 4.09:1, under AA, when black gives 5.07:1.
  - **The `on-` colour must be decided from the _painted_ colour, not the requested one.** A rotated
    hue at full chroma often lands outside sRGB, and clipping it back moves its lightness: a tertiary
    asked for at 0.551 was painted at 0.579, so judging the request chose white where the thing on
    screen wanted black.
  - **No constant pivot can be right for every hue.** With one, five pairs in the test sample landed
    under AA despite 4.64–4.87:1 being available to them. Measuring both candidates and keeping the
    better clears AA for every model and every primary tested. `contrastPivot` stays in the model as
    the stylesheet's approximation of this rule — the stylesheet has no way to compute a luminance —
    and what that approximation costs will be measured in a browser rather than assumed.

  The margin is genuinely thin at mid lightness: a colour sitting on the crossover has only ~4.6:1
  available whichever way it goes. That is a property of black and white text on mid-tone backgrounds,
  not something a better pivot could fix.

  No new package and no build change — this follows the existing `@modyra/core/time-utils` subpath
  pattern. Nothing renders differently yet; this batch establishes the numbers.

- fd87ae7: A placement belongs to a column, and now says so everywhere

  Contract v3 shipped a gap: a slot's `at` parsed anywhere a slot could appear, but only a column could
  act on it. A slot in a section was accepted and then silently ignored by every renderer — the exact
  failure the strict parser exists to prevent.

  **Placement is now refused where it cannot be honoured.** `at` is valid only inside a `columns` row,
  including for a section at the top of a layout, which occupies no column. A slot with no `at` is
  still a field name written longhand and is fine anywhere.

  **And it is now possible where it was needed.** A group compiles to a section, so a group in a row
  could be moved and hidden per size in Studio and the compiler dropped both without a word. A section
  occupying a column carries the same `at` a slot does, read by the same code in both renderers — the
  column is the element either way. Studio's group box gains the controls its fields already had:
  left/right, columns-across, and the eye.

  Also closed, all of them ways the same feature could be silently lost:

  - A `column` past a row's tracks — what a row narrowing under it leaves behind — is trimmed at
    compile time. It used to reach the parser, be refused, and take the whole layout down with it.
  - The compiled version is read off the finished layout rather than tracked while building it, so a
    document cannot claim v3 for a placement that was trimmed away after the slot carrying it was
    emitted.
  - `layoutNodeAttributes` reads only numbers from `at`. Row counts and slot placements share the key
    across the layout union, and a placement reaching it became `NaN` tracks.
  - A group in a column laid its legend out on one unwrapped line: a dozen controls, 267px of them in a
    135px column, overflowing onto the column beside it where they took the clicks meant for its
    buttons. The action bar now folds inside its own column — scoped there deliberately, since at full
    width it fits on one line and folding it would only make every row taller.

- 1523836: A read-only field is finally read-only

  `form.setReadonly()` has always set the field state, and the widget controllers have always blocked
  intents when read-only, and the ARIA projection has always been ready to emit both `aria-readonly`
  and the native `readonly` attribute. None of it ever ran, because one hop was missing:
  `MdyFieldHandle` did not expose `readonly`, so the controllers read it from a local signal seeded by
  an option no renderer passes. Every other field of that projection — `value`, `disabled`,
  `required`, `touched` — came from the form. `readonly` alone did not.

  The consequence was a field a form had marked read-only that still accepted typing, in every
  renderer, with `aria-readonly="false"` on it while it happened. Found by the state matrix, and then
  by typing into one.

  `MdyFieldHandle` now exposes `readonly`, and `createFieldController`,
  `createBooleanFieldController`, `createDatepickerFieldController` and
  `createMultiselectFieldController` read it from the handle. `setReadonly()` on the controller stays
  an imperative override for a renderer with no form behind it.

  **This changes behaviour.** If you call `form.setReadonly()` today it does nothing; after this it
  does what it says — the control gets the native attribute, exposes `aria-readonly="true"`, and stops
  accepting input. Anything that depended on it being inert will notice.

  `MdyFieldHandle` gains a required member. If you implement that interface by hand rather than taking
  it from a form, add `readonly`.

- fc6327f: Remove the deprecated surface

  **Breaking, and it rides the minor.** The workspace is pre-1.0 and every package moves together, so
  this lands as `0.5.0` rather than claiming a `1.0.0` the framework has not earned — Lit still has no
  config-driven form, and contract-v2's `rules` are parsed but reach no renderer. Pin exactly if you
  depend on any of the removed names.

  **`@modyra/core/overlay-position` is gone.** It held the placement policy Modyra had before there was
  a contract — it never knew how big the popup was, so it chose a side with _enough_ room rather than
  the side where the content fits, and could not report whether the popup would scroll. `anchorOverlay`
  in `@modyra/widgets` replaced it and is what all three renderers have used for some time. The
  subpath export is removed from `package.json` and the module no longer re-exports through
  `@modyra/core/ui`.

  Replacements, all in `@modyra/widgets`: `computeOverlayPosition` → `anchorOverlay`;
  `computeCoordsForAnchor` → `anchorOverlay` with `lock`; `getOverlayStyles` → `overlayStyleProperties`;
  `ComputedPosition` → `MdyOverlayPlacementResult`; `OverlayPosition`/`OverlayAlignment` →
  `MdyOverlayPlacement`/`MdyOverlayAlignment`; `OverlayPositionConfig` → `MdyOverlayAnchorOptions`.

  **`MdyReactivity.canEffect` is gone, and `capabilities` is now required.** `canEffect` existed as a
  guaranteed answer to the one question the engine cannot do without, standing in while `capabilities`
  was still optional. Every adapter declares capabilities now — Vue, Solid and Angular natively, React,
  Preact, Svelte and Lit through `vanillaReactivity()` — so there is one way to ask and the alias is
  unnecessary. Read `capabilities.effects` instead.

  A custom adapter needs two changes: drop `canEffect`, and declare `capabilities`. The engine reads it
  through `reactivityRunsEffects()`, newly exported, which treats a reactivity assembled without
  capabilities as "no effects" — the same answer `canEffect: false` gave — so a JavaScript caller
  degrades to skipped async validators, drafts and history rather than a crash.

- 61271c5: `required` understands every kind's own empty value, and a half-set range is invalid

  `required` only recognised `null`, `undefined`, a blank string and an empty array, so every kind
  whose empty value is another shape escaped it entirely. An unchecked required checkbox, an off
  required toggle and a required date range with both ends unset all reported themselves **valid** and
  submitted. Plain, Angular and Lit each recorded this independently in their state matrices before
  the cause was identified — three adapters describing one validation defect.

  `false` now counts as empty, matching HTML, where `<input type="checkbox" required>` unchecked does
  not satisfy the constraint. A toggle whose "off" is a genuine answer should simply not be marked
  required.

  A `{ start, end }` pair with neither end set now counts as empty too.

  **`completeRange` is new, and it is not the same rule.** A range is one value with two halves, so
  half of one names no interval at all — it is wrong whether or not the field is required. Every
  `daterange` carries it automatically, through the same mechanism that already constrains a select to
  its declared options. An optional range may be left entirely empty; it may not be left half-set.

  **What changes for you.** A form with a required checkbox left unchecked, or a required range left
  blank, stops passing validation — it was passing before and should not have been. A form with a
  half-entered range now shows an error where it previously accepted the value silently.

- fe0dba3: Overlay placement is one vocabulary, and it lives in `@modyra/widgets`

  `@modyra/core/overlay-position` held the placement policy Modyra had before there was a contract. Its
  functions have been unused by every renderer since `anchorOverlay` took over — but its _types_ were
  still the currency Angular and Lit spoke, so the package that no longer decides where a popup goes
  was still the package that said what "where" means.

  `@modyra/widgets` now names it: `MdyOverlayPlacement`, `MdyOverlayAlignment`, `MdyOverlayCoords`,
  `MdyOverlayPlacementResult`, and `overlayStyleProperties` for a host that positions its panel from the
  custom properties. Angular and Lit import from there; nothing in the repository imports
  `@modyra/core/overlay-position` any more.

  **For consumers of `@modyra/core`:** nothing is removed. Every export in that module stays, and each
  now carries `@deprecated` naming its replacement. The types are duplicated rather than re-exported
  because `@modyra/widgets` depends on `@modyra/core`, and re-exporting would make the two packages
  depend on each other; they are structurally identical, so imports can move across one at a time.

  Worth knowing before you move: `computeOverlayPosition` never knew how big the popup was. It picked a
  side with _enough_ room rather than the side where the content fits, and could not report whether the
  popup would scroll. `anchorOverlay` takes the measured content and answers both.

- df563d4: The optional parts that only exist once something is supplied are built and checked for the first
  time, and building them found three contract defects.

  `clear` no longer hangs from `fileItem`. Every renderer puts one clear button beside the file list,
  because clearing empties the field rather than one row — the contract asked for it inside an item.
  `mdy-file-name` and `mdy-file-meta` join the file kind's presentation classes; both were rendered and
  neither was declared.

  Plain gains the two affordances it never had. `loading` on select and multiselect shows on the
  control, matching the other adapters, so its state matrix no longer reports the state as undrivable.
  `prefix` and `suffix` render on the free-text kinds when the field supplies content for them — an
  empty affix is a gap the theme still spaces, so they appear only when there is something to put in
  them. Both arrive as optional properties on the dynamic field config.

  Counter mode was the same story. `optionStep` and `optionCount` exist only on a multiselect in
  `"multi"` mode and no fixture had ever used it, which is why `mdy-chip--centered` was declared and
  its opposite `mdy-chip--counter` was not. `optionCheck` stops being mandatory: a counter chip has a
  count between two steppers and no tick, so requiring it asked every counter-mode renderer for an
  element that means nothing there.

  New coverage, each falsified by breaking the renderer it checks: a file field with files chosen, a
  text field with both affixes, Lit's slotted affixes, and the value-chip presentation the multiselect
  catalogue declares as its compact alternative — declared, styled and reachable through
  `multiselectChipClasses`, and until now never once constructed.

- ec3d8ca: Milestone B, batch 1: the contract says what a field holds.

  `MDY_VALUE_CONTRACTS` declares, per kind, the runtime shape of the value, whether it may be absent,
  and whether interaction writes through or edits a draft until confirmed. `explainValueMismatch` names
  why a value does not belong in a field rather than returning a colour, and
  `matchesValueShape` answers the shape question on its own.

  This is the dimension the widget specification had no declaration for at all: every other one —
  anatomy, semantics, relations, states — was contract data somewhere, and "what does this field hold"
  was agreed implicitly by the engine, the validators and three renderers.

  Implicit agreement cannot be checked, and the cost was measured. A state-matrix fixture used one
  empty value for every kind, so `daterange` received `""` where two endpoints belong and was rejected
  for being an empty string rather than for being an empty range — its row was green because of the
  fixture. All three adapters now assert their fixtures against the declared shape, and reintroducing
  that fixture fails the suite.

  The commit mode is bound to behaviour rather than described: a confirm-mode kind is asserted to leave
  the field untouched until it is confirmed, and a live-mode kind to write through on the interaction.
  Asserting only one side would leave the two modes indistinguishable.

  Two defects surfaced the moment the check ran. Every fixture drove `slider` empty as `null`, which is
  a state the kind cannot be in: a thumb is always somewhere. Correcting it showed that `required`
  alone can never fail on a slider, so `slider × invalid` had been green because the state was
  unreachable, not because the renderers were right — the fixtures now give it a validator that can
  fail. `file` was driven with `null` and `""` where an array belongs.

### Patch Changes

- f5ee72d: No package names one it must not know about, and an audit keeps it that way.

  `scripts/audit-package-independence.mjs` runs in `test:contracts`. The rule it enforces:
  `@modyra/core` and `@modyra/widgets` are the contract and name no adapter at all; an adapter may name
  itself and nothing else. Siblings are peers, not references.

  It found **58 comments** across five packages, all the same shape — "modeled on Angular's real
  component", "the same structure the themes style for the Angular renderer", "the answer Angular
  kept", "Plain and Angular come through `current`". A framework-free renderer explaining its anatomy
  by naming the framework one is the same inversion as the contract doing it, one layer down; and a
  contract that cites a consumer is describing the wrong thing.

  The import graph was clean throughout, which is why none of this was caught: nothing here is a
  dependency, so nothing objects at build time. The audit checks file names too — that half is what an
  `angular-ui.json` sitting in the widgets package would have failed.

  `plain` counts only when spelled `@modyra/plain`, because it is also an ordinary adjective: a plain
  button, a plain array.

- 9864d9a: The palette follows the colour it is derived from

  `modyra-base.css` now derives secondary, tertiary and error from `--mdy-sys-color-primary` in OKLCH,
  with the model selected by `data-mdy-palette` on the root or on any subtree. Four ship — `brand`
  (default), `monochrome`, `complementary`, `triadic` — each nothing but hue offsets and chroma and
  lightness multipliers, written as plain custom properties.

  Before this, choosing a brand colour moved the primary and left everything else where it stood: a
  green brand still rendered violet chips and coral accents, in every theme, measured. Dark mode was
  worse than that — it restated secondary and tertiary from the fixed reference colours, so a chosen
  colour worked in the light theme and quietly stopped applying in the dark one. Both derive now.

  `brand` uses round +30°/+90° where the stock palette measured at +24°/+96°, so its colours shift
  slightly and deliberately.

  **Contrast is derived too, and this is the part that was actually broken.**
  `--mdy-sys-color-on-primary` was `color-mix(primary, cloud 95%)` — 95% white whatever the primary
  was, which on a light brand colour is white text on a light background. Each `on-` colour now reads
  the colour it is named for and resolves to black or white against it.

  Getting that right took three measured corrections, none of which were visible from reading the code:

  - **CSS has no conditional**, but `clamp()` on lightness makes a step. The slope has to be steep:
    at ×100 a colour landing within 0.01 of the threshold resolved _inside_ the clamp — one measured
    at lightness 0.5559 produced a mid grey, the worst text colour available on any background.
  - **A lightness threshold cannot stand in for a luminance one.** WCAG weights green at 0.72 and blue
    at 0.07, so a blue and a green of identical OKLCH lightness are nowhere near equally bright; a
    constant pivot picked the wrong side 38 times in 1080 samples. Luminance is estimated instead as
    `l³ · (1 + 0.85·c·cos(h − 179°))` — exact for a grey, fitted for the rest — which is wrong 16
    times in the same 1080, all within 0.0075 luminance of the crossover where the two choices are
    worth the same. `pow()` and `cos()` are both older than the relative-colour-syntax baseline, so
    this costs no support.
  - **The `on-` colour must be judged on the _painted_ colour, not the requested one.** A rotated hue
    at full chroma often leaves sRGB, and clipping it back moves its lightness.

  Everything sits inside `@supports (color: oklch(from white l c h))`. Relative colour syntax needs
  Chrome 119, Safari 16.4 or Firefox 128; an older browser keeps exactly the palette it renders today
  rather than losing its colours.

  **Derivation is a default, not a cage**: a theme declaring `--mdy-sys-color-secondary` outright still
  wins, and there is a test that says so.

  The stylesheet's estimate is an approximation and `@modyra/core/color-utils` is not — it measures
  both candidates and is exact, which is the guarantee for generating a theme ahead of time. The new
  `e2e/palette.spec.ts` measures what a browser actually paints, through a canvas rather than a second
  implementation of the colour maths, and asserts the approximation never falls far from the best
  colour available. A test parses the stylesheet and compares every number against
  `MDY_PALETTE_MODELS`, because two copies of a number is exactly what drifts.

- 1644bf5: Both SDKs read Contract v3

  Studio emits `version: 3` the moment a layout places a slot per breakpoint. Neither SDK could read
  the result:

  - **Rust** refused it on the version alone — `expected contract version 2`, before a field was
    read — and its untagged `LayoutChild` could not deserialize a `{ref, at}` slot at all, so even an
    accepted version would have failed the whole document.
  - **Java** fell through every branch of `parse`'s envelope check and returned a failed result, and
    `validLayoutNode` rejected a slot object as an invalid shape.

  A form authored responsively therefore exported to something neither server could parse.

  Both now accept v3 as what it is: v2 plus per-slot placement, with every other envelope member read
  exactly the same way. Both refuse placement where no column can honour it — outside a `columns` row,
  or naming a track the row does not have — matching the TypeScript parser rule for rule, and both
  still refuse a version they have never heard of.

  Rust also gains two things it was quietly dropping: `at` on a `columns` row (v2's own track counts,
  absent from the struct, so a responsively-authored row round-tripped back to one arrangement) and
  `at` on a section.

  The guarantee is a shared fixture, `spec/fixtures/dynamic-form/v3/placement.json`, parsed by all
  three implementations in their own suites — the same arrangement this repo already uses for v2, and
  what stops the three drifting apart again.

## 0.4.0

### Minor Changes

- 318e721: Add Dynamic Form Contract v2 with data-only layout sections/columns,
  declarative visibility/enabled rules, structured strict/lenient parser
  diagnostics, a machine-readable JSON Schema, shared conformance fixtures,
  and the initial `modyra-contract` Rust crate. Contract v1 and the legacy
  `parseDynamicFields()` API remain supported.

  Add a runnable Rust `reqwest` POST example that sends a Contract v2 form
  submission and prints both raw and typed API responses, including normalized
  422 validation errors and optional bearer-token authentication.

  Add an Axum form API example and connect the existing Angular dynamic-form
  demo to it: Rust maps checkout business configuration to Contract v2 JSON,
  Angular validates and renders it, and completed values are posted back to
  Rust with success or normalized server-error output.

  Extend Contract v2 with recursive `group` and `array` schema nodes. The
  strict parser validates structural limits and flattens accepted nodes to the
  dotted/indexed paths consumed by the Angular dynamic renderer. Rust now emits
  the original checkout shape (`shipping` group and `items` array) and omits
  absent option fields from JSON instead of serializing them as `null`.

- 1bb844f: Reactivity/adapter API redesign (`piano-modyra-reactivity-adapter-api.md`), all additive:

  - `MdyReactivity` gains optional `id`/`kind`/`capabilities` (honest, per-adapter, never claiming an unimplemented guarantee), `createScope()`/`MdyReactiveScope` (ownership with idempotent, cascading destroy), typed errors (`MdyUnsupportedCapabilityError`, `MdyCrossRuntimeObservationError`, `MdyDestroyedScopeError`, `MdyAdapterContractError`, `MdyActivationError`) and structured diagnostics (`MdyDiagnostics`, `MDY_*` codes). `canEffect` stays as a deprecated alias.
  - `vanillaReactivity()` is the reference implementation: real `batch()`, `flush()` and `observe()` (a selector-based subscription that only fires on an actual change), built on a redesigned shared-drain effect scheduler that settles chained effect triggers within one flush/batch instead of needing one microtask per hop.
  - `MdyFormEngine`/`MdyTypedFormBase` gain `form.mutate(fn)` — coalesces a burst of field writes into exactly one history entry regardless of whether the adapter's effects run synchronously (Vue/Solid) or are scheduler-deferred (vanilla/Angular); delegates to a real runtime `batch()` when the adapter reports it.
  - `MdyFormEngineOptions.autoActivate` (default `true`, unchanged behavior) plus `activate()`/`deactivate()`: pause/resume draft persistence, history recording and async validators without losing any state (field values, undo/redo stacks, draft baseline). `@modyra/react` and `@modyra/preact`'s `useMdyForm` now construct with `autoActivate: false` and call `activate()`/`deactivate()` from their effect instead of destroying on unmount — tolerant of React/Preact Strict Mode's dev-only double-invoke and safe during SSR (activation only ever runs client-side). **Behavior note**: the hook no longer calls `form.destroy()` automatically on unmount; call it yourself if you need a hard, final teardown (releasing field records) rather than a pause.
  - `@modyra/angular`'s adapter hardened: `effect()` without an `Injector` now throws a typed error by default instead of returning a silent no-op (`unsupported: "report"` opts back into graceful, diagnosed degradation); declared capabilities; `equal` propagated to Angular's native `signal()`/`computed()`; `onError` now actually respected (previously silently ignored).
  - Fixed a real, if latent, bug in `@modyra/react`/`@modyra/preact`: `createStore()` used to build a fresh `vanillaReactivity()` to observe a field handle, which happened to work only because vanilla's tracking is module-global — it silently never re-rendered for a handle owned by a different adapter's form. Now resolves the owner via a new handle-ownership registry (`getFieldHandleOwner()`).
  - Fixed a real pre-existing bug found while building `mutate()`: `undo()`/`redo()` restore a value through the same non-atomic multi-field write path `mutate()` guards against, so a synchronous-effect adapter could see 1-2 spurious extra history entries mid-restore.
  - Fixed a scheduler bug found while auditing error handling: an effect throwing without `onError` used to abort the shared drain loop, silently starving sibling effects scheduled in the same batch.
  - New `@modyra/core/testing` subpath (`runReactivityContractTests`, `MdyReactivityTestHarness`) — the conformance suite adapters are tested against, now a documented public API instead of an internal test helper.
  - New `docs/guides/reactivity-adapter-guide.md` and a generated `docs/reactivity-capability-matrix.md` (`npm run docs:reactivity-matrix`).

## 0.3.0

### Minor Changes

- c7dadfb: Whole-entry slimming (roadmap phase J). The root entry `@modyra/core` now re-exports only the form engine (typed forms, validation, security, dynamic config, reactivity): **10.7 KB min+gzip** measured, down from 17.2 KB (−38%). Satellite utilities are no longer re-exported from the root — they remain in the package via their curated subpath entries: `@modyra/core/datetime`, `/localization`, `/ui` (icons, keyboard, options-utils, overlay-position), `/serialize`, `/devtools`, `/i18n`, `/dynamic-config`. **Migration:** change e.g. `import { formatDate } from "@modyra/core"` to `import { formatDate } from "@modyra/core/datetime"`. The framework adapters (`@modyra/react`, `/vue`, `/lit`) re-export the core surface via `export *`, so the same migration applies to satellite names previously reached through them (e.g. `mountMdyDevtools` now comes from `@modyra/core/devtools`). Also new: compile-time `__MDY_DEV__=false` define strips dev warnings in production builds (esbuild/rollup/vite), and a CI guard (`test:core-bundle`) now budgets the whole entry (11 KB) and the realistic surface (10 KB) so the comparison-doc numbers can't silently regress.
- 7554cc8: Injection prevention at the engine's write choke point. New `security` form option: sanitization profiles (`"text"` strips control/bidi/zero-width characters, `"strict"` also strips markup characters), per-field overrides and custom sanitizer functions via `field(..., { sanitize })`, `maxValueLength` string caps, and an `onViolation` telemetry hook. Always-on structural checks: restored draft entries are shape-validated against the declared field type, and submit-returned errors with prototype-polluting paths are dropped. Sanitization is opt-in in 0.x (`"off"` by default) and covers every write path — user input, `patch`/`setValue`, draft restore, array operations. See `docs/guides/security.md`.
- fc22197: Option whitelisting (client-side anti-tampering). New `oneOf`/`eachOneOf` validators: a select offering "one"/"two" now rejects a scripted `set("three")`. Option-based dynamic fields get the whitelist automatically — `buildDynamicFieldValidators()` constrains `select`/`radio`/`segmented` values and every `multiselect` element to the declared `options`, and `<mdy-dynamic-form>` uses it, so CMS/LLM-generated configs are tamper-resistant with zero extra code. `docs/guides/security.md` gains a trust-model section: client checks are defense-in-depth, and the same schema can gate the API server-side (isomorphic pattern with `@modyra/zod`).

## 0.2.0

### Minor Changes

- fd1e9d8: Add typed field arrays via `array()` — repeatable rows with
  `push`/`insert`/`remove`/`move`/`setAll`, wired through
  `@modyra/angular/adapter` and `@modyra/zod` (`z.array()`).
