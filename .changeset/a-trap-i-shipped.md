---
"@modyra/plain": patch
"@modyra/lit": patch
"@modyra/angular": patch
---

Tab leaves a closed widget again, and stops being cancelled inside an open one

A regression from the previous release, found on the browser tier: forty tab stops inside a **closed**
colour field and the next field never reached. A trap in an open panel is at least explicable — there
is something on screen. In a closed control nothing says why the key stopped working.

Moving the dismissals onto the catalogue asked the wrong question of it. `Escape` and `Tab` are both
declared `cancel`, and they are not the same act: `Escape` takes the reading position back to the
opener, `Tab` is already carrying it to the next field and must be left alone. Asked only "does this
key mean cancel", six handlers answered `Tab` with `Escape`'s rule. One of them focused the opener —
that is the trap that was found. The other five called `preventDefault` on `Tab`, which strands
somebody in a panel being torn down and which **no check outside a browser can see**, because there
is no native Tab to prevent.

The contract already told them apart: `restoresFocus`. Every one reads the binding now, and the phase
is asked rather than assumed — a shut control asked about the open phase answers with the bindings of
a panel that is not there.

Two checks, because the two halves are not visible to the same instrument. One walks a closed
widget's tab stops and asserts nothing moves the reading position. The other presses `Tab` at every
stop, open and closed, and reads `defaultPrevented` off the event — which works exactly where
watching focus cannot. `Escape` is its control: a renderer that cancelled nothing at all would pass
the first and fail the second.

The one kind that keeps `Tab` inside its open panel is read from the catalogue, not exempted by name:
its overlay holds an actions bar, so a confirm button inside has to stay reachable, and it declares no
`Tab` dismissal — which is the contract saying exactly that.
