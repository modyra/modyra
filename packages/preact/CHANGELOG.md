# @modyra/preact

## 0.8.0

### Minor Changes

- 6ee16f5: One live region for the page, and announcing became a queue

  Eight adapters each named a live region of their own — `mdy-plain-announcer`, `mdy-lit-announcer`,
  six more. Eight literals, declared by nothing, so a page carrying two renderers carried two
  `aria-live="polite"` regions.

  **Two regions speaking in the same instant are read in an order nothing specifies.** Every screen
  reader has its own policy and no specification fixes one, so one announcement cuts the other off
  partway. One region loses a message the same way — but a queue can only stand in front of one region,
  and with two there is nowhere to put it.

  `MDY_SHARED_REGION_ID` and `MDY_SHARED_REGION_ATTRIBUTE` are now exported. The attribute was already
  declared in the contract and was not published, so the one part of this that had been decided could
  not be read.

  Announcing is now queued rather than written, which fixes three things a plain write does not:

  - **the region exists before the first message.** A reader announces a _change_ to a region it
    already knows; one created and filled in the same instant is met already full, and the first
    announcement of a page is the one most likely to be lost;
  - **the same words twice running are said twice.** The region is cleared and written a turn later, so
    a repeat is a change. Written over itself it is silent;
  - **two messages in one instant are both heard** instead of one overwriting the other.

  No adapter names a region any more. `createMdyAnnouncer()` and `MdyCommandRuntimeOptions.announcerId`
  default to the contract's id; `announcerId` is still accepted, and passing one means keeping a second
  region on the page with everything above.

  The cost: announcements from two renderers now serialise, so a burst finishes slower than a burst
  that overwrote itself. And messages that should _replace_ rather than queue — "2 results", "3
  results", "4 results" as someone types — still queue, because `announce` carries no category to
  decide on. That is a real defect for anything announcing per keystroke.

  See ADR 0163.

### Patch Changes

- Updated dependencies [7d85603]
- Updated dependencies [4098145]
- Updated dependencies [9ad3e51]
- Updated dependencies [3852b04]
- Updated dependencies [454a168]
- Updated dependencies [8409975]
- Updated dependencies [d5bc45b]
- Updated dependencies [6a82839]
- Updated dependencies [8048151]
- Updated dependencies [fa4b98a]
- Updated dependencies [0f16026]
- Updated dependencies [37f5eab]
- Updated dependencies [a14b7c6]
- Updated dependencies [4a1928c]
- Updated dependencies [ff00fb6]
- Updated dependencies [57fcb30]
- Updated dependencies [78bd88c]
- Updated dependencies [4b30db9]
- Updated dependencies [9346f32]
- Updated dependencies [01261b8]
- Updated dependencies [ff19aea]
- Updated dependencies [a116692]
- Updated dependencies [9a2ba53]
- Updated dependencies [0050769]
- Updated dependencies [7f407b9]
- Updated dependencies [9840c5e]
- Updated dependencies [117e1c3]
- Updated dependencies [965a61c]
- Updated dependencies [918e404]
- Updated dependencies [22bf399]
- Updated dependencies [3a15797]
- Updated dependencies [89e42ec]
- Updated dependencies [12c9e50]
- Updated dependencies [86d196e]
- Updated dependencies [1fffe2d]
- Updated dependencies [ba9a0c1]
- Updated dependencies [b6b31c4]
- Updated dependencies [4c8cf60]
- Updated dependencies [d0a6f15]
- Updated dependencies [4e7ba99]
- Updated dependencies [6022157]
- Updated dependencies [16f1d3f]
- Updated dependencies [93fcb70]
- Updated dependencies [f0b4f7d]
- Updated dependencies [a268ec7]
- Updated dependencies [2fde8a7]
- Updated dependencies [08cca72]
- Updated dependencies [cd7e937]
- Updated dependencies [e0ab01c]
- Updated dependencies [5bde1b0]
- Updated dependencies [e972a01]
- Updated dependencies [be44d0a]
- Updated dependencies [d8b3b54]
- Updated dependencies [07b3ec8]
- Updated dependencies [9cdd4ef]
- Updated dependencies [f962df5]
- Updated dependencies [5b1b52b]
- Updated dependencies [087b2ca]
- Updated dependencies [234736d]
- Updated dependencies [e455962]
- Updated dependencies [04ff8d8]
- Updated dependencies [4255d5a]
- Updated dependencies [0e6540c]
- Updated dependencies [58654b1]
- Updated dependencies [cde2ab8]
- Updated dependencies [0a54a17]
- Updated dependencies [ab7fcb2]
- Updated dependencies [3bc4a23]
- Updated dependencies [f7bd4cb]
- Updated dependencies [0ae26cf]
- Updated dependencies [49339e9]
- Updated dependencies [d2092bb]
- Updated dependencies [88c8cc7]
- Updated dependencies [50ffc70]
- Updated dependencies [b7fbfd4]
- Updated dependencies [ca7a0fa]
- Updated dependencies [e6531f2]
- Updated dependencies [59e7af2]
- Updated dependencies [ef24648]
- Updated dependencies [f24ca8b]
- Updated dependencies [2e2a1ef]
- Updated dependencies [423b8b1]
- Updated dependencies [32e7440]
- Updated dependencies [661568e]
- Updated dependencies [0883045]
- Updated dependencies [2228872]
- Updated dependencies [8081294]
- Updated dependencies [e47e039]
- Updated dependencies [0cba121]
- Updated dependencies [233c2bd]
- Updated dependencies [f133092]
- Updated dependencies [e65f631]
- Updated dependencies [f65d19d]
- Updated dependencies [6efa698]
- Updated dependencies [a7cd1a8]
- Updated dependencies [a7eddca]
- Updated dependencies [fb289a9]
- Updated dependencies [024de71]
- Updated dependencies [450aa2c]
- Updated dependencies [9eb86d9]
- Updated dependencies [cfff558]
- Updated dependencies [96ab84b]
- Updated dependencies [b6cd7d6]
- Updated dependencies [82e7216]
- Updated dependencies [49e17ce]
- Updated dependencies [3fd899b]
- Updated dependencies [d5656be]
- Updated dependencies [cb8a6fd]
- Updated dependencies [e505164]
- Updated dependencies [6ee16f5]
- Updated dependencies [244dd08]
- Updated dependencies [953381d]
- Updated dependencies [8f72ad1]
- Updated dependencies [96edbb0]
- Updated dependencies [09c79c3]
- Updated dependencies [e63ccbd]
- Updated dependencies [3a148c0]
- Updated dependencies [5edf370]
- Updated dependencies [7df6f00]
- Updated dependencies [709fb7f]
- Updated dependencies [8e5fe67]
- Updated dependencies [1f646ae]
- Updated dependencies [5c49e32]
- Updated dependencies [58af44d]
- Updated dependencies [fc493c5]
- Updated dependencies [1897b23]
- Updated dependencies [012db3b]
- Updated dependencies [14755ac]
- Updated dependencies [11b6823]
- Updated dependencies [49e17ce]
- Updated dependencies [48c0597]
- Updated dependencies [7aaa84a]
- Updated dependencies [1a235c4]
- Updated dependencies [3eb1f84]
- Updated dependencies [e7be4b6]
- Updated dependencies [e488eec]
- Updated dependencies [3246dce]
- Updated dependencies [769b992]
- Updated dependencies [cef9693]
- Updated dependencies [23accd5]
- Updated dependencies [d3cd87c]
- Updated dependencies [7878e24]
- Updated dependencies [b4bee4f]
- Updated dependencies [9f191da]
- Updated dependencies [052db3e]
- Updated dependencies [17c3bff]
- Updated dependencies [a36aca3]
- Updated dependencies [ad85b8b]
- Updated dependencies [2175826]
- Updated dependencies [b69252a]
- Updated dependencies [2742dd9]
- Updated dependencies [425f3a7]
- Updated dependencies [7c85752]
- Updated dependencies [b22529e]
- Updated dependencies [f678c06]
- Updated dependencies [cd584fc]
- Updated dependencies [aa44a14]
- Updated dependencies [69d8cb8]
- Updated dependencies [ce0b6d5]
  - @modyra/widgets@2.5.0
  - @modyra/core@2.5.0

## 0.7.0

### Minor Changes

- 2c81244: The text-field widget hook is `useMdyTextField` — the name `useMdyField` belongs to one function

  Both packages shipped two functions under one identifier: `src/index.ts` declares
  `useMdyField(handle)`, the field-state hook, and `src/widgets/index.ts` exported
  `useMdyField(handle, options)`, the headless text-field controller hook. An `export *` yields to a
  local declaration silently, so the widget hook compiled and shipped but could never be imported from
  the package root — what arrived was the field-state hook, and nothing in a build objected.

  The widget hook now goes by the name its family already uses — `useMdyTextField`, beside
  `useMdyBooleanField`, `useMdyOptionField` and the rest, wrapping `createTextFieldController` — with
  `UseMdyTextFieldOptions` and `MdyReactTextFieldApi` / `MdyPreactTextFieldApi`. The field-state hook
  keeps `useMdyField`, so every documented call (`useMdyField(form.f.email)`) is untouched.

  Breaking only for the three type names, which were reachable where the function was not; both
  packages are pre-1.0, so this lands as a minor. See ADR 0085.

### Patch Changes

- 437bad1: A widget hook given its configuration as a literal at the call settles. Each hook memoized its
  controller on the configuration object's identity, so a new literal every render built a new
  controller, which resubscribed, which set state, which rendered — React reported "Maximum update
  depth exceeded" and kept going, and Preact did the same thing silently. The configuration is now
  compared by what it says (`sameControllerOptions`, published from `@modyra/widgets`), and a handler
  written at the call — a new function every render — is replaced by one stable function that calls
  whatever the latest render passed, so the controller keeps the handler it was built with and that
  handler is never stale. Memoizing the configuration still works and is still free.
- 000f195: A handle is observed by the runtime that owns it

  The defect had been diagnosed, fixed and documented once already — and the fix reached two callers
  out of roughly seventeen. `CHANGELOG.md` records what it costs: a binding that builds a fresh
  `vanillaReactivity()` to observe a handle works only because vanilla's tracking is global to the
  module, and silently never re-renders for a handle owned by another form.

  `observerFor(handle, requested?)` is the one place that reads the ownership registry, so a caller no
  longer has to know it should. Every field controller and every field renderer now resolves through
  it; a runtime passed in explicitly is honoured rather than replaced, because a host with its own
  scheduling has a right to be believed.

  `MdyCrossRuntimeObservationError` and `MDY_CROSS_RUNTIME_OBSERVATION` were declared when the defect
  was first found and constructed by nothing, which is why the other fifteen went unnoticed. They are
  now raised when a caller observes a handle through a runtime that does not own it.

  The select hooks keep their own runtime, and say why: that controller takes options and a callback
  rather than a field, so there is no form whose runtime it could observe through.

  Also in this release, for the suites rather than the library:

  - `settleFor(beat, hostFlush?)` and `MDY_PAINT_BEATS` — when a renderer's DOM catches up with a
    write, declared by the renderer instead of guessed per fixture. Plain's twenty milliseconds turn
    out to have been one task all along.
  - Lit and Angular drive the lifecycle contract, which one renderer had been carrying alone.

- 8514984: Executing widget commands, written once

  Eight adapters had the same command executor: collect focus and scroll into a queue, run everything
  else now, drain the queue after the host has rendered. What differed was the id of a live region and
  one call — `queueMicrotask`, `requestAnimationFrame`, `afterNextRender`, `host.updateComplete.then`.

  `createCommandRuntime({ announcerId, defer })` in `@modyra/widgets` is that function. Each adapter
  passes its own beat and writes nothing else, which is also where the difference becomes visible: the
  framework-free renderer's `defer` runs immediately, because it writes to the document itself and has
  nothing to wait for.

  Two more shapes every binding was writing itself:

  - `subscribeController(controller, reactivity, notify)` — watch a controller and hand back the
    teardown for it and the subscription. Six of the eight hooks in the two hook-based adapters watched
    `state` alone and were right by coincidence: every controller's view is currently a function of its
    state, and the contract does not promise it.
  - `fieldCommandHandlers(handle)` — what a control with no overlay gives a command executor. `setOpen`
    is a no-op rather than absent, because one vocabulary means answering the question rather than
    crashing on it.

  `MdyAngularCommandHandlers` and `MdyLitCommandHandlers` are aliases of `MdyWidgetCommandHandlers`
  instead of member-by-member copies, which is what the other five adapters always did.

  A guard moved upstream with the code: the framework-free renderer checked for `scrollIntoView` before
  calling it, because the DOM implementation every adapter's suite runs under does not have it. That
  check now protects all of them.

- 89e7d14: A form from a flat field list, built in one place

  `buildDynamicFormSchema` meant two things. In `@modyra/core` it takes the nested node a document
  declares; in the React binding it took the flat list a parse produces — a different function with the
  same name. The framework-free renderer had a third under `buildFormSchema`, a **superset** that also
  rebuilds collections, and the Angular one inlined a fourth. Three implementations of one rule can
  differ, and the only way anyone would have found out is a user reporting that the same document
  behaves differently in two renderers.

  `buildFlatFormSchema(fields, collections?)` and `applyFlatValidators(form, fields, key?)` are that
  rule, named for what they take. The superset behaviour is the one that survived: a path cannot say
  whether `lines.0` came from an array or a record keyed by digits, so the collections are passed rather
  than guessed. The nested builder keeps its name — renaming a working export to make room for a new
  one is a break with no gain.

  `applyFlatValidators` asks for the one method it uses rather than a whole `MdyTypedForm`: one of the
  three callers passes a component that owns a form, and a signature wider than its use turns a working
  call into a cast.

  `useMdyField` now applies the verdict rule. `errors` is what the field **shows** — a field the form is
  not asking about shows none — and `heldErrors` is what it still carries, for a debugging view.
  `showsAsInvalid` and `errorsVisible` come with it. The rule landed in the renderers a while ago and
  had never reached the hooks.

- 8d0cadf: `comparableControllerOptions` and `stableControllerOptions` are published beside
  `sameControllerOptions`, and the two hook-shaped adapters read them instead of each keeping a copy.
  The rule for turning a configuration written at the call into one a controller can be memoized on is
  one rule — what to compare, and what to do with handlers — and two copies of it are two answers
  waiting to drift.
- bb37b4e: A binding made from a form's handle ends when the form does

  `createFieldStore` opens an effect over a handle's signals, and a component on `useSyncExternalStore`
  subscribes to it. The store exposed its own `destroy` and that worked — but a component's cleanup and
  the form's `destroy()` race on unmount, and the consumer does not get to order them. A store still
  notifying after the form ended re-renders a component against a form that is gone:

  ```js
  const store = createFieldStore(form.f.rows.cell("a", "code"));
  store.subscribe(onChange);
  form.destroy();
  cell.set("anything"); // onChange fired again
  ```

  `MdyTypedFormBase.onDestroy(teardown)` is the affordance a binding uses to say it belongs to a form:
  teardowns run when the form is destroyed, in registration order, each isolated so one that throws
  neither stops the others nor the engine. It returns a release function, and registering on a form
  that is already destroyed runs the teardown at once — a binding built from a dead form's handle is
  dead too.

  `@modyra/react` and `@modyra/preact` register their field stores with it. Calling `store.destroy()`
  yourself still works and releases the registration, so a store you ended is not held by the form.

  Found by `battle-tests/adversarial/lifecycle/adapter-store-after-destroy.battle.test.mjs`. The other
  adapters bind through their own framework primitives and were not measured; the same question applies
  to any binding that outlives its form.

- Updated dependencies [435a31a]
- Updated dependencies [76509d3]
- Updated dependencies [d2cdcaa]
- Updated dependencies [27224d8]
- Updated dependencies [894699d]
- Updated dependencies [f297a3c]
- Updated dependencies [09b1c21]
- Updated dependencies [c0b44a8]
- Updated dependencies [6e53749]
- Updated dependencies [25d004c]
- Updated dependencies [57c68d8]
- Updated dependencies [ac052bc]
- Updated dependencies [61e814c]
- Updated dependencies [de7e122]
- Updated dependencies [3fa4c1a]
- Updated dependencies [45eb775]
- Updated dependencies [d2cdcaa]
- Updated dependencies [039059c]
- Updated dependencies [a76fc10]
- Updated dependencies [3f0787e]
- Updated dependencies [7ac08a7]
- Updated dependencies [437bad1]
- Updated dependencies [4892a49]
- Updated dependencies [1a8138f]
- Updated dependencies [d03419c]
- Updated dependencies [d9203ee]
- Updated dependencies [2904441]
- Updated dependencies [ccde959]
- Updated dependencies [1c164b7]
- Updated dependencies [9b89cd2]
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
- Updated dependencies [3bd2d09]
- Updated dependencies [111aa5b]
- Updated dependencies [95bb48b]
- Updated dependencies [f00ead6]
- Updated dependencies [0c3a770]
- Updated dependencies [1783afc]
- Updated dependencies [f47ee5e]
- Updated dependencies [b6a1325]
- Updated dependencies [3ff02a3]
- Updated dependencies [7f847da]
- Updated dependencies [833a5f6]
- Updated dependencies [3233dd4]
- Updated dependencies [d89c221]
- Updated dependencies [1b76a2c]
- Updated dependencies [a2a2bda]
- Updated dependencies [7c8e0b4]
- Updated dependencies [aa09065]
- Updated dependencies [eab4653]
- Updated dependencies [a6dc4de]
- Updated dependencies [1b24d8f]
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
- Updated dependencies [ecee2fd]
- Updated dependencies [117ecba]
- Updated dependencies [501dbb2]
- Updated dependencies [0a6d296]
- Updated dependencies [892c01b]
- Updated dependencies [551320a]
- Updated dependencies [e6b35e4]
- Updated dependencies [e35174d]
- Updated dependencies [5e32e40]
- Updated dependencies [4d4110b]
- Updated dependencies [af002ed]
- Updated dependencies [9fab18e]
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
- Updated dependencies [9fc24f7]
- Updated dependencies [70220fc]
- Updated dependencies [c7b25ce]
- Updated dependencies [cfa1ec6]
- Updated dependencies [7cd79cc]
- Updated dependencies [9a7c524]
- Updated dependencies [c228019]
- Updated dependencies [b75b5d3]
- Updated dependencies [0879e90]
- Updated dependencies [44a23e5]
- Updated dependencies [daf38f2]
- Updated dependencies [d6a97f6]
- Updated dependencies [7cbcd34]
- Updated dependencies [ca1c6c3]
- Updated dependencies [aa3574c]
- Updated dependencies [b1a31dd]
- Updated dependencies [023d6c7]
- Updated dependencies [c464e35]
- Updated dependencies [bbf6081]
- Updated dependencies [4914abd]
- Updated dependencies [b5c81b7]
- Updated dependencies [315a533]
- Updated dependencies [5165a7b]
- Updated dependencies [30d8a97]
- Updated dependencies [136fd3a]
- Updated dependencies [c0e0348]
- Updated dependencies [49cebaa]
- Updated dependencies [7d5dc5b]
- Updated dependencies [8802f09]
- Updated dependencies [bf0c12e]
- Updated dependencies [67aa107]
- Updated dependencies [611fd20]
- Updated dependencies [e30a985]
- Updated dependencies [85ff99a]
- Updated dependencies [9190e59]
- Updated dependencies [ad86c08]
- Updated dependencies [0f9cf08]
- Updated dependencies [e4182c0]
- Updated dependencies [cd62884]
- Updated dependencies [59c70fe]
- Updated dependencies [1b24d8f]
- Updated dependencies [7e1b5a5]
- Updated dependencies [d522e25]
- Updated dependencies [211ee54]
- Updated dependencies [4678b59]
- Updated dependencies [3fa4c1a]
- Updated dependencies [1aff75a]
- Updated dependencies [000f195]
- Updated dependencies [92b7f7b]
- Updated dependencies [bd8a9ed]
- Updated dependencies [357316c]
- Updated dependencies [8514984]
- Updated dependencies [7997644]
- Updated dependencies [f207e5e]
- Updated dependencies [5589197]
- Updated dependencies [9f29b19]
- Updated dependencies [89e7d14]
- Updated dependencies [bda72f8]
- Updated dependencies [d2e0d7f]
- Updated dependencies [8d0cadf]
- Updated dependencies [556517c]
- Updated dependencies [4749edc]
- Updated dependencies [eacc848]
- Updated dependencies [83e94a5]
- Updated dependencies [50e1211]
- Updated dependencies [4af560a]
- Updated dependencies [2707f44]
- Updated dependencies [87ff0a4]
- Updated dependencies [621866a]
- Updated dependencies [483d9b7]
- Updated dependencies [3c7f88f]
- Updated dependencies [e2828ed]
- Updated dependencies [d9583ff]
- Updated dependencies [e6ca669]
- Updated dependencies [d51b2fa]
- Updated dependencies [8e5fef8]
- Updated dependencies [c8c8470]
- Updated dependencies [e712ea0]
- Updated dependencies [ee8040c]
- Updated dependencies [ea534af]
- Updated dependencies [010fa6a]
- Updated dependencies [1aff75a]
- Updated dependencies [009d7ad]
- Updated dependencies [5029184]
- Updated dependencies [ca1c6c3]
- Updated dependencies [07bea5d]
- Updated dependencies [7f738dd]
- Updated dependencies [c849c60]
- Updated dependencies [e16ed4f]
- Updated dependencies [b137ea2]
- Updated dependencies [2b04e24]
- Updated dependencies [55dd238]
- Updated dependencies [4bc6e19]
- Updated dependencies [0956768]
- Updated dependencies [74dbda3]
- Updated dependencies [3b6ecac]
- Updated dependencies [8347116]
- Updated dependencies [324d2aa]
- Updated dependencies [bd05055]
- Updated dependencies [2cbfb3f]
- Updated dependencies [a629f50]
- Updated dependencies [9133c94]
- Updated dependencies [14d74cc]
- Updated dependencies [e7b5f9c]
- Updated dependencies [a64a7a3]
- Updated dependencies [bb37b4e]
- Updated dependencies [61b5b04]
- Updated dependencies [d1733cb]
- Updated dependencies [8478a18]
- Updated dependencies [c48c9c1]
  - @modyra/core@2.2.0
  - @modyra/widgets@2.2.0

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
- Updated dependencies [965dd88]
  - @modyra/core@2.2.0
  - @modyra/widgets@2.1.0

## 0.5.4

### Patch Changes

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
- Updated dependencies [2e29f30]
- Updated dependencies [062881c]
- Updated dependencies [c090eac]
- Updated dependencies [992b36d]
- Updated dependencies [850a463]
- Updated dependencies [90fdf00]
- Updated dependencies [df1aaeb]
- Updated dependencies [c47d0ac]
- Updated dependencies [2a38f16]
- Updated dependencies [6921584]
- Updated dependencies [6921584]
- Updated dependencies [062881c]
  - @modyra/core@2.1.1
  - @modyra/widgets@2.0.2

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
  - @modyra/widgets@2.0.1

## 0.5.2

### Patch Changes

- Updated dependencies [c76dfc9]
- Updated dependencies [c1ddb7c]
- Updated dependencies [2037ba5]
- Updated dependencies [4e9a4bc]
- Updated dependencies [3e9e1fb]
- Updated dependencies [a5658fb]
- Updated dependencies [7fb3ebf]
- Updated dependencies [eb267c1]
- Updated dependencies [dce1918]
- Updated dependencies [3161bad]
  - @modyra/widgets@2.0.0
  - @modyra/core@2.0.0

## 0.5.1

### Patch Changes

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

- 342f396: These packages are now compiled by TypeScript 7.

  Nothing about the published API changes, and that is checked rather than asserted: both compilers
  emit all twenty-one projects and the results are compared file by file. Across 464 files the only
  difference is the order in which the members of a string-literal union are printed in
  `catalog.d.ts` — the same type either way. The contract snapshot is unmoved, and the Angular package
  still builds through its own TypeScript 5.9 toolchain from these declarations.

  The Angular package and Studio's embedded compiler stay on TypeScript 5.9, which their peer ranges
  and its package exports require.

- Updated dependencies [04d150e]
- Updated dependencies [5db335c]
- Updated dependencies [1c672d4]
- Updated dependencies [e3f27b3]
- Updated dependencies [0a23bfd]
- Updated dependencies [e8b586a]
- Updated dependencies [9ec6b65]
- Updated dependencies [76f4e7e]
- Updated dependencies [2d2398b]
- Updated dependencies [4de3620]
- Updated dependencies [b213813]
- Updated dependencies [c1584ad]
- Updated dependencies [b0d9252]
- Updated dependencies [27c1222]
- Updated dependencies [a3c4580]
- Updated dependencies [7bafd3d]
- Updated dependencies [3bb85a6]
- Updated dependencies [76e119e]
- Updated dependencies [c1b9b10]
- Updated dependencies [569128a]
- Updated dependencies [49c28c9]
- Updated dependencies [35d6094]
- Updated dependencies [186cbad]
- Updated dependencies [ee8198d]
- Updated dependencies [eb224f8]
- Updated dependencies [0f85077]
- Updated dependencies [d6e8855]
- Updated dependencies [ca0eebc]
- Updated dependencies [2ac6b1e]
- Updated dependencies [44d0e03]
- Updated dependencies [3068258]
- Updated dependencies [0f09b34]
- Updated dependencies [0d3fa5f]
- Updated dependencies [08cb845]
- Updated dependencies [8e67cfe]
- Updated dependencies [f4e593a]
- Updated dependencies [31cbcdb]
- Updated dependencies [75d2553]
- Updated dependencies
- Updated dependencies [5c8784c]
- Updated dependencies [6e434ab]
- Updated dependencies [5dbdf1a]
- Updated dependencies [b10a5b1]
- Updated dependencies [8d7a621]
- Updated dependencies [c7c6adf]
- Updated dependencies [f4b41af]
- Updated dependencies [afef217]
- Updated dependencies [635529b]
- Updated dependencies [bc91571]
- Updated dependencies [8bdc82b]
- Updated dependencies [81e1e39]
- Updated dependencies [e4aa213]
- Updated dependencies [7091a93]
- Updated dependencies [342f396]
- Updated dependencies [84ae084]
- Updated dependencies [50a654b]
- Updated dependencies [1a99bbb]
- Updated dependencies [bfeb371]
- Updated dependencies [816ca68]
- Updated dependencies [9a8a747]
- Updated dependencies [6d1e0cd]
- Updated dependencies [bdde472]
  - @modyra/widgets@1.0.0
  - @modyra/core@1.0.0

## 0.5.0

### Patch Changes

- Updated dependencies [6f09012]
- Updated dependencies [969c08f]
- Updated dependencies [29621a7]
- Updated dependencies [602ac27]
- Updated dependencies [2c6a57f]
- Updated dependencies [b0aa545]
- Updated dependencies [2ce4ef1]
- Updated dependencies [9e8cbad]
- Updated dependencies [879b5e9]
- Updated dependencies [cd22e96]
- Updated dependencies [33679ba]
- Updated dependencies [1d3a104]
- Updated dependencies [e5eb12d]
- Updated dependencies [c2fc744]
- Updated dependencies [808293d]
- Updated dependencies [c4ca77d]
- Updated dependencies [207901b]
- Updated dependencies [05c5665]
- Updated dependencies [242551e]
- Updated dependencies [4751929]
- Updated dependencies [18929b0]
- Updated dependencies [d568743]
- Updated dependencies [098a0af]
- Updated dependencies [8279dc3]
- Updated dependencies [f580d4b]
- Updated dependencies [8e1164f]
- Updated dependencies [db0c39a]
- Updated dependencies [daaabe1]
- Updated dependencies [3f2e9d0]
- Updated dependencies [a8606da]
- Updated dependencies [ba52f67]
- Updated dependencies [f5ee72d]
- Updated dependencies [c170cf3]
- Updated dependencies [6bdfb02]
- Updated dependencies [a0559ec]
- Updated dependencies [351c0ed]
- Updated dependencies [6f6ed4e]
- Updated dependencies [f93c8cd]
- Updated dependencies [ebfa0ca]
- Updated dependencies [4803d30]
- Updated dependencies [8e1dc80]
- Updated dependencies [d9e424a]
- Updated dependencies [d21390f]
- Updated dependencies [9864d9a]
- Updated dependencies [6aab031]
- Updated dependencies [fd87ae7]
- Updated dependencies [9d7b426]
- Updated dependencies [e4ff1ac]
- Updated dependencies [26017d8]
- Updated dependencies [e0a4cef]
- Updated dependencies [5dbf493]
- Updated dependencies [a3c662e]
- Updated dependencies [1523836]
- Updated dependencies [e7f3189]
- Updated dependencies [fc6327f]
- Updated dependencies [0bd898d]
- Updated dependencies [7a574d1]
- Updated dependencies [61271c5]
- Updated dependencies [fe0dba3]
- Updated dependencies [8b87472]
- Updated dependencies [5b34979]
- Updated dependencies [3acc9bf]
- Updated dependencies [88b57b4]
- Updated dependencies [b3aa842]
- Updated dependencies [d32694a]
- Updated dependencies [f7e0c7c]
- Updated dependencies [62575e9]
- Updated dependencies [f998046]
- Updated dependencies [f759e3d]
- Updated dependencies [df563d4]
- Updated dependencies [6d000c1]
- Updated dependencies [1644bf5]
- Updated dependencies [026cf08]
- Updated dependencies [ec3d8ca]
- Updated dependencies [a613ac8]
- Updated dependencies [cf497e7]
- Updated dependencies [e403b6d]
- Updated dependencies [1008e4e]
- Updated dependencies [f7e0c7c]
- Updated dependencies [095fff8]
- Updated dependencies [77f2095]
- Updated dependencies [92d6155]
- Updated dependencies [4b2560b]
- Updated dependencies [d981a2f]
- Updated dependencies [6bff3da]
- Updated dependencies [bbb575e]
- Updated dependencies [8061d1d]
- Updated dependencies [de65e03]
- Updated dependencies [93a65aa]
- Updated dependencies [2388e2a]
- Updated dependencies [cf9b772]
- Updated dependencies [dc7acff]
- Updated dependencies [e6e592d]
- Updated dependencies [3846236]
- Updated dependencies [c136ad1]
- Updated dependencies [0b4298b]
- Updated dependencies [847f436]
- Updated dependencies [9b2646a]
- Updated dependencies [fd6e967]
- Updated dependencies [4206be3]
- Updated dependencies [b4b236d]
- Updated dependencies [9c8a238]
- Updated dependencies [d91dca1]
- Updated dependencies [ff10fc7]
- Updated dependencies [d17ea98]
- Updated dependencies [0310e27]
- Updated dependencies [5a66c4a]
  - @modyra/widgets@0.5.0
  - @modyra/core@0.5.0

## 0.4.0

### Minor Changes

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
  - @modyra/widgets@0.4.0
