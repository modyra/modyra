use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::{BTreeMap, HashMap, HashSet};

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
    value
        .as_object()
        .is_some_and(|object| object.contains_key("op"))
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
    let object = operand
        .as_object()
        .filter(|object| !object.contains_key("op"))?;
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
            && OPERAND_MARKERS
                .iter()
                .filter(|marker| object.contains_key(**marker))
                .count()
                > 1
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
    let Some(object) = expression
        .as_object()
        .filter(|object| object.contains_key("op"))
    else {
        out.push(format!(
            "{at}: expected an expression object with an \"op\""
        ));
        return;
    };
    if depth > EXPRESSION_MAX_DEPTH {
        out.push(format!(
            "{at}: nests deeper than {EXPRESSION_MAX_DEPTH} levels"
        ));
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
        Some(object) => operands_of(object)
            .0
            .into_iter()
            .map(|operand| (operand, 1))
            .collect(),
        None => Vec::new(),
    };
    while let Some((operand, depth)) = pending.pop() {
        if depth > EXPRESSION_MAX_DEPTH {
            continue;
        }
        match operand
            .as_object()
            .filter(|object| object.contains_key("op"))
        {
            Some(object) => pending.extend(
                operands_of(object)
                    .0
                    .into_iter()
                    .map(|nested| (nested, depth + 1)),
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
    expression_leaves(expression)
        .into_iter()
        .filter_map(context_ref)
        .collect()
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
    context_keys.extend(
        expression_context_keys(&clause)
            .into_iter()
            .map(String::from),
    );
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
/// value of the wrong type. An array is not a validators object.
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
    if !validators.is_object() {
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
    if length("minLength")
        .zip(length("maxLength"))
        .is_some_and(|(min, max)| min > max)
    {
        return Some("validators.minLength cannot exceed validators.maxLength.".into());
    }
    None
}

/// Whether `name` is refused as a field name or a group child key: empty, reserved, or dotted.
fn is_unsafe_name(name: &str) -> bool {
    name.is_empty()
        || name.contains('.')
        || matches!(name, "__proto__" | "prototype" | "constructor")
}

/// Whether `name` holds a character ECMAScript's `\s` matches, which no field name or group child
/// key may: a widget id is built from the name and reaches `aria-describedby`, a space-separated
/// list of ids, where whitespace splits one reference into several that resolve to nothing.
/// `char::is_whitespace` is Unicode `White_Space`, which counts U+0085 and not U+FEFF; `\s` is the
/// other way round, and the TypeScript reader decides with `\s`.
fn has_js_whitespace(name: &str) -> bool {
    name.chars()
        .any(|c| (c.is_whitespace() && c != '\u{85}') || c == '\u{feff}')
}

/// Whether `name` holds a character that cannot be seen: a control character, a zero-width one, a
/// bidirectional override or isolate, or U+FEFF. Two names that differ only by one of these read the
/// same and are two different fields, so the duplicate check would not see the collision. The class
/// is the one the value sanitizer strips.
fn has_invisible_character(name: &str) -> bool {
    name.chars().any(|c| {
        matches!(c,
            '\u{0}'..='\u{8}'
            | '\u{b}'
            | '\u{c}'
            | '\u{e}'..='\u{1f}'
            | '\u{7f}'..='\u{9f}'
            | '\u{200b}'..='\u{200d}'
            | '\u{2028}'..='\u{202e}'
            | '\u{2066}'..='\u{2069}'
            | '\u{feff}')
    })
}

/// The longest path a field may have, in UTF-16 code units as JavaScript measures a string's
/// length. A path is the payload key, the draft key and the widget id, and every read of the value
/// carries it.
const MAX_PATH_LENGTH: usize = 512;

/// Whether `name` is longer than [`MAX_PATH_LENGTH`].
fn is_too_long_for_a_path(name: &str) -> bool {
    name.encode_utf16().count() > MAX_PATH_LENGTH
}

/// Whether a dotted part of `name` is `toString`. A form's value is an object, and a field so named
/// shadows the method every string conversion of that value goes through, so `${value}` throws.
fn breaks_value_conversion(name: &str) -> bool {
    name.split('.').any(|part| part == "toString")
}

/// The separator between the segments of a generated widget id: a name holding it would collide
/// with another field's parts.
const ID_DELIMITER: &str = "__";

/// Whether `name` is refused as a group child key: unsafe, or carrying whitespace, a character that
/// cannot be seen, the id delimiter, or a `toString` part.
fn is_unsafe_child_name(name: &str) -> bool {
    is_unsafe_name(name)
        || breaks_value_conversion(name)
        || name.contains(ID_DELIMITER)
        || has_js_whitespace(name)
        || has_invisible_character(name)
}

/// Whether a field is refused for its name or kind, which the TypeScript reader judges before its
/// members: such a field carries one diagnostic for that, and none for its members.
fn is_dropped_before_members(field: &Value, names: Option<&mut HashSet<String>>) -> bool {
    let kind = field.get("kind").and_then(Value::as_str);
    let named_badly = names.is_some_and(|names| match field.get("name").and_then(Value::as_str) {
        Some(name) => {
            is_unsafe_name(name)
                || has_invisible_character(name)
                || is_too_long_for_a_path(name)
                || breaks_value_conversion(name)
                || name.contains(ID_DELIMITER)
                || has_js_whitespace(name)
                || !names.insert(name.to_string())
        }
        None => true,
    });
    named_badly || !kind.is_some_and(|kind| KINDS.contains(&kind))
}

/// The members a field declares, whatever its kind, mirroring `MDY_DYNAMIC_MEMBERS.field`.
const FIELD_MEMBERS: &[&str] = &[
    "name",
    "kind",
    "label",
    "ariaLabel",
    "placeholder",
    "supportingText",
    "initialValue",
    "validators",
    "sensitive",
    "prefix",
    "suffix",
    "min",
    "max",
    "step",
    "options",
    "mode",
    "searchable",
    "reorderable",
    "loading",
    "locale",
    "firstDayOfWeek",
    "minDate",
    "maxDate",
    "format",
    "viewMode",
    "granularity",
    "animateHand",
    "showUnavailable",
    "accept",
    "multiple",
    "presets",
];

/// The members a field's validators declare, mirroring `MDY_DYNAMIC_MEMBERS.validators`.
const VALIDATOR_MEMBERS: &[&str] = &[
    "required",
    "email",
    "integer",
    "min",
    "max",
    "minLength",
    "maxLength",
    "pattern",
    "messages",
];

/// The members an option declares, mirroring `MDY_DYNAMIC_MEMBERS.option`.
const OPTION_MEMBERS: &[&str] = &["value", "label", "disabled"];

/// What a field of each kind holds, mirroring `MDY_VALUE_CONTRACTS`: the shape of its value, and
/// whether `null` is one of its values.
fn value_contract(kind: &str) -> Option<(&'static str, bool)> {
    Some(match kind {
        "text" | "textarea" | "email" | "password" | "colors" => ("string", false),
        "number" => ("number", true),
        "slider" => ("number", false),
        "checkbox" | "toggle" => ("boolean", false),
        "select" | "radio" | "segmented" => ("option", true),
        "multiselect" => ("option[]", false),
        "datepicker" | "timepicker" => ("string", true),
        "daterange" => ("dateRange", false),
        "file" => ("file[]", false),
        _ => return None,
    })
}

/// Why `value` does not belong in a field of `kind`, or `None` when it does — the TypeScript
/// reader's `explainValueMismatch`.
///
/// An option's value is anything but `null`: which values are offered is the option list's word. A
/// string with a form — a date, a time, a colour, a range's endpoints — is held to that form, and
/// the empty string is how such a value writes absence, so it is accepted for every one of them.
fn value_mismatch(kind: &str, value: &Value) -> Option<String> {
    let (shape, nullable) = value_contract(kind)?;
    if value.is_null() {
        return (!nullable).then(|| format!("{kind} cannot hold null"));
    }
    let fits = match shape {
        "string" => value.is_string(),
        "number" => value.is_number(),
        "boolean" => value.is_boolean(),
        "option" => true,
        "dateRange" => value
            .as_object()
            .is_some_and(|range| range.contains_key("start") && range.contains_key("end")),
        _ => value.is_array(),
    };
    if !fits {
        return Some(format!("{kind} holds {shape}, got {}", json_type(value)));
    }
    let text = value.as_str();
    if text == Some("") {
        return None;
    }
    let form = match kind {
        "datepicker" => "an ISO date (yyyy-MM-dd)",
        "timepicker" => "a time (HH:mm)",
        "colors" => "a hex colour (#rgb or #rrggbb)",
        "daterange" => {
            return ["start", "end"].into_iter().find_map(|end| {
                let held = &value[end];
                (!held.is_null() && !held.as_str().is_some_and(is_iso_date))
                    .then(|| format!("{kind} holds ISO dates, and {end} is {held}"))
            })
        }
        _ => return None,
    };
    let text = text.unwrap_or_default();
    let held = match kind {
        "datepicker" => is_iso_date(text),
        "timepicker" => is_clock_time(text),
        _ => is_hex_colour(text),
    };
    (!held).then(|| format!("{kind} holds {form}, got {value}"))
}

/// The JSON type of `value` as JavaScript's `typeof` names it, which is how a mismatch is worded.
fn json_type(value: &Value) -> String {
    match value {
        Value::Object(_) | Value::Array(_) => value.to_string(),
        Value::String(_) => "string".into(),
        Value::Number(_) => "number".into(),
        Value::Bool(_) => "boolean".into(),
        Value::Null => "null".into(),
    }
}

/// `HH:mm` on a 24-hour clock.
fn is_clock_time(text: &str) -> bool {
    let bytes = text.as_bytes();
    bytes.len() == 5
        && bytes[2] == b':'
        && matches!(
            (bytes[0], bytes[1]),
            (b'0' | b'1', b'0'..=b'9') | (b'2', b'0'..=b'3')
        )
        && matches!((bytes[3], bytes[4]), (b'0'..=b'5', b'0'..=b'9'))
}

/// `#rgb` or `#rrggbb`, in either case.
fn is_hex_colour(text: &str) -> bool {
    text.strip_prefix('#').is_some_and(|digits| {
        matches!(digits.len(), 3 | 6) && digits.bytes().all(|b| b.is_ascii_hexdigit())
    })
}

/// Why a number or slider field's range cannot be drawn, or `None` when it can.
///
/// A bound or a step is a number, the lower bound is not above the upper, and a step moves the
/// value. Other kinds have no range, so their `min`, `max` and `step` are not read.
fn range_refusal(field: &Value, kind: &str) -> Option<&'static str> {
    if !matches!(kind, "number" | "slider") {
        return None;
    }
    let member = |key: &str| field.get(key).map(Value::as_f64);
    let (min, max, step) = (member("min"), member("max"), member("step"));
    if min == Some(None) {
        return Some("min must be a finite number.");
    }
    if max == Some(None) {
        return Some("max must be a finite number.");
    }
    if min
        .flatten()
        .zip(max.flatten())
        .is_some_and(|(min, max)| min > max)
    {
        return Some("min cannot exceed max.");
    }
    match step {
        Some(None) => Some("step must be a finite number."),
        Some(Some(step)) if step <= 0.0 => Some("step must be greater than zero."),
        _ => None,
    }
}

/// Why a date or time field's calendar cannot be drawn, or `None` when it can.
///
/// A locale is a tag the platform's `Intl` would take, because a malformed one throws when the
/// calendar is drawn rather than degrading; the first day of the week is a weekday's index; the
/// bounds are ISO dates, the earlier one first.
fn calendar_refusal(field: &Value, kind: &str) -> Option<&'static str> {
    if !matches!(kind, "datepicker" | "timepicker" | "daterange") {
        return None;
    }
    if field
        .get("locale")
        .is_some_and(|locale| !locale.as_str().is_some_and(is_language_tag))
    {
        return Some("locale must be a valid BCP 47 tag, e.g. \"it-IT\".");
    }
    if field.get("firstDayOfWeek").is_some_and(|day| {
        !day.as_f64()
            .is_some_and(|day| day.fract() == 0.0 && (0.0..=6.0).contains(&day))
    }) {
        return Some("firstDayOfWeek must be an integer from 0 (Sunday) to 6.");
    }
    let bound = |key: &str| {
        field
            .get(key)
            .map(|date| date.as_str().filter(|date| is_iso_date(date)))
    };
    let (min, max) = (bound("minDate"), bound("maxDate"));
    if min == Some(None) {
        return Some("minDate must be an ISO date, e.g. \"2026-08-02\".");
    }
    if max == Some(None) {
        return Some("maxDate must be an ISO date, e.g. \"2026-08-02\".");
    }
    if min
        .flatten()
        .zip(max.flatten())
        .is_some_and(|(min, max)| min > max)
    {
        return Some("minDate cannot be later than maxDate.");
    }
    None
}

/// Whether `tag` is a locale `Intl.getCanonicalLocales` accepts: a structurally valid Unicode BCP 47
/// locale identifier, as ECMA-402 defines one.
///
/// A language subtag first, then an optional script, region and variants; then extensions, each a
/// singleton not repeated, and a private use part last. Subtags are ASCII letters and digits joined
/// by `-` and compared without case. Whether a subtag is registered is not asked, as `Intl` does not
/// ask it.
fn is_language_tag(tag: &str) -> bool {
    let lower = tag.to_ascii_lowercase();
    let mut rest = Subtags(lower.split('-').collect(), 0);
    if !rest.take_if(is_language_subtag) || !language_tail(&mut rest) {
        return false;
    }
    let mut singletons = HashSet::new();
    while let Some(singleton) = rest.next() {
        let one = singleton.len() == 1 && alphanumeric(singleton, 1, 1);
        if !one || !singletons.insert(singleton) {
            return false;
        }
        let well_formed = match singleton {
            "x" => return rest.count_while(|part| alphanumeric(part, 1, 8)) > 0 && rest.done(),
            "u" => unicode_extension(&mut rest),
            "t" => transformed_extension(&mut rest),
            _ => rest.count_while(|part| alphanumeric(part, 2, 8)) > 0,
        };
        if !well_formed {
            return false;
        }
    }
    true
}

/// The subtags of a locale, and how many have been read.
struct Subtags<'a>(Vec<&'a str>, usize);

impl<'a> Subtags<'a> {
    fn next(&mut self) -> Option<&'a str> {
        let part = self.0.get(self.1).copied();
        self.1 += usize::from(part.is_some());
        part
    }

    /// Reads the next subtag when it is one `is` accepts.
    fn take_if(&mut self, is: impl Fn(&str) -> bool) -> bool {
        let taken = self.0.get(self.1).is_some_and(|part| is(part));
        self.1 += usize::from(taken);
        taken
    }

    fn count_while(&mut self, is: impl Fn(&str) -> bool) -> usize {
        let mut count = 0;
        while self.take_if(&is) {
            count += 1;
        }
        count
    }

    fn done(&self) -> bool {
        self.1 == self.0.len()
    }
}

/// Between `min` and `max` ASCII letters and digits.
fn alphanumeric(part: &str, min: usize, max: usize) -> bool {
    (min..=max).contains(&part.len()) && part.bytes().all(|b| b.is_ascii_alphanumeric())
}

/// Between `min` and `max` ASCII letters.
fn alphabetic(part: &str, min: usize, max: usize) -> bool {
    (min..=max).contains(&part.len()) && part.bytes().all(|b| b.is_ascii_alphabetic())
}

fn is_language_subtag(part: &str) -> bool {
    alphabetic(part, 2, 3) || alphabetic(part, 5, 8)
}

/// The script, region and variants after a language subtag, with no variant repeated.
fn language_tail(rest: &mut Subtags) -> bool {
    rest.take_if(|part| alphabetic(part, 4, 4));
    rest.take_if(|part| {
        alphabetic(part, 2, 2) || (part.len() == 3 && part.bytes().all(|b| b.is_ascii_digit()))
    });
    let mut variants = HashSet::new();
    let is_variant = |part: &str| {
        alphanumeric(part, 5, 8)
            || (alphanumeric(part, 4, 4) && part.as_bytes()[0].is_ascii_digit())
    };
    while let Some(variant) = rest.0.get(rest.1).copied().filter(|part| is_variant(part)) {
        rest.1 += 1;
        if !variants.insert(variant) {
            return false;
        }
    }
    true
}

/// `-u-`: attributes, then keywords — a key of a letter or digit and a letter, and its type.
fn unicode_extension(rest: &mut Subtags) -> bool {
    let is_key = |part: &str| alphanumeric(part, 2, 2) && part.as_bytes()[1].is_ascii_alphabetic();
    let mut count = rest.count_while(|part| alphanumeric(part, 3, 8));
    while rest.take_if(is_key) {
        count += 1;
        rest.count_while(|part| alphanumeric(part, 3, 8));
    }
    count > 0
}

/// `-t-`: an optional source language, then fields — a letter and a digit, and their values.
fn transformed_extension(rest: &mut Subtags) -> bool {
    let is_key = |part: &str| {
        let bytes = part.as_bytes();
        bytes.len() == 2 && bytes[0].is_ascii_alphabetic() && bytes[1].is_ascii_digit()
    };
    let mut count = 0;
    if rest.take_if(is_language_subtag) {
        if !language_tail(rest) {
            return false;
        }
        count += 1;
    }
    while rest.take_if(is_key) {
        if rest.count_while(|part| alphanumeric(part, 3, 8)) == 0 {
            return false;
        }
        count += 1;
    }
    count > 0
}

/// A finding about a field as written: its code, the member it points into (empty for the field
/// itself), and what it says.
type FieldFinding = (&'static str, String, String);

/// Judges a field as written, in the order the TypeScript reader judges it, and says whether the
/// field is refused.
///
/// The first refusal ends the judgement, so a refused field carries one reason; a finding that does
/// not refuse the field is collected on the way.
fn field_findings(field: &Value, out: &mut Vec<FieldFinding>) -> bool {
    fn refuse(out: &mut Vec<FieldFinding>, message: String) -> bool {
        out.push(("MDY_DYNAMIC_INVALID_FIELD", String::new(), message));
        true
    }
    if let Some(refusal) = member_type_refusal(field) {
        return refuse(out, refusal);
    }
    // A member nobody declared is reported and the field kept: a document may be written against a
    // contract this reader predates.
    let options = field.get("options").and_then(Value::as_array);
    for (owner, member, declared) in [(Some(field), String::new(), FIELD_MEMBERS)]
        .into_iter()
        .chain([(field.get("validators"), String::new(), VALIDATOR_MEMBERS)])
        .chain(
            options
                .into_iter()
                .flatten()
                .enumerate()
                .map(|(i, option)| (Some(option), format!("/options/{i}"), OPTION_MEMBERS)),
        )
    {
        let unknown: Vec<String> = owner
            .and_then(Value::as_object)
            .into_iter()
            .flat_map(|object| object.keys())
            .filter(|key| !declared.contains(&key.as_str()))
            .map(|key| Value::from(key.as_str()).to_string())
            .collect();
        if !unknown.is_empty() {
            out.push((
                "MDY_DYNAMIC_UNKNOWN_MEMBER",
                member,
                format!(
                    "carries {}, which this contract does not declare, so nothing reads it.",
                    unknown.join(", ")
                ),
            ));
        }
    }
    let kind = field
        .get("kind")
        .and_then(Value::as_str)
        .unwrap_or_default();
    if let Some(refusal) = range_refusal(field, kind) {
        return refuse(out, refusal.into());
    }
    if let Some(refusal) = calendar_refusal(field, kind) {
        return refuse(out, refusal.into());
    }
    if let Some(mismatch) = field
        .get("initialValue")
        .and_then(|value| value_mismatch(kind, value))
    {
        return refuse(
            out,
            format!("initialValue does not match the kind — {mismatch}."),
        );
    }
    // A rule written one level too high: the contract's own name for a rule, on the field, where
    // nothing reads it, so the field has no such rule while its author believes it has. `min` and
    // `max` are not among them, being a number field's range.
    for misplaced in ["required", "email", "minLength", "maxLength", "pattern"] {
        if field.get(misplaced).is_some() {
            out.push((
                "MDY_DYNAMIC_MISPLACED_VALIDATOR",
                String::new(),
                format!(
                    "\"{misplaced}\" belongs in \"validators\"; nothing reads it on the field."
                ),
            ));
        }
    }
    if matches!(kind, "select" | "radio" | "multiselect" | "segmented") {
        let Some(options) = field
            .get("options")
            .filter(|options| has_valid_options(options))
        else {
            out.push((
                "MDY_DYNAMIC_OPTIONS_REQUIRED",
                String::new(),
                format!("kind \"{kind}\" requires a valid options array."),
            ));
            return true;
        };
        for key in repeated_option_values(options) {
            out.push((
                "MDY_DYNAMIC_DUPLICATE_OPTION",
                String::new(),
                format!("duplicate option value {key}: an option's value is its identity."),
            ));
        }
    }
    false
}

/// Whether `options` is a list of options as the contract writes one: each an object with a `value`
/// that is neither `null` — the empty value of half the kinds — nor a list, a string `label`, and a
/// `disabled` that is a boolean when present.
fn has_valid_options(options: &Value) -> bool {
    options.as_array().is_some_and(|options| {
        options.iter().all(|option| {
            option
                .get("value")
                .is_some_and(|value| !value.is_null() && !value.is_array())
                && option.get("label").is_some_and(Value::is_string)
                && option.get("disabled").is_none_or(Value::is_boolean)
        })
    })
}

/// The comparable spelling of each option value written after an earlier option with the same
/// value, in order; an option's value is its identity, so the later of two is unreachable.
fn repeated_option_values(options: &Value) -> Vec<String> {
    let mut seen = HashSet::new();
    options
        .as_array()
        .into_iter()
        .flatten()
        .map(|option| option_value_key(&option["value"]))
        .filter(|key| !seen.insert(key.clone()))
        .collect()
}

/// A comparable spelling of an option's value, the TypeScript reader's `optionValueKey`.
///
/// Two objects declaring the same members are the same value however they were written, so an
/// object's members are spelled in key order. A number is spelled by the double it reads as, so
/// `1` and `1.0` are one value as they are in JavaScript, and `-0` is `0`. A list inside an object
/// is spelled as JavaScript enumerates it, as an object keyed by index.
fn option_value_key(value: &Value) -> String {
    let mut members: Vec<(String, &Value)> = match value {
        Value::Object(object) => object
            .iter()
            .map(|(key, held)| (key.clone(), held))
            .collect(),
        Value::Array(list) => list
            .iter()
            .enumerate()
            .map(|(i, held)| (i.to_string(), held))
            .collect(),
        Value::Number(number) => {
            let number = number.as_f64().unwrap_or_default();
            return format!("{:?}", if number == 0.0 { 0.0 } else { number });
        }
        _ => return value.to_string(),
    };
    members.sort_by(|(left, _), (right, _)| left.cmp(right));
    let spelled: Vec<String> = members
        .into_iter()
        .map(|(key, held)| format!("{}:{}", Value::from(key), option_value_key(held)))
        .collect();
    format!("{{{}}}", spelled.join(","))
}

/// Reports what `field_findings` finds at `at`, and removes from the field what deserialization
/// cannot read.
///
/// A field in a tree takes every finding at the field itself, as the TypeScript reader reports a
/// leaf; there, a declared initial value its kind cannot hold is also a finding about the document's
/// shape, at the member.
fn judge_field(field: &mut Value, at: Option<&str>, in_tree: bool, d: &mut Vec<Diagnostic>) {
    let mut found = Vec::new();
    let refused = field_findings(field, &mut found);
    if let Some(at) = at {
        let kind = field
            .get("kind")
            .and_then(Value::as_str)
            .unwrap_or_default();
        if let Some(mismatch) = field
            .get("initialValue")
            .filter(|_| in_tree)
            .and_then(|value| value_mismatch(kind, value))
        {
            d.push(diag(
                "MDY_DYNAMIC_INVALID_FIELD",
                &format!("{at}/initialValue"),
                &format!("initialValue does not match the kind — {mismatch}."),
            ));
        }
        for (code, member, message) in found {
            let member = if in_tree { "" } else { member.as_str() };
            d.push(diag(code, &format!("{at}{member}"), &message));
        }
    }
    let Some(field) = field.as_object_mut() else {
        return;
    };
    if refused {
        for key in [
            "label",
            "sensitive",
            "placeholder",
            "validators",
            "min",
            "max",
            "step",
            "options",
        ] {
            field.remove(key);
        }
    }
    // A kind with no options does not read them, so a list that is not one is not carried either.
    if field
        .get("options")
        .is_some_and(|options| !has_valid_options(options))
    {
        field.remove("options");
    }
    // The later of two options with one value is unreachable, so it is not carried.
    if let Some(Value::Array(options)) = field.get_mut("options") {
        let mut seen = HashSet::new();
        options.retain(|option| seen.insert(option_value_key(&option["value"])));
    }
    // A kind with no range does not read these, so one that is not a number is no finding and is
    // not carried either.
    field.retain(|key, value| !matches!(key.as_str(), "min" | "max" | "step") || value.is_number());
}

/// Judges every field as written, flat or in a tree, before anything is deserialized.
///
/// A refused field is reported here; what remains of it is read only so that the rest of the
/// document can be deserialized and judged, which a member of the wrong type would otherwise make
/// impossible. A field already refused for its name or kind, or under a child key the tree walk
/// does not enter, has its members removed the same way but is not reported again: its path is
/// `None`.
fn judge_fields_as_written(document: &mut Value, d: &mut Vec<Diagnostic>) {
    let mut pending: Vec<(&mut Value, Option<String>, bool)> = Vec::new();
    let mut nodes: Vec<(&mut Value, Option<String>)> = Vec::new();
    let Value::Object(members) = document else {
        return;
    };
    for (key, value) in members.iter_mut() {
        match (key.as_str(), value) {
            ("fields", Value::Array(fields)) => {
                let mut names = HashSet::new();
                for (i, field) in fields.iter_mut().enumerate() {
                    let path = (!is_dropped_before_members(field, Some(&mut names)))
                        .then(|| format!("/fields/{i}"));
                    pending.push((field, path, false));
                }
            }
            ("schema", schema) => nodes.push((schema, Some("/schema".to_string()))),
            _ => {}
        }
    }
    while let Some((node, path)) = nodes.pop() {
        let Some(node) = node.as_object_mut() else {
            continue;
        };
        match node.get("node").and_then(Value::as_str) {
            Some("field") => {
                if let Some(field) = node.get_mut("field") {
                    let path = path
                        .filter(|_| !is_dropped_before_members(field, None))
                        .map(|path| format!("{path}/field"));
                    pending.push((field, path, true));
                }
            }
            Some("group") => {
                if let Some(Value::Object(children)) = node.get_mut("children") {
                    nodes.extend(children.iter_mut().map(|(name, child)| {
                        let path = path.as_ref().filter(|_| !is_unsafe_child_name(name));
                        let path =
                            path.map(|path| format!("{path}/children/{}", pointer_segment(name)));
                        (child, path)
                    }));
                }
            }
            Some("array" | "record") => {
                if let Some(item) = node.get_mut("item") {
                    nodes.push((item, path.map(|path| format!("{path}/item"))));
                }
            }
            _ => {}
        }
    }
    for (field, path, in_tree) in pending {
        judge_field(field, path.as_deref(), in_tree, d);
    }
}

/// The member of the object that stands for a number past the double range.
const NON_FINITE_NUMBER: &str = "nonFiniteNumber";

/// Reads `json` as a document, where a number past the double range is a value and not an error.
///
/// JSON has no bound on a number's size, and a reader on doubles reads `1e400` as infinity; that is
/// a value the document holds, and it is refused where a finite number is asked for — a field's
/// range, a validator's bound — rather than making the whole document unreadable. serde_json refuses
/// such a number outright, so when it does, each one is rewritten as the object
/// `{"nonFiniteNumber": "<literal>"}` and the document read again. No check accepts that object as a
/// number, and wherever any value is accepted it is carried as written. Any other error, or one the
/// rewrite does not cure, is the reader's error as before.
fn read_document(json: &str) -> Result<Value, serde_json::Error> {
    serde_json::from_str(json).or_else(|error| match hold_non_finite_numbers(json) {
        Some(held) => serde_json::from_str(&held).map_err(|_| error),
        None => Err(error),
    })
}

/// `json` with every number literal past the double range held as an object, or `None` when it has
/// none.
///
/// Outside a string, a JSON number is the only token that starts with `-` or a digit, so a scan that
/// steps over strings finds every one; a literal is held only when it is a JSON number by the
/// grammar, so a malformed document stays malformed.
fn hold_non_finite_numbers(json: &str) -> Option<String> {
    let bytes = json.as_bytes();
    let mut held = String::with_capacity(json.len());
    let (mut i, mut copied) = (0, 0);
    while i < bytes.len() {
        match bytes[i] {
            b'"' => {
                i += 1;
                while i < bytes.len() && bytes[i] != b'"' {
                    i += if bytes[i] == b'\\' { 2 } else { 1 };
                }
                i += 1;
            }
            b'-' | b'0'..=b'9' => {
                let start = i;
                while i < bytes.len()
                    && matches!(bytes[i], b'-' | b'+' | b'.' | b'e' | b'E' | b'0'..=b'9')
                {
                    i += 1;
                }
                let literal = &json[start..i];
                if is_json_number(literal) && literal.parse::<f64>().is_ok_and(f64::is_infinite) {
                    held.push_str(&json[copied..start]);
                    held.push_str(&format!("{{\"{NON_FINITE_NUMBER}\":\"{literal}\"}}"));
                    copied = i;
                }
            }
            _ => i += 1,
        }
    }
    (copied > 0).then(|| held + &json[copied..])
}

/// Whether `literal` is a number as JSON writes one: `-?(0|[1-9][0-9]*)(\.[0-9]+)?([eE][+-]?[0-9]+)?`.
fn is_json_number(literal: &str) -> bool {
    let digits =
        |text: &str| text.len() - text.trim_start_matches(|c: char| c.is_ascii_digit()).len();
    let rest = literal.strip_prefix('-').unwrap_or(literal);
    let whole = digits(rest);
    if whole == 0 || (whole > 1 && rest.starts_with('0')) {
        return false;
    }
    let mut rest = &rest[whole..];
    if let Some(fraction) = rest.strip_prefix('.') {
        let count = digits(fraction);
        if count == 0 {
            return false;
        }
        rest = &fraction[count..];
    }
    if let Some(exponent) = rest.strip_prefix(['e', 'E']) {
        let exponent = exponent.strip_prefix(['+', '-']).unwrap_or(exponent);
        let count = digits(exponent);
        return count > 0 && count == exponent.len();
    }
    rest.is_empty()
}

pub fn parse_v2(json: &str, mode: ValidationMode) -> Result<ValidationResult, serde_json::Error> {
    let mut document = read_document(json)?;
    let mut d = Vec::new();
    judge_fields_as_written(&mut document, &mut d);
    let mut form: DynamicFormV2 = serde_json::from_value(document)?;
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
        if is_unsafe_name(&field.name) {
            d.push(diag(
                "MDY_DYNAMIC_UNSAFE_NAME",
                &format!("{path}/name"),
                "field name is empty, reserved, or contains a dot",
            ));
        } else if has_invisible_character(&field.name) {
            d.push(diag(
                "MDY_DYNAMIC_INVALID_FIELD",
                &path,
                &format!(
                    "Dropped dynamic field {}: the name carries a character that cannot be seen, \
                     so two names that read the same would be two different fields.",
                    serde_json::Value::String(field.name.clone())
                ),
            ));
        } else if is_too_long_for_a_path(&field.name) {
            d.push(diag(
                "MDY_DYNAMIC_PATH_TOO_LONG",
                &path,
                &format!(
                    "Dropped a dynamic field whose path is {} characters, past the \
                     {MAX_PATH_LENGTH} a path may be: a path is the payload key, the draft key and \
                     the widget id, and every read of the value carries it.",
                    field.name.encode_utf16().count()
                ),
            ));
        } else if breaks_value_conversion(&field.name) {
            d.push(diag(
                "MDY_DYNAMIC_INVALID_FIELD",
                &path,
                &format!(
                    "Dropped dynamic field \"{}\": a form's value is an object, so this name \
                     shadows the method every string conversion of that value goes through, and \
                     `${{value}}` then throws.",
                    field.name
                ),
            ));
        } else if field.name.contains(ID_DELIMITER) {
            d.push(diag(
                "MDY_DYNAMIC_INVALID_FIELD",
                &path,
                &format!(
                    "Dropped dynamic field \"{}\": \"{ID_DELIMITER}\" separates the segments of a \
                     generated id, so this name would collide with another field's parts.",
                    field.name
                ),
            ));
        } else if has_js_whitespace(&field.name) {
            d.push(diag(
                "MDY_DYNAMIC_INVALID_FIELD",
                &path,
                &format!(
                    "Dropped dynamic field \"{}\": a widget id is built from this name, and \
                     whitespace splits an id reference into several, each resolving to nothing \
                     — so the control would have no accessible name.",
                    field.name
                ),
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
        if let Some(pattern) = field.validators.as_ref().and_then(|v| v.pattern.as_ref()) {
            let at = format!("{path}/validators/pattern");
            if utf16_len(pattern) > 256 {
                d.push(diag(
                    "MDY_DYNAMIC_PATTERN_TOO_LONG",
                    &at,
                    "pattern exceeds 256 characters",
                ));
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
        if let Some(refusal) =
            rule_value_refusal(&rule.when.operator, rule.when.value.as_ref(), kind)
        {
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
    let mut past_the_bound = false;
    if let Some(schema) = &form.schema {
        let before = d.len();
        validate_node(schema, "/schema", &mut d, &mut context_keys);
        // A finding about the tree's shape turns the document down whole, so its rows are not
        // counted. A kind nobody declared is a finding about one field, and the walk still runs.
        let shape_refused = d[before..]
            .iter()
            .any(|finding| finding.code != "MDY_DYNAMIC_UNKNOWN_KIND");
        past_the_bound = !shape_refused && expands_past_the_bound(schema);
    }
    // Refused whole: the part of a tree a walk reaches first is not a form the document declared.
    if past_the_bound {
        d.push(diag(
            "MDY_DYNAMIC_SCHEMA_LIMIT",
            "/schema",
            &format!(
                "the schema's rows expand it by more than {SCHEMA_MAX_EXTRA_VISITS} nodes beyond those it declares, more than a reader carries."
            ),
        ));
        form.schema = None;
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
            if field
                .validators
                .as_ref()
                .is_some_and(|v| v.integer.is_some())
            {
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
            DynamicNode::Field {
                when, async_when, ..
            } => [when.as_ref(), async_when.as_ref()],
            DynamicNode::Group { when, .. }
            | DynamicNode::Array { when, .. }
            | DynamicNode::Record { when, .. } => [when.as_ref(), None],
        }
        .into_iter()
        .zip(["when", "asyncWhen"])
        {
            if let Some(clause) = clause {
                validate_clause(
                    clause,
                    &format!("{path}/{member}"),
                    &scope,
                    out,
                    context_keys,
                );
            }
        }
        match node {
            DynamicNode::Field { field, .. } => {
                if !KINDS.contains(&field.kind.as_str()) {
                    out.push(diag(
                        "MDY_DYNAMIC_UNKNOWN_KIND",
                        &path,
                        "unknown field kind",
                    ));
                }
            }
            DynamicNode::Group { children, .. } => {
                let here: HashSet<String> = children.keys().cloned().collect();
                for (name, child) in children {
                    if is_unsafe_child_name(name) {
                        out.push(diag(
                            "MDY_DYNAMIC_UNSAFE_NAME",
                            &path,
                            "unsafe group child name",
                        ));
                    } else {
                        pending.push((
                            child,
                            format!("{path}/children/{}", pointer_segment(name)),
                            here.clone(),
                        ));
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

/// How many visits a flatten may make beyond the nodes the schema declares (ADR 0231).
///
/// A row that does not write a nested collection takes that collection's declared rows, so a reader
/// that expands rows visits the product of the row counts down each branch and not the size of the
/// document: a few kilobytes can name more nodes than a request can hold. This reader does not expand
/// rows, but a document it accepts is one every reader of the contract must be able to take, so it
/// applies the same bound to the same count.
const SCHEMA_MAX_EXTRA_VISITS: u64 = 10_000;

/// Whether a flatten of `schema` would visit more than its declared nodes plus
/// [`SCHEMA_MAX_EXTRA_VISITS`].
///
/// The count is ADR 0231's: one visit per node a walk takes — the schema, each group child under a
/// safe key, each row of a collection (the rows its enclosing row wrote for it when it wrote an array,
/// an object for a record, else the rows it declares; a record's under safe keys only) — plus, for
/// each collection's `item` the walk reaches, that item walked once more with no rows written, the
/// row template. Declared is every node in the tree, unsafe keys included.
///
/// Computed rather than walked: the visits under a node depend only on the node and the value its
/// row wrote for it, and a lent row is the same value in every enclosing row that takes it, so each
/// pair is counted once and the product never materialises. Saturating, because the product is
/// exactly what can overflow.
fn expands_past_the_bound(schema: &DynamicNode) -> bool {
    let mut declared: u64 = 0;
    let mut items: Vec<&DynamicNode> = Vec::new();
    let mut pending: Vec<(&DynamicNode, bool)> = vec![(schema, true)];
    while let Some((node, reached)) = pending.pop() {
        declared += 1;
        match node {
            DynamicNode::Field { .. } => {}
            DynamicNode::Group { children, .. } => pending.extend(
                children
                    .iter()
                    .map(|(name, child)| (child, reached && !is_unsafe_child_name(name))),
            ),
            DynamicNode::Array { item, .. } | DynamicNode::Record { item, .. } => {
                if reached {
                    items.push(item);
                }
                pending.push((item, reached));
            }
        }
    }
    let bound = declared.saturating_add(SCHEMA_MAX_EXTRA_VISITS);
    let mut memo: HashMap<(*const DynamicNode, *const Value), u64> = HashMap::new();
    let mut total = visits(schema, None, &mut memo);
    for item in items {
        if total > bound {
            break;
        }
        total = total.saturating_add(visits(item, None, &mut memo));
    }
    total > bound
}

/// The visits a walk makes from `node`, given the value its enclosing row wrote for it, memoised by
/// the pair. Over an explicit stack for the reason `validate_node` gives: each pair is entered, its
/// children counted, then the pair summed from them.
fn visits(
    root: &DynamicNode,
    written: Option<&Value>,
    memo: &mut HashMap<(*const DynamicNode, *const Value), u64>,
) -> u64 {
    fn key(node: &DynamicNode, written: Option<&Value>) -> (*const DynamicNode, *const Value) {
        (
            node,
            written.map_or(std::ptr::null(), |value| value as *const Value),
        )
    }
    /// What a node passes to the walk: each child or row it visits, with the value written for it.
    fn next<'a>(
        node: &'a DynamicNode,
        written: Option<&'a Value>,
    ) -> Vec<(&'a DynamicNode, Option<&'a Value>)> {
        match node {
            DynamicNode::Field { .. } => Vec::new(),
            DynamicNode::Group { children, .. } => {
                let row = written.and_then(Value::as_object);
                children
                    .iter()
                    .filter(|(name, _)| !is_unsafe_child_name(name))
                    .map(|(name, child)| (child, row.and_then(|row| row.get(name))))
                    .collect()
            }
            DynamicNode::Array {
                item,
                initial_value,
                ..
            } => match written.and_then(Value::as_array) {
                Some(rows) => rows.iter().map(|row| (&**item, Some(row))).collect(),
                None => initial_value
                    .iter()
                    .map(|row| (&**item, Some(row)))
                    .collect(),
            },
            DynamicNode::Record {
                item,
                initial_value,
                ..
            } => match written.and_then(Value::as_object) {
                Some(rows) => rows
                    .iter()
                    .filter(|(key, _)| !is_unsafe_child_name(key))
                    .map(|(_, row)| (&**item, Some(row)))
                    .collect(),
                None => initial_value
                    .iter()
                    .filter(|(key, _)| !is_unsafe_child_name(key))
                    .map(|(_, row)| (&**item, Some(row)))
                    .collect(),
            },
        }
    }

    let mut pending: Vec<(&DynamicNode, Option<&Value>, bool)> = vec![(root, written, false)];
    while let Some((node, written, entered)) = pending.pop() {
        if memo.contains_key(&key(node, written)) {
            continue;
        }
        let children = next(node, written);
        if entered {
            let sum = children.iter().fold(1u64, |sum, (child, value)| {
                sum.saturating_add(memo[&key(child, *value)])
            });
            memo.insert(key(node, written), sum);
        } else {
            pending.push((node, written, true));
            pending.extend(
                children
                    .into_iter()
                    .map(|(child, value)| (child, value, false)),
            );
        }
    }
    memo[&key(root, written)]
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
            DynamicNode::Group { children, .. } => {
                pending.extend(children.iter().map(|(name, child)| {
                    (child, format!("{path}/children/{}", pointer_segment(name)))
                }))
            }
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
fn rule_value_refusal(
    operator: &str,
    value: Option<&Value>,
    kind: Option<&str>,
) -> Option<&'static str> {
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

/// `yyyy-MM-dd` naming a day the calendar has, in a year from 0100 on.
///
/// The TypeScript reader decides a date through `Date.UTC`, which reads a year below 100 as one in
/// the twentieth century, so `0099-01-01` does not name the day it spells there and is refused. The
/// same years are refused here, so both readers give one verdict on one document.
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
    if year < 100 {
        return false;
    }
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
