---
"@modyra/core": major
---

A keyed collection reports the calls it could not carry out, and stops holding what nobody is using.

Four calls used to do nothing and say nothing, which is the shape of a bug that reaches production
intact — the code looks right and the data quietly is not what the author believes:

- **`setAll` handed something that is not an object emptied the collection.** A stray `undefined`
  from a response erased every row. It now declares nothing and says so; `setAll({})` is still how
  you empty one deliberately.
- **`patch({ key: 5 })` on rows that are groups was ignored**, so a caller believed it had written.
- **`rename` onto a taken key, or from a key that does not exist**, was a silent no-op. The data was
  never at risk; the silence was.
- **`cell(key, "typo")`** returned a handle that could never bind. It now names the parts the row
  actually offers.

Cell handles are held weakly, so a table churning provisional keys no longer accumulates one handle
per key it ever rendered. Identity across `upsert → remove → upsert` is unchanged: a weak reference
keeps exactly what a mounted control is holding.

All of it goes through the host's development channel, so `devWarnings: false` silences these like
everything else.

**Breaking:** `MdyRecordManagerDeps` gained a required `warn`. It is the seam the typed form uses to
build a collection; constructing an `MdyRecordManager` by hand means passing one
(`warn: (message) => engine.warnDev(message)`). `MdyFormEngine.warnDev` is new and public for that.
