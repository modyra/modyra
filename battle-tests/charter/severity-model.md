# Severity model

Severity is a property of the claim that broke, not of the test that found it. The machine-readable
form is [`../models/severity.mjs`](../models/severity.mjs); every report carries one.

## S0 — integrity or security

The submitted payload differs from the declared data semantics; data is silently lost; a prototype is
polluted; a stale async result corrupts another row; a renderer invents submitted data.

**Action:** release blocker.

## S1 — semantic correctness

Validity depends on which cells are mounted; record identity follows sorting or rendering; removing a
row leaves validators or fields alive; a draft restores the wrong structure.

**Action:** merge blocker for the affected package.

## S2 — cross-surface divergence

Two renderers produce different form semantics; typed and dynamic paths disagree; a packed package
behaves unlike the workspace one.

**Action:** merge blocker unless explicitly quarantined with an owner and an expiry.

## S3 — ergonomics and diagnostics

A misleading warning; a late failure where an early diagnostic was possible; a valid operation that
works only in an undocumented order.

**Action:** tracked defect; may merge with explicit justification.

## Judging a report

A report's severity is the worst severity among the claims it cites, unless the battle states one
explicitly. Raising it in review is normal — the claim registry is where that decision is recorded,
so the next break of the same promise inherits it.
