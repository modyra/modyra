use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::{BTreeMap, HashSet};

mod pattern_cost;

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

/// Depth cap for nested layout, matching MDY_LAYOUT_MAX_DEPTH in the TS parser (ADR 0161).
pub const LAYOUT_MAX_DEPTH: usize = 32;

/// The most tracks a row may declare at one size, matching the TS parser.
const LAYOUT_MAX_COLUMNS: u32 = 12;

/// Why a layout subtree is unusable. Each reason is its own diagnostic code, so an author told
/// "unknown field" about a layout that is merely too deep is not sent looking for a typo.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum LayoutRefusal {
    /// Nested past `LAYOUT_MAX_DEPTH`.
    Depth,
    /// A v3 placement in a document whose version precedes it.
    Version,
    /// A member that cannot describe a layout: a track count out of range, a placement on a
    /// section no column holds.
    Shape,
    /// A field that does not exist, is placed twice, or is sent to a column the row lacks.
    Reference,
}

impl LayoutRefusal {
    fn diagnostic(self, path: &str) -> Diagnostic {
        match self {
            LayoutRefusal::Depth => diag(
                "MDY_DYNAMIC_INVALID_LAYOUT",
                path,
                "layout nests deeper than 32 levels",
            ),
            LayoutRefusal::Version => diag(
                "MDY_DYNAMIC_UNSUPPORTED_VERSION",
                path,
                "layout uses a placement this document's version precedes; it needs version 3",
            ),
            LayoutRefusal::Shape => diag(
                "MDY_DYNAMIC_INVALID_LAYOUT",
                path,
                "layout node has an invalid shape",
            ),
            LayoutRefusal::Reference => diag(
                "MDY_DYNAMIC_UNKNOWN_FIELD_REFERENCE",
                path,
                "layout references an unknown or already-placed field, or a column the row lacks",
            ),
        }
    }
}

/// Collects every field name a layout node places, or says why the subtree is unusable.
///
/// The first refusal met in document order is the one reported, as the TS parser reports it, so
/// both readers name the same code for the same document. `allow_slots` is whether the document's
/// version has v3 placement at all.
fn layout_refs(
    node: &LayoutNode,
    depth: usize,
    names: &HashSet<String>,
    seen: &mut Vec<String>,
    allow_slots: bool,
) -> Result<(), LayoutRefusal> {
    if depth > LAYOUT_MAX_DEPTH {
        return Err(LayoutRefusal::Depth);
    }
    if let LayoutNode::Columns { at: Some(at), .. } = node {
        let fits = at.iter().all(|(size, count)| {
            LAYOUT_BREAKPOINTS.contains(&size.as_str()) && (1..=LAYOUT_MAX_COLUMNS).contains(count)
        });
        if !fits {
            return Err(LayoutRefusal::Shape);
        }
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
                    if !names.contains(name) || seen.iter().any(|existing| existing == name) {
                        return Err(LayoutRefusal::Reference);
                    }
                    seen.push(name.clone());
                }
                LayoutChild::Slot(placed) => {
                    // Below v3 a slot does not exist; accepting one would make this reader
                    // disagree with every other reader of the same document.
                    if !allow_slots {
                        return Err(LayoutRefusal::Version);
                    }
                    if !names.contains(&placed.reference)
                        || seen.iter().any(|existing| existing == &placed.reference)
                    {
                        return Err(LayoutRefusal::Reference);
                    }
                    if !valid_placement(placed.at.as_ref(), tracks) {
                        return Err(LayoutRefusal::Reference);
                    }
                    seen.push(placed.reference.clone());
                }
                LayoutChild::Node(nested) => {
                    layout_refs(nested, depth + 1, names, seen, allow_slots)?;
                    // A section's own `at` describes the column *this* node gives
                    // it, so it is checked here rather than inside its own walk.
                    if let LayoutNode::Section { at: Some(at), .. } = nested.as_ref() {
                        if !allow_slots {
                            return Err(LayoutRefusal::Version);
                        }
                        if !valid_placement(Some(at), tracks) {
                            return Err(LayoutRefusal::Shape);
                        }
                    }
                }
            }
        }
    }
    Ok(())
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

/// How deep a predicate tree may nest, mirroring `MDY_MAX_EXPRESSION_DEPTH`.
///
/// Well under serde_json's own recursion limit of 128, so a document nested past it is reported as
/// a diagnostic rather than failing to deserialize.
pub const EXPRESSION_MAX_DEPTH: usize = 32;

/// How long a `matches` pattern may be, in UTF-16 code units as the TS reader counts them,
/// mirroring `MDY_MAX_EXPRESSION_PATTERN_LENGTH`.
pub const EXPRESSION_PATTERN_MAX_LENGTH: usize = 256;

/// The members that make an object an operand of one kind.
const OPERAND_MARKERS: [&str; 4] = ["path", "self", "root", "context"];

/// Whether `value` is an expression: an object with an `op`, whatever the `op` holds.
fn is_expression(value: &Value) -> bool {
    value.as_object().is_some_and(|object| object.contains_key("op"))
}

/// The operands an expression object holds, and whether `operands` is present but not a list.
///
/// `operands` wins over `operand` when both are written, as it does in the TS reader.
fn operands_of(expression: &serde_json::Map<String, Value>) -> (Vec<&Value>, bool) {
    match expression.get("operands") {
        Some(Value::Array(list)) => (list.iter().collect(), false),
        Some(_) => (Vec::new(), true),
        None => (expression.get("operand").into_iter().collect(), false),
    }
}

/// The value of `marker` when `operand` is an object naming that marker and no other (ADR 0092).
fn names_one_thing<'a>(operand: &'a Value, marker: &str) -> Option<&'a Value> {
    let object = operand.as_object().filter(|object| !object.contains_key("op"))?;
    let held = object.get(marker)?;
    OPERAND_MARKERS
        .iter()
        .all(|each| *each == marker || !object.contains_key(*each))
        .then_some(held)
}

/// Whether `operand` reaches for more than one of the four things an operand can name.
fn claims_two_things(operand: &Value) -> bool {
    operand.as_object().is_some_and(|object| {
        !object.contains_key("op")
            && OPERAND_MARKERS.iter().filter(|marker| object.contains_key(**marker)).count() > 1
    })
}

fn path_ref(operand: &Value) -> Option<&str> {
    names_one_thing(operand, "path").and_then(Value::as_str)
}

fn context_ref(operand: &Value) -> Option<&str> {
    names_one_thing(operand, "context")
        .and_then(Value::as_str)
        .filter(|key| !key.is_empty())
}

fn is_flag_ref(operand: &Value, marker: &str) -> bool {
    names_one_thing(operand, marker) == Some(&Value::Bool(true))
}

/// A path a condition may read: the empty path (the value the clause is read against), or dotted
/// segments none of which is empty, a prototype key, whitespace-bearing or carrying the `__` id
/// delimiter — the TS reader's `isSafeFieldPath`.
fn readable_path(path: &str) -> bool {
    path.is_empty()
        || path.split('.').all(|segment| {
            !matches!(segment, "" | "__proto__" | "prototype" | "constructor")
                && !segment.contains(['\t', '\n', '\x0c', '\r', ' '])
                && !segment.contains("__")
        })
}

/// Length in UTF-16 code units, the unit every length cap in this contract is written in.
fn utf16_len(text: &str) -> usize {
    text.encode_utf16().count()
}

/// Why `expression` is not a usable expression; empty when it is.
///
/// Recursive, and bounded: past `EXPRESSION_MAX_DEPTH` the walk stops with a refusal, so a
/// document cannot choose how deep this goes.
fn expression_problems(expression: &Value, at: &str, depth: usize, out: &mut Vec<String>) {
    let Some(object) = expression.as_object().filter(|object| object.contains_key("op")) else {
        out.push(format!("{at}: expected an expression object with an \"op\""));
        return;
    };
    if depth > EXPRESSION_MAX_DEPTH {
        out.push(format!("{at}: nests deeper than {EXPRESSION_MAX_DEPTH} levels"));
        return;
    }
    let op = object.get("op").and_then(Value::as_str);
    if !op.is_some_and(|op| EXPRESSION_OPS.contains(&op)) {
        out.push(format!("{at}: unknown operator"));
    }
    let (operands, malformed) = operands_of(object);
    if malformed {
        out.push(format!("{at}: \"operands\" must be a list of operands"));
    } else if operands.is_empty() {
        out.push(format!("{at}: the expression has no operands"));
    }
    if op == Some("matches") {
        match operands.get(1).and_then(|pattern| pattern.as_str()) {
            None => out.push(format!("{at}: \"matches\" needs a literal string pattern")),
            Some(pattern) if utf16_len(pattern) > EXPRESSION_PATTERN_MAX_LENGTH => out.push(format!(
                "{at}: \"matches\" pattern is longer than {EXPRESSION_PATTERN_MAX_LENGTH} characters"
            )),
            Some(pattern) => {
                if !pattern_cost::compiles(pattern) {
                    out.push(format!("{at}: \"matches\" pattern is not a valid regular expression"));
                }
                if let Some(refusal) = pattern_cost::pattern_refusal(pattern) {
                    out.push(format!("{at}: \"matches\" pattern {refusal}"));
                }
            }
        }
    }
    for (index, operand) in operands.iter().enumerate() {
        let here = format!("{at}.operands[{index}]");
        if is_expression(operand) {
            expression_problems(operand, &here, depth + 1, out);
        } else if claims_two_things(operand) {
            out.push(format!(
                "{here}: an operand names one of {{path}}, {{self}}, {{root}}, {{context}}, and this one names more than one"
            ));
        } else if let Some(path) = path_ref(operand) {
            if !readable_path(path) {
                out.push(format!("{here}: \"{path}\" is not a field path"));
            }
        } else if is_flag_ref(operand, "self")
            || is_flag_ref(operand, "root")
            || context_ref(operand).is_some()
        {
        } else if operand.is_object() || operand.is_array() {
            // An object nobody declared is a reference that reads nothing, and a list is no operand
            // the contract has; both are the shapes a hand-written document gets wrong.
            out.push(format!(
                "{here}: an object operand must be {{path}}, {{self}}, {{root}}, {{context}} or a nested expression"
            ));
        }
    }
}

/// Every operand an expression reads that is not itself an expression, outermost first.
fn expression_leaves(expression: &Value) -> Vec<&Value> {
    let mut leaves = Vec::new();
    let mut pending: Vec<(&Value, usize)> = match expression.as_object() {
        Some(object) => operands_of(object).0.into_iter().map(|operand| (operand, 1)).collect(),
        None => Vec::new(),
    };
    while let Some((operand, depth)) = pending.pop() {
        if depth > EXPRESSION_MAX_DEPTH {
            continue;
        }
        match operand.as_object().filter(|object| object.contains_key("op")) {
            Some(object) => pending.extend(
                operands_of(object).0.into_iter().map(|nested| (nested, depth + 1)),
            ),
            None => leaves.push(operand),
        }
    }
    leaves
}

/// The field paths `expression` reads through `{path}`.
fn expression_paths(expression: &Value) -> Vec<&str> {
    expression_leaves(expression)
        .into_iter()
        .filter_map(path_ref)
        .filter(|path| readable_path(path))
        .collect()
}

/// The context keys `expression` reads through `{context}`.
fn expression_context_keys(expression: &Value) -> Vec<&str> {
    expression_leaves(expression).into_iter().filter_map(context_ref).collect()
}

/// Checks a condition written on a node and collects the context keys it reads.
///
/// An invalid clause is one diagnostic, and nothing further is read from it: what it references is
/// not a dependency anything will have. A valid one may read `{path}` only from what encloses it —
/// the enclosing group's children, or a row's own cells — and `{root}` is how it reaches the whole
/// form.
fn validate_clause(
    clause: &Expression,
    path: &str,
    scope: &HashSet<String>,
    out: &mut Vec<Diagnostic>,
    context_keys: &mut Vec<String>,
) {
    let clause = serde_json::to_value(clause).unwrap_or(Value::Null);
    let mut problems = Vec::new();
    expression_problems(&clause, path, 0, &mut problems);
    if !problems.is_empty() {
        out.push(Diagnostic {
            code: "MDY_DYNAMIC_INVALID_CONDITION",
            path: path.into(),
            message: problems.join("; "),
        });
        return;
    }
    let unreadable = expression_paths(&clause)
        .into_iter()
        .any(|read| !scope.contains(read.split('.').next().unwrap_or(read)));
    if unreadable {
        out.push(diag(
            "MDY_DYNAMIC_UNKNOWN_FIELD_REFERENCE",
            path,
            "condition reads a path nothing enclosing this clause declares; { \"root\": true } reaches the whole form",
        ));
    }
    context_keys.extend(expression_context_keys(&clause).into_iter().map(String::from));
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Rule {
    pub effect: String,
    pub target: String,
    pub when: Condition,
}

/// A cross-field check that produces an error message, mirroring `MdyDynamicValidation`.
///
/// The form is invalid while `when` holds; `message` is what the user is told, attached to `target`
/// when one is named and to the form otherwise.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Validation {
    pub when: Expression,
    pub message: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub target: Option<String>,
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

    /// Cross-field checks. Carried so a document read and written back here keeps them.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub validations: Vec<Validation>,

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
    "daterange",
    "timepicker",
    "file",
    "colors",
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

/// Why a field's members are refused for their JSON type, in the order and words of the TypeScript
/// reader, or `None` when each carries the type the contract gives it.
///
/// Judged on the document as written: deserialization reads an explicit `null` as an absent member,
/// so `integer: null` would be read as no rule where the contract refuses it. A present `null` is a
/// value of the wrong type. An array passes the validators object test, as it does in JavaScript.
fn member_type_refusal(field: &Value) -> Option<String> {
    let wrong = |key: &str, is: fn(&Value) -> bool| field.get(key).is_some_and(|v| !is(v));
    if wrong("label", Value::is_string) {
        return Some("label must be a string.".into());
    }
    if wrong("sensitive", Value::is_boolean) {
        return Some("sensitive must be a boolean.".into());
    }
    if wrong("placeholder", Value::is_string) {
        return Some("placeholder must be a string.".into());
    }
    let validators = field.get("validators")?;
    if !validators.is_object() && !validators.is_array() {
        return Some("validators must be an object.".into());
    }
    for key in ["required", "email", "integer"] {
        if validators.get(key).is_some_and(|v| !v.is_boolean()) {
            return Some(format!("validators.{key} must be a boolean."));
        }
    }
    for key in ["min", "max", "minLength", "maxLength"] {
        if validators.get(key).is_some_and(|v| !v.is_number()) {
            return Some(format!("validators.{key} must be a finite number."));
        }
    }
    let length = |key: &str| validators.get(key).and_then(Value::as_f64);
    if length("minLength").zip(length("maxLength")).is_some_and(|(min, max)| min > max) {
        return Some("validators.minLength cannot exceed validators.maxLength.".into());
    }
    None
}

/// Refuses every field whose members have the wrong JSON type, flat or in a tree, and removes the
/// members such a check reads from it.
///
/// The refused field is reported here; what remains of it is read only so that the rest of the
/// document can be deserialized and judged, which a member of the wrong type would otherwise make
/// impossible.
fn refuse_mistyped_members(document: &mut Value, d: &mut Vec<Diagnostic>) {
    let mut pending: Vec<(&mut Value, String)> = Vec::new();
    let mut nodes: Vec<(&mut Value, String)> = Vec::new();
    let Value::Object(members) = document else { return };
    for (key, value) in members.iter_mut() {
        match (key.as_str(), value) {
            ("fields", Value::Array(fields)) => pending
                .extend(fields.iter_mut().enumerate().map(|(i, f)| (f, format!("/fields/{i}")))),
            ("schema", schema) => nodes.push((schema, "/schema".to_string())),
            _ => {}
        }
    }
    while let Some((node, path)) = nodes.pop() {
        let Some(node) = node.as_object_mut() else { continue };
        match node.get("node").and_then(Value::as_str) {
            Some("field") => {
                if let Some(field) = node.get_mut("field") {
                    pending.push((field, format!("{path}/field")));
                }
            }
            Some("group") => {
                if let Some(Value::Object(children)) = node.get_mut("children") {
                    nodes.extend(children.iter_mut().map(|(name, child)| {
                        (child, format!("{path}/children/{}", pointer_segment(name)))
                    }));
                }
            }
            Some("array" | "record") => {
                if let Some(item) = node.get_mut("item") {
                    nodes.push((item, format!("{path}/item")));
                }
            }
            _ => {}
        }
    }
    for (field, path) in pending {
        if let Some(refusal) = member_type_refusal(field) {
            d.push(diag("MDY_DYNAMIC_INVALID_FIELD", &path, &refusal));
            if let Some(field) = field.as_object_mut() {
                for key in ["label", "sensitive", "placeholder", "validators"] {
                    field.remove(key);
                }
            }
        }
    }
}

pub fn parse_v2(json: &str, mode: ValidationMode) -> Result<ValidationResult, serde_json::Error> {
    let mut document: Value = serde_json::from_str(json)?;
    let mut d = Vec::new();
    refuse_mistyped_members(&mut document, &mut d);
    let form: DynamicFormV2 = serde_json::from_value(document)?;
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
        if let Some(pattern) = field.validators.as_ref().and_then(|v| v.pattern.as_ref()) {
            let at = format!("{path}/validators/pattern");
            if utf16_len(pattern) > 256 {
                d.push(diag("MDY_DYNAMIC_PATTERN_TOO_LONG", &at, "pattern exceeds 256 characters"));
            } else if let Some(refusal) = pattern_cost::pattern_refusal(pattern) {
                d.push(diag(
                    "MDY_DYNAMIC_PATTERN_TOO_COSTLY",
                    &at,
                    &format!("the pattern has {refusal}"),
                ));
            } else if !pattern_cost::compiles(pattern) {
                // A pattern that does not compile is a rule that never runs; the TS reader names no
                // code of its own for it, so it falls to the generic one.
                d.push(diag(
                    "MDY_DYNAMIC_INVALID_FIELD",
                    &at,
                    "pattern is not a regular expression this platform can compile, so the rule never runs",
                ));
            }
        }
    }
    let mut placed: Vec<String> = Vec::new();
    for (i, node) in form.layout.iter().enumerate() {
        let path = format!("/layout/{i}");
        // A section at the top of the layout sits in no column, so it has nothing to be placed in.
        if let LayoutNode::Section { at: Some(_), .. } = node {
            d.push(diag(
                "MDY_DYNAMIC_INVALID_LAYOUT",
                &path,
                "a section at the top of the layout occupies no column and cannot be placed",
            ));
            continue;
        }
        let mut refs: Vec<String> = placed.clone();
        match layout_refs(node, 1, &names, &mut refs, form.version >= 3) {
            Ok(()) => placed = refs,
            Err(refusal) => d.push(refusal.diagnostic(&path)),
        }
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
            continue;
        }
        let kind = form
            .fields
            .iter()
            .find(|field| field.name == rule.when.field)
            .map(|field| field.kind.as_str());
        if let Some(refusal) = rule_value_refusal(&rule.when.operator, rule.when.value.as_ref(), kind) {
            d.push(diag(
                "MDY_DYNAMIC_INVALID_RULE",
                &format!("/rules/{i}/when/value"),
                refusal,
            ));
        }
    }
    for (i, validation) in form.validations.iter().enumerate() {
        let at = format!("/validations/{i}");
        if validation.message.trim().is_empty() {
            d.push(diag(
                "MDY_DYNAMIC_INVALID_VALIDATION",
                &at,
                "validation needs a non-empty message",
            ));
            continue;
        }
        // A target names a field, as a rule's does: an unknown one attaches the error to nothing.
        if validation
            .target
            .as_deref()
            .is_some_and(|target| !validation_path(target, &names))
        {
            d.push(diag(
                "MDY_DYNAMIC_UNKNOWN_FIELD_REFERENCE",
                &at,
                "validation target references an unknown field",
            ));
            continue;
        }
        let when = serde_json::to_value(&validation.when).unwrap_or(Value::Null);
        let mut problems = Vec::new();
        expression_problems(&when, &format!("{at}.when"), 0, &mut problems);
        if !problems.is_empty() {
            d.push(Diagnostic {
                code: "MDY_DYNAMIC_INVALID_VALIDATION",
                path: at,
                message: problems.join("; "),
            });
            continue;
        }
        // A condition about a field the form does not have can never be satisfied. The empty path
        // is refused here too: `{ "root": true }` is the operand that reads the whole form.
        if expression_paths(&when)
            .into_iter()
            .any(|read| !validation_path(read, &names))
        {
            d.push(diag(
                "MDY_DYNAMIC_UNKNOWN_FIELD_REFERENCE",
                &at,
                "validation condition references an unknown field",
            ));
        }
    }
    let mut context_keys: Vec<String> = Vec::new();
    if let Some(schema) = &form.schema {
        validate_node(schema, "/schema", &mut d, &mut context_keys);
    }
    // A rule the document's version predates: `integer` arrived with v5, and a v2 document carrying
    // it asks for a constraint no reader of that version emits.
    if form.version < 5 {
        // The first entry claims a name and a later one is the refused duplicate, so only the first
        // is a field this document has.
        let mut claimed = HashSet::new();
        let flat = form
            .fields
            .iter()
            .enumerate()
            .filter(|(_, field)| claimed.insert(field.name.as_str()))
            .map(|(i, field)| (field, format!("/fields/{i}")));
        let mut leaves = Vec::new();
        if let Some(schema) = &form.schema {
            collect_fields(schema, "/schema", &mut leaves);
        }
        for (field, path) in flat.chain(leaves) {
            if field.validators.as_ref().is_some_and(|v| v.integer.is_some()) {
                d.push(diag(
                    "MDY_DYNAMIC_UNSUPPORTED_VERSION",
                    &format!("{path}/validators/integer"),
                    "integer arrived with version 5",
                ));
            }
        }
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
    // Each node travels with the names a clause written on it may read: the enclosing group's
    // children. The root and a collection's row start from nothing.
    let mut pending: Vec<(&DynamicNode, String, HashSet<String>)> =
        vec![(node, path.to_string(), HashSet::new())];

    while let Some((node, path, scope)) = pending.pop() {
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
                validate_clause(clause, &format!("{path}/{member}"), &scope, out, context_keys);
            }
        }
        match node {
            DynamicNode::Field { field, .. } => {
                if !KINDS.contains(&field.kind.as_str()) {
                    out.push(diag("MDY_DYNAMIC_UNKNOWN_KIND", &path, "unknown field kind"));
                }
            }
            DynamicNode::Group { children, .. } => {
                let here: HashSet<String> = children.keys().cloned().collect();
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
                        pending.push((child, format!("{path}/children/{}", pointer_segment(name)), here.clone()));
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
                pending.push((item, format!("{path}/item"), HashSet::new()));
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
                pending.push((item, format!("{path}/item"), HashSet::new()));
            }
        }
    }
}

/// A key as one segment of a diagnostic path, escaped as RFC 6901 escapes a JSON Pointer token.
///
/// "/" and "~" are legal in a name, so a key written raw splits into segments that address
/// something else: child `a/b` would read as child `a`, then `b`. `~` is escaped first, or the `~1`
/// written for a "/" would itself be rewritten.
fn pointer_segment(key: &str) -> String {
    key.replace('~', "~0").replace('/', "~1")
}

/// Every field a schema declares, with the path of its declaration, over an explicit stack for the reason
/// `validate_node` gives.
fn collect_fields<'a>(node: &'a DynamicNode, path: &str, out: &mut Vec<(&'a Field, String)>) {
    let mut pending: Vec<(&DynamicNode, String)> = vec![(node, path.to_string())];
    while let Some((node, path)) = pending.pop() {
        match node {
            DynamicNode::Field { field, .. } => out.push((field, format!("{path}/field"))),
            DynamicNode::Group { children, .. } => pending.extend(
                children
                    .iter()
                    .map(|(name, child)| (child, format!("{path}/children/{}", pointer_segment(name)))),
            ),
            DynamicNode::Array { item, .. } | DynamicNode::Record { item, .. } => {
                pending.push((item, format!("{path}/item")))
            }
        }
    }
}

/// Why a rule's `value` cannot be read by its operator, or `None` when it can.
///
/// A unary operator reads no value, so one written beside it is ignored. Membership needs a list;
/// ordering needs a number or a string, and on a date kind the string must be a full ISO date,
/// because dates are compared as text and only one shape of text sorts as a date.
fn rule_value_refusal(operator: &str, value: Option<&Value>, kind: Option<&str>) -> Option<&'static str> {
    match operator {
        "in" | "notIn" if !value.is_some_and(Value::is_array) => {
            Some("membership operators test a list, and \"value\" is not one")
        }
        "greaterThan" | "greaterThanOrEqual" | "lessThan" | "lessThanOrEqual" => match value {
            Some(Value::Number(_)) => None,
            Some(Value::String(text)) => (matches!(kind, Some("datepicker" | "daterange"))
                && !is_iso_date(text))
            .then_some("ordering a date kind compares text, so \"value\" must be a full ISO date (yyyy-MM-dd)"),
            _ => Some("ordering operators compare two numbers or two strings, and \"value\" is neither"),
        },
        _ => None,
    }
}

/// `yyyy-MM-dd` naming a day the calendar has.
fn is_iso_date(text: &str) -> bool {
    let bytes = text.as_bytes();
    if bytes.len() != 10
        || bytes[4] != b'-'
        || bytes[7] != b'-'
        || !bytes
            .iter()
            .enumerate()
            .all(|(i, b)| i == 4 || i == 7 || b.is_ascii_digit())
    {
        return false;
    }
    let number = |range: std::ops::Range<usize>| text[range].parse::<u32>().unwrap_or(0);
    let (year, month, day) = (number(0..4), number(5..7), number(8..10));
    let leap = (year % 4 == 0 && year % 100 != 0) || year % 400 == 0;
    let days = match month {
        1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
        4 | 6 | 9 | 11 => 30,
        2 if leap => 29,
        2 => 28,
        _ => return false,
    };
    (1..=days).contains(&day)
}

/// A path a validation may name: a declared field, or a container something declared lives under.
fn validation_path(path: &str, names: &HashSet<String>) -> bool {
    if path.is_empty() {
        return false;
    }
    if names.contains(path) {
        return true;
    }
    let prefix = format!("{path}.");
    names.iter().any(|name| name.starts_with(&prefix))
}

fn diag(code: &'static str, path: &str, message: &str) -> Diagnostic {
    Diagnostic {
        code,
        path: path.into(),
        message: message.into(),
    }
}
