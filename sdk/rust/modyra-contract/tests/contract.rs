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
