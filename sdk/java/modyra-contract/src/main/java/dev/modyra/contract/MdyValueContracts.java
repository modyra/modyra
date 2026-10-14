package dev.modyra.contract;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * What a field of each kind holds: {@code MDY_VALUE_CONTRACTS} and {@code explainValueMismatch} in
 * packages/core/src/value-contracts.ts, reduced to the two properties a declared value is judged by —
 * the runtime shape it takes and whether {@code null} is one of its values.
 *
 * <p>The reasons are the TypeScript reader's sentences, so a refusal says the same thing from both
 * readers. Package-private so the test suite can hold the table against the source it mirrors.
 */
final class MdyValueContracts {

  /** A kind's value: its runtime shape, as {@code MdyValueShape} spells it, and whether it may be null. */
  record Contract(String shape, boolean nullable) {}

  static final Map<String, Contract> CONTRACTS = Map.ofEntries(
      Map.entry("text", new Contract("string", false)),
      Map.entry("textarea", new Contract("string", false)),
      Map.entry("email", new Contract("string", false)),
      Map.entry("password", new Contract("string", false)),
      Map.entry("colors", new Contract("string", false)),
      Map.entry("number", new Contract("number", true)),
      Map.entry("slider", new Contract("number", false)),
      Map.entry("checkbox", new Contract("boolean", false)),
      Map.entry("toggle", new Contract("boolean", false)),
      Map.entry("select", new Contract("option", true)),
      Map.entry("radio", new Contract("option", true)),
      Map.entry("segmented", new Contract("option", true)),
      Map.entry("multiselect", new Contract("option[]", false)),
      Map.entry("datepicker", new Contract("string", true)),
      Map.entry("timepicker", new Contract("string", true)),
      Map.entry("daterange", new Contract("dateRange", false)),
      Map.entry("file", new Contract("file[]", false)));

  /** {@code HH:mm} on a 24-hour clock, matched whole: JavaScript's {@code $} does not admit a trailing newline. */
  private static final Pattern TIME = Pattern.compile("([01]\\d|2[0-3]):[0-5]\\d");
  private static final Pattern HEX_COLOR = Pattern.compile("#[0-9a-f]{3}(?:[0-9a-f]{3})?", Pattern.CASE_INSENSITIVE);

  private MdyValueContracts() {}

  /**
   * Why {@code value}, a value the document wrote, does not belong in a field of {@code kind}, or null
   * when it does. A kind this table does not describe holds anything.
   */
  static String explainMismatch(String kind, JsonNode value) {
    Contract contract = CONTRACTS.get(kind);
    if (contract == null) return null;
    if (value.isNull()) return contract.nullable() ? null : kind + " cannot hold null";
    if (!matchesShape(contract.shape(), value)) {
      return kind + " holds " + contract.shape() + ", got "
          + (value.isObject() || value.isArray() ? MdyDynamicFormParser.jsonText(value) : typeOf(value));
    }
    return contentMismatch(kind, value);
  }

  private static boolean matchesShape(String shape, JsonNode value) {
    return switch (shape) {
      case "string" -> value.isTextual();
      case "number" -> value.isNumber() && Double.isFinite(value.doubleValue());
      case "boolean" -> value.isBoolean();
      // An option's value is whatever the option list holds; that it is one of the offered options
      // is a validator's question, not a shape's.
      case "option" -> true;
      case "option[]", "file[]" -> value.isArray();
      case "dateRange" -> value.isObject() && value.has("start") && value.has("end");
      default -> throw new IllegalStateException("Unknown value shape: " + shape);
    };
  }

  /** JavaScript's {@code typeof} for a JSON value that is neither null, an object nor an array. */
  private static String typeOf(JsonNode value) {
    if (value.isTextual()) return "string";
    if (value.isNumber()) return "number";
    return "boolean";
  }

  /**
   * Why a value of the right shape is still not one the kind can hold: a date, a time and a colour
   * are strings with a form, and a range is two dates. The empty string is how absence is written
   * wherever a value is a formatted string, so it passes.
   */
  private static String contentMismatch(String kind, JsonNode value) {
    if (value.isTextual() && value.textValue().isEmpty()) return null;
    switch (kind) {
      case "datepicker":
        return MdyDynamicFormParser.isIsoDate(value.textValue()) ? null
            : kind + " holds an ISO date (yyyy-MM-dd), got " + MdyDynamicFormParser.jsonText(value);
      case "timepicker":
        return TIME.matcher(value.textValue()).matches() ? null
            : kind + " holds a time (HH:mm), got " + MdyDynamicFormParser.jsonText(value);
      case "colors":
        return HEX_COLOR.matcher(value.textValue()).matches() ? null
            : kind + " holds a hex colour (#rgb or #rrggbb), got " + MdyDynamicFormParser.jsonText(value);
      case "daterange":
        for (String end : new String[] {"start", "end"}) {
          JsonNode held = value.get(end);
          if (held.isNull() || (held.isTextual() && MdyDynamicFormParser.isIsoDate(held.textValue()))) continue;
          return kind + " holds ISO dates, and " + end + " is " + MdyDynamicFormParser.jsonText(held);
        }
        return null;
      default:
        return null;
    }
  }
}
