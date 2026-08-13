use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::{BTreeMap, HashSet};

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
    /// Select and multiselect only: whether the list filters as the user types.
    ///
    /// Decides which of two interaction models the widget is — a listbox whose trigger keeps focus,
    /// or a combobox whose search input takes it — so a document that loses it describes a
    /// different control than the one it was written for.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub searchable: Option<bool>,
    /// Multiselect only: `"single"` is a toggle set, `"multi"` a bag whose chip counts repeats.
    ///
    /// Carried because the widget contract declares a different anatomy per mode. A field that
    /// round-trips through here without it describes a different widget than the one it was written
    /// as — the same silent loss an unknown-property-tolerant parser makes everywhere else.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub mode: Option<String>,
}

/// The sizes a layout is authored against, mirroring `MDY_LAYOUT_BREAKPOINTS`.
pub const LAYOUT_BREAKPOINTS: [&str; 4] = ["base", "sm", "md", "lg"];

/// Where a slot sits and whether it shows, at one size — Contract v3's per-slot
/// placement. Both keys are optional; a size that states neither is refused.
#[derive(Debug, Clone, PartialEq, Default, Serialize, Deserialize)]
pub struct SlotPlacement {
    /// 1-based, like a grid line.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub column: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub hidden: Option<bool>,
}

/// Contract v3's slot: a field name that also says where it sits, per size.
///
/// `ref` is a Rust keyword, so the field is `reference` and serde carries the
/// wire name. Only valid inside a `columns` row — the column is the element a
/// placement can act on — which `layout_refs` enforces.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct LayoutSlot {
    #[serde(rename = "ref")]
    pub reference: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub at: Option<BTreeMap<String, SlotPlacement>>,
}

/// A layout slot: a field name, a v3 slot describing that field's placement, or
/// a nested layout node so a column row can sit inside a section. Untagged,
/// because the JSON is a string or one of two object shapes.
///
/// Order matters to serde: a string first, then the slot (which a layout node
/// can never match, having no `ref`), then the node. Putting `Node` first would
/// make every slot fail to deserialize and take the whole document with it.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(untagged)]
pub enum LayoutChild {
    Field(String),
    Slot(LayoutSlot),
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
        /// v3: a section occupying a column carries that column's placement.
        #[serde(default, skip_serializing_if = "Option::is_none")]
        at: Option<BTreeMap<String, SlotPlacement>>,
    },
    Columns {
        id: String,
        columns: Vec<Vec<LayoutChild>>,
        /// v2: how many tracks the row shows at each size. Absent here until
        /// now, which meant a round-trip through this SDK silently dropped a
        /// responsively-authored row back to one arrangement.
        #[serde(default, skip_serializing_if = "Option::is_none")]
        at: Option<BTreeMap<String, u32>>,
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
    // How many tracks this node has, so a slot cannot be sent to a column it does
    // not have. `0` marks a section: placement is refused there, because the
    // column is the only element a placement can act on.
    let tracks: u32 = match node {
        LayoutNode::Section { .. } => 0,
        LayoutNode::Columns { columns, at, .. } => {
            let declared = columns.len().max(1) as u32;
            at.iter()
                .flat_map(|counts| counts.values().copied())
                .fold(declared, u32::max)
        }
    };
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
                LayoutChild::Slot(placed) => {
                    if seen.iter().any(|existing| existing == &placed.reference) {
                        return false;
                    }
                    if !valid_placement(placed.at.as_ref(), tracks) {
                        return false;
                    }
                    seen.push(placed.reference.clone());
                }
                LayoutChild::Node(nested) => {
                    if !layout_refs(nested, depth + 1, seen) {
                        return false;
                    }
                    // A section's own `at` describes the column *this* node gives
                    // it, so it is checked here rather than inside its own walk.
                    if let LayoutNode::Section { at, .. } = nested.as_ref() {
                        if !valid_placement(at.as_ref(), tracks) {
                            return false;
                        }
                    }
                }
            }
        }
    }
    true
}

/// A per-size placement the row can honour. `tracks` of 0 means there is no
/// column, and any placement at all is refused.
fn valid_placement(at: Option<&BTreeMap<String, SlotPlacement>>, tracks: u32) -> bool {
    let Some(at) = at else { return true };
    if tracks == 0 {
        return false;
    }
    at.iter().all(|(size, placement)| {
        LAYOUT_BREAKPOINTS.contains(&size.as_str())
            // A size that states neither is a typo worth refusing, not a no-op.
            && (placement.column.is_some() || placement.hidden.is_some())
            && placement.column.is_none_or(|column| column >= 1 && column <= tracks)
    })
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
    /// A collection whose keys are data rather than positions — an entity id, a provisional key.
    ///
    /// The document declares the shape of a row and, where it has them, the rows it starts with.
    /// Which rows exist afterwards is the application's word.
    Record {
        #[serde(default, skip_serializing_if = "Option::is_none")]
        label: Option<String>,

        item: Box<DynamicNode>,

        #[serde(
            default,
            rename = "initialValue",
            skip_serializing_if = "std::collections::BTreeMap::is_empty"
        )]
        initial_value: std::collections::BTreeMap<String, Value>,
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
/// The two shapes a multiselect has, mirroring `MdyMultiselectMode`.
const MODES: &[&str] = &["single", "multi"];
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
    // v3 is v2 plus per-slot placement: every other member is read the same way,
    // so a v3 document parses here exactly as a v2 one does. Studio emits v3 the
    // moment a layout places a slot per breakpoint, and refusing it outright made
    // a form authored responsively unreadable by this SDK.
    if form.version != 2 && form.version != 3 {
        d.push(diag(
            "MDY_DYNAMIC_UNSUPPORTED_VERSION",
            "/version",
            "expected contract version 2 or 3",
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
        // A mode nothing describes is worse than none: the widget contract picks an anatomy by this
        // value, so an unrecognised one leaves the field checked against no anatomy at all.
        if let Some(mode) = field.mode.as_deref() {
            if !MODES.contains(&mode) {
                d.push(diag(
                    "MDY_DYNAMIC_UNKNOWN_MODE",
                    &format!("{path}/mode"),
                    "unknown multiselect mode",
                ));
            } else if field.kind != "multiselect" {
                d.push(diag(
                    "MDY_DYNAMIC_UNEXPECTED_MODE",
                    &format!("{path}/mode"),
                    "mode is meaningful only on multiselect",
                ));
            }
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
        validate_node(schema, "/schema", 0, false, &mut d);
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

/// `positional` says an array already encloses this node: a path crosses one positional level
/// (ADR 0040), so a second array below one is refused where it is written.
fn validate_node(
    node: &DynamicNode,
    path: &str,
    depth: usize,
    positional: bool,
    out: &mut Vec<Diagnostic>,
) {
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
                    validate_node(
                        child,
                        &format!("{path}/children/{name}"),
                        depth + 1,
                        positional,
                        out,
                    );
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
            if matches!(**item, DynamicNode::Array { .. }) {
                out.push(diag(
                    "MDY_DYNAMIC_INVALID_ARRAY",
                    &format!("{path}/item"),
                    "a path crosses one positional level — an array below another array is not addressable",
                ));
            } else {
                validate_node(item, &format!("{path}/item"), depth + 1, true, out);
            }
        }
        DynamicNode::Record {
            item,
            initial_value,
            ..
        } => {
            if initial_value.len() > 100 {
                out.push(diag(
                    "MDY_DYNAMIC_SCHEMA_LIMIT",
                    path,
                    "record initial value exceeds 100 rows",
                ));
            }
            for key in initial_value.keys() {
                // A key that cannot be a path segment names a row nothing can address.
                if key.is_empty()
                    || key.contains('.')
                    || matches!(key.as_str(), "__proto__" | "prototype" | "constructor")
                {
                    out.push(diag(
                        "MDY_DYNAMIC_UNSAFE_NAME",
                        &format!("{path}/initialValue/{key}"),
                        "unsafe row key",
                    ));
                }
            }
            if positional && matches!(**item, DynamicNode::Array { .. }) {
                out.push(diag(
                    "MDY_DYNAMIC_INVALID_RECORD",
                    &format!("{path}/item"),
                    "a path crosses one positional level — an array below another array is not addressable",
                ));
            } else {
                validate_node(item, &format!("{path}/item"), depth + 1, positional, out);
            }
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
