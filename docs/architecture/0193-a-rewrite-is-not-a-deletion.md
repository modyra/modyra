# ADR 0193: A rewrite is not a deletion

Status: Accepted

## Context

This repository's commit messages carry no generated attribution: no session trailers, no machine
co-author lines, no "generated with" footers. The history was rewritten once to remove them, and the
rule has been enforced since by a `commit-msg` hook.

The rule had no record. It lived in a hook under `.git/hooks`, which git does not version, so it
existed on one machine and in no checkout — one `rm -rf` away from being unenforced, with nothing to
notice. Versioning the hook fixed that and introduced the opposite defect in the same act: the hook's
filter **enumerated by name** the things it removed, so the file that existed to keep those strings
out of the repository was itself a list of them, tracked and pushed.

That is the shape worth keeping: a censor that names what it censors has published it. The same
applies to an ignore file — `.gitignore` is versioned, so a name written there to be ignored is a name
written into the repository. `9174b761` had already removed such an entry once; it came back in a
working tree months later as a convenience, which is how a decision gets undone by someone who never
saw it.

## Decision

**The filter matches by shape, never by name.** Any session trailer (`<Word>-Session:`), any
`Co-Authored-By:` line, any line containing "generated with". No tool, product or vendor is named in
the pattern, in the file's comments, or anywhere else in the tracked tree.

The form is deliberately broader than the trailers actually observed. A genuine human co-author line
would be stripped too; this repository has one author, and the breadth is chosen knowing that. A
narrower filter would have to describe its targets, which is the defect.

**Names that must not appear in the tracked tree are excluded through `.git/info/exclude`, not
`.gitignore`.** Same effect on what git tracks; `info/exclude` is not itself versioned, so the name
is not published by the act of hiding it.

**A history rewrite removes an object from reachable history. It does not delete it from the
remote.** After a force-push the old commit remains on the server as an unreachable object, fetchable
by SHA until the host's garbage collection runs — on a schedule nobody here controls. So the claim
this project makes is *"out of reachable history"*, never *"deleted from the server"*.

## Consequences

The attribution rule now survives a fresh checkout: the hook bodies live in `scripts/hooks/` and are
installed by `scripts/install-hooks.sh`, run by a person.

The honest claim is weaker than the intuitive one, and it is the one to make when asked. Anyone
holding the old SHA can still fetch that object. Nothing further can be done about it from here —
which is precisely why the difference is recorded rather than left to be assumed away.

The broad filter will silently remove a co-author line that a second contributor adds. If this
repository ever gains one, that is the line to revisit, and this record is where the reason is.

An uninstalled hook is silent. A checkout where the installer was never run enforces nothing, and
nothing announces it.

## Alternatives rejected

**Keep the enumerated filter and accept the strings.** It is the version that shipped, and it is
self-defeating: the artefact protecting the property violated it.

**Leave the hook unversioned to avoid the problem.** That is the state this came from — a rule that
existed on one machine, invisible to every other checkout, unnoticeable when it stopped running.

**Claim the traces are gone after the force-push.** Convenient, and false. The distinction between
unreachable and deleted is the whole content of the third decision above.

**Put the excluded names in `.gitignore`.** Already tried and already undone once, in `9174b761`.
Reintroducing them undoes a decision rather than adding a convenience — and publishes the names.

## Verification

`git grep -icE "<vendor terms>" origin/main -- .` over the whole tracked tree returns zero, and
`git log -S"<trailer literal>" --all` is empty. Both were run after the force-push, against the
fetched remote rather than the local tree, because the question is about what the remote publishes.

The hook was exercised rather than read: a message carrying a session trailer, a co-author line, a
"generated with" line and a real body comes back with the body alone.

`git check-ignore` confirms the excluded names still resolve to `.git/info/exclude` after being
removed from the versioned ignore file, so the hiding survived the move that stopped publishing them.

## Security and privacy

This is a privacy decision, and its limit is the finding. Removing an identifier from reachable
history does not remove it from a remote's storage; a host keeps unreachable objects until it
collects them. Any future request to remove something from this repository's history must be answered
with that distinction, and — for anything genuinely sensitive rather than merely unwanted, such as a
credential — with rotation, because a rewrite alone does not make the old value unreachable to
someone who already has the SHA.
