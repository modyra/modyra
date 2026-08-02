# React Native

Honest status: **the engine compiles and runs its logic under a current
Hermes** (verified below), but there is no `@modyra/react-native` package,
no native-input renderer, and no dedicated example — this is a
compatibility finding, not a shipped integration.

## What was actually verified

An earlier attempt used the `hermes-engine` npm package (`0.11.0`) and
found it rejected `async`/ES6 classes — a false negative, since that
package is a ~2019-era Hermes build that predates most of modern
JavaScript, not a fair proxy for a real RN app's engine.

This time: the real `hermesc` binary shipped inside `hermes-compiler`
(the exact compiler React Native `0.86.0`'s build pulls in), extracted
directly from the npm tarball — no full `react-native` install needed,
since only the compiler (not the native iOS/Android runtime) is relevant
to a "does Modyra's compiled output parse under Hermes" question.

```sh
npm pack hermes-compiler@250829098.0.14
tar xzf hermes-compiler-250829098.0.14.tgz
chmod +x package/hermesc/osx-bin/hermesc  # linux64-bin/win64-bin also ship in the tarball

# Realistic surface 1: @modyra/core alone
npx esbuild packages/core/dist/index.js --bundle --format=cjs --platform=neutral \
  --outfile=core-bundle.js
./package/hermesc/osx-bin/hermesc -emit-binary -out core.hbc core-bundle.js

# Realistic surface 2: an RN app's actual import surface (core + React adapter)
npx esbuild rn-entry.js --bundle --format=cjs --platform=neutral \
  --jsx=automatic --jsx-import-source=react --outfile=react-bundle.js
./package/hermesc/osx-bin/hermesc -emit-binary -out react.hbc react-bundle.js
```

**Result: both compile to Hermes bytecode with exit code 0, zero errors.**
`hermesc` only emits its standard "undeclared global" warnings
(`setTimeout`, `clearTimeout`, `Promise`, `AbortController`, `console`,
`queueMicrotask`, `performance`) — expected and harmless: these are
free-variable references Hermes flags because it compiles the bundle in
isolation, and React Native's JS runtime provides all of them at actual
app startup, same as any other bundle compiled standalone. No syntax or
language-feature rejection anywhere in either bundle — the ES2022 output
`tsconfig.json` targets (including private class fields) compiles cleanly.

This reverses the earlier finding: Modyra's actual compiled JavaScript
is not the blocker. `hermesc` only compiles (this build has execution
disabled — `hermesc does not support -exec`), so this confirms **parses
and compiles cleanly**, not full runtime behavior inside a device/simulator;
that would need an actual RN app shell, out of scope for this check.

## What still needs attention before calling RN "supported"

1. **No native `<TextInput>` renderer.** `@modyra/react`'s hooks
   (`useMdyForm`, `useMdyField` via `@modyra/widgets`) are markup-agnostic
   — they never assume `<input>` — so wiring a field handle to RN's
   `<TextInput onChangeText={...} value={...}>` is mechanically the same
   shape as any other headless integration, but nobody has written or
   tested that binding.
2. **No example app, no Metro-bundled smoke test.** This check compiled
   representative bundles with `esbuild`, not Metro; Metro's own transform
   pipeline (Babel presets, `commonjs` wrapping) could behave differently
   even though the underlying Hermes compiler is identical.

## Drafts on AsyncStorage

`MdyDraftStorage` is synchronous — a field writes a draft while the user types, and there is nothing
useful to hand a caller that cannot wait. AsyncStorage is Promise-based, so the two need a cache
between them. `@modyra/core/async-draft-storage` is that cache:

```ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createHydratedDraftStorage } from "@modyra/core/async-draft-storage";

const storage = createHydratedDraftStorage({
  backend: AsyncStorage,          // any { getItem, setItem, removeItem } returning Promises
  keys: ["checkout-draft"],       // a key/value store cannot be enumerated portably
  onError: (key, error) => console.warn("draft flush failed", key, error),
});

await storage.ready;              // before restoring, so a read cannot miss the saved draft
mdyForm(schema, { draft: { key: "checkout-draft", storage } });
```

Two behaviours worth knowing rather than discovering:

- **A read before `ready` resolves returns `null`** — "no draft", never a stale one. A synchronous
  read cannot wait, and restoring the wrong draft is worse than restoring none. Await `ready` first.
- **A failed flush is never thrown into the form and never loses the draft.** The value stays in the
  cache, so the user keeps typing and the next write retries it. `onError` is how you find out;
  without it the failure is silent, exactly as the default `localStorage` storage treats quota errors.

## Bottom line

Nothing in Modyra's own source is Hermes-incompatible — the previous
"blocked" status was really "tested against the wrong Hermes." Shipping a
real RN integration is still open work: a `<TextInput>` binding recipe and an
actual RN app smoke test (ideally via a StackBlitz-equivalent or Expo
snack, not verified here). The draft-storage adapter that used to be on this
list is built and tested — see above.
