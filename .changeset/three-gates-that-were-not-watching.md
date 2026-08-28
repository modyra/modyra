---
"@modyra/widgets": minor
---

Three gates that were reporting on things they could not see

**Moving a part inside a kind's list changed nothing the contract differ could tell you.** The order a
part sits in is the reading order — `contracts.ts` says so — and the snapshot recorded eight fields
per part, none of them where it was. Swapping two names in a shipped kind moves what a screen reader
says next and the differ answered "contract unchanged". It records `order` now, and a move is major
in both directions: a person hears the parts in the order they are in.

**A field controller published by no door was nobody's finding.** Three of them were written, tested,
and unreachable: the types were exported, so a consumer could name the interface and had no way to
build one, while the adoption bench reported the kinds as offering nothing — correctly, because from
the public door nothing was. The duplicate-door check guards the opposite problem, the type surface
only compares what is exported, and their own specs reach them by deep path into `dist/`, which is
the house habit and therefore not a signal. `test:public-doors` now asks the third question, and its
three findings print three different sentences: one had been telling readers to look for a second
door when the finding was that there was none.

**One index claimed to cover a package it covered two thirds of.** The `./testing` door publishes
twelve collections — what a kind holds when it is empty, what it looks like at rest, which beats a
paint takes — and every one was in no index. They are what the adapters' fixtures compare against, so
a fourth adapter's author needs them as much as the contract's own catalogues.

They are not folded into the contract's index, because reaching them from the main barrel would put
fixtures in the bundle of somebody who only wanted to draw a field. `MDY_TESTING_VOCABULARIES` is
that door's own index. Two indexes and no third list: the alternative — one index plus a ledger of
what it deliberately omits — is the shape that goes stale in silence, and two such ledgers once hid
five undeclared classes between them. The check now asks of every door together that nothing
published anywhere is named by neither.
