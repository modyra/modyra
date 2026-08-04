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
            children: BTreeMap::from([(
                "city".into(),
                DynamicNode::Field {
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

    // And a version this SDK has never heard of is still refused.
    let v4 = r#"{"version":4,"fields":[{"name":"a","kind":"text"}]}"#;
    let result = parse_v2(v4, ValidationMode::Strict).unwrap();
    assert!(result.diagnostics.iter().any(|d| d.code == "MDY_DYNAMIC_UNSUPPORTED_VERSION"));
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
