use modyra_contract::{parse_v2, ValidationMode};

#[test]
fn accepts_shared_valid_fixture() {
    let json = include_str!("../../../../spec/fixtures/dynamic-form/v2/valid.json");
    let result = parse_v2(json, ValidationMode::Strict).unwrap();
    assert!(result.valid, "{:?}", result.diagnostics);
    assert!(result.form.is_some());
}

#[test]
fn rejects_unknown_references_in_strict_mode() {
    let json = include_str!("../../../../spec/fixtures/dynamic-form/v2/invalid-reference.json");
    let result = parse_v2(json, ValidationMode::Strict).unwrap();
    assert!(!result.valid);
    assert!(result.form.is_none());
    assert!(result.diagnostics.iter().any(|d| d.code == "MDY_DYNAMIC_UNKNOWN_FIELD_REFERENCE"));
}

#[test]
fn serializes_recursive_schema_without_null_optionals() {
    use modyra_contract::{DynamicFormV2, DynamicNode, Field};
    use std::collections::BTreeMap;

    let form = DynamicFormV2 {
        version: 2,
        id: Some("checkout".into()),
        fields: vec![],
        schema: Some(DynamicNode::Group {
            label: None,
            when: None,
            children: BTreeMap::from([(
                "city".into(),
                DynamicNode::Field {
                    when: None,
                    async_when: None,
                    field: Field {
                        name: "leaf".into(),
                        kind: "text".into(),
                        label: Some("City".into()),
                        placeholder: None,
                        initial_value: None,
                        validators: None,
                        min: None,
                        max: None,
                        step: None,
                        options: None,
                        searchable: None,
                        mode: None,
                    },
                },
            )]),
        }),
        layout: vec![],
        rules: vec![],
        requires_context: vec![],
    };

    let value = serde_json::to_value(form).unwrap();
    assert!(value.get("schema").is_some());
    assert!(value.get("fields").is_none());
    assert!(value.get("layout").is_none());
    assert!(value.get("rules").is_none());
    let field = &value["schema"]["children"]["city"]["field"];
    assert!(field.get("placeholder").is_none());
    assert!(field.get("validators").is_none());
}

#[test]
fn accepts_shared_nested_layout_fixture() {
    // Same fixture the TS and Java parsers accept: a column row nested inside a section.
    let json = include_str!("../../../../spec/fixtures/dynamic-form/v2/nested-layout.json");
    let result = parse_v2(json, ValidationMode::Strict).unwrap();
    assert!(result.valid, "{:?}", result.diagnostics);
    let form = result.form.expect("form");
    assert_eq!(form.layout.len(), 2);

    use modyra_contract::{LayoutChild, LayoutNode};
    match &form.layout[0] {
        LayoutNode::Section { id, children, .. } => {
            assert_eq!(id, "address");
            assert!(matches!(&children[0], LayoutChild::Field(name) if name == "street"));
            assert!(matches!(&children[1], LayoutChild::Node(nested) if matches!(**nested, LayoutNode::Columns { .. })));
        }
        other => panic!("expected a section, got {other:?}"),
    }
}

#[test]
fn rejects_shared_duplicate_layout_reference_fixture() {
    // A field placed in two slots would render twice and bind one value to both.
    let json = include_str!("../../../../spec/fixtures/dynamic-form/v2/duplicate-layout-reference.json");
    let result = parse_v2(json, ValidationMode::Strict).unwrap();
    assert!(!result.valid);
    assert!(result.diagnostics.iter().any(|d| d.code == "MDY_DYNAMIC_UNKNOWN_FIELD_REFERENCE"));
}

#[test]
fn accepts_shared_v3_placement_fixture() {
    // The same document the TS and Java parsers accept. A v3 envelope is what a layout placing a
    // slot per breakpoint produces, so a responsively authored form is the case a version check can
    // refuse outright — `expected contract version 2`, before a single field is read.
    let json = include_str!("../../../../spec/fixtures/dynamic-form/v3/placement.json");
    let result = parse_v2(json, ValidationMode::Strict).unwrap();
    assert!(result.valid, "{:?}", result.diagnostics);
    let form = result.form.expect("form");
    assert_eq!(form.version, 3);

    use modyra_contract::{LayoutChild, LayoutNode};
    match &form.layout[0] {
        LayoutNode::Columns { columns, at, .. } => {
            // v2's track counts survive the round trip rather than being dropped silently.
            assert_eq!(at.as_ref().expect("row at").get("sm").copied(), Some(2));
            assert!(matches!(&columns[0][0], LayoutChild::Field(name) if name == "first"));
            match &columns[1][0] {
                LayoutChild::Slot(slot) => {
                    assert_eq!(slot.reference, "last");
                    let at = slot.at.as_ref().expect("slot at");
                    assert_eq!(at["base"].hidden, Some(true));
                    assert_eq!(at["md"].column, Some(2));
                    assert_eq!(at["md"].hidden, Some(false));
                }
                other => panic!("expected a v3 slot, got {other:?}"),
            }
        }
        other => panic!("expected a columns row, got {other:?}"),
    }

    // A section occupying a column carries that column's placement.
    match &form.layout[1] {
        LayoutNode::Columns { columns, .. } => match &columns[0][0] {
            LayoutChild::Node(nested) => match nested.as_ref() {
                LayoutNode::Section { id, at, .. } => {
                    assert_eq!(id, "address");
                    assert_eq!(at.as_ref().expect("section at")["base"].hidden, Some(true));
                }
                other => panic!("expected a section, got {other:?}"),
            },
            other => panic!("expected a nested node, got {other:?}"),
        },
        other => panic!("expected a columns row, got {other:?}"),
    }
}

#[test]
fn refuses_placement_where_no_column_can_honour_it() {
    // `at` outside a columns row, and a column past the row's tracks: both are refused, the same
    // way the TS parser refuses them, so the three implementations agree on what a slot may say.
    let in_section = r#"{"version":3,"fields":[{"name":"a","kind":"text"}],
        "layout":[{"kind":"section","id":"s","children":[{"ref":"a","at":{"sm":{"hidden":true}}}]}]}"#;
    let result = parse_v2(in_section, ValidationMode::Strict).unwrap();
    assert!(!result.valid, "placement in a section must be refused");

    let past_the_end = r#"{"version":3,"fields":[{"name":"a","kind":"text"},{"name":"b","kind":"text"}],
        "layout":[{"kind":"columns","id":"r","columns":[["a"],[{"ref":"b","at":{"sm":{"column":5}}}]]}]}"#;
    let result = parse_v2(past_the_end, ValidationMode::Strict).unwrap();
    assert!(!result.valid, "a column the row does not have must be refused");

    // And a version this SDK has never heard of is still refused. Four is one it has: v4 is v3 plus
    // a condition on a node and the context keys a document declares it reads.
    let v5 = r#"{"version":5,"fields":[{"name":"a","kind":"text"}]}"#;
    let result = parse_v2(v5, ValidationMode::Strict).unwrap();
    assert!(result.diagnostics.iter().any(|d| d.code == "MDY_DYNAMIC_UNSUPPORTED_VERSION"));
}

/// The three readers of this contract accept the same versions, and read v4's own members.
///
/// A document rendered by one runtime and refused by two is not one contract, and v4 is the version
/// that carries the conditional semantics — so it is the one where disagreeing costs the most. The
/// clause is checked as a shape here: this SDK says whether a document is a document, and building
/// a form from it is the runtime's work.
#[test]
fn reads_a_v4_document_and_the_context_it_declares() {
    let declared = r#"{"version":4,"requiresContext":["tier"],
        "schema":{"node":"group","children":{
          "vat":{"node":"field","field":{"kind":"text"},
                 "when":{"op":"equals","operands":[{"context":"tier"},"business"]}}}}}"#;
    let result = parse_v2(declared, ValidationMode::Strict).unwrap();
    assert!(result.valid, "a v4 document was refused: {:?}", result.diagnostics);

    // A key read and not declared: the host is told what to supply by `requiresContext` alone, so a
    // key missing from it is one no host would think to pass.
    let undeclared = r#"{"version":4,
        "schema":{"node":"group","children":{
          "vat":{"node":"field","field":{"kind":"text"},
                 "when":{"op":"equals","operands":[{"context":"tier"},"business"]}}}}}"#;
    let result = parse_v2(undeclared, ValidationMode::Strict).unwrap();
    assert!(result
        .diagnostics
        .iter()
        .any(|d| d.code == "MDY_DYNAMIC_UNDECLARED_CONTEXT"));

    // An operand shape the contract does not have, in a clause a reader would otherwise carry.
    let malformed = r#"{"version":4,
        "schema":{"node":"group","children":{
          "vat":{"node":"field","field":{"kind":"text"},
                 "when":{"op":"equals","operands":[{"nonsense":"tier"},"business"]}}}}}"#;
    let result = parse_v2(malformed, ValidationMode::Strict).unwrap();
    assert!(result
        .diagnostics
        .iter()
        .any(|d| d.code == "MDY_DYNAMIC_INVALID_CONDITION"));

    // And a member the version predates, the same answer the TypeScript reader gives.
    let early = r#"{"version":3,"requiresContext":["tier"],"fields":[{"name":"a","kind":"text"}]}"#;
    let result = parse_v2(early, ValidationMode::Strict).unwrap();
    assert!(result
        .diagnostics
        .iter()
        .any(|d| d.code == "MDY_DYNAMIC_UNSUPPORTED_VERSION"));
}

/// A mode survives a round trip, and an unknown one is reported rather than carried.
///
/// The failure this guards is silent: a field parsed without `mode` re-serialises as a different
/// widget than the one that was written, because the widget contract picks its anatomy by that
/// value. Nothing in this SDK noticed until the anatomy started depending on it.
#[test]
fn multiselect_mode_survives_a_round_trip() {
    let json = r#"{
        "version": 2,
        "fields": [{
            "name": "tags",
            "kind": "multiselect",
            "mode": "multi",
            "options": [{"value": "a", "label": "A"}]
        }]
    }"#;

    let result = parse_v2(json, ValidationMode::Lenient).expect("parses");
    let form = result.form.expect("a form");
    assert_eq!(form.fields[0].mode.as_deref(), Some("multi"));

    let round_tripped = serde_json::to_string(&form).expect("serialises");
    assert!(
        round_tripped.contains("\"mode\":\"multi\""),
        "the mode must survive re-serialisation, got {round_tripped}"
    );
    assert!(
        result.diagnostics.iter().all(|d| d.code != "MDY_DYNAMIC_UNKNOWN_MODE"),
        "a declared mode is not an unknown one"
    );
}

#[test]
fn an_unrecognised_mode_is_reported() {
    let json = r#"{
        "version": 2,
        "fields": [{
            "name": "tags",
            "kind": "multiselect",
            "mode": "counter",
            "options": [{"value": "a", "label": "A"}]
        }]
    }"#;
    let result = parse_v2(json, ValidationMode::Lenient).expect("parses");
    assert!(
        result.diagnostics.iter().any(|d| d.code == "MDY_DYNAMIC_UNKNOWN_MODE"),
        "a mode the contract does not describe leaves the field checked against no anatomy"
    );
}

#[test]
fn accepts_the_shared_nested_collections_fixture() {
    // The same document the TS parser accepts: a keyed collection inside a keyed row, an array
    // below that, and a keyed collection as the whole row of an array.
    let json = include_str!("../../../../spec/fixtures/dynamic-form/v3/nested-collections.json");
    let result = parse_v2(json, ValidationMode::Strict).unwrap();
    assert!(result.valid, "{:?}", result.diagnostics);
    let form = result.form.expect("form");

    use modyra_contract::DynamicNode;
    let schema = form.schema.expect("schema");
    let DynamicNode::Group { children, .. } = &schema else {
        panic!("expected a group at the root, got {schema:?}");
    };
    assert!(matches!(children["orders"], DynamicNode::Record { .. }));
    match &children["shipments"] {
        // A row that *is* a collection: an array of keyed serial lists.
        DynamicNode::Array { item, .. } => assert!(matches!(**item, DynamicNode::Record { .. })),
        other => panic!("expected an array of records, got {other:?}"),
    }
}

#[test]
fn a_collection_nests_without_a_limit() {
    // This asserted the opposite: a path crossing one positional level, with an array below another
    // array refused where it was written. ADR 0043 removed that rule from the engine — a collection
    // is addressed by the pattern its declaration has, so a second positional level names its rows
    // as unambiguously as the first — and this SDK went on refusing documents the runtime accepts.
    let array_in_array = r#"{"version":3,"schema":{"node":"array","item":
        {"node":"array","item":{"node":"field","field":{"kind":"text","name":"leaf"}}}}}"#;
    let result = parse_v2(array_in_array, ValidationMode::Strict).unwrap();
    assert!(result.valid, "an array of arrays was refused: {:?}", result.diagnostics);

    let array_under_a_rows_record = r#"{"version":3,"schema":{"node":"array","item":
        {"node":"record","item":{"node":"array","item":
        {"node":"field","field":{"kind":"text","name":"leaf"}}}}}}"#;
    let nested = parse_v2(array_under_a_rows_record, ValidationMode::Strict).unwrap();
    assert!(nested.valid, "an array below a row's record was refused: {:?}", nested.diagnostics);

    // Deeper than the eight levels this SDK used to cap at, since that limit went with the rule.
    let mut deep = String::from(r#"{"version":3,"schema":"#);
    for _ in 0..40 {
        deep.push_str(r#"{"node":"array","item":"#);
    }
    deep.push_str(r#"{"node":"field","field":{"kind":"text","name":"leaf"}}"#);
    for _ in 0..40 {
        deep.push('}');
    }
    deep.push('}');
    let forty = parse_v2(&deep, ValidationMode::Strict).unwrap();
    assert!(forty.valid, "forty positional levels were refused: {:?}", forty.diagnostics);

    // The known-good refusal in the same test: what the walk still reports, it still reports.
    let unsafe_key = r#"{"version":3,"schema":{"node":"record","item":
        {"node":"field","field":{"kind":"text","name":"leaf"}},"initialValue":{"__proto__":{}}}}"#;
    let refused = parse_v2(unsafe_key, ValidationMode::Strict).unwrap();
    assert!(!refused.valid);
    assert!(refused
        .diagnostics
        .iter()
        .any(|d| d.code == "MDY_DYNAMIC_UNSAFE_NAME"));
}

/// The shared corpus's v4 documents, read by this SDK.
///
/// The corpus is what makes one contract out of three implementations: the same documents, the same
/// verdict. A version present in one reader and absent from two is the shape that costs the most,
/// and v4 is the version that carries the conditions.
#[test]
fn accepts_the_shared_v4_fixtures() {
    for json in [
        include_str!("../../../../spec/fixtures/dynamic-form/v4/conditional-tree.json"),
        include_str!("../../../../spec/fixtures/dynamic-form/v4/self-and-root.json"),
        include_str!("../../../../spec/fixtures/dynamic-form/v4/context-conditions.json"),
    ] {
        let result = parse_v2(json, ValidationMode::Strict).unwrap();
        assert!(
            result.valid,
            "a published v4 fixture was refused: {:?}",
            result.diagnostics
        );
    }
}
