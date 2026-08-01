---
"@modyra/widgets": minor
---

Milestone C begins: one canonical observation, answered by three renderers.

`canonicalWidgetSnapshot` reduces a mounted widget to what the contract can say about it — which
parts are on screen, what each part's role is, which *part* every reference resolves to, the field
states, the value, who owns focus, and whether the overlay is showing. `MDY_CANONICAL_AT_REST`
declares the expectation once and `compareToCanonical` reports the difference in the contract's own
words.

Two rules keep it canonical, and both had to be enforced against my own first attempt:

- **It may not know which adapter it is looking at.** Parts are found by the classes the contract
  gives them. A snapshot that needed telling would not be canonical, and the suite on top of it would
  be three suites.
- **No ids.** Every adapter generates its own, so a relationship records the *part* an attribute
  lands on. That an id matches is an implementation detail; that the label points at the control is
  the contract.

Getting the reduction right meant deciding what counts as an observation, and the differences between
renderers were the teacher every time:

- **A hidden subtree is not observed.** One renderer mounts its overlay eagerly and hides it, another
  builds it on open. The roadmap leaves that free, so counting hidden elements made two identical
  widgets look different.
- **`aria-hidden` is not hiding.** It means "do not announce", not "do not render" — a select's arrow
  is decorative and still part of the anatomy.
- **Open-ness comes from `aria-expanded`, not from the DOM's own hiding.** One adapter sets `hidden`,
  another leaves the panel attached under `visibility: hidden`, a third detaches it, and only the
  first is visible to an inspection without layout.
- **A portalled overlay is found through the relation that names it.** Scanning the document for
  something popup-shaped picks up a neighbour's panel the moment two widgets are mounted.

Select at rest now produces the same observation on Plain, Lit and Angular, with an empty divergence
ledger on all three. `aria-describedby` is deliberately not part of that expectation: at rest, with
nothing to describe, whether it names an empty description box depends on a free choice, and two
renderers disagreeing about it are both right. It becomes normative once there is something to say.
