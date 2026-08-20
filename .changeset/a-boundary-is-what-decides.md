---
"@modyra/core": patch
---

A repeated group is refused for ambiguity, not for a variable body alone

Refusing every repeated group whose body can match different lengths caught the exponential shapes
and deleted ten of twenty patterns from a corpus of what form authors actually write — an IPv4
address, a hostname, a slug, a grouped card number, a person's name — each measured flat against its
own near miss out to two hundred characters.

What the cheap ones have is a boundary the stretchy part cannot stand in for, so the division between
one repetition and the next falls in exactly one place. The check reads that seam now: a body ending
stretchy is pinned unless the ending accepts everything the body's first element does; a body ending
fixed is pinned unless the stretchy part before it accepts everything the ending does. `\d{1,3}\.`
is pinned — a dot is not a digit. `.*a` is not — a dot *is* an `a`.

`^(a+)+b$`, `^(a+){15}b$`, `^(a{1,10})+b$`, `(.*a){20}$` and `^((ab)+)+$` are still refused; a body
this cannot take apart still is too. See ADR 0050.

Also: `escapeLiteral` no longer escapes `-`, which is only special inside a character class and is an
invalid escape under the `u` flag — so a hyphen compiled to nothing and `([a-z]+-)*` was refused for
that alone.
