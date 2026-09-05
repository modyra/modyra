# ADR 0207: A part that shows something is told what, in a closed vocabulary

Status: Accepted

## Context

The catalogue declares the parts a widget is made of — their containment, order, classes, roles and
ARIA. It said nothing about what a part *displays*.

For most parts that is right: a wrapper displays nothing, and a control displays the value the
platform draws inside it. But a few parts exist only to show something. A slider's `value` is a
number beside the track. A file field's `content` is the prompt a person reads before choosing, and
the `clear` inside it is a mark on a button. A colour field's `preview` is a swatch whose entire job
is to be a colour.

Every renderer invented those. Four adapters, four answers: `"Select file"` written into a lit
template, the same words written again in a plain renderer, a hex fallback of `#4361ee` chosen
independently in two places. The fourth renderer delegated those parts to a walk over the declared
structure — which knew the shape and nothing else — and drew them **empty**. A field held a file and
the page said nothing; a slider held 50 and showed a caption; a swatch was transparent.

That is the phase's shape exactly: three implementations agreeing looks like conformance until a
fourth implements the contract from the catalogue alone, and finds the catalogue does not answer.

## Decision

A projected part may carry **content**: what it shows, in a vocabulary with exactly two members.

```ts
interface MdyPartContent {
  readonly text?: string;
  readonly color?: string;
}
```

A renderer translates mechanically — text becomes the part's text, a colour becomes what DESIGN.md
says a colour is, which today is the swatch's background. It does not decide *what*.

**The vocabulary is closed.** A free channel — a string a renderer interprets, or a style bag — would
be a surface with no letter of intent: anything could go in it and no check could say what was meant.
Closed, a third kind of content is a change to this type, classified by the type-surface audit and
the contract differ, rather than something a renderer invents.

**`color`, not `swatch`.** `swatch` is already the name of a part in the colours catalogue; one word
would otherwise mean an element in one place and a value in another.

The empty-state colour lives with the projection too. A value a person sees, chosen independently by
two renderers, is two empty states for one contract — a difference visible only to somebody comparing
screenshots.

## Consequences

The projections grow: `text-field-a11y` publishes a `value` part for the slider kind and for no
other, and the file and colour controllers publish content for three parts. A kind that gains a
displaying part must project its content, and a renderer that draws one without asking is back to
inventing.

The words are now in the contract's message table rather than in four templates, which makes them
translatable in one place — and makes a renderer that hard-codes them a divergence a reader can see.

`style` on a part remains what it was: custom properties a theme reads for layout, a count, a fill
percentage. It is not a content channel and this decision does not turn it into one.

Adoption is per renderer. Vue reads the content now; lit, plain and angular still write these few
strings themselves, and each of those is a small mechanical change rather than a decision. Until they
adopt, the contract states the answer and three renderers repeat it — better than four inventing it,
and not yet finished.

## Alternatives rejected

**Let each renderer decide.** That is the status quo, and it produced four answers to one question
and one renderer with no answer at all. The content of a part is not a rendering choice: it is what
the widget holds.

**A free `style` or `data` channel.** It would have carried the colour today and anything at all
tomorrow. A surface a renderer can put anything into is a surface no check can defend, and the point
of this door is that a new kind of content is a contract change somebody classifies.

**Put the content in the structure rather than the projection.** The structure is static — it says a
slider has a readout — and the content is a value that changes with the field. They are different
questions and the projection is where changing answers live.

## Verification

`packages/vue/test/a-part-that-shows-nothing.test.mjs` asserts the three kinds show what they hold,
with absent and empty asserted apart: an earlier repair supplied a prompt *instead of* the structure
beneath it, deleting a button, and a check reading a missing element's text as `""` called that a
pass.

What it does not guard: a renderer that ignores the content and writes its own. The kit compares
renderers against the catalogue, not against each other's strings, and a lit template with `"Select
file"` in it still passes. That gap closes when the remaining three adopt.

## Security and privacy

None. The content is the value the field already holds, projected rather than re-derived; it adds no
data flow and no new trust boundary.
