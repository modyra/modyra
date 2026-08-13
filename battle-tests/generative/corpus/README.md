# Corpus

Generated schemas, contracts and operation sequences a campaign has kept — the inputs worth rerunning
on every seed because they once found something, or because they cover a shape the generators reach
rarely.

A corpus entry is data: a schema spec and an operation log, replayable through the same interpreter
every battle uses. Entries that led to a break live in `../../regressions/` instead; this directory
holds the ones that are interesting without being red.
