---
"@modyra/widgets": minor
---

The kit says which member a mount is missing

A conformance config's `mount` returns an `MdyStateFixture`. The reference config delegates to a
fixture it already has, so somebody copying it sees `export const mount = fixture.mount` and never
learns what one returns — and the first missing member arrived as `fixture.drive is not a function`,
thrown inside a kit file the author has never opened.

The kit now checks the fixture before driving anything and names what is missing and what it is for.
The tool reports it as a config problem, in its own voice, and exits 2. `missingFixtureMembers` is
exported from `@modyra/widgets/testing` for a suite that wants the same answer.

The reference config writes the members out instead of assigning the fixture across, so copying it
shows them.
