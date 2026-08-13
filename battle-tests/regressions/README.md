# Regressions

One file per confirmed break, minimised to the smallest sequence that still shows it.

Each file states the claim id it defends, the seed and report it came from, and what the fix changed.
A regression is red before its fix and green after; it is never relaxed to match behaviour that was
never decided. If the public contract changes, the claim registry changes with it and the record of
the compatibility decision goes to `docs/architecture/`.

The generative campaign that found a break stays active after the regression is added: the fixture
pins one sequence, the campaign keeps searching for the next.
