---
"@modyra/widgets": minor
"@modyra/angular": minor
---

Declare the class doors, and give the Angular components a class record whose shape does not move

`MDY_CLASS_DOORS` names every function that puts a class on an element, and says for each one how a
reader turns a call site into the classes it produces. A door that cannot be answered from text
declares **why** — `stateClass` takes a class and a state, so a call site names nothing until the
expression that produced it runs. A gate can now print the perimeter it did not cover instead of
reporting those classes as absent.

Doors whose argument is an options object declare `resolveObject` and the `domains` each key may
hold. A key fixed at the call site is fixed; a key left to runtime is expanded over its domain; a
key the call omits is left out of the record so the signature's own default applies. That last rule
is what keeps the expansion honest: expanding every key would claim `mdy-chip--removable` on call
sites that never pass `removable`.

A positional door declares `argDomains`: `null` where the argument must be written out, and the
domain to expand over where it is decided at runtime. A popup's placement is the case — a call names
the kind and leaves the position to the moment, and only two positions carry a class at all. No
domain is ever inferred; a door that declares none is answered only when every argument is a
literal, because an invented domain would claim classes no call site can emit.

The Angular renderers take their class names from the catalogue through a `cls` record typed
`Readonly<Record<string, string>>`. The wide type is deliberate: a component's declared surface must
not change every time its kind gains a part, which is what an inferred shape does. The width is paid
for at the gate — `audit-angular-widget-contract` refuses a `cls.x` a component does not declare and
names what it has, so an unknown key is a red before it ships rather than `class="undefined"` on the
page.

**Where the tools disagree, and this is the record of it.** `contract:diff` classifies this `patch`:
the widget contract's parts, relations, keyboard and shared classes are untouched, and it says so
itself. `test:type-surface` classifies it `major`, on one line — `MdySelectComponent.protected cls`
is now `Readonly<Record<string, string>>` where it was an object type of nine named keys.

That verdict is the tool working as designed, not a hole in it. It compares two object-literal types
by their members, so a type that gains a key is `minor`; a mapped type has no members to compare, so
the comparison falls back to the text and any replacement of one by the other is `major`. Read
member by member the change does remove nine named keys, which is exactly what the wide type is
for.

Read as a consumer feels it, this release is `minor`. `cls` is `protected`, so only a subclass sees
it, and every key that resolved through the old type resolves through the index signature. What is
lost is `keyof` over those nine names — narrow, and paid for deliberately so that a component's
declared surface stops moving each time its kind gains a part. The keys themselves are checked
where they are used: `audit-angular-widget-contract` refuses a `cls.x` no component declares.
