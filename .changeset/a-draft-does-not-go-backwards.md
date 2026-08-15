---
"@modyra/core": patch
---

A save reads the draft it is replacing, and its stamp never goes backwards

A draft key names the **form**, not the window — that is what makes a draft survive a reload — so two
tabs of one form share it by design. A tab that had been open a while replaced a draft another view
had saved a minute later, and stamped the replacement with the earlier time:

```
tab A saves         savedAt …957878
another view saves  savedAt …018229   ← newer
tab A saves again   savedAt …958629   ← the record went backwards 59 seconds
```

Losing the other draft is a defensible last-write-wins. The stamp is not: it is the only field a
later reader has, and it said the opposite of what happened.

A save now reads what is there first. The typing in front of the person still wins — discarding what
someone is writing to keep what they are not is the worse answer — but replacing a more recently
saved draft is reported on the development channel, and the stamp is never earlier than the one it
replaced.

Each write costs one read of a key the form already owns. Recorded as
[ADR 0068](../docs/architecture/0068-a-draft-does-not-go-backwards.md).
