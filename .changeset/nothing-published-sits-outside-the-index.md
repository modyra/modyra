---
"@modyra/widgets": minor
---

The index of catalogues covers everything the package publishes, and every catalogue is frozen through

Two holes, one shape: a list that says "these are the contract" is worth exactly what it leaves out.

**The index was a quarter complete.** Its own check recognised a vocabulary by six name endings —
`CLASSES`, `CONTRACTS`, `KEYBOARD`, `OPENERS`, `STRUCTURE`, `RELATIONS` — so it could only ever find
what already looked like what somebody had thought of. Twenty-six collections sat outside it,
published and unindexed, and the check was green the whole time: a recogniser narrower than the thing
it guards reports the absence of what it cannot see. It now derives the list from the package's own
exports — every `MDY_` name holding members — and there are 41, the index among them. An index that
omitted itself published one collection it did not cover.

A fifth shape, `data`, separates the collections that are contract from the collections that are
payload: translations, colour presets, icon paths. Both are published and readable; only one is a
vocabulary a fourth adapter must implement against, and no rule reading the data can tell them apart.

**Every catalogue is now frozen all the way down.** `Object.freeze` reaches one level, and two
catalogues were shallow: `CATALOGUE.text.parts.label.classes.push(…)` succeeded, and from then on
every renderer reading the contract read what the page had written. Invisible while each catalogue
was reachable only through its own export — publishing an index made all of them reachable from one
value, which is what turned a latent hole into a found one. The freeze is applied at the source, so a
catalogue imported directly is as safe as the same catalogue reached through the index; protection
that depended on how you asked would not be protection.
