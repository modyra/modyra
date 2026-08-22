# ADR 0139: A select has two shapes, and one renderer only ever draws one of them

Status: Accepted — amended, see *Amendment* below

## Context

`select` is not one control. Measured across the three renderers, with a document that declares
nothing but a label and two options:

```
                    searchable: false            searchable: true
plain               role="combobox"              role="combobox"
lit                 native <select>              role="combobox"
angular             native <select>              role="combobox"
```

Two shapes, and a switch that moves two of the three renderers between them. **Plain never enters the
native shape at all.**

The reason for the native shape is written where it was decided, in the lit adapter:

> A custom combobox with no search field gives a keyboard user arrows and nothing else: no way to
> type towards an option… using the control that already has one — along with the platform's
> keyboard model and the mobile picker — is the other answer.

That is a good reason. A native `<select>` brings type-ahead, the platform's own keyboard model, and
the mobile picker, and a custom combobox without a search field brings none of them. The decision to
prefer it when nothing asks for search is deliberate and it is not what this record disturbs.

What this record exists for is the part nobody wrote down: **the two shapes do not have the same
parts, and the contract describes only one of them.**

## Decision

**`select` has two shapes. `searchable` selects between them, and `MDY_WIDGET_CONTRACTS.select`
describes the combobox shape only.**

A native `<select>` cannot draw `options` or `popup`: the list is the platform's, rendered outside the
document, and no markup of ours exists for it. Those parts are therefore **conditional on the combobox
shape**, and a check that reads them is measuring the renderers that are in it — not the contract.

**Plain's divergence is recorded, not resolved here.** It draws a combobox in both modes, so a
document declaring `searchable: false` gets the platform's keyboard model and mobile picker in two
renderers and does not in the third. That is a real difference in what a person can do, and it is the
thing `@modyra/widgets` exists to prevent. It is recorded as an open difference rather than settled,
because settling it means choosing which renderer changes and that is a product decision with a
migration behind it either way.

## Consequences

**Any check reading `options` or `popup` for a `select` must say which shape it means.** Today several
do not, and they pass because they happen to run against the combobox shape — which is plain always,
and the other two only when a document asks for search. A document that does not ask puts two of three
renderers outside what those checks describe, and nothing fails.

**A native shape's keyboard cannot be observed from the page.** No `aria-expanded` moves, no element
appears; the platform owns the popup. `every-key-a-kind-declares` records such a binding as
*unreached* rather than unanswered for exactly this reason, and any future check about opening a
`select` needs the same distinction or it will report the platform's control as keyboard-dead.

**The switch is a capability, not a style.** `searchable: false` is not "the same control without a
search box" — it is a different control, with a different keyboard model, a different popup owner and
a different accessibility surface. A consumer reading the flag as cosmetic will be surprised, and the
name does not help them.

## Alternatives rejected

**Describe both shapes in the contract.** `options` and `popup` marked optional, with a note. Rejected
because an optional part that is *always* absent in one shape and *always* present in the other is two
contracts wearing one name, and a check cannot tell which it is looking at without knowing the flag —
which is the same information, stated less clearly.

**Make every renderer always draw the combobox.** One shape, one contract, nothing conditional. It
throws away the platform keyboard model and the mobile picker for every document that does not ask for
search, which is the majority, and it is the choice the lit adapter's own comment argues against.

**Make plain follow the switch.** The smallest change that removes the divergence, and probably where
this ends. Not taken here because it is a behaviour change to a shipped renderer and belongs to
whoever owns that decision, with a migration note; recording the difference is what this ADR can
honestly do on its own.

## Verification

Measured directly rather than inferred: a `select` mounted with `searchable` false and true on each of
the three renderers, counting `[role="combobox"]` and `select` elements. The table above is that
measurement.

**What is not checked, and is the gap this record names:** nothing asserts that the two shapes offer
the same *capabilities* — that a value chosen in the native shape is the value the combobox shape
would produce, that both announce their selection, that both are reachable by keyboard in their own
idiom. Those are the properties a person actually depends on, and the shapes were compared by their
markup rather than by what they let someone do.

**The check that fails if this decision is violated** is a contract check that reads `options` or
`popup` for a `select` without saying which shape it means. There is no such gate today; writing one
is the follow-up this record owes.

## Amendment: the native shape is not the platform's keyboard model

Measured after this record was accepted, stepping a closed native `<select>` key by key on both
renderers that draw one:

```
                 ArrowDown   Enter   ArrowDown   Enter
lit                null      null     null       null
angular            null      null     null       "a"
events the <select> received:  keydown ×4, and nothing else, in both
```

**Neither receives a `change`.** The platform draws its list outside the document and produces no
event this page can hear, so Angular's native shape works because its host binds `(keydown)` and
drives the selection through the contract's own policy — the library imitating the platform, not the
platform answering. Lit now does the same, deliberately without `preventDefault`, so that where the
platform *does* answer it answers first and lands on the same option.

This does not change the decision, and it corrects one of the reasons given for it. The argument
quoted above for preferring the native shape names *"the platform's keyboard model"*, and in this
environment neither renderer gets one — the keyboard is ours in both shapes. **Type-ahead and the
mobile picker remain real reasons and are not measured here**; they are what is left of the case for
the native shape, and they are what the decision about plain should be weighed against rather than a
keyboard model that turns out to be a library's.

A second thing the same work added, which belongs in this record because a check will meet it: the
native shape draws an entry for **nothing chosen**, so that a list has somewhere to sit before a
choice is made. It is not an option a document declared, and it carries the `placeholder` part's class
so that it can be told apart by the catalogue rather than by having empty text. A collector reading
`option` elements must exclude it or it reports a control as offering a value nobody wrote.

## Security and privacy

None. A native control's popup is rendered by the platform rather than the page, which narrows rather
than widens what the document exposes; no data crosses a boundary either way.
