package dev.modyra.contract;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * The shape rules of a portable predicate, as {@code packages/core/src/expression.ts} states them.
 *
 * <p>An expression arrives in a document and is checked here as a shape, never evaluated: this reader
 * says whether a document is a document. Every answer — the problems an expression has, the field
 * paths it reads, the context keys it reads — is worded and ordered as the TypeScript reader words
 * and orders it, so one document gets one verdict from every reader of the contract.
 */
final class MdyExpressions {

  private MdyExpressions() {
  }

  /** The closed set of operators an expression may use, mirroring {@code MdyExpressionOp}. */
  private static final Set<String> OPS = Set.of(
      "equals", "notEquals", "isEmpty", "isNotEmpty", "lengthAtLeast", "lengthAtMost",
      "greaterThan", "greaterThanOrEqual", "lessThan", "lessThanOrEqual",
      "in", "notIn", "matches", "and", "or", "not");

  /**
   * How deep a predicate tree may nest: {@code MDY_MAX_EXPRESSION_DEPTH}.
   *
   * <p>The walk below recurses, so a document deep enough would end the thread rather than produce a
   * diagnostic; thirty-two levels is well past anything a person or a model writes and well short of
   * the stack. The bound also decides a cycle, which JSON cannot express but an object graph can.
   */
  static final int MAX_DEPTH = 32;

  /** How long a pattern inside a condition may be: {@code MDY_MAX_EXPRESSION_PATTERN_LENGTH}. */
  static final int MAX_PATTERN_LENGTH = 256;

  /** The members that make an object an operand of one kind. */
  private static final List<String> OPERAND_MARKERS = List.of("path", "self", "root", "context");

  /** The segments no readable path may contain, the ones {@code isSafeFieldPath} refuses. */
  private static final Set<String> FORBIDDEN_PATH_SEGMENTS = Set.of("", "__proto__", "prototype", "constructor");

  /** The characters a path segment may not hold: the whitespace {@code isIdSegment} refuses. */
  private static final Pattern SEGMENT_WHITESPACE = Pattern.compile("[\\t\\n\\f\\r ]");

  /** The delimiter a control's id is built from, which a segment therefore may not contain. */
  private static final String PATH_ID_DELIMITER = "__";

  /**
   * Why {@code expr} is not a usable expression, or an empty list when it is — {@code validateExpression}.
   *
   * <p>{@code where} is the clause's address as the problems name it; a nested expression is named
   * {@code where.operands[index]} under it.
   */
  static List<String> validateExpression(JsonNode expr, String where) {
    List<String> problems = new ArrayList<>();
    validateAt(expr, where, 0, problems);
    return problems;
  }

  private static void validateAt(JsonNode expr, String where, int depth, List<String> problems) {
    if (!isExpression(expr)) {
      problems.add(where + ": expected an expression object with an \"op\"");
      return;
    }
    if (depth > MAX_DEPTH) {
      problems.add(where + ": nests deeper than " + MAX_DEPTH + " levels");
      return;
    }

    JsonNode op = expr.get("op");
    String opText = jsString(op);
    if (!op.isTextual() || !OPS.contains(opText)) problems.add(where + ": unknown operator \"" + opText + "\"");

    List<JsonNode> operands = operandsOf(expr);
    if (operandsAreMalformed(expr)) {
      problems.add(where + ": \"operands\" must be a list of operands");
    } else if (operands.isEmpty()) {
      problems.add(where + ": \"" + opText + "\" has no operands");
    }

    if ("matches".equals(opText) && op.isTextual()) {
      JsonNode pattern = operands.size() > 1 ? operands.get(1) : null;
      if (pattern == null || !pattern.isTextual()) {
        problems.add(where + ": \"matches\" needs a literal string pattern");
      } else if (pattern.asText().length() > MAX_PATTERN_LENGTH) {
        problems.add(where + ": \"matches\" pattern is longer than " + MAX_PATTERN_LENGTH + " characters");
      } else {
        patternProblems(pattern.asText(), where, problems);
      }
    }

    for (int index = 0; index < operands.size(); index++) {
      JsonNode operand = operands.get(index);
      String at = where + ".operands[" + index + "]";
      if (isExpression(operand)) {
        validateAt(operand, at, depth + 1, problems);
      } else if (claimsTwoThings(operand)) {
        // Which of the two it is would be decided by the order a reader happens to ask in, and the
        // readers of this contract need not ask in the same order (ADR 0092).
        problems.add(at + ": an operand names one of {path}, {self}, {root}, {context}, and this one names more than one");
      } else if (isPathRef(operand)) {
        String path = operand.get("path").asText();
        if (!isReadablePath(path)) problems.add(at + ": \"" + path + "\" is not a field path");
      } else if (isSelfRef(operand) || isRootRef(operand) || isContextRef(operand)) {
        // Each names one thing; whether it is available is a question about the caller, not the
        // expression. A context key of no characters is not a reference at all and falls through.
      } else if (operand.isContainerNode()) {
        problems.add(at + ": an object operand must be {path}, {self}, {root}, {context} or a nested expression");
      }
    }
  }

  /**
   * What a {@code matches} pattern of acceptable length gets wrong.
   *
   * <p>The TypeScript reader also refuses a pattern that does not compile as a JavaScript regular
   * expression, and one whose shape backtracks exponentially — the same gate a field's
   * {@code validators.pattern} passes. This reader judges neither here, so a condition carrying such
   * a pattern is accepted by this reader and refused by that one; the corpus ledger names the two
   * documents where that shows.
   */
  private static void patternProblems(String pattern, String where, List<String> problems) {
  }

  /**
   * The field paths {@code expr} reads, in reading order and without repeats — {@code expressionPaths}.
   *
   * <p>Only a path the engine would register counts: a path the validator refuses is not a dependency
   * anything downstream subscribes to. {@code self}, {@code root} and {@code context} are not paths.
   */
  static List<String> expressionPaths(JsonNode expr) {
    Set<String> paths = new LinkedHashSet<>();
    for (JsonNode operand : operandsOf(expr)) walkPaths(operand, 1, paths);
    return List.copyOf(paths);
  }

  private static void walkPaths(JsonNode operand, int depth, Set<String> paths) {
    if (depth > MAX_DEPTH) return;
    if (isExpression(operand)) {
      for (JsonNode nested : operandsOf(operand)) walkPaths(nested, depth + 1, paths);
      return;
    }
    if (isPathRef(operand) && isReadablePath(operand.get("path").asText())) paths.add(operand.get("path").asText());
  }

  /**
   * The context keys {@code expr} reads, in reading order and without repeats —
   * {@code expressionContextKeys} — so a document's declaration can be held to what its conditions
   * ask a host for.
   */
  static List<String> expressionContextKeys(JsonNode expr) {
    Set<String> keys = new LinkedHashSet<>();
    for (JsonNode operand : operandsOf(expr)) walkContextKeys(operand, 1, keys);
    return List.copyOf(keys);
  }

  private static void walkContextKeys(JsonNode operand, int depth, Set<String> keys) {
    if (depth > MAX_DEPTH) return;
    if (isExpression(operand)) {
      for (JsonNode nested : operandsOf(operand)) walkContextKeys(nested, depth + 1, keys);
      return;
    }
    if (isContextRef(operand)) keys.add(operand.get("context").asText());
  }

  /** Whether {@code node} is itself a predicate: an object carrying {@code op}, whatever it holds. */
  static boolean isExpression(JsonNode node) {
    return node != null && node.isObject() && node.has("op");
  }

  /**
   * The operands of {@code expr}, however it spelled them: {@code operands} wins when both are
   * present, and a present {@code operands} that is not a list reads as nothing.
   */
  private static List<JsonNode> operandsOf(JsonNode expr) {
    if (expr.has("operands")) {
      JsonNode list = expr.get("operands");
      if (!list.isArray()) return List.of();
      List<JsonNode> operands = new ArrayList<>(list.size());
      list.forEach(operands::add);
      return operands;
    }
    return expr.has("operand") ? List.of(expr.get("operand")) : List.of();
  }

  /** True when {@code operands} is present and is not a list — a clause nothing can read. */
  private static boolean operandsAreMalformed(JsonNode expr) {
    return expr.has("operands") && !expr.get("operands").isArray();
  }

  /** Whether {@code operand} is an object naming exactly {@code marker} and no other marker. */
  private static boolean namesOneThing(JsonNode operand, String marker) {
    if (!operand.isObject() || operand.has("op") || !operand.has(marker)) return false;
    for (String each : OPERAND_MARKERS) if (!each.equals(marker) && operand.has(each)) return false;
    return true;
  }

  /** Whether {@code operand} is an object reaching for more than one of the four things it can name. */
  private static boolean claimsTwoThings(JsonNode operand) {
    if (!operand.isObject() || operand.has("op")) return false;
    int named = 0;
    for (String marker : OPERAND_MARKERS) if (operand.has(marker)) named++;
    return named > 1;
  }

  private static boolean isPathRef(JsonNode operand) {
    return namesOneThing(operand, "path") && operand.get("path").isTextual();
  }

  private static boolean isSelfRef(JsonNode operand) {
    return namesOneThing(operand, "self") && operand.get("self").isBoolean() && operand.get("self").asBoolean();
  }

  private static boolean isRootRef(JsonNode operand) {
    return namesOneThing(operand, "root") && operand.get("root").isBoolean() && operand.get("root").asBoolean();
  }

  private static boolean isContextRef(JsonNode operand) {
    return namesOneThing(operand, "context") && operand.get("context").isTextual() && !operand.get("context").asText().isEmpty();
  }

  /**
   * True for a path an expression may read: a field path, or {@code ""} for the root value itself.
   *
   * <p>A field path has at least one segment, and every segment is non-empty, names no prototype key,
   * holds no whitespace and does not contain the id delimiter — {@code isSafeFieldPath}.
   */
  static boolean isReadablePath(String path) {
    if (path.isEmpty()) return true;
    for (String segment : path.split("\\.", -1)) {
      if (FORBIDDEN_PATH_SEGMENTS.contains(segment)) return false;
      if (SEGMENT_WHITESPACE.matcher(segment).find() || segment.contains(PATH_ID_DELIMITER)) return false;
    }
    return true;
  }

  /**
   * A JSON value as JavaScript's {@code String(value)} spells it, so a message naming a malformed
   * operator reads the same from every reader: a number without a spurious fraction, {@code null}
   * as the word, an object as {@code [object Object]}, an array as its members joined by commas.
   */
  private static String jsString(JsonNode value) {
    if (value == null || value.isMissingNode()) return "undefined";
    if (value.isTextual()) return value.asText();
    if (value.isNull()) return "null";
    if (value.isBoolean()) return Boolean.toString(value.asBoolean());
    if (value.isNumber()) {
      return value.canConvertToExactIntegral() && value.canConvertToLong() ? Long.toString(value.asLong()) : value.numberValue().toString();
    }
    if (value.isArray()) {
      StringBuilder joined = new StringBuilder();
      for (int i = 0; i < value.size(); i++) {
        if (i > 0) joined.append(',');
        JsonNode member = value.get(i);
        if (!member.isNull()) joined.append(jsString(member));
      }
      return joined.toString();
    }
    return "[object Object]";
  }
}
