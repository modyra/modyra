---
"@modyra/core": patch
---

The dynamic reader judges what a document wrote, and files each finding under the code of the rule it broke

`parseDynamicForm` and `parseDynamicFields`:

- **A finding's code no longer depends on its message.** Every refusal names its code where it is
  made. The code used to be read back out of the message, and a message quotes what the document
  wrote, so a field named `"a path may be"` was refused for its whitespace under
  `MDY_DYNAMIC_PATH_TOO_LONG`, and an unknown kind spelled `"duplicate option value"` came back as
  `MDY_DYNAMIC_DUPLICATE_OPTION`. `MDY_DYNAMIC_DIAGNOSTICS` and its phrases are unchanged.
- **A tree child named like an `Object` method** (`valueOf`, `hasOwnProperty`, `isPrototypeOf`) reads
  the initial value its parent declares for it, or none. It used to read the inherited method and be
  refused with "text holds string, got function".
- **`validators` written as a list** (`validators: []`) is refused as "validators must be an object"
  (`MDY_DYNAMIC_INVALID_FIELD`), and the field is dropped. It used to be accepted.
- **Option values past a double's range in opposite directions** (`1e400` and `-1e400`) are two
  options. Both used to compare as `null` and the second was dropped as `MDY_DYNAMIC_DUPLICATE_OPTION`.
  Two values past the range in the same direction (`1e400`, `1e401`) both parse to `Infinity` and are
  still one option.
- **`explainValueMismatch` names NaN and the infinities by value**: "number holds number, got
  Infinity" rather than "… got number".

The Rust and Java readers (`sdk/rust/modyra-contract`, `sdk/java/modyra-contract`) refuse
`validators: []` the same way, and the Java reader also keeps `1e400` and `-1e400` as two options.
The Rust reader holds `1e400` and `1e401` as
two distinct options where TypeScript, reading both as `Infinity`, keeps one: a limit of the
JavaScript number, with no shared fixture.

**Migration.** A document carrying `validators: []` used to parse `ok` and now drops that field: write
`validators: {}`, or leave the member out. A consumer that keyed on a misfiled code for a document
whose names or kinds quote a phrase now receives the code of the rule that was broken. Classified
`patch` by `contract:diff`, which covers the widget contract only; a reader that refuses a document it
used to accept is the kind of change that tool cannot see.
