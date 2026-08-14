---
"@modyra/studio-model": patch
"@modyra/studio-editor": patch
---

One bound for how deep a schema may go, and a schema nobody can clone is refused

A project carries **two** nested structures through the same `structuredClone`. The layout was
guarded ahead of it; the schema went on reaching the identical frame:

```
depth 32    loads clean
depth 40    loads clean, nothing reported
depth 4000  RangeError, from inside the clone
```

Both structures gave way at the same threshold, which is what says it is one frame one structure
over rather than two defects that look alike.

**The schema is walked on the raw input before the clone**, over an explicit stack. Past what can be
processed the project is **refused** rather than degraded — a schema is not arrangement, and a
project without one is not a project — and a schema containing itself is refused by name rather than
reported as depth.

**And the two packages disagreed about how deep a schema may be.** `@modyra/studio-editor` refuses to
*place* a node past 32 levels, so nothing built in a session goes deeper, while the loader accepted
any depth from a file and said nothing — so an import or a generator produced a project nobody could
then edit, silently. `STUDIO_SCHEMA_MAX_DEPTH` now lives in `@modyra/studio-model`, the editor reads
it instead of declaring its own, and the loader reports `SCHEMA_TOO_DEEP` past it.

Reported rather than refused, because an import can legitimately be deeper and the value is the
author's — but a project their editor cannot open is something they have to be told about.

The bound is counted the way a placement is: `validatePlacement` accepts a leaf under `root + 31`
groups and refuses it under `root + 32`, and the loader now changes its answer at exactly that
point. Two bounds meaning different things by "depth" agree on the number and disagree by one, which
is the kind of difference nobody finds until a project sits on it.

Found by `battle-tests/adversarial/studio/`.
