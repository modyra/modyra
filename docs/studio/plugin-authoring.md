# Plugin authoring

A Studio target is a plain object implementing `StudioTarget<T>` from
`@modyra/studio-codegen` — no inheritance, no registration ceremony
beyond adding it to a `TargetRegistry`.

```ts
interface StudioTarget<T = unknown> {
  id: string;
  displayName: string;
  version: string;
  capabilities: TargetCapabilities;
  defaults(): T;
  analyze(project: MdyStudioProject, options: T): Promise<TargetAnalysis>;
  generate(project: MdyStudioProject, options: T): Promise<Artifact>;
}
```

`generate()` returns an `Artifact`: a target ID, a list of files
(`path`/`language`/`content`/`role`), diagnostics, and an optional entry
file. `analyze()` is the same shape without the files — a cheap
compatibility check.

## Registering it

Targets load lazily. Registering one costs nothing until a user actually
picks it and clicks Generate:

```ts
import { TargetRegistry } from "@modyra/studio-codegen";

const registry = new TargetRegistry();
registry.register({
  id: "my-target",
  displayName: "My Target",
  load: async () => (await import("./my-target.js")).createMyTarget(),
});
```

## The conformance suite

Every target — including one you write — should pass
`runConformanceSuite(target, project)` from `@modyra/studio-codegen`
before it ships. It checks:

- **Determinism** — generating twice from the same project produces
  byte-identical output.
- **No project mutation** — `generate()` must never write back to the
  project it was handed.
- **Safe file paths** — no absolute paths, no `..` traversal.
- **Valid diagnostics** — every diagnostic has a real `code`, a severity
  of `error`/`warning`/`info`, and a non-empty `message`.
- **A valid `entryFile`** — if set, it must match a path the target
  actually generated.

The suite is designed to *catch* violations, not just pass a correct
target — see `packages/studio-codegen/test/conformance.test.mjs` for five
intentionally-broken targets, one per rule, each one failing the
corresponding check.

## Reusing the shared mapper

If your target emits a real `@modyra/core`-shaped form definition (the
way Core, Angular, and React all do), you very likely do not need to
write schema-mapping logic at all: `buildFormModule()` and
`buildStubsModule()` from `@modyra/studio-codegen` already do it,
parameterized by a `TargetProfile`:

```ts
interface TargetProfile {
  factoryImportSource: string;   // e.g. "@modyra/core"
  createCallName: string;        // e.g. "createForm"
  wrapSchemaInThunk?: boolean;   // React's useMdyForm(() => schema, …)
  hookExportName?: string;       // wrap the call in an exported hook
  validatorsImportSource?: string; // defaults to factoryImportSource
}
```

Check the real signature of whatever factory function you're targeting
before assuming the existing profile shape covers it — `wrapSchemaInThunk`
and `hookExportName` exist precisely because React's `useMdyForm` turned
out to have two real differences from `createForm`/`mdyForm`, found by
checking the actual API rather than assuming a bare rename would work.

## Never generate logic, only stubs

Server validators, custom validators, and submit actions are always
symbolic (`StudioImplementationRef`) — a target emits a typed, throwing
stub function for each one, never a guess at what the real implementation
should do. This is a hard rule (ADR-0005, R7, R11): Studio never `eval`s
anything and never invents business logic on a user's behalf.
