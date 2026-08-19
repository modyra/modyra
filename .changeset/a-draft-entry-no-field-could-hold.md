---
"@modyra/core": major
---

A draft entry no field of that kind could hold is dropped and reported

The draft shape check is named among the always-on structural protections, with one exemption:
*fields without a declared initial restore as-is*. What actually disabled it was an initial of
`null` — and `null` is not the absence of a declaration, it is what the value contract declares for
every kind with no empty of its own. So seven kinds of seventeen skipped the check: a script on the
origin could write `{"x":{…}}` into the stored draft and a `number`, a `select` or a `datepicker`
restored it whole, which is the type confusion the check exists to stop. `daterange` skipped it for
the mirror reason — its own empty is an object, so any object matched.

A field now declares the shape its kind takes, and a kind that chooses from a list declares the
values it offers — an option's shape is "anything non-nullish" by design, so only the list can tell
a legitimate option carrying an object from a hostile one. Both travel on the descriptor and reach a
collection's rows, which is where a draft is most likely to name something nobody declared.

**Breaking.** `MdyFieldDescriptor` and `MdyAnyFieldDescriptor` gain required `shape` and `options`
members: code building a descriptor as an object literal rather than through `field()` needs them.
