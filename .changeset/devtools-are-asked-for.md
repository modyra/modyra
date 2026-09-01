---
"@modyra/core": minor
---

The inspector mounts because somebody asked

`mountMdyDevtools` appeared in four starters, and a line every starter carries reads as part of the
minimum a form needs. It is not — it is a development tool, and whether to mount one is a question
the caller may already have an answer to.

`mountMdyDevtoolsIfWanted(form, host, asked?)` mounts when the build says development and skips
otherwise, and takes `true` or `false` when a consumer wants to decide. Both directions matter:
`false` keeps it out of a development build and `true` puts it in a production one, because a
consumer asking for either has a reason this library does not know.

The heuristic is the option's **default**, never the mechanism. A heuristic that cannot be
overridden is a guess a consumer cannot correct; an option with no default is the line that ends up
in every starter. `devtoolsWanted` is exported so a consumer can ask the same question without
mounting anything.

A missing host is not an error, and a disposer comes back either way — a conditional disposer is the
shape that leaks the one time the condition changes.
