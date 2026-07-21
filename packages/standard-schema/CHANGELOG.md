# @modyra/standard-schema

## 0.3.0

### Minor Changes

- e66be95: New package: `@modyra/standard-schema` — one adapter for every Standard Schema v1 library (Zod ≥3.24, Valibot, ArkType, …), zero peer dependencies. You declare the field tree with `field()`/`group()`/`array()`, the schema validates the whole form value with issues attributed to their dotted field paths (`address.city`, `items.0.name`), and schema defaults seed field initials when `validate({})` succeeds. Async schemas are rejected with a clear error (form-level validation is synchronous). Ships with `MdyStandardSchemaTree` for opt-in compile-time agreement between schema and declared fields, and a test suite that asserts identical results across Zod and Valibot.

### Patch Changes

- Updated dependencies [c7dadfb]
- Updated dependencies [7554cc8]
- Updated dependencies [fc22197]
  - @modyra/core@0.3.0
