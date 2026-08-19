# ADR 0099: A password is said to be one

Status: Accepted

## Context

`password` is a kind in every table that enumerates kinds, and a document may name it: the Dynamic
Form Contract carries `kind` as data from outside the application. The one thing that makes it a
password rather than a short piece of text is that the control does not show what is typed into it.
There is no other difference — no separate value shape, no rule only it carries.

That difference was said nowhere a renderer could read it. `@modyra/widgets` is the framework-agnostic
UI contract each adapter implements, and normalising the kind's own name out of it left the published
description of `password` identical to the description of `text`. Every adapter therefore kept a
private map from kind to input type — `@modyra/plain` had one in its text renderer — and the failure
mode of an adapter that does not is a password rendered in clear text.

## Decision

The contract says it, twice, in the two places a consumer reads:

- `MDY_WIDGET_CONTRACTS[kind].controlType` names the native control a kind is drawn with, where a
  platform has one — `"text"`, `"email"`, `"password"` — and is absent for a kind no single control
  covers, like a select drawn as a trigger and a listbox.
- `MDY_WIDGET_CONTRACTS.password.concealed` and `MDY_VALUE_CONTRACTS.password.concealed` are `true`:
  the value is not displayed wherever it is shown.

`concealed` on the value contract is a property of the **kind**, true before any form exists. It is
distinct from a field's own `sensitive` (ADR 0089), which an author declares about one field's value
and which governs drafts, copies and the devtools panel.

An adapter reads `controlType` instead of keeping its own map. `@modyra/plain` does; the number and
slider elements stay the renderer's own choice, because they are how *that* renderer draws a numeric
kind rather than something the contract decides.

## Consequences

The contract now carries a presentational fact. That is a boundary worth naming: `controlType` is a
platform's control name, and a platform without one — a terminal renderer, a native toolkit — reads
`concealed` instead, which is the meaning rather than the spelling.

Two members are optional, so nothing an adapter does today breaks, and an adapter that keeps its own
map keeps working. What it loses is the excuse: the statement exists, so not implementing it is a
choice.

A kind that gains a control type later has one place to declare it, and any adapter reading the
contract picks it up without being touched.

## Alternatives rejected

**A `secret` flag on the field descriptor only.** That is `sensitive`, and it already exists for a
different question: whether *this* field's value is a secret. A password is concealed whether or not
anyone declared the field sensitive.

**Leave it to adapters and document the expectation in prose.** Prose is what every adapter already
had, and five of them kept five private maps.

**Name the HTML input type in the value contract.** The value contract is about values, and an
`<input type>` is a browser's word. The kind's control type belongs with the rest of the widget
anatomy; the value contract carries the meaning.

## Verification

`battle-tests/adversarial/security/a-kind-that-differs-only-by-name.battle.test.mjs` compares the
published description of `password` with that of `text` across every published per-kind table. Two of
them now differ. `npm run test:type-surface` holds the shape of both additions, and
`packages/plain/test` covers the renderer that reads `controlType`.

## Security and privacy

This is the security decision: a password concealed by one adapter and shown by another is the
failure the contract exists to prevent, and it needs no bug to reach a user. Publishing the fact
moves it from private knowledge to an implementable statement. Nothing about how the value is stored,
drafted or submitted changes — `sensitive` still governs that — and a concealed control is a
presentation rule, not a guarantee about the value in memory.
