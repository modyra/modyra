---
"@modyra/widgets": minor
"@modyra/plain": patch
---

The contract says which message names a part no relation points at

Most parts are named by being pointed at — a caption's `for`, an opener's `aria-controls` — and the
relations declare it. Five are not, and they are not machinery: a person types in a panel's search
box, in the second date of a range, in each half of a time. Nothing said what those are called, so
each renderer chose.

They chose differently. One built `"<caption> — end"` out of an English word and the caption; another
read `daterangeEndLabel` from the message table. **The words already existed in the table in five
languages.** What was missing was the line saying which word belongs to which part — so a page in
Italian announced a box as "end".

`MDY_PART_NAMES` is that line. It is a binding rather than a vocabulary: the translation of a
control's name stops being a decision a renderer takes alone.

Held to both tables at once — a binding to a message that does not exist and a binding to a part the
contract does not declare fail differently here and identically on a page — and to the relations: a
part named by a relation **and** by a message is refused. That refusal found one immediately: a
range's caption already points `for` at the first of its two boxes, so only the second was unclaimed,
and binding both would have been two answers to one question.

The framework-free renderer reads the binding now. Its first box keeps the caption; the phrase built
around it is gone.

Also asserted: every bound message exists in every locale the package ships, because a name that falls
back to English on a translated page is the defect this exists to stop being possible one renderer at
a time.
