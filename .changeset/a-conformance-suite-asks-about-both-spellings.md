---
"@modyra/studio-codegen": patch
---

The conformance suite asks about both path spellings, and about a file's content

`runConformanceSuite` is the gate a target must pass before it ships, and `TargetRegistry` is
exported — so the targets it judges are not only the four in this repository. A host writes what it
is handed.

**The path check knew one notation.** `path.startsWith("/") || path.split("/").includes("..")`:

```
../out.ts        refused      ..\out.ts          admitted
a/../../out.ts   refused      a\..\..\out.ts     admitted
/etc/passwd      refused      C:\out.ts          admitted
                              \\server\share     admitted
                              a/..\..\out.ts     admitted
```

A host on Windows resolves every one of those exactly as it reads. Both separators are checked now,
along with drive-qualified and UNC paths.

**A file is a path, a language, a role and content**, and three were checked. A file with no content
at all, and one whose content was the number `42`, were conformant. Two files at one path were too —
a target overwriting its own output, where which one survives depends on how the host iterates.

**A target that produces nothing has to say why.** Emitting no files passed every check by having
nothing to check, which is the emptiest way through a suite whose purpose is to be passed before
shipping. Nothing plus an error diagnostic is conformant — a project a target cannot express is what
diagnostics are for — and nothing alone is not.

Found by `battle-tests/adversarial/studio/`.
