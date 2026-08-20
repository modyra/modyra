# ADR 0105: One handle registry per realm

Status: Accepted

## Context

`reactive-owner.ts` keeps two `WeakMap`s: which reactivity runtime owns a handle's signals, and
which form built it. `observerFor` reads the first to catch the cross-runtime observation defect —
a binding handed a handle and observing it through a fresh, unrelated runtime, so nothing re-renders
and nothing complains.

A module-level `WeakMap` is per module *instance*. Two copies of `@modyra/core` in one dependency
tree are two registries, and a handle registered in one is unknown to the other. `observerFor`
reports only when it can *see* an owner that differs from the runtime it was handed, so an unknown
handle is one it says nothing about: the guard turns itself off.

Two copies is not hypothetical. It is what a package manager builds whenever two dependents need
versions it cannot deduplicate — the ordinary state of a tree partway through an upgrade — and it is
the case `PKG-001` names, a packed consumer observing something a workspace test cannot. Measured by
packing both packages, installing them into a project that has never seen this repository, and
placing a second core where a resolver would: the second copy answered `undefined` for a handle the
first one owned, and the diagnostic never fired.

## Decision

The registry is keyed by a global symbol — `Symbol.for("modyra.handle-registry")` — so every copy of
the package loaded in one realm shares one pair of maps.

It is read defensively: another copy may be a version whose registry has a different shape, and one
that does not carry both `WeakMap`s is replaced rather than trusted.

## Consequences

The scope of the guard is the realm, not the module. A worker or a second document has its own
registry, which is correct — a handle cannot cross a realm either.

The maps are now reachable by anything in the realm that knows the well-known symbol, including code
that is not Modyra. They hold handles and runtimes, both of which that code would already have to
hold a handle to reach; what it gains is the ability to *mislead* the guard by writing a wrong owner,
turning a diagnostic off. That is a diagnostic, not an enforcement point, so the loss is a warning
rather than a boundary.

Two copies of *different versions* now share one structure, so its shape is a compatibility surface
between versions in a way a module-local map was not. The defensive read is what keeps a shape change
from being a crash; it costs the sharing, silently, for the copy that finds a shape it does not know.

## Alternatives rejected

**Leave it and document that the guard needs deduplication.** The tree where it fails is the tree
nobody controls, and the failure is the guard going quiet rather than saying anything.

**Have `observerFor` treat an unknown owner as a mismatch.** Reports every hand-built handle and
every handle from a version predating the registry — the two cases the `undefined` answer exists to
tolerate.

**Ship the registry as its own package both copies depend on.** Moves the deduplication problem
rather than solving it: two copies of that package have the same defect.

## Verification

- `battle-tests/adversarial/reactivity/duplicated-core.battle.test.mjs` — builds the duplicated tree
  by packing and installing, and requires the second copy to see the owner and produce the
  diagnostic, with two controls: that the tree really holds two module instances, and that the copy
  which registered the handle can still see it.

## Security and privacy

A well-known global symbol is reachable by any code in the realm. The maps hold field handles and
reactivity runtimes; nothing in them is a value the user typed, and reading a handle out of them
gives no access the holder of the handle did not already have. What an attacker in the realm gains is
the ability to suppress a development-mode warning, which is the same thing they would gain by
loading a build with `MDY_DEV` false. No credential, no user data, no enforcement point.
