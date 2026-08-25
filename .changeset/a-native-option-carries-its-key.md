---
"@modyra/angular": patch
---

Choosing an object-valued option stops emptying the field.

A native `<option>` carries a string, and this renderer bound the value itself — so an object-valued
list wrote `[object Object]` on every one of them, and the browser could not tell them apart. The
change handler looked that string up among the options and, once the key derivation was corrected to
describe an object by what it holds, found nothing: **choosing any option set the field to `null`.**

The option carries its key now, which is the same string the lookup asks for. And whether an option is
the chosen one is asked through that key rather than with `==`, which is identity for an object — so a
fresh value from a restored draft or a refetch showed nothing chosen while the model held it.

```
before   option values ["[object Object]", "[object Object]"]  ·  picking Beta → null
after    option values ['{"id":1,…}', '{"id":2,…}']            ·  picking Beta → {"id":2,…}
```
