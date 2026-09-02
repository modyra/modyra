# ADR 0192: A debt that cannot be paid where it is incurred

Status: Accepted

## Context

Visual baselines are recorded per platform. `-darwin.png` is produced where the work happens;
`-linux.png` can only be produced where the suite runs, by a workflow, against a pushed head.

So a change to a page the suite photographs splits in two. The author re-records the half they can
take, pushes, and CI goes red an hour later at a reader holding a pixel diff and no account of why.
That happened three times in one day — the range frames, the Lit demo, the plain lab — each time
discovered rather than declared, and each time by someone who was not the author.

Both authors then wrote the debt into the commit body, which is the right thing and is the problem:
it depends on remembering, at the one moment the person is thinking about something else. Nobody is
prompted where they could act.

The measurement is available in git's own terms. For each renderer the suite photographs, is the last
commit touching its pages an ancestor of the last commit touching its linux baselines? If not, the
images are behind the page.

## Decision

**A commit-time check announces the debt and names the run that pays it. It does not refuse the
commit.**

Refusing is the shape this obviously wants and it is a deadlock: the linux images are recorded from a
pushed head, so a gate barring the commit asks for images that cannot exist until the commit does.
The way around a deadlock is `--no-verify`, and a check that trains its own bypass has spent the
credibility it would need for everything else it might say. Announcing at the moment the author can
still act is the entire value; refusing adds nothing to it.

`--check` exists for a caller that wants the exit code — a reviewer asking whether a head owes
images. It is deliberately **not** wired into `test:contracts` or the commit path, where the same
deadlock would return as a red on a state that is allowed to be true.

**Ancestry, not timestamps.** A rebase rewrites dates, and two commits made a second apart on two
machines say nothing about which came first. `git merge-base --is-ancestor` asks the question that is
actually being asked: was this recorded after that change.

**Existence before order.** `git log -- <path>` reports the commit that *deleted* a file as readily as
the one that wrote it, so a renderer whose linux baselines were all removed reads as current — the
deletion is the most recent commit touching them, and it is a descendant of everything. The tracked
files are counted at HEAD first; only something that exists can be behind.

## Consequences

The check reads which renderers to ask about from the specs on disk rather than from a list, so a
renderer that gains a visual suite is covered the day it lands and one that loses it stops being
asked.

It reports a renderer with pages and no linux baselines at all, and distinguishes *never recorded*
from *recorded and then removed* — two different mistakes with two different repairs.

Because it announces rather than refuses, **it can be ignored.** A hurried author sees the paragraph
and pushes anyway, and CI is red exactly as before — with the difference that the debt was stated
before the push rather than diagnosed after it. That is the accepted limit, and it is the price of not
being bypassable.

The commit-time half is a hook, and git does not version `.git/hooks`. So the hook bodies are kept in
`scripts/hooks/` and copied in by `scripts/install-hooks.sh`, which **a person runs**: a hook that
installed itself from `postinstall` would be a hook nobody chose, and one of the two here rewrites
commit messages. That also closes a gap that had nothing to do with baselines — the `commit-msg` hook
enforcing this repository's attribution rule existed on one machine and in no checkout, so the rule
was one `rm -rf node_modules` away from being unenforced and nobody would have noticed.

An uninstalled hook is silent, which is the failure mode to know about: this announces nothing in a
checkout where the installer was never run. `npm run audit:visual-debt` is the form that always
works, and the reasoning and the measurement live in `scripts/audit-visual-debt.mjs` — the hook is
three lines calling it.

It cannot see a page moved by something outside `examples/<renderer>/`: a theme file, a widget's own
CSS, a shared stylesheet. Those move the images too and this will call the renderer current. It
answers for the pages, which is where the three incidents came from, and not for everything the
pages draw.

## Alternatives rejected

**Refuse the commit.** Deadlocks against the recording order, and teaches `--no-verify`.

**Compare file modification times.** A git checkout does not preserve them, so the check would be
right on the machine that made the change and wrong on every other.

**Record linux baselines locally in a container.** Tried and dead for a different reason already in
the record: the runner image is x64 and the local engine is arm64, so the images produced would be of
a different render than the one CI compares.

**Keep writing the debt in the commit body.** It is what both authors already did correctly, three
times, and it is the practice this exists to support rather than replace — the check does not write
the body, it reminds someone to.

## Verification

`node scripts/audit-visual-debt.mjs` — `NO VISUAL DEBT`, and the row per renderer with its image count
and both commits, so a reader can check the verdict rather than take it.

Falsified in three directions in a throwaway worktree, because a gate that has only been seen to pass
has not been seen:

- a page moved after its images → `plain … BEHIND`, `VISUAL DEBT — 1`, exit 1;
- images recorded after that change → `NO VISUAL DEBT`, exit 0, so the debt is payable and the gate
  closes;
- every linux baseline deleted → **passed as `current`**. That is the hole described above, found by
  this direction and only by it. After the repair the same tree reports `lit: its pages are
  photographed and it carries no linux baseline at all (they were recorded and then removed)`.

## Security and privacy

None. The check reads git metadata and file names in the repository; it publishes nothing, and the
run it names in its message is dispatched by a person.
