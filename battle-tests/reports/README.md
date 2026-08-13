# Reports

Failure artefacts land in `reports/failures/<failure-id>.json` and are not committed — a report is
evidence of one run on one machine, and a confirmed break is preserved by promoting it to
`../regressions/` instead.

Each report carries the schema as data, the operations in order, both states at the divergence, the
seed, the environment and the command that replays it:

```sh
npm run battle:replay -- battle-tests/reports/failures/<failure-id>.json
```

Fixtures are synthetic, so nothing written here is application data. Keep it that way: a battle that
attacks with real data would produce reports nobody can attach to an issue.
