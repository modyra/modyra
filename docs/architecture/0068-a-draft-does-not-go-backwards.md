# ADR 0068: A draft does not go backwards

Status: Accepted

## Context

A draft key identifies the **form**, not the window — that is what makes a draft survive a reload. So
two tabs of one form share a key by design, and that is the ordinary arrangement rather than an
abuse.

The engine defined the envelope, stamps `savedAt` on every save, and is the only thing that reads
one. It never compared it. Measured, with a second view saving in between:

```
tab A saves         { savedAt: …957878, value: { note: "A is writing something long" } }
another view saves  { savedAt: …018229, value: { note: "B finished first" } }   ← newer
tab A saves again   { savedAt: …958629, value: { note: "A is writing something longer" } }

did A read before writing?   no
```

B's work is gone, which a last-write-wins rule could defend. What it cannot defend is the third line:
**the stamp in storage went backwards by 59 seconds.** The stored draft now claims to be older than
the one it replaced, so the single field a later reader could use to notice tells them the opposite.

A field written and never read promises a freshness nothing checks. The security guide already states
the surrounding threat model in those words: a draft lives where any script on the origin can write
it.

## Decision

**A save reads what is there before replacing it.** One read per write, on a store the form already
holds.

**The typing in front of the person wins.** A draft is a convenience, and discarding what someone is
writing to preserve what they are not is the worse answer. Last-write-wins stays the rule.

**It is said out loud.** Replacing a draft that something else saved more recently reports on the
development channel, naming the key and what to do about it — give each view its own key where they
must not overwrite each other.

**The stamp never goes backwards.** Where the stored stamp is ahead of now, the replacement carries
the stored one. The record of when the stored draft was written is the only thing a later reader has,
and it is now at worst imprecise rather than wrong in the direction that hides a loss.

**Nothing readable is not a conflict.** An absent key, a storage that raises, a payload another
writer owns: none of them is another view of this form, and none of them reports.

## Consequences

Every draft write now costs a read. Drafts are debounced, and the store is the one the form was given
— `localStorage` in practice — so the cost is a synchronous lookup per settled burst of typing rather
than per keystroke. A consumer on a storage where a read is expensive pays for it on that path.

The warning is `MDY_DEV`-only and stripped in production, so a shipped application learns nothing
about the collision. That is deliberate: the engine has no channel for something that is neither a
security violation nor a field's verdict, and inventing one for a case whose answer is "give each
view its own key" would be a public surface built for a diagnostic.

A stamp taken from storage can be ahead of this machine's clock — two devices, or one clock corrected
backwards — so `savedAt` is not a reliable ordering across writers. It was never one; it is now
monotonic per key, which is a smaller promise honestly kept.

## Alternatives rejected

**Refuse the write and keep the newer draft.** It makes the person in front of the screen lose what
they are typing to preserve what someone else typed, which inverts whose work the feature exists to
protect.

**Merge the two drafts.** There is no merge the engine can perform on a form value it did not author,
and a wrong merge is worse than either draft.

**Document that a key must be unique per view.** It is a real answer and it is in the warning, but on
its own it leaves the default arrangement silently lossy and the stored record false.

**Report through `onViolation`.** That channel is for security findings — an unsafe path, a sanitized
value — and a second tab is not an attack.

## Verification

- `battle-tests/adversarial/persistence/a-draft-that-went-backwards.battle.test.mjs` — the three
  saves, asserting that the stamp cannot go backwards and that the newer draft is either kept or read
  first.
- `packages/core/test/` — the draft suite, where a form that writes and reads its own draft must not
  see a conflict with itself.

## Security and privacy

The read is of a key the form already owns, and nothing new is stored. It closes a way for a stored
record to misstate when it was written, which mattered because a draft is writable by any script on
the origin: a value planted with a future stamp is now carried forward rather than silently
overwritten with an earlier time, so the record of a tampered write survives instead of being erased
by the next ordinary save.
