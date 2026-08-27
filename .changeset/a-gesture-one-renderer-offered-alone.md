---
"@modyra/angular": patch
---

The segmented control stops claiming Home and End

It answered two keys the contract does not declare and the other two renderers do not offer, so
somebody who learned the gesture here lost it by changing renderer — and the contract was silent
about it, which under "everything adheres to the contract" is not an available outcome.

Two ways to close that: declare them, and the other two renderers owe them on every kind that is a
group of choices; or stop offering them, and the three agree. The second, because the authoring
practices give a radio group the arrows and not these: Home and End serve a set longer than can be
seen or held in mind, and three or four always-visible choices are crossed in three presses. Nobody
expects them here, so nobody loses them.

The shared `optionNavigationIndex` still answers Home and End — it serves lists too, where they are
owed. What changed is that a group of choices stops asking it for them.
