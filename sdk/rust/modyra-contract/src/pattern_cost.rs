//! Whether a pattern from a document can be made to backtrack exponentially, decided the way the
//! TS reference decides it (`packages/core/src/dynamic/pattern-cost.ts`, ADR 0050).
//!
//! The refusal is a heuristic over the *shape* of a source: a repeated group whose body can be
//! divided several ways, or repeated alternatives that can match the same text. It is conservative
//! in the same places as the reference, because a document passes or fails on its verdict and two
//! readers that disagree about one pattern disagree about the whole document.
//!
//! The source is scanned as UTF-16 code units, as the reference indexes it. A character outside
//! the Basic Multilingual Plane is two units there, and reading it as one here would move every
//! position after it and change which quantifier binds to what. Where a slice cut between the two
//! halves of a pair is compiled, the lone half is written as a `\u{…}` escape, which is what the
//! reference's `u`-flag `RegExp` makes of it: a code point no sampled character equals.

use regress::Regex;

const STAR: u16 = b'*' as u16;
const PLUS: u16 = b'+' as u16;
const QUESTION: u16 = b'?' as u16;
const OPEN_BRACE: u16 = b'{' as u16;
const CLOSE_BRACE: u16 = b'}' as u16;
const OPEN_BRACKET: u16 = b'[' as u16;
const CLOSE_BRACKET: u16 = b']' as u16;
const OPEN_PAREN: u16 = b'(' as u16;
const CLOSE_PAREN: u16 = b')' as u16;
const BAR: u16 = b'|' as u16;
const BACKSLASH: u16 = b'\\' as u16;
const CARET: u16 = b'^' as u16;
const DOLLAR: u16 = b'$' as u16;
const DOT: u16 = b'.' as u16;
const COMMA: u16 = b',' as u16;
const LESS: u16 = b'<' as u16;
const GREATER: u16 = b'>' as u16;
const EQUALS: u16 = b'=' as u16;
const BANG: u16 = b'!' as u16;
const COLON: u16 = b':' as u16;

/// How many times a quantifier may repeat what it follows. Infinite for the open-ended ones.
#[derive(Clone, Copy)]
struct Repetition {
    min: f64,
    max: f64,
    /// Index of the last unit of the quantifier, so a scan can step past it.
    end: usize,
}

struct Group {
    variable: bool,
    /// Where each top-level alternative of this group starts.
    alternatives: Vec<usize>,
}

/// One element of a group's body: what it can match, and how many times it may repeat.
struct Atom {
    /// What one occurrence accepts, or `None` when that cannot be decided cheaply.
    matcher: Option<Regex>,
    /// The element's own source, without its quantifier: what a union of elements is built from.
    source: Vec<u16>,
    min: f64,
    max: f64,
}

fn units(text: &str) -> Vec<u16> {
    text.encode_utf16().collect()
}

/// A slice of units as regex source; a lone surrogate becomes the escape that names it.
fn text(slice: &[u16]) -> String {
    let mut out = String::new();
    for decoded in char::decode_utf16(slice.iter().copied()) {
        match decoded {
            Ok(character) => out.push(character),
            Err(lone) => out.push_str(&format!("\\u{{{:X}}}", lone.unpaired_surrogate())),
        }
    }
    out
}

fn index_of(source: &[u16], unit: u16, from: usize) -> Option<usize> {
    source
        .get(from..)?
        .iter()
        .position(|&u| u == unit)
        .map(|i| i + from)
}

fn is_digit(unit: u16) -> bool {
    (b'0' as u16..=b'9' as u16).contains(&unit)
}

fn is_letter(unit: u16) -> bool {
    (b'a' as u16..=b'z' as u16).contains(&unit) || (b'A' as u16..=b'Z' as u16).contains(&unit)
}

fn is_class_escape(unit: u16) -> bool {
    [b'd', b'D', b'w', b'W', b's', b'S']
        .iter()
        .any(|&c| c as u16 == unit)
}

/// What `\s` matches in ECMAScript: white space and line terminators.
fn is_js_space(unit: u16) -> bool {
    matches!(
        unit,
        0x09..=0x0D | 0x20 | 0xA0 | 0x1680 | 0x2000..=0x200A | 0x2028 | 0x2029 | 0x202F | 0x205F | 0x3000 | 0xFEFF
    )
}

/// The unprintable character an escape such as `\n` stands for.
fn literal_escape(unit: u16) -> Option<u16> {
    match u8::try_from(unit).ok()? {
        b'n' => Some(0x0A),
        b't' => Some(0x09),
        b'r' => Some(0x0D),
        b'f' => Some(0x0C),
        b'v' => Some(0x0B),
        b'0' => Some(0x00),
        _ => None,
    }
}

fn number(digits: &[u16]) -> f64 {
    text(digits).parse().unwrap_or(f64::INFINITY)
}

/// The quantifier at `at`, or `None` when nothing there is one. `{` is only a quantifier when what
/// follows spells a count, so a literal brace does not make the scan lose its place.
fn repetition_at(source: &[u16], at: usize) -> Option<Repetition> {
    let character = *source.get(at)?;
    match character {
        STAR => {
            return Some(Repetition {
                min: 0.0,
                max: f64::INFINITY,
                end: at,
            })
        }
        PLUS => {
            return Some(Repetition {
                min: 1.0,
                max: f64::INFINITY,
                end: at,
            })
        }
        QUESTION => {
            return Some(Repetition {
                min: 0.0,
                max: 1.0,
                end: at,
            })
        }
        OPEN_BRACE => {}
        _ => return None,
    }
    let close = index_of(source, CLOSE_BRACE, at)?;
    let body = &source[at + 1..close];
    let lead = body.iter().take_while(|&&u| is_digit(u)).count();
    if lead == 0 {
        return None;
    }
    let min = number(&body[..lead]);
    if lead == body.len() {
        return Some(Repetition {
            min,
            max: min,
            end: close,
        });
    }
    if body[lead] != COMMA {
        return None;
    }
    let rest = &body[lead + 1..];
    if rest.iter().all(|&u| is_js_space(u)) {
        return Some(Repetition {
            min,
            max: f64::INFINITY,
            end: close,
        });
    }
    let spaces = rest.iter().take_while(|&&u| is_js_space(u)).count();
    let tail = &rest[spaces..];
    if !tail.is_empty() && tail.iter().all(|&u| is_digit(u)) {
        return Some(Repetition {
            min,
            max: number(tail),
            end: close,
        });
    }
    None
}

/// Characters used to decide whether two sets of characters intersect: printable ASCII, plus the
/// whitespace and non-Latin letters that keep `.` from `\n` and `\w` from a letter outside ASCII.
fn alphabet() -> Vec<String> {
    let mut out: Vec<String> = (0x20u8..=0x7E).map(|b| (b as char).to_string()).collect();
    out.extend(
        ["\n", "\t", "\r", "é", "ß", "中"]
            .iter()
            .map(|s| s.to_string()),
    );
    out
}

fn accepts(matcher: &Regex, character: &str) -> bool {
    matcher.find(character).is_some()
}

/// Where a character class ends, accounting for `]` as the first member and for escapes.
fn class_end(source: &[u16], open: usize) -> Option<usize> {
    let mut at = open + 1;
    if source.get(at) == Some(&CARET) {
        at += 1;
    }
    if source.get(at) == Some(&CLOSE_BRACKET) {
        at += 1;
    }
    while at < source.len() {
        if source[at] == BACKSLASH {
            at += 2;
            continue;
        }
        if source[at] == CLOSE_BRACKET {
            return Some(at);
        }
        at += 1;
    }
    None
}

/// A pattern body compiled to something that answers for one character, or `None` when it will not.
fn safe_matcher(body: &[u16]) -> Option<Regex> {
    Regex::with_flags(&format!("^(?:{})$", text(body)), "u").ok()
}

/// A literal character as a pattern body that matches only itself. `-` stays bare: `\-` is an
/// invalid escape under the `u` flag.
fn escape_literal(character: u16) -> Vec<u16> {
    if b"\\^$.*+?()[]{}|/".iter().any(|&c| c as u16 == character) {
        vec![BACKSLASH, character]
    } else {
        vec![character]
    }
}

/// Whether what precedes `at` may be absent, which makes the branch's first character undecidable.
fn optional_after(branch: &[u16], at: usize) -> bool {
    match branch.get(at) {
        Some(&QUESTION) | Some(&STAR) => true,
        Some(&OPEN_BRACE) => match index_of(branch, CLOSE_BRACE, at) {
            Some(close) => {
                let body = &branch[at + 1..close];
                let zeros = body.iter().take_while(|&&u| u == b'0' as u16).count();
                body.get(zeros) == Some(&COMMA)
            }
            None => false,
        },
        _ => false,
    }
}

/// What an alternative can start with, as something that answers for one character, or `None`
/// when that cannot be decided cheaply. A nested group and a backreference stay undecidable.
fn first_matcher(branch: &[u16]) -> Option<Regex> {
    let head = *branch.first()?;
    if head == BACKSLASH {
        let escaped = *branch.get(1)?;
        if is_class_escape(escaped) {
            return if optional_after(branch, 2) {
                None
            } else {
                safe_matcher(&[BACKSLASH, escaped])
            };
        }
        if escaped == b'b' as u16 || escaped == b'B' as u16 || is_digit(escaped) {
            return None;
        }
        if let Some(literal) = literal_escape(escaped) {
            return if optional_after(branch, 2) {
                None
            } else {
                safe_matcher(&escape_literal(literal))
            };
        }
        if is_letter(escaped) {
            return None;
        }
        return if optional_after(branch, 2) {
            None
        } else {
            safe_matcher(&escape_literal(escaped))
        };
    }
    if head == OPEN_BRACKET {
        let close = class_end(branch, 0)?;
        return if optional_after(branch, close + 1) {
            None
        } else {
            safe_matcher(&branch[..=close])
        };
    }
    if head == DOT {
        return if optional_after(branch, 1) {
            None
        } else {
            safe_matcher(&[DOT])
        };
    }
    if [
        OPEN_PAREN, CARET, DOLLAR, STAR, PLUS, QUESTION, OPEN_BRACE, BAR,
    ]
    .contains(&head)
    {
        return None;
    }
    if optional_after(branch, 1) {
        None
    } else {
        safe_matcher(&escape_literal(head))
    }
}

/// Top-level alternatives of a group body, given where each one starts. Each start is recorded
/// after its `|`, so every alternative but the last ends one unit before the next start.
fn alternatives_of(source: &[u16], group: &Group, end: usize) -> Vec<Vec<u16>> {
    let mut bounds = group.alternatives.clone();
    bounds.push(end);
    (0..bounds.len() - 1)
        .map(|index| {
            let from = bounds[index].min(source.len());
            let to = if index + 2 < bounds.len() {
                bounds[index + 1].saturating_sub(1)
            } else {
                bounds[index + 1]
            };
            let to = to.min(source.len());
            if to > from {
                source[from..to].to_vec()
            } else {
                Vec::new()
            }
        })
        .collect()
}

/// The literal string an alternative is, or `None` when it matches more than the characters it is
/// written with. An escaped literal is still a literal.
fn plain_word(branch: &[u16]) -> Option<Vec<u16>> {
    let mut word = Vec::new();
    let mut at = 0;
    while at < branch.len() {
        let character = branch[at];
        if character == BACKSLASH {
            let escaped = *branch.get(at + 1)?;
            if is_class_escape(escaped) || is_letter(escaped) || is_digit(escaped) {
                word.push(literal_escape(escaped)?);
            } else {
                word.push(escaped);
            }
            at += 2;
            continue;
        }
        if b"[](){}|*+?.^$".iter().any(|&c| c as u16 == character) {
            return None;
        }
        word.push(character);
        at += 1;
    }
    if word.is_empty() {
        None
    } else {
        Some(word)
    }
}

/// Whether two alternatives can both match at the same position: plain words compared whole for a
/// prefix, anything else compared by the characters each can start with.
fn overlap(branches: &[Vec<u16>], alphabet: &[String]) -> bool {
    let words: Vec<Option<Vec<u16>>> = branches.iter().map(|b| plain_word(b)).collect();
    if words.iter().all(Option::is_some) {
        let words: Vec<&Vec<u16>> = words.iter().flatten().collect();
        return words.iter().enumerate().any(|(index, word)| {
            words
                .iter()
                .enumerate()
                .any(|(at, other)| at != index && other.starts_with(word))
        });
    }
    let matchers: Vec<Option<Regex>> = branches.iter().map(|b| first_matcher(b)).collect();
    for i in 0..matchers.len() {
        let Some(a) = &matchers[i] else { continue };
        for b in matchers[i + 1..].iter().flatten() {
            if alphabet.iter().any(|c| accepts(a, c) && accepts(b, c)) {
                return true;
            }
        }
    }
    false
}

/// The body of one alternative split into the elements it is a sequence of, or `None` when it
/// holds something that cannot be read as one, such as a backreference or an assertion.
fn atoms_of(branch: &[u16]) -> Option<Vec<Atom>> {
    let mut atoms = Vec::new();
    let mut at = 0;
    while at < branch.len() {
        let character = branch[at];
        if character == CARET || character == DOLLAR {
            at += 1;
            continue;
        }
        let mut end = at;
        let matcher;
        if character == BACKSLASH {
            let escaped = *branch.get(at + 1)?;
            if is_digit(escaped) || escaped == b'b' as u16 || escaped == b'B' as u16 {
                return None;
            }
            end = at + 1;
            matcher = if is_class_escape(escaped) {
                safe_matcher(&[BACKSLASH, escaped])
            } else if is_letter(escaped) {
                None
            } else {
                safe_matcher(&escape_literal(literal_escape(escaped).unwrap_or(escaped)))
            };
        } else if character == OPEN_BRACKET {
            let close = class_end(branch, at)?;
            end = close;
            matcher = safe_matcher(&branch[at..=close]);
        } else if character == DOT {
            matcher = safe_matcher(&[DOT]);
        } else if character == OPEN_PAREN {
            let close = group_end(branch, at)?;
            end = close;
            matcher = group_matcher(&branch[at..=close]);
        } else if character == CLOSE_PAREN || character == BAR {
            return None;
        } else {
            matcher = safe_matcher(&escape_literal(character));
        }
        let repetition = repetition_at(branch, end + 1);
        atoms.push(Atom {
            matcher,
            source: branch[at..=end].to_vec(),
            min: repetition.map_or(1.0, |r| r.min),
            max: repetition.map_or(1.0, |r| r.max),
        });
        at = repetition.map_or(end, |r| r.end) + 1;
    }
    Some(atoms)
}

/// How many units of a group's opening `(?:`, `(?=`, `(?!`, `(?<=`, `(?<!` or `(?<name>` precede
/// its body; only the `(` when the `?` spells none of them.
fn group_prefix(group: &[u16]) -> usize {
    if group.get(1) != Some(&QUESTION) {
        return 1;
    }
    match group.get(2) {
        Some(&COLON) | Some(&EQUALS) | Some(&BANG) => 3,
        Some(&LESS) => match group.get(3) {
            Some(&EQUALS) | Some(&BANG) => 4,
            _ => index_of(group, GREATER, 3).map_or(1, |close| close + 1),
        },
        _ => 1,
    }
}

/// Everything a group accepts, as one matcher: the union of every element of every alternative.
fn group_matcher(group: &[u16]) -> Option<Regex> {
    let start = group_prefix(group);
    let mut inner = &group[start.min(group.len())..];
    if inner.last() == Some(&CLOSE_PAREN) {
        inner = &inner[..inner.len() - 1];
    }
    let mut sources: Vec<Vec<u16>> = Vec::new();
    for branch in top_level_alternatives(inner) {
        for atom in atoms_of(&branch)? {
            atom.matcher.as_ref()?;
            sources.push(atom.source);
        }
    }
    if sources.is_empty() {
        return None;
    }
    safe_matcher(&sources.join(&BAR))
}

/// A body split on the `|` that belongs to it, skipping the ones inside groups and classes.
fn top_level_alternatives(body: &[u16]) -> Vec<Vec<u16>> {
    let mut out = Vec::new();
    let mut from = 0;
    let mut depth: i64 = 0;
    let mut at = 0;
    while at < body.len() {
        let character = body[at];
        if character == BACKSLASH {
            at += 2;
            continue;
        }
        if character == OPEN_BRACKET {
            match class_end(body, at) {
                Some(close) => {
                    at = close + 1;
                    continue;
                }
                None => break,
            }
        }
        if character == OPEN_PAREN {
            depth += 1;
        } else if character == CLOSE_PAREN {
            depth -= 1;
        } else if character == BAR && depth == 0 {
            out.push(body[from..at].to_vec());
            from = at + 1;
        }
        at += 1;
    }
    out.push(body[from.min(body.len())..].to_vec());
    out
}

/// Where the group opened at `at` closes, skipping classes and escapes.
fn group_end(source: &[u16], at: usize) -> Option<usize> {
    let mut depth = 0i64;
    let mut index = at;
    while index < source.len() {
        let character = source[index];
        if character == BACKSLASH {
            index += 2;
            continue;
        }
        if character == OPEN_BRACKET {
            index = class_end(source, index)? + 1;
            continue;
        }
        if character == OPEN_PAREN {
            depth += 1;
        } else if character == CLOSE_PAREN {
            depth -= 1;
            if depth == 0 {
                return Some(index);
            }
        }
        index += 1;
    }
    None
}

/// Whether everything `inner` accepts, the stretchy `outer` accepts too. Undecidable counts as yes.
fn contained_in(inner: &Atom, outer: &Atom, alphabet: &[String]) -> bool {
    let (Some(inner), Some(outer)) = (&inner.matcher, &outer.matcher) else {
        return true;
    };
    alphabet
        .iter()
        .all(|c| !accepts(inner, c) || accepts(outer, c))
}

/// Whether repeating this body gives the engine more than one way to divide the same input: a
/// variable element with no forced boundary at the seam between one repetition and the next.
fn body_is_ambiguous(branch: &[u16], alphabet: &[String]) -> bool {
    let Some(atoms) = atoms_of(branch) else {
        return false;
    };
    if atoms.is_empty() || !atoms.iter().any(|a| a.min != a.max) {
        return false;
    }
    // Trailing elements that can contribute nothing are not an ending.
    let Some(end) = atoms.iter().rposition(|a| a.min != 0.0) else {
        // Nothing that must be there: a body that can match empty and repeats makes no progress.
        return true;
    };
    let last = &atoms[end];
    if last.min != last.max {
        if contained_in(&atoms[0], last, alphabet) {
            return true;
        }
        for pair in atoms[..=end].windows(2) {
            let (a, b) = (&pair[0], &pair[1]);
            if a.min == a.max || b.min == b.max {
                continue;
            }
            let (Some(am), Some(bm)) = (&a.matcher, &b.matcher) else {
                return true;
            };
            if alphabet.iter().any(|c| accepts(am, c) && accepts(bm, c)) {
                return true;
            }
        }
        return false;
    }
    let Some(stretchy) = atoms[..=end].iter().rposition(|a| a.min != a.max) else {
        return false;
    };
    atoms[stretchy + 1..=end]
        .iter()
        .all(|atom| contained_in(atom, &atoms[stretchy], alphabet))
}

pub(crate) const REFUSED_DIVISIBLE: &str =
    "a repeated group whose body can be divided several ways, which backtracks exponentially";
pub(crate) const REFUSED_OVERLAP: &str =
    "repeated alternatives that can match the same text, which backtracks exponentially";

/// Why this pattern is refused, or `None` when it is allowed. The message names the shape, which is
/// what a document's author has to change.
pub(crate) fn pattern_refusal(pattern: &str) -> Option<&'static str> {
    let source = units(pattern);
    let alphabet = alphabet();
    let mut groups: Vec<Group> = Vec::new();
    let mut at = 0;
    while at < source.len() {
        let character = source[at];
        if character == BACKSLASH {
            at += 2;
            continue;
        }
        if character == OPEN_BRACKET {
            // A character class is opaque here: nothing inside it repeats or groups.
            at = index_of(&source, CLOSE_BRACKET, at + 1).map_or(source.len(), |close| close + 1);
            continue;
        }
        if character == OPEN_PAREN {
            // The `?` of `(?:` and its kin names the kind of group and is not a quantifier.
            let mut body = at + 1;
            if source.get(body) == Some(&QUESTION) {
                body += 1;
                if source.get(body) == Some(&LESS)
                    && source.get(body + 1) != Some(&EQUALS)
                    && source.get(body + 1) != Some(&BANG)
                {
                    body = index_of(&source, GREATER, body).map_or(body + 1, |named| named + 1);
                } else if source.get(body) == Some(&LESS) {
                    body += 2;
                } else {
                    body += 1;
                }
            }
            groups.push(Group {
                variable: false,
                alternatives: vec![body],
            });
            at = body;
            continue;
        }
        if character == BAR {
            if let Some(group) = groups.last_mut() {
                group.alternatives.push(at + 1);
            }
            at += 1;
            continue;
        }
        if character == CLOSE_PAREN {
            let Some(group) = groups.pop() else {
                at += 1;
                continue;
            };
            let repetition = repetition_at(&source, at + 1);
            // Repeated at all is `max >= 2`; whether the count is written or open-ended only
            // writes the exponent as a number instead of the length of the input.
            if repetition.is_some_and(|r| r.max >= 2.0) {
                let branches = alternatives_of(&source, &group, at);
                if group.variable && branches.iter().any(|b| body_is_ambiguous(b, &alphabet)) {
                    return Some(REFUSED_DIVISIBLE);
                }
                if overlap(&branches, &alphabet) {
                    return Some(REFUSED_OVERLAP);
                }
            }
            // A variable body stays variable however it is repeated, and a fixed body becomes
            // variable when the repetition itself is.
            if group.variable || repetition.is_some_and(|r| r.min != r.max) {
                if let Some(parent) = groups.last_mut() {
                    parent.variable = true;
                }
            }
            at = repetition.map_or(at, |r| r.end) + 1;
            continue;
        }
        if let Some(repetition) = repetition_at(&source, at) {
            // A quantifier whose minimum and maximum differ makes the run around it variable.
            if repetition.min != repetition.max {
                if let Some(parent) = groups.last_mut() {
                    parent.variable = true;
                }
            }
            at = repetition.end;
        }
        at += 1;
    }
    None
}

/// Whether the pattern compiles as `new RegExp(pattern)` does, with no flags: the reading a
/// document's pattern is run under.
///
/// One construct is refused here that recent engines accept: a group name repeated in different
/// alternatives, `(?<y>a)|(?<y>b)`, which ES2025 allows and `regress` does not. Older engines refuse
/// it too, so the TS verdict on such a pattern depends on the engine running it.
pub(crate) fn compiles(pattern: &str) -> bool {
    Regex::with_flags(pattern, "").is_ok() && !quantifies_word_boundary(&units(pattern))
}

/// Whether a quantifier follows `\b` or `\B` outside a class. ECMAScript refuses that, legacy
/// syntax included; `regress` accepts it, so without this a pattern every browser rejects would
/// pass here.
fn quantifies_word_boundary(source: &[u16]) -> bool {
    let mut in_class = false;
    let mut at = 0;
    while at < source.len() {
        match source[at] {
            BACKSLASH => {
                let escaped = source.get(at + 1).copied();
                if !in_class
                    && (escaped == Some(b'b' as u16) || escaped == Some(b'B' as u16))
                    && is_quantifier(source, at + 2)
                {
                    return true;
                }
                at += 2;
                continue;
            }
            OPEN_BRACKET => in_class = true,
            CLOSE_BRACKET => in_class = false,
            _ => {}
        }
        at += 1;
    }
    false
}

/// Whether a quantifier in ECMAScript's own grammar starts at `at`: `*`, `+`, `?`, `{n}`, `{n,}` or
/// `{n,m}`, with no spaces, unlike the looser reading the cost scan gives a brace.
fn is_quantifier(source: &[u16], at: usize) -> bool {
    match source.get(at) {
        Some(&STAR) | Some(&PLUS) | Some(&QUESTION) => true,
        Some(&OPEN_BRACE) => {
            let rest = &source[at + 1..];
            let lead = rest.iter().take_while(|&&u| is_digit(u)).count();
            if lead == 0 {
                return false;
            }
            let rest = &rest[lead..];
            match rest.first() {
                Some(&CLOSE_BRACE) => true,
                Some(&COMMA) => {
                    let tail = rest[1..].iter().take_while(|&&u| is_digit(u)).count();
                    rest.get(1 + tail) == Some(&CLOSE_BRACE)
                }
                _ => false,
            }
        }
        _ => false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn refuses_the_shapes_that_backtrack_exponentially() {
        for source in [
            "(a+)+$",
            "^(a*)*$",
            "^(a|ab)+$",
            "^([a-z]|[a-z])*$",
            "^(\\w|[a-z])*$",
            "^(.|x)+$",
            "^(a{2,4})+$",
            "^(a+){15}b$",
            "(.*a){20}$",
            "^([A-Za-z]+[0-9]*)+$",
            "^([^x]+[^y]+)+z$",
        ] {
            assert!(pattern_refusal(source).is_some(), "{source} was allowed");
        }
        assert_eq!(pattern_refusal("^(a|a)*$"), Some(REFUSED_OVERLAP));
        assert_eq!(pattern_refusal("^(a+)+$"), Some(REFUSED_DIVISIBLE));
    }

    #[test]
    fn leaves_the_patterns_forms_are_written_with() {
        for source in [
            "^\\d{5}$",
            "^(foo|bar|baz)+$",
            "^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$",
            "^(\\d{1,3}\\.){3}\\d{1,3}$",
            "^([a-z]+-)*[a-z]+$",
            "^(\\s*[^,]+,)*\\s*[^,]+$",
            "^(\"[^\"]*\",)*\"[^\"]*\"$",
            "^(?:ab){3}$",
            "^(?<year>\\d{4})-(?<month>\\d{2})$",
            "(?<!x)(\\d{2}){4}",
            "^(.|\\n)*$",
        ] {
            assert_eq!(pattern_refusal(source), None, "{source} was refused");
        }
    }

    #[test]
    fn compiles_as_a_flagless_regexp_does() {
        for source in [
            "\\-", "a{", "\\1", "(?=a)*", "[\\b]+", "\\b{,3}", "\\b{2, }",
        ] {
            assert!(compiles(source), "{source} was refused");
        }
        for source in ["[", "a**", "x{2,1}", "\\b+", "\\B*", "\\b{2}", "(?<=a)+"] {
            assert!(!compiles(source), "{source} was accepted");
        }
    }

    #[test]
    fn reads_a_character_outside_the_bmp_as_two_units() {
        // The quantifier binds to the low half only, so the group's body stays fixed-length.
        assert_eq!(pattern_refusal("^(😀+)+$"), Some(REFUSED_DIVISIBLE));
        assert_eq!(pattern_refusal("^(a😀)+$"), None);
    }
}
