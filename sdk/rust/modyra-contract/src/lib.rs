use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashSet;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ValidationMode {
    Lenient,
    Strict,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct Diagnostic {
    pub code: &'static str,
    pub path: String,
    pub message: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OptionItem {
    pub value: Value,
    pub label: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub disabled: Option<bool>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Validators {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub required: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub email: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub min: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub max: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub min_length: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub max_length: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub pattern: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Field {
    pub name: String,
    pub kind: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub label: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub placeholder: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub initial_value: Option<Value>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub validators: Option<Validators>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub min: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub max: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub step: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub options: Option<Vec<OptionItem>>,
}

/// A layout slot: a field name, or a nested layout node so a column row can sit
/// inside a section. Untagged, because the JSON is either a string or an object.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(untagged)]
pub enum LayoutChild {
    Field(String),
    Node(Box<LayoutNode>),
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "lowercase")]
pub enum LayoutNode {
    Section {
        id: String,
        #[serde(default)]
        label: Option<String>,
        children: Vec<LayoutChild>,
    },
    Columns {
        id: String,
        columns: Vec<Vec<LayoutChild>>,
    },
}

/// Depth cap for nested layout, matching MDY_LAYOUT_MAX_DEPTH in the TS parser.
pub const LAYOUT_MAX_DEPTH: usize = 6;

/// Collects every field name a layout node places, or returns `None` when the
/// subtree is unusable — too deep, or a field placed in more than one slot.
fn layout_refs(node: &LayoutNode, depth: usize, seen: &mut Vec<String>) -> bool {
    if depth > LAYOUT_MAX_DEPTH {
        return false;
    }
    let slots: Vec<&Vec<LayoutChild>> = match node {
        LayoutNode::Section { children, .. } => vec![children],
        LayoutNode::Columns { columns, .. } => columns.iter().collect(),
    };
    for slot in slots {
        for child in slot {
            match child {
                LayoutChild::Field(name) => {
                    if seen.iter().any(|existing| existing == name) {
                        return false;
                    }
                    seen.push(name.clone());
                }
                LayoutChild::Node(nested) => {
                    if !layout_refs(nested, depth + 1, seen) {
                        return false;
                    }
                }
            }
        }
    }
    true
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Condition {
    pub field: String,
    pub operator: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub value: Option<Value>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Rule {
    pub effect: String,
    pub target: String,
    pub when: Condition,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "node", rename_all = "lowercase")]
pub enum DynamicNode {
    Field {
        field: Field,
    },
    Group {
        #[serde(default, skip_serializing_if = "Option::is_none")]
        label: Option<String>,
        children: std::collections::BTreeMap<String, DynamicNode>,
    },
    Array {
        #[serde(default, skip_serializing_if = "Option::is_none")]
        label: Option<String>,

        item: Box<DynamicNode>,

        #[serde(
            default,
            rename = "initialValue",
            skip_serializing_if = "Vec::is_empty"
        )]
        initial_value: Vec<Value>,

        #[serde(default, rename = "minItems", skip_serializing_if = "Option::is_none")]
        min_items: Option<usize>,

        #[serde(default, rename = "maxItems", skip_serializing_if = "Option::is_none")]
        max_items: Option<usize>,
    },
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct DynamicFormV2 {
    pub version: u8,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub id: Option<String>,

    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub fields: Vec<Field>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub schema: Option<DynamicNode>,

    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub layout: Vec<LayoutNode>,

    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub rules: Vec<Rule>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct ValidationResult {
    pub valid: bool,
    pub form: Option<DynamicFormV2>,
    pub diagnostics: Vec<Diagnostic>,
}

const KINDS: &[&str] = &[
    "text",
    "textarea",
    "email",
    "password",
    "number",
    "slider",
    "checkbox",
    "toggle",
    "select",
    "radio",
    "multiselect",
    "segmented",
    "datepicker",
    "timepicker",
];
const EFFECTS: &[&str] = &["visible", "hidden", "enabled", "disabled"];
const OPERATORS: &[&str] = &[
    "equals",
    "notEquals",
    "in",
    "notIn",
    "isEmpty",
    "isNotEmpty",
    "greaterThan",
    "greaterThanOrEqual",
    "lessThan",
    "lessThanOrEqual",
];

pub fn parse_v2(json: &str, mode: ValidationMode) -> Result<ValidationResult, serde_json::Error> {
    let form: DynamicFormV2 = serde_json::from_str(json)?;
    let mut d = Vec::new();
    if form.version != 2 {
        d.push(diag(
            "MDY_DYNAMIC_UNSUPPORTED_VERSION",
            "/version",
            "expected contract version 2",
        ));
    }
    let mut names = HashSet::new();
    for (i, field) in form.fields.iter().enumerate() {
        let path = format!("/fields/{i}");
        if field.name.is_empty()
            || field.name.contains('.')
            || matches!(
                field.name.as_str(),
                "__proto__" | "prototype" | "constructor"
            )
        {
            d.push(diag(
                "MDY_DYNAMIC_UNSAFE_NAME",
                &format!("{path}/name"),
                "field name is empty, reserved, or contains a dot",
            ));
        } else if !names.insert(field.name.clone()) {
            d.push(diag(
                "MDY_DYNAMIC_DUPLICATE_NAME",
                &format!("{path}/name"),
                "duplicate field name",
            ));
        }
        if !KINDS.contains(&field.kind.as_str()) {
            d.push(diag(
                "MDY_DYNAMIC_UNKNOWN_KIND",
                &format!("{path}/kind"),
                "unknown field kind",
            ));
        }
        if matches!(
            field.kind.as_str(),
            "select" | "radio" | "multiselect" | "segmented"
        ) && field.options.is_none()
        {
            d.push(diag(
                "MDY_DYNAMIC_OPTIONS_REQUIRED",
                &format!("{path}/options"),
                "option field requires options",
            ));
        }
        if field.step.is_some_and(|v| !v.is_finite() || v <= 0.0) {
            d.push(diag(
                "MDY_DYNAMIC_INVALID_FIELD",
                &format!("{path}/step"),
                "step must be finite and greater than zero",
            ));
        }
        if field.min.zip(field.max).is_some_and(|(a, b)| a > b) {
            d.push(diag(
                "MDY_DYNAMIC_INVALID_FIELD",
                path.as_str(),
                "min cannot exceed max",
            ));
        }
        if field
            .validators
            .as_ref()
            .and_then(|v| v.pattern.as_ref())
            .is_some_and(|p| p.len() > 256)
        {
            d.push(diag(
                "MDY_DYNAMIC_PATTERN_TOO_LONG",
                &format!("{path}/validators/pattern"),
                "pattern exceeds 256 characters",
            ));
        }
    }
    let mut placed: Vec<String> = Vec::new();
    for (i, node) in form.layout.iter().enumerate() {
        let mut refs: Vec<String> = placed.clone();
        let before = refs.len();
        if !layout_refs(node, 1, &mut refs) || refs[before..].iter().any(|v| !names.contains(v.as_str())) {
            d.push(diag(
                "MDY_DYNAMIC_UNKNOWN_FIELD_REFERENCE",
                &format!("/layout/{i}"),
                "layout references an unknown or already-placed field, or has an invalid shape",
            ));
            continue;
        }
        placed = refs;
    }
    for (i, rule) in form.rules.iter().enumerate() {
        if !EFFECTS.contains(&rule.effect.as_str())
            || !OPERATORS.contains(&rule.when.operator.as_str())
            || !names.contains(&rule.target)
            || !names.contains(&rule.when.field)
        {
            d.push(diag(
                "MDY_DYNAMIC_INVALID_RULE",
                &format!("/rules/{i}"),
                "rule is unsupported or references an unknown field",
            ));
        }
    }
    if let Some(schema) = &form.schema {
        validate_node(schema, "/schema", 0, &mut d);
    }
    let valid = d.is_empty();
    Ok(ValidationResult {
        valid,
        form: if valid || mode == ValidationMode::Lenient {
            Some(form)
        } else {
            None
        },
        diagnostics: d,
    })
}

fn validate_node(node: &DynamicNode, path: &str, depth: usize, out: &mut Vec<Diagnostic>) {
    if depth > 8 {
        out.push(diag(
            "MDY_DYNAMIC_SCHEMA_LIMIT",
            path,
            "schema exceeds maximum depth",
        ));
        return;
    }
    match node {
        DynamicNode::Field { field } => {
            if !KINDS.contains(&field.kind.as_str()) {
                out.push(diag("MDY_DYNAMIC_UNKNOWN_KIND", path, "unknown field kind"));
            }
        }
        DynamicNode::Group { children, .. } => {
            for (name, child) in children {
                if name.is_empty()
                    || name.contains('.')
                    || matches!(name.as_str(), "__proto__" | "prototype" | "constructor")
                {
                    out.push(diag(
                        "MDY_DYNAMIC_UNSAFE_NAME",
                        path,
                        "unsafe group child name",
                    ));
                } else {
                    validate_node(child, &format!("{path}/children/{name}"), depth + 1, out);
                }
            }
        }
        DynamicNode::Array {
            item,
            initial_value,
            min_items,
            max_items,
            ..
        } => {
            if initial_value.len() > 100 {
                out.push(diag(
                    "MDY_DYNAMIC_SCHEMA_LIMIT",
                    path,
                    "array initial value exceeds 100 rows",
                ));
            }
            if min_items
                .zip(*max_items)
                .is_some_and(|(min, max)| min > max)
            {
                out.push(diag(
                    "MDY_DYNAMIC_INVALID_ARRAY",
                    path,
                    "minItems cannot exceed maxItems",
                ));
            }
            validate_node(item, &format!("{path}/item"), depth + 1, out);
        }
    }
}

fn diag(code: &'static str, path: &str, message: &str) -> Diagnostic {
    Diagnostic {
        code,
        path: path.into(),
        message: message.into(),
    }
}
