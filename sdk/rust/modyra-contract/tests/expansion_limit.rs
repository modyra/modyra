//! What a document's rows may cost a reader beyond what the document declares (ADR 0231).
//!
//! A collection's declared rows are lent to every enclosing row that writes none, so a reader that
//! expands rows visits the product of the row counts. This reader computes that count instead of
//! walking it, and refuses the whole schema past the bound, at `/schema`, in both modes.

use modyra_contract::{parse_v2, ValidationMode};
use serde_json::{json, Value};
use std::time::Instant;

fn text() -> Value {
    json!({ "node": "field", "field": { "kind": "text", "label": "Cell" } })
}

/// A collection of `count` rows that write nothing, each row a group of `children`.
fn rows_of(count: usize, children: Value) -> Value {
    json!({
        "node": "array",
        "initialValue": vec![json!({}); count],
        "item": { "node": "group", "children": children },
    })
}

/// Nested collections of `rows` rows each, `depth` deep, ending in `leaf`.
fn nested(depth: usize, rows: usize, leaf: Value) -> String {
    let mut node = leaf;
    for level in 0..depth {
        node = rows_of(rows, json!({ format!("c{level}"): node }));
    }
    json!({ "version": 5, "schema": { "node": "group", "children": { "root": node } } }).to_string()
}

fn findings(json: &str, mode: ValidationMode) -> (bool, bool, Vec<(String, String)>) {
    let result = parse_v2(json, mode).expect("a document this reader can take");
    let schema_kept = result
        .form
        .as_ref()
        .is_some_and(|form| form.schema.is_some());
    let codes = result
        .diagnostics
        .iter()
        .map(|d| (d.code.to_string(), d.path.to_string()))
        .collect();
    (result.valid, schema_kept, codes)
}

fn limit() -> Vec<(String, String)> {
    vec![(
        "MDY_DYNAMIC_SCHEMA_LIMIT".to_string(),
        "/schema".to_string(),
    )]
}

#[test]
fn rows_that_multiply_past_the_bound_refuse_the_schema_whole_in_both_modes() {
    for mode in [ValidationMode::Strict, ValidationMode::Lenient] {
        let started = Instant::now();
        let (valid, schema_kept, codes) = findings(&nested(6, 100, text()), mode);
        assert!(
            started.elapsed().as_secs() < 5,
            "the count does not walk the product"
        );
        assert!(!valid);
        assert!(
            !schema_kept,
            "a refused schema is not handed on, even leniently"
        );
        assert_eq!(codes, limit());
    }
}

#[test]
fn a_product_past_what_the_count_can_hold_saturates() {
    // 100^40 overflows every integer the count could use.
    let (valid, _, codes) = findings(&nested(40, 100, text()), ValidationMode::Strict);
    assert!(!valid);
    assert_eq!(codes, limit());
}

#[test]
fn a_branch_that_ends_in_no_field_is_bounded_too() {
    let leaf = json!({ "node": "group", "children": {} });
    let (_, _, codes) = findings(&nested(6, 100, leaf), ValidationMode::Lenient);
    assert_eq!(codes, limit());
}

#[test]
fn written_rows_count_as_lent_ones_do() {
    // A hundred rows each writing a hundred rows of its own: paid for in bytes, and still refused.
    let inner = vec![json!({}); 100];
    let document = json!({ "version": 5, "schema": { "node": "group", "children": { "lines": {
        "node": "array",
        "initialValue": vec![json!({ "notes": inner }); 100],
        "item": { "node": "group", "children": { "notes": rows_of(0, json!({})) } },
    } } } });
    let (_, _, codes) = findings(&document.to_string(), ValidationMode::Strict);
    assert_eq!(codes, limit());
}

#[test]
fn a_collection_writes_at_most_a_hundred_rows() {
    let cell = json!({ "node": "field", "field": { "kind": "text", "label": "Cell" } });
    let array = |count: usize| json!({ "node": "array", "initialValue": vec![json!(""); count], "item": cell });
    let record = |count: usize| {
        let rows: serde_json::Map<String, Value> = (0..count)
            .map(|index| (format!("r{index}"), json!("")))
            .collect();
        json!({ "node": "record", "initialValue": rows, "item": cell })
    };
    for collection in [&array as &dyn Fn(usize) -> Value, &record] {
        let document = |count| {
            json!({ "version": 5, "schema": { "node": "group", "children": { "rows": collection(count) } } })
                .to_string()
        };
        let (valid, _, codes) = findings(&document(100), ValidationMode::Strict);
        assert!(valid, "{codes:?}");
        let (valid, _, codes) = findings(&document(101), ValidationMode::Strict);
        assert!(!valid);
        assert_eq!(
            codes,
            vec![(
                "MDY_DYNAMIC_SCHEMA_LIMIT".to_string(),
                "/schema/children/rows/initialValue".to_string(),
            )]
        );
    }
}

#[test]
fn a_table_of_a_hundred_rows_and_twenty_cells_is_accepted() {
    let cells: serde_json::Map<String, Value> =
        (0..20).map(|index| (format!("c{index}"), text())).collect();
    let document = json!({ "version": 5, "schema": { "node": "group", "children": {
        "lines": rows_of(100, Value::Object(cells)),
    } } });
    let (valid, schema_kept, codes) = findings(&document.to_string(), ValidationMode::Strict);
    assert!(valid, "{codes:?}");
    assert!(schema_kept);
}
