# Modyra Rust SDK

The first Rust deliverable is `modyra-contract`, a network-independent crate for reading, writing, and validating the Modyra Dynamic Form Contract v2.

```rust
use modyra_contract::{parse_v2, ValidationMode};

let result = parse_v2(json, ValidationMode::Strict)?;
if !result.valid {
    for diagnostic in result.diagnostics {
        eprintln!("{} at {}: {}", diagnostic.code, diagnostic.path, diagnostic.message);
    }
}
```

`Strict` returns no form when any diagnostic exists. `Lenient` keeps the parsed document for AI previews while returning the same diagnostics. The crate uses the fixtures under `spec/fixtures/dynamic-form/`, shared with the TypeScript implementation.

Run:

```bash
cargo test --manifest-path sdk/rust/Cargo.toml
```

## POST submission example

The `examples/post-form` binary sends a sample Contract v2 submission and
prints the request, HTTP status, raw body, parsed response, and normalized
validation errors.

Start your API, then run:

```bash
MODYRA_ENDPOINT="http://127.0.0.1:3000/v1/forms/business-signup/submissions" \
  cargo run --manifest-path sdk/rust/Cargo.toml -p modyra-post-form-example
```

For bearer-token authentication, set `MODYRA_API_TOKEN` in the environment.
The example also sends an `Idempotency-Key` header. Never put API tokens in
source code or commit them to the repository.

Expected success response:

```json
{
  "ok": true,
  "submission_id": "sub_001"
}
```

Expected validation response (`422 Unprocessable Entity`):

```json
{
  "ok": false,
  "errors": [
    {
      "path": "vatNumber",
      "kind": "validation",
      "message": "VAT number is required"
    }
  ]
}
```

## Rust API to Angular dynamic checkout

`examples/axum-form-server` demonstrates the intended end-to-end direction:
a Rust business object is converted to a Modyra Contract v2 document, exposed
as JSON, fetched by the existing Angular demo, validated in strict mode, and
rendered by `<mdy-dynamic-form>`.

Start Rust first:

```bash
cargo run --manifest-path sdk/rust/Cargo.toml \
  -p modyra-axum-form-server-example
```

Inspect the generated contract:

```bash
curl -s http://127.0.0.1:3000/v1/forms/checkout | python3 -m json.tool
```

Then start Angular from the repository root:

```bash
npm run demo:angular
```

Open the Angular demo and find **Dynamic checkout - served by Rust**. The
same section posts completed values back to
`POST /v1/forms/checkout/submissions` and displays the Rust response.

The example emits a recursive Contract v2 schema: `shipping` is a group and
`items` is an array of item groups. The strict TypeScript parser validates the
tree and expands it to the dotted/indexed paths consumed by the current Angular
dynamic renderer. Initial rows are rendered; interactive add/remove controls
remain a future renderer enhancement.
