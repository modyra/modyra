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

/// Mirrors `MdyDynamicValidatorMessages`: what each rule says when it refuses, in the author's own
/// words. A rule with no sentence here refuses in the form's own language.
#[derive(Debug, Clone, PartialEq, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ValidatorMessages {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub required: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub email: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub integer: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub min: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub max: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub min_length: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub max_length: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub pattern: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Validators {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub required: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub email: Option<bool>,
    /// The value must be a whole number. Arrived with contract v5.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub integer: Option<bool>,
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
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub messages: Option<ValidatorMessages>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Field {
    /// The name a field carries in the flat list. In the tree the parent's key is the name — the
    /// contract's own type removes it there — so a document written as a tree has none to read, and
    /// requiring it made this reader refuse documents the runtime builds.
    #[serde(default)]
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

/// The operators an expression may name, mirroring `MdyExpressionOp`.
const EXPRESSION_OPS: &[&str] = &[
    "equals",
    "notEquals",
    "isEmpty",
    "isNotEmpty",
    "lengthAtLeast",
    "lengthAtMost",
    "greaterThan",
    "greaterThanOrEqual",
    "lessThan",
    "lessThanOrEqual",
    "in",
    "notIn",
    "matches",
    "and",
    "or",
    "not",
];

/// A condition written on a node, as contract v4 declares it.
///
/// Read as a shape rather than evaluated: this reader says whether a document is a document, and a
/// clause it cannot check is a clause a host would find out about only when a field failed to
/// appear. Evaluating it is the runtime's work, and this SDK does not build forms.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Expression {
    pub op: String,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub operand: Option<Value>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub operands: Option<Vec<Value>>,
}

/// Reports what an expression gets wrong, and collects the context keys it reads.
///
/// An object operand is one of the four the contract names — `{path}`, `{self}`, `{root}`,
/// `{context}` — or a nested expression. Anything else is a literal only when it is not an object:
/// an object nobody declared is a reference that reads nothing, which is the shape a hand-written
/// document gets wrong.
fn validate_expression(
    expression: &Expression,
    path: &str,
    out: &mut Vec<Diagnostic>,
    context_keys: &mut Vec<String>,
) {
    if !EXPRESSION_OPS.contains(&expression.op.as_str()) {
        out.push(diag(
            "MDY_DYNAMIC_INVALID_CONDITION",
            path,
            "expression names an operator this contract does not have",
        ));
    }
    let mut operands: Vec<&Value> = Vec::new();
    if let Some(operand) = &expression.operand {
        operands.push(operand);
    }
    if let Some(list) = &expression.operands {
        operands.extend(list.iter());
    }
    let mut pending: Vec<&Value> = operands;
    while let Some(operand) = pending.pop() {
        let Some(object) = operand.as_object() else { continue };
        if let Some(op) = object.get("op") {
            // A nested expression: the same rules, one level down, over the same stack.
            if !op
                .as_str()
                .is_some_and(|op| EXPRESSION_OPS.contains(&op))
            {
                out.push(diag(
                    "MDY_DYNAMIC_INVALID_CONDITION",
                    path,
                    "expression names an operator this contract does not have",
                ));
            }
            if let Some(inner) = object.get("operand") {
                pending.push(inner);
            }
            if let Some(list) = object.get("operands").and_then(Value::as_array) {
                pending.extend(list.iter());
            }
            continue;
        }
        if let Some(key) = object.get("context").and_then(Value::as_str) {
            context_keys.push(key.to_string());
            continue;
        }
        if object.contains_key("path") || object.contains_key("self") || object.contains_key("root")
        {
            continue;
        }
        out.push(diag(
            "MDY_DYNAMIC_INVALID_CONDITION",
            path,
            "an object operand must be {path}, {self}, {root}, {context} or a nested expression",
        ));
    }
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

        /// Contract v4: whether this field is in play, decided from the form and the host's context.
        #[serde(default, skip_serializing_if = "Option::is_none")]
        when: Option<Expression>,

        /// Contract v4: whether this field's asynchronous validation runs.
        #[serde(default, rename = "asyncWhen", skip_serializing_if = "Option::is_none")]
        async_when: Option<Expression>,
    },
    Group {
        #[serde(default, skip_serializing_if = "Option::is_none")]
        label: Option<String>,
        children: std::collections::BTreeMap<String, DynamicNode>,

        #[serde(default, skip_serializing_if = "Option::is_none")]
        when: Option<Expression>,
    },
    Array {
        #[serde(default, skip_serializing_if = "Option::is_none")]
        label: Option<String>,

        item: Box<DynamicNode>,

        #[serde(default, skip_serializing_if = "Option::is_none")]
        when: Option<Expression>,

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

        #[serde(default, skip_serializing_if = "Option::is_none")]
        when: Option<Expression>,

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

    /// Contract v4: the context keys this document's conditions read, declared for the host.
    #[serde(
        default,
        rename = "requiresContext",
        skip_serializing_if = "Vec::is_empty"
    )]
    pub requires_context: Vec<String>,
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
    if !(2..=5).contains(&form.version) {
        d.push(diag(
            "MDY_DYNAMIC_UNSUPPORTED_VERSION",
            "/version",
            "expected contract version 2, 3, 4 or 5",
        ));
    }
    // A member the document's version predates. `requiresContext` arrived with v4, and a v2 or v3
    // document carrying it declares a need nothing acts on — the same answer the TypeScript reader
    // gives, so an author is not told two different things by two readers of one contract.
    if !form.requires_context.is_empty() && form.version < 4 {
        d.push(diag(
            "MDY_DYNAMIC_UNSUPPORTED_VERSION",
            "/requiresContext",
            "requiresContext arrived with version 4",
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
    let mut context_keys: Vec<String> = Vec::new();
    if let Some(schema) = &form.schema {
        validate_node(schema, "/schema", &mut d, &mut context_keys);
    }
    // A key a condition reads and the document does not declare. The host is told what to supply by
    // `requiresContext` alone, so a key missing from it is one no host would think to pass — and a
    // condition that cannot be read decides false, hiding the fields it guards.
    for key in &context_keys {
        if !form.requires_context.contains(key) {
            d.push(diag(
                "MDY_DYNAMIC_UNDECLARED_CONTEXT",
                "/schema",
                "a condition reads a context key the document does not declare in requiresContext",
            ));
        }
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

/// Walks a schema, reporting what it cannot use.
///
/// Over an explicit stack rather than by recursion, and with no depth limit: a document is untrusted
/// input, so its nesting must cost memory rather than stack — a recursive walk lets the document
/// decide how deep this goes, and in this language that ends the process rather than raising
/// something a caller can answer. The engine's own walk was made iterative for the same reason
/// (ADR 0043).
///
/// A collection nests without a limit, in either direction: an array's row may be an array, and a
/// record below a positional level may hold one. Both were refused here, matching a rule ADR 0043
/// removed from the engine — so this SDK told an author their document was invalid while the runtime
/// accepted it.
fn validate_node(
    node: &DynamicNode,
    path: &str,
    out: &mut Vec<Diagnostic>,
    context_keys: &mut Vec<String>,
) {
    let mut pending: Vec<(&DynamicNode, String)> = vec![(node, path.to_string())];

    while let Some((node, path)) = pending.pop() {
        // A condition written on this node, whichever kind of node it is. Checked as a shape and
        // read for the context keys it names, which is what a document's `requiresContext` is held
        // against.
        for (clause, member) in match node {
            DynamicNode::Field { when, async_when, .. } => [when.as_ref(), async_when.as_ref()],
            DynamicNode::Group { when, .. }
            | DynamicNode::Array { when, .. }
            | DynamicNode::Record { when, .. } => [when.as_ref(), None],
        }
        .into_iter()
        .zip(["when", "asyncWhen"])
        {
            if let Some(clause) = clause {
                validate_expression(clause, &format!("{path}/{member}"), out, context_keys);
            }
        }
        match node {
            DynamicNode::Field { field, .. } => {
                if !KINDS.contains(&field.kind.as_str()) {
                    out.push(diag("MDY_DYNAMIC_UNKNOWN_KIND", &path, "unknown field kind"));
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
                            &path,
                            "unsafe group child name",
                        ));
                    } else {
                        pending.push((child, format!("{path}/children/{name}")));
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
                        &path,
                        "array initial value exceeds 100 rows",
                    ));
                }
                if min_items
                    .zip(*max_items)
                    .is_some_and(|(min, max)| min > max)
                {
                    out.push(diag(
                        "MDY_DYNAMIC_INVALID_ARRAY",
                        &path,
                        "minItems cannot exceed maxItems",
                    ));
                }
                pending.push((item, format!("{path}/item")));
            }
            DynamicNode::Record {
                item,
                initial_value,
                ..
            } => {
                if initial_value.len() > 100 {
                    out.push(diag(
                        "MDY_DYNAMIC_SCHEMA_LIMIT",
                        &path,
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
                pending.push((item, format!("{path}/item")));
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
