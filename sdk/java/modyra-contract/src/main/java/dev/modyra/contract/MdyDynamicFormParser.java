package dev.modyra.contract;

import com.fasterxml.jackson.annotation.JsonSubTypes;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.math.BigDecimal;
import java.math.MathContext;
import java.math.RoundingMode;
import java.time.DateTimeException;
import java.time.LocalDate;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Deque;
import java.util.HashMap;
import java.util.HashSet;
import java.util.IdentityHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Mirrors {@code parseDynamicForm}/{@code parseDynamicFields} in
 * packages/core/src/dynamic-config.ts: never throws on untrusted input,
 * every field is validated independently (a bad one is dropped with an
 * {@code error} diagnostic, not a parse failure for the whole document), and
 * {@code STRICT} mode returns no fields/layout/rules at all if any error was
 * reported (never publish/accept a partially-valid document), matching TS
 * exactly. A {@code warning} is worth knowing and refuses nothing, in either
 * mode.
 *
 * <p>Handles three envelope shapes: a bare JSON array, {@code {"version":
 * 2..5, "fields": [...]}}, and the recursive {@code {"version": 2..5,
 * "schema": {...}}} envelope (nested {@code group}/{@code array}/{@code
 * field} nodes, flattened to dotted/indexed paths exactly like {@code
 * flattenDynamicSchema} in TS). {@code layout}/{@code rules} are validated
 * against the resolved field names and kept as the raw JSON nodes, same as
 * the TS reference implementation.
 */
public final class MdyDynamicFormParser {

  public enum Mode { STRICT, LENIENT }

  private static final Set<String> FORBIDDEN_NAMES = Set.of("__proto__", "prototype", "constructor");

  private static final Set<String> SCHEMA_NODE_KINDS = Set.of("field", "group", "array", "record");
  private static final Set<String> RULE_EFFECTS = Set.of("visible", "hidden", "enabled", "disabled");
  private static final Set<String> RULE_OPERATORS = Set.of(
      "equals", "notEquals", "in", "notIn", "isEmpty", "isNotEmpty",
      "greaterThan", "greaterThanOrEqual", "lessThan", "lessThanOrEqual");
  /** The rule operators that order two values, so their {@code value} must be orderable. */
  private static final Set<String> ORDERING_RULE_OPERATORS = Set.of(
      "greaterThan", "greaterThanOrEqual", "lessThan", "lessThanOrEqual");
  /** The kinds whose value is an ISO date, so a comparison against them is a date comparison. */
  private static final Set<String> DATE_KINDS = Set.of("datepicker", "daterange");
  /** The one spelling of a date a rule may order against: {@code yyyy-MM-dd}, ASCII digits. */
  private static final Pattern ISO_DATE = Pattern.compile("^\\d{4}-\\d{2}-\\d{2}$");
  /**
   * How deep a schema may nest before this parser stops walking it.
   *
   * <p>Not the contract's rule: a collection nests without a limit (ADR 0043), and this parser
   * accepted eight levels while the runtime accepted any — so a document the engine runs was refused
   * here. What remains is a bound on what <em>this walk</em> can process: it recurses, and a
   * document deep enough would end the thread rather than produce a diagnostic a caller can answer.
   *
   * <p>Generous on purpose. No form a person arranges comes near it, and a document that does was
   * made by a generator or a loop.
   */
  private static final int SCHEMA_MAX_DEPTH = 100;
  private static final int SCHEMA_MAX_NODES = 500;
  /** The version {@code validators.integer} arrived with, as {@code MDY_DYNAMIC_MEMBER_ARRIVALS} records it. */
  private static final int INTEGER_ARRIVED_WITH = 5;
  private static final int SCHEMA_MAX_ARRAY_ROWS = 100;

  /**
   * Unknown properties are reported, never silently dropped.
   *
   * The records used to carry {@code @JsonIgnoreProperties(ignoreUnknown = true)} each, which made
   * a document this SDK did not understand parse cleanly and re-serialise as something else — a
   * multiselect losing its mode stops being the widget it was written as. Failing outright would
   * trade that for the opposite problem, refusing every document written against a later contract.
   *
   * So the mapper stays lenient and the parser says what it ignored, in the diagnostics vocabulary
   * the rest of this class already speaks.
   */
  private final ObjectMapper mapper = new ObjectMapper()
      .configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);

  /**
   * The members of {@code value} its slot does not declare, in the order the document wrote them.
   *
   * <p>Anything that is not an object has no members to report: it is refused elsewhere, for being
   * the wrong shape, and a second finding about the same thing sends a reader to two places for one
   * fault.
   */
  private static List<String> unknownMembers(JsonNode value, Set<String> declared) {
    if (value == null || !value.isObject()) return List.of();
    List<String> unknown = new ArrayList<>();
    value.fieldNames().forEachRemaining((name) -> {
      if (!declared.contains(name)) unknown.add(name);
    });
    return unknown;
  }

  /**
   * The members each slot of a document declares, as {@code MDY_DYNAMIC_MEMBERS} in
   * packages/core/src/dynamic/members.ts lists them. The published JSON Schema closes every one of
   * these objects, so a member outside its list is one nothing reads; it is reported and never
   * refused, because a reader may meet a document written against a contract it predates.
   *
   * <p>Package-private so the test suite can hold each list against the TypeScript source it mirrors.
   */
  static final Set<String> DOCUMENT_MEMBERS = Set.of(
      "version", "id", "fields", "schema", "layout", "rules", "validations", "requiresContext");

  /**
   * Every member a field of any kind may carry: the members every field has, then the ones a kind
   * adds. A document naming one on the wrong kind is a document naming a member the contract has, so
   * the list is one list and not one per kind. Wider than the records here read, because reporting a
   * member is not the same as carrying it.
   */
  static final Set<String> FIELD_MEMBERS = Set.of(
      "name", "kind", "label", "ariaLabel", "placeholder", "supportingText", "initialValue",
      "validators", "sensitive", "prefix", "suffix",
      "min", "max", "step",
      "options", "mode", "searchable", "reorderable", "loading",
      "locale", "firstDayOfWeek", "minDate", "maxDate", "format", "viewMode", "granularity",
      "animateHand", "showUnavailable",
      "accept", "multiple",
      "presets");

  /** The members a validator block declares: the record that reads it is the list. */
  static final Set<String> VALIDATOR_MEMBERS = recordComponentNames(MdyDynamicValidators.class);

  /** The rules a field declares, and so the only keys {@code validators.messages} may name. */
  static final Set<String> VALIDATOR_MESSAGE_KEYS = recordComponentNames(MdyDynamicValidatorMessages.class);

  static final Set<String> OPTION_MEMBERS = Set.of("value", "label", "disabled");
  static final Set<String> RULE_MEMBERS = Set.of("effect", "target", "when");
  static final Set<String> VALIDATION_MEMBERS = Set.of("when", "message", "target");
  static final Set<String> LAYOUT_SECTION_MEMBERS = Set.of("kind", "id", "label", "at", "children");
  static final Set<String> LAYOUT_COLUMNS_MEMBERS = Set.of("kind", "id", "at", "columns");
  static final Set<String> LAYOUT_SLOT_MEMBERS = Set.of("ref", "at");

  /** The kinds a field may declare: the names the field type dispatches on, read from its annotation. */
  static final Set<String> FIELD_KINDS = fieldKinds(null);

  /** The kinds a choice is made from, and so the ones that must carry an options list. */
  static final Set<String> OPTIONS_KINDS = fieldKinds(MdyDynamicOptionsField.class);

  private static Set<String> recordComponentNames(Class<? extends Record> type) {
    Set<String> names = new HashSet<>();
    for (var component : type.getRecordComponents()) names.add(component.getName());
    return Set.copyOf(names);
  }

  /** The kind names dispatched to {@code implementation}, or every kind name when it is null. */
  private static Set<String> fieldKinds(Class<?> implementation) {
    Set<String> kinds = new HashSet<>();
    for (var type : MdyDynamicField.class.getAnnotation(JsonSubTypes.class).value()) {
      if (implementation == null || type.value() == implementation) kinds.add(type.name());
    }
    return Set.copyOf(kinds);
  }

  public MdyDynamicFormParseResult parse(String json, Mode mode) {
    JsonNode root;
    try {
      root = mapper.readTree(json);
    } catch (JsonProcessingException e) {
      return new MdyDynamicFormParseResult(
          false, null, List.of(), List.of(), List.of(),
          List.of(new MdyDynamicDiagnostic("MDY_DYNAMIC_INVALID_JSON", MdyDynamicDiagnostic.ERROR, "/", "Input is not valid JSON: " + e.getOriginalMessage())),
          0, 0);
    }
    return parse(root, mode);
  }

  public MdyDynamicFormParseResult parse(JsonNode root, Mode mode) {
    List<MdyDynamicField> accepted;
    List<MdyDynamicDiagnostic> diagnostics = new ArrayList<>();
    Integer version;
    int sourceCount;
    /** How many fields a tree document declared, kept or not; null until a tree is walked. */
    Integer declaredLeaves = null;
    /**
     * How many of those the walk turned down. Counted from what was refused rather than from the
     * difference between declared and kept: a collection's cells are declared and never become flat
     * fields, so the difference would call every one of them a rejection.
     */
    int treeRejected = 0;

    // A version this reader does not have is answered as a version, before the envelope's shape is
    // looked at: read as a malformed field list, a document from a newer publisher sends its host
    // hunting for a broken field when the answer is that this reader does not have that version.
    if (root.isObject() && root.has("version") && supportedVersion(root.get("version")) == -1) {
      JsonNode declared = root.get("version");
      boolean one = isWholeNumber(declared) && declared.asInt() == 1;
      return new MdyDynamicFormParseResult(
          false, null, List.of(), List.of(), List.of(),
          List.of(new MdyDynamicDiagnostic("MDY_DYNAMIC_UNSUPPORTED_VERSION", MdyDynamicDiagnostic.ERROR, "/version",
              "Unsupported dynamic form config version " + jsonText(declared) + " — this contract has versions "
                  + "2, 3, 4 and 5, and nothing in this document was read. "
                  + (one
                      ? "Version 1 was read by this runtime alone and is no longer supported — set \"version\": 2, "
                          + "which reads the same fields."
                      : "The document is from a publisher this reader does not know."))),
          0, 0);
    }

    if (root.isArray()) {
      version = 1;
      FlatResult flat = parseFlatItems(root);
      accepted = flat.accepted;
      diagnostics.addAll(flat.diagnostics);
      sourceCount = root.size();
    } else if (root.isObject() && supportedVersion(root.path("version")) != -1 && root.has("schema")) {
      version = supportedVersion(root.path("version"));
      List<MdyDynamicDiagnostic> schemaDiagnostics = new ArrayList<>();
      // What a field node declares, judged where it is written: a shape the walk can still enter,
      // so it does not turn the document down whole the way a structural finding does.
      List<MdyDynamicDiagnostic> perField = new ArrayList<>();
      Set<String> contextKeys = new LinkedHashSet<>();
      validateSchema(root.get("schema"), "/schema", "schema", 0, schemaDiagnostics, perField, new int[]{0}, contextKeys, Set.of());
      diagnostics.addAll(schemaDiagnostics);
      diagnostics.addAll(perField);
      // A key a condition reads and the document does not declare. `requiresContext` is the whole of
      // what tells a host which values to supply, so a key missing from it is one no host would think
      // to pass — and a condition that cannot be read decides false, hiding the fields it guards. The
      // fields are still read: the declaration is wrong, not the tree.
      Set<String> declared = new LinkedHashSet<>();
      JsonNode requires = root.path("requiresContext");
      if (requires.isArray()) for (JsonNode key : requires) if (key.isTextual()) declared.add(key.asText());
      List<String> undeclared = new ArrayList<>();
      for (String key : contextKeys) if (!declared.contains(key)) undeclared.add(key);
      if (!undeclared.isEmpty()) {
        diagnostics.add(new MdyDynamicDiagnostic("MDY_DYNAMIC_UNDECLARED_CONTEXT", MdyDynamicDiagnostic.ERROR, "/requiresContext",
            "conditions read context " + quoted(undeclared) + ", which this document does not declare in "
                + "\"requiresContext\" — a host cannot supply what it is not told about."));
      }
      // What the document said it had, counted before anything is refused: a schema turned down
      // whole never reaches the walk, and without the count a document declaring three children
      // would report none accepted and none rejected — three entered and nothing came out.
      declaredLeaves = declaredFieldCount(root.get("schema"));
      if (schemaDiagnostics.isEmpty()) {
        // Every finding the walk reports is one leaf turned down, so the walk's count replaces the
        // per-field one: the walk sees each row a template is repeated into, the check above sees
        // the template once.
        int before = diagnostics.size();
        accepted = flattenSchema(root.get("schema"), diagnostics);
        treeRejected = diagnostics.size() - before;
        declaredLeaves = Math.max(declaredLeaves, accepted.size() + treeRejected);
      } else {
        // A shape the walk cannot enter turns the document down whole, so everything it declared
        // was turned down.
        accepted = List.of();
        treeRejected = declaredLeaves;
      }
      sourceCount = accepted.size();
    } else if (root.isObject() && root.has("fields") && !root.has("version")) {
      // An envelope that declares no version is not read: every entry it lists counts as turned
      // down, and each member only a versioned document carries is named below, so the author learns
      // that the version is what is missing rather than that the fields are wrong.
      //
      // "version undefined" is deliberate: `undefined` is how JavaScript spells a member that is not
      // there, and the sentence is the TypeScript reader's word for word, so a host matching on the
      // message meets one sentence from both readers.
      JsonNode itemsNode = root.get("fields");
      diagnostics.add(new MdyDynamicDiagnostic("MDY_DYNAMIC_UNSUPPORTED_VERSION", MdyDynamicDiagnostic.ERROR, "/fields",
          "Unsupported dynamic form config version undefined — this contract has versions 2, 3, 4 and 5."));
      version = null;
      accepted = List.of();
      sourceCount = itemsNode.isArray() ? itemsNode.size() : 0;
    } else if (root.isObject() && root.path("fields").isArray()) {
      version = supportedVersion(root.path("version"));
      JsonNode itemsNode = root.get("fields");
      FlatResult flat = parseFlatItems(itemsNode);
      accepted = flat.accepted;
      diagnostics.addAll(flat.diagnostics);
      sourceCount = itemsNode.size();
    } else {
      // No field list to read. A supported version is still the document's version, and the members
      // it entitles the document to are still read below.
      int v = root.isObject() ? supportedVersion(root.path("version")) : -1;
      version = v == -1 ? null : v;
      diagnostics.add(new MdyDynamicDiagnostic("MDY_DYNAMIC_INVALID_FIELD", MdyDynamicDiagnostic.ERROR, "/fields",
          "Dynamic form config is neither a field array nor a config envelope."));
      accepted = List.of();
      sourceCount = 0;
    }

    // A member no version of this contract has, on the envelope itself. A document reaching for
    // something the contract does not do — a computation, a slot an author expected to exist — would
    // otherwise parse clean and render a form that quietly does not do it.
    if (root.isObject()) {
      reportUnknownMembers(root, DOCUMENT_MEMBERS, "the document", "/", diagnostics);
    }
    // A member the document's version predates. `requiresContext` arrived with v4, so a v2 or v3
    // document carrying it declares a need nothing acts on — the answer the TypeScript reader gives,
    // so one contract does not say two things to one author.
    if (version != null && version < 4 && root.isObject() && root.has("requiresContext")) {
      diagnostics.add(new MdyDynamicDiagnostic("MDY_DYNAMIC_UNSUPPORTED_VERSION", MdyDynamicDiagnostic.ERROR, "/requiresContext",
          "Unsupported dynamic form config version for \"requiresContext\": it arrived with version 4, "
              + "and this document says " + version + ". Set \"version\": 4 to use it."));
    }
    // A document that declares no version reads fields and nothing else: each member only a
    // versioned document carries is named, so the author learns that the version is what is missing.
    if (version == null && root.isObject()) {
      for (String slot : List.of("layout", "rules", "validations")) {
        if (!root.has(slot)) continue;
        diagnostics.add(new MdyDynamicDiagnostic("MDY_DYNAMIC_UNSUPPORTED_VERSION", MdyDynamicDiagnostic.ERROR, "/" + slot,
            "Unsupported dynamic form config version for \"" + slot + "\": a document that declares no version "
                + "reads fields and nothing else. Set \"version\": 2 to use it."));
      }
    }
    Set<String> names = new HashSet<>();
    // What each declared field holds, so a rule's value can be judged against the field it reads.
    Map<String, String> kindOf = new HashMap<>();
    for (MdyDynamicField field : accepted) {
      names.add(field.name());
      kindOf.put(field.name(), field.kind());
    }
    List<JsonNode> layout = new ArrayList<>();
    List<JsonNode> rules = new ArrayList<>();
    // v3 is v2 plus per-slot placement: every envelope member is read the same way.
    if (version != null && isStructuredVersion(version) && root.isObject()) {
      parseLayout(root.path("layout"), names, version, layout, diagnostics);
      parseRules(root.path("rules"), names, kindOf, rules, diagnostics);
      parseValidations(root.path("validations"), names, diagnostics);
    }
    // A rule the document's version predates. `integer` arrived with v5, and a document of an
    // earlier version carrying it asks for a constraint no reader of that version applies, so the
    // field would validate one way here and another wherever the declared version is honoured.
    // A bare array is version 1 and is held to the same arrival.
    if (version != null && version < INTEGER_ARRIVED_WITH) {
      JsonNode source = root.isArray()
          ? root
          : root.isObject() && supportedVersion(root.path("version")) != -1 && root.has("schema") ? root.get("schema") : root.path("fields");
      // Every row of a collection is read from one template, so its rows point at the same word.
      Set<String> reported = new HashSet<>();
      for (MdyDynamicField field : accepted) {
        if (field.validators() == null || field.validators().integer() == null) continue;
        String at = fieldReadPath(source, field.name());
        String path = (at != null ? at : source.isArray() ? "/fields" : "/schema") + "/validators/integer";
        if (!reported.add(path)) continue;
        diagnostics.add(new MdyDynamicDiagnostic("MDY_DYNAMIC_UNSUPPORTED_VERSION", MdyDynamicDiagnostic.ERROR,
            path,
            "Unsupported dynamic form config version for \"integer\": it arrived with version "
                + INTEGER_ARRIVED_WITH + ", and this document says " + version + ". Set \"version\": "
                + INTEGER_ARRIVED_WITH + " to use it."));
      }
    }

    boolean strict = mode == Mode.STRICT;
    // What strict mode refuses on is an error. A warning is the severity a consumer reads to tell
    // what must be fixed from what is worth knowing, so refusing the whole document for one would
    // turn the distinction into a second word for "error".
    //
    // `ok` is false whenever an error was reported, in either mode: a lenient result still carries
    // what could be read, and `ok` withdraws only the claim that nothing was lost.
    boolean refused = diagnostics.stream().anyMatch(d -> MdyDynamicDiagnostic.ERROR.equals(d.severity()));
    boolean blockAll = strict && refused;
    // A finding about one entry of a list, wherever under the entry it sits. A finding about the list
    // itself (`/layout` is not an array) turns down no entry, so it is not counted — the same line
    // the TypeScript reader draws.
    int rejectedFromLayoutRules = (int) diagnostics.stream()
        .filter(d -> d.path().startsWith("/layout/") || d.path().startsWith("/rules/") || d.path().startsWith("/validations/"))
        .count();
    int rejectedCount = (declaredLeaves == null ? Math.max(0, sourceCount - accepted.size()) : treeRejected)
        + rejectedFromLayoutRules;
    // What the document declared and the parser understood. For a tree that is every field node it
    // declares, collections included, minus what was refused — `accepted` cannot answer it, because a
    // collection's cells are not flat fields until rows exist.
    int acceptedCount = declaredLeaves == null ? accepted.size() : Math.max(0, declaredLeaves - rejectedCount);

    return new MdyDynamicFormParseResult(
        version != null && !refused,
        version,
        blockAll ? List.of() : List.copyOf(accepted),
        blockAll ? List.of() : List.copyOf(layout),
        blockAll ? List.of() : List.copyOf(rules),
        List.copyOf(diagnostics),
        acceptedCount,
        rejectedCount);
  }

  /**
   * How many fields a schema says it has, counted without trusting it.
   *
   * <p>Read off the raw tree over an explicit stack, because this runs on a document the validator
   * may have already refused: it must not assume any node is well formed. A node that is neither a
   * field nor a container the walk can descend counts as one declaration — something was written
   * there, and it did not become a field. A collection is descended and counts as neither: its cells
   * are declared, and they legitimately never become flat fields because a document cannot name rows
   * that do not exist yet.
   *
   * <p>The walk stops after {@link #MAX_DECLARATION_WALK} steps, so a shape nothing has validated
   * cannot make it run without end; the count is then a floor rather than a total.
   */
  private static int declaredFieldCount(JsonNode schema) {
    int count = 0;
    Deque<JsonNode> stack = new ArrayDeque<>();
    stack.push(schema);
    for (int steps = 0; !stack.isEmpty() && steps < MAX_DECLARATION_WALK; steps++) {
      JsonNode node = stack.pop();
      if (!node.isObject()) continue;
      String kind = node.path("node").isTextual() ? node.path("node").asText() : null;
      if ("field".equals(kind)) {
        count++;
      } else if ("group".equals(kind)) {
        JsonNode children = node.path("children");
        if (children.isObject()) children.forEach(stack::push);
        else count++;
      } else if ("array".equals(kind) || "record".equals(kind)) {
        stack.push(node.path("item"));
      } else {
        count++;
      }
    }
    return count;
  }

  /** How many declarations the count walks before it stops: {@code MDY_MAX_DECLARATION_WALK} in the TS parser. */
  private static final int MAX_DECLARATION_WALK = 100_000;

  /**
   * A key as one segment of a diagnostic path, escaped as RFC 6901 escapes a JSON Pointer token.
   *
   * "/" and "~" are legal in a name, so a key written raw splits into segments that address something
   * else: child {@code a/b} would read as child {@code a}, then {@code b}. "~" is escaped first, or the
   * "~1" written for a "/" would itself be rewritten.
   */
  private static String pointerSegment(String key) {
    return key.replace("~", "~0").replace("/", "~1");
  }

  /**
   * Where a flattened field was written in the document, as a diagnostic path, or null when the
   * document does not hold it.
   *
   * A flat list addresses an entry by index, and the entry is the first object carrying the name: the
   * reader claims a name before any other check, so a later entry with it is the refused duplicate. A
   * tree's flattened name is its keys joined by ".", which no key may contain, so the walk retraces it:
   * a group descends by key, a collection's segment is a row and every row is read from the one
   * {@code item} template, and a leaf's declaration sits under {@code field}.
   */
  private static String fieldReadPath(JsonNode source, String name) {
    if (source.isArray()) {
      for (int i = 0; i < source.size(); i++) {
        JsonNode item = source.get(i);
        if (item.isObject() && item.path("name").isTextual() && item.path("name").asText().equals(name)) return "/fields/" + i;
      }
      return null;
    }
    JsonNode node = source;
    StringBuilder path = new StringBuilder("/schema");
    for (String segment : name.split("\\.", -1)) {
      if (!node.isObject()) return null;
      String kind = node.path("node").asText("");
      if (kind.equals("group") && node.path("children").isObject()) {
        node = node.path("children").path(segment);
        path.append("/children/").append(pointerSegment(segment));
      } else if (kind.equals("array") || kind.equals("record")) {
        node = node.path("item");
        path.append("/item");
      } else {
        return null;
      }
    }
    return node.isObject() && node.path("node").asText("").equals("field") ? path.append("/field").toString() : null;
  }

  private record FlatResult(List<MdyDynamicField> accepted, List<MdyDynamicDiagnostic> diagnostics) {
  }

  private FlatResult parseFlatItems(JsonNode itemsNode) {
    List<MdyDynamicField> accepted = new ArrayList<>();
    List<MdyDynamicDiagnostic> diagnostics = new ArrayList<>();
    Set<String> seenNames = new HashSet<>();
    int index = 0;
    for (JsonNode item : itemsNode) {
      // Where this entry is written, so a finding underlines the entry rather than the array. A
      // duplicate names the second occurrence: the first is legitimate until the second exists, and
      // the second is the one a reader has to change.
      String path = "/fields/" + index;
      index++;

      // Every refusal of a field is an error, in the TypeScript reader's words: a field the document
      // declared and the form will not have is a loss, whatever mode the caller asked for.
      //
      // An array is an object to JavaScript, so it passes this door and is refused at the next for
      // having no name; the sentence is kept so both readers say the same thing about the same entry.
      if (!item.isObject() && !item.isArray()) {
        diagnostics.add(new MdyDynamicDiagnostic("MDY_DYNAMIC_INVALID_FIELD", MdyDynamicDiagnostic.ERROR, path,
            "Dropped non-object dynamic field: " + jsonText(item)));
        continue;
      }
      JsonNode nameNode = item.get("name");
      if (nameNode == null || !nameNode.isTextual() || nameNode.asText().isEmpty()) {
        diagnostics.add(new MdyDynamicDiagnostic("MDY_DYNAMIC_INVALID_FIELD", MdyDynamicDiagnostic.ERROR, path,
            "Dropped dynamic field without a name: " + jsonText(item)));
        continue;
      }
      String name = nameNode.asText();
      if (!isSafeSegment(name)) {
        diagnostics.add(new MdyDynamicDiagnostic("MDY_DYNAMIC_UNSAFE_NAME", MdyDynamicDiagnostic.ERROR, path,
            "Dropped dynamic field \"" + name + "\": name is reserved or contains forbidden path separators."));
        continue;
      }
      MdyDynamicDiagnostic unusable = nameRefusal(name, nameNode, path);
      if (unusable != null) {
        diagnostics.add(unusable);
        continue;
      }
      if (!seenNames.add(name)) {
        diagnostics.add(new MdyDynamicDiagnostic("MDY_DYNAMIC_DUPLICATE_NAME", MdyDynamicDiagnostic.ERROR, path,
            "Dropped duplicate dynamic field name \"" + name + "\"."));
        continue;
      }
      // The kind is judged before the mapper sees the entry, so the refusal names the kind the way
      // JavaScript spells the value — `undefined` for none, `[object Object]` for an object — rather
      // than the way a deserializer describes a type id it has no subtype for.
      JsonNode kind = item.get("kind");
      if (kind == null || !kind.isTextual() || !FIELD_KINDS.contains(kind.asText())) {
        diagnostics.add(new MdyDynamicDiagnostic("MDY_DYNAMIC_UNKNOWN_KIND", MdyDynamicDiagnostic.ERROR, path,
            "Dropped dynamic field \"" + name + "\" with unknown kind \"" + MdyExpressions.jsString(kind) + "\"."));
        continue;
      }

      // The document is judged as written, in the order the TypeScript reader judges it, before the
      // mapper builds anything from it: the mapper coerces and ignores where the contract refuses,
      // and a refusal it does produce describes a Java type rather than the document.
      if (!messagesAreReadable(item, name, diagnostics)) continue;
      if (!patternIsUsable(item, name, diagnostics)) continue;
      reportUnknownFieldMembers(item, name, path, diagnostics);
      if (OPTIONS_KINDS.contains(kind.asText()) && !hasValidOptions(item.path("options"))) {
        diagnostics.add(new MdyDynamicDiagnostic("MDY_DYNAMIC_OPTIONS_REQUIRED", MdyDynamicDiagnostic.ERROR, path,
            "Dropped dynamic field \"" + name + "\": kind \"" + kind.asText() + "\" requires a valid options array."));
        continue;
      }
      MdyDynamicField field;
      try {
        field = mapper.treeToValue(item, MdyDynamicField.class);
      } catch (JsonProcessingException e) {
        diagnostics.add(new MdyDynamicDiagnostic("MDY_DYNAMIC_INVALID_FIELD", MdyDynamicDiagnostic.ERROR, path,
            "Dropped dynamic field \"" + name + "\": " + e.getOriginalMessage()));
        continue;
      }
      accepted.add(field);
    }
    return new FlatResult(accepted, diagnostics);
  }

  /**
   * Whether the words a field wrote for its own rules can be read, dropping the field otherwise.
   *
   * <p>A message is checked like everything else a document declares: a key that names no rule is a
   * sentence nothing will ever say, and a value that is not a string, or that ECMAScript
   * {@code trim} leaves empty, is a sentence nobody can read — which is the thing this slot exists
   * to prevent. The mapper alone would keep both: it ignores the key and reads a number as its
   * digits.
   *
   * <p>Reported at {@code /fields}, where the TypeScript reader puts a validator's refusal.
   */
  private static boolean messagesAreReadable(JsonNode item, String name, List<MdyDynamicDiagnostic> diagnostics) {
    JsonNode messages = item.path("validators").path("messages");
    if (messages.isMissingNode()) return true;
    if (!messages.isObject()) {
      diagnostics.add(new MdyDynamicDiagnostic("MDY_DYNAMIC_INVALID_FIELD", MdyDynamicDiagnostic.ERROR, "/fields",
          "Dropped dynamic field \"" + name + "\": validators.messages must be an object."));
      return false;
    }
    for (var entry : messages.properties()) {
      String key = entry.getKey();
      if (!VALIDATOR_MESSAGE_KEYS.contains(key)) {
        diagnostics.add(new MdyDynamicDiagnostic("MDY_DYNAMIC_INVALID_FIELD", MdyDynamicDiagnostic.ERROR, "/fields",
            "Dropped dynamic field \"" + name + "\": validators.messages names \"" + key + "\", which is not a rule a field declares."));
        return false;
      }
      JsonNode said = entry.getValue();
      if (!said.isTextual() || isJsBlank(said.asText())) {
        diagnostics.add(new MdyDynamicDiagnostic("MDY_DYNAMIC_INVALID_FIELD", MdyDynamicDiagnostic.ERROR, "/fields",
            "Dropped dynamic field \"" + name + "\": validators.messages." + key + " must be a message a person can read."));
        return false;
      }
    }
    return true;
  }

  /**
   * Members nobody declared, on the field and on the objects it carries. The field is kept: a reader
   * may meet a document written against a contract it predates, and dropping the field would turn a
   * report into a loss. What is not kept is the silence — and the finding is an error, because a
   * document reaching for something the contract does not do would otherwise render a form that
   * quietly does not do it.
   */
  private static void reportUnknownFieldMembers(JsonNode item, String name, String path, List<MdyDynamicDiagnostic> diagnostics) {
    reportUnknownMembers(item, FIELD_MEMBERS, "dynamic field \"" + name + "\"", path, diagnostics);
    reportUnknownMembers(item.path("validators"), VALIDATOR_MEMBERS, "the validators of \"" + name + "\"", path, diagnostics);
    JsonNode options = item.path("options");
    if (!options.isArray()) return;
    for (int i = 0; i < options.size(); i++) {
      reportUnknownMembers(options.get(i), OPTION_MEMBERS, "an option of \"" + name + "\"", path + "/options/" + i, diagnostics);
    }
  }

  /**
   * One error naming every member of {@code value} that {@code declared} does not list, at the path
   * where the value is written, or nothing when there is none. {@code what} is the subject of the
   * sentence — "a rule", "the document" — as the TypeScript reader words it.
   */
  private static void reportUnknownMembers(JsonNode value, Set<String> declared, String what, String at,
      List<MdyDynamicDiagnostic> diagnostics) {
    List<String> unknown = unknownMembers(value, declared);
    if (unknown.isEmpty()) return;
    diagnostics.add(new MdyDynamicDiagnostic("MDY_DYNAMIC_UNKNOWN_MEMBER", MdyDynamicDiagnostic.ERROR, at,
        what + " carries " + jsonQuoted(unknown) + ", which this contract does not declare, so nothing reads it."));
  }

  /**
   * Every layout node and every slot under one, each held to its own published list.
   *
   * <p>Reported at every depth, not only at the top: a document's layout nests, and a member outside
   * the list is a member nothing reads wherever it is written. A slot is where it costs the most —
   * {@code at} is how a field says which column it takes at which size, so {@code att} is a
   * placement that never happens, and the node parses clean with the misspelling kept.
   *
   * <p>Over a stack rather than by recursion, in the order the TypeScript reader walks it: a node,
   * then its children last-first. The walk stops at the depth the validator refuses, so a layout
   * deeper than the contract allows is refused there rather than walked here.
   */
  private static void reportLayoutMembers(JsonNode root, String rootPath, List<MdyDynamicDiagnostic> diagnostics) {
    record Pending(JsonNode node, String at, int depth) {}
    Deque<Pending> pending = new ArrayDeque<>();
    pending.push(new Pending(root, rootPath, 1));
    while (!pending.isEmpty()) {
      Pending next = pending.pop();
      JsonNode node = next.node();
      if (!node.isObject() || next.depth() > LAYOUT_MAX_DEPTH) continue;
      // A slot is the third shape a layout position can take, beside the two node kinds: it names a
      // field and says where it sits. `ref` is what separates it from a node, which always has a
      // `kind`.
      Set<String> members = "columns".equals(node.path("kind").asText(null))
          ? LAYOUT_COLUMNS_MEMBERS
          : !node.has("kind") && node.has("ref") ? LAYOUT_SLOT_MEMBERS : LAYOUT_SECTION_MEMBERS;
      reportUnknownMembers(node, members, node.has("kind") ? "a layout node" : "a layout slot", next.at(), diagnostics);
      JsonNode children = node.path("children");
      if (children.isArray()) {
        for (int i = 0; i < children.size(); i++) {
          pending.push(new Pending(children.get(i), next.at() + "/children/" + i, next.depth() + 1));
        }
        continue;
      }
      JsonNode columns = node.path("columns");
      if (!columns.isArray()) continue;
      for (int track = 0; track < columns.size(); track++) {
        JsonNode column = columns.get(track);
        if (!column.isArray()) continue;
        for (int i = 0; i < column.size(); i++) {
          pending.push(new Pending(column.get(i), next.at() + "/columns/" + track + "/" + i, next.depth() + 1));
        }
      }
    }
  }

  /** Member names as {@code JSON.stringify} quotes each, joined by commas. */
  private static String jsonQuoted(List<String> names) {
    StringBuilder joined = new StringBuilder();
    for (String name : names) {
      if (joined.length() > 0) joined.append(", ");
      writeString(name, joined);
    }
    return joined.toString();
  }

  /**
   * Whether an options list is one a choice can be made from: every option an object with a
   * {@code value} and a textual {@code label}, and {@code disabled} a boolean when written.
   *
   * <p>A value may be a string, a number, a boolean or an object keyed by what it holds (ADR 0051).
   * {@code null} is refused because it is the empty value of half the kinds — an option meaning
   * "nothing" cannot be told apart from no choice at all. An array is refused because the schema an
   * author's editor checks against does not allow one. An empty list has no option to refuse and is
   * accepted, as the TypeScript reader accepts it.
   */
  private static boolean hasValidOptions(JsonNode options) {
    if (!options.isArray()) return false;
    for (JsonNode option : options) {
      if (!option.isObject() || !option.has("value")) return false;
      JsonNode value = option.get("value");
      if (value.isNull() || value.isArray()) return false;
      JsonNode label = option.get("label");
      if (label == null || !label.isTextual()) return false;
      JsonNode disabled = option.get("disabled");
      if (disabled != null && !disabled.isBoolean()) return false;
    }
    return true;
  }

  /**
   * Whether a field's {@code validators.pattern} lets the field be read, reporting what is wrong
   * with it either way.
   *
   * <p>A pattern that is not a string, or longer than the cap, takes the field with it: there is no
   * rule to keep. A pattern that would backtrack exponentially (ADR 0050), or that no JavaScript
   * engine compiles, is reported as an error and the field stays — one rule the engine will not run
   * is not a reason to take an input away from the person filling the form. Either way the result
   * is not {@code ok}, so a publishing gate does not approve a rule that will never exist.
   *
   * <p>The diagnostics sit at {@code /fields}, where the TypeScript reader puts a validator's
   * refusal, so a host matching on path sees the same thing from both readers.
   */
  private static boolean patternIsUsable(JsonNode item, String name, List<MdyDynamicDiagnostic> diagnostics) {
    JsonNode pattern = item.path("validators").path("pattern");
    if (pattern.isMissingNode()) return true;
    if (!pattern.isTextual()) {
      diagnostics.add(new MdyDynamicDiagnostic("MDY_DYNAMIC_INVALID_FIELD", MdyDynamicDiagnostic.ERROR, "/fields",
          "Dropped dynamic field \"" + name + "\": validators.pattern must be a string."));
      return false;
    }
    String source = pattern.asText();
    if (source.length() > MdyDynamicPatterns.MAX_LENGTH) {
      diagnostics.add(new MdyDynamicDiagnostic("MDY_DYNAMIC_PATTERN_TOO_LONG", MdyDynamicDiagnostic.ERROR, "/fields",
          "Dropped dynamic field \"" + name + "\": validators.pattern length exceeds max " + MdyDynamicPatterns.MAX_LENGTH + "."));
      return false;
    }
    String refusal = MdyDynamicPatterns.costRefusal(source);
    if (refusal != null) {
      diagnostics.add(new MdyDynamicDiagnostic("MDY_DYNAMIC_PATTERN_TOO_COSTLY", MdyDynamicDiagnostic.ERROR, "/fields",
          "Dropped validators.pattern on dynamic field \"" + name + "\": the pattern has " + refusal + "."));
    } else if (!MdyDynamicPatterns.compiles(source)) {
      diagnostics.add(new MdyDynamicDiagnostic("MDY_DYNAMIC_INVALID_FIELD", MdyDynamicDiagnostic.ERROR, "/fields",
          "Dropped validators.pattern on dynamic field \"" + name + "\": \"" + source
              + "\" is not a regular expression this platform can compile, so the rule never runs."));
    }
    return true;
  }

  // ─── v2 recursive schema: validate + flatten (mirrors validateDynamicSchema / flattenDynamicSchema) ───

  /**
   * Walks a schema, reporting what it cannot use, and collecting the context keys its conditions
   * read.
   *
   * <p>A condition — contract v4's {@code when} and {@code asyncWhen} — is checked as a shape rather
   * than evaluated: this reader says whether a document is a document, and a clause it cannot check
   * is one a host would find out about only when a field failed to appear.
   *
   * <p>{@code scope} is the names a clause written on this node may read. A condition is evaluated
   * against what encloses the clause, so those are the enclosing group's children — inside a
   * collection's {@code item} that is the row's own cells, which is what lets a template condition
   * one of them without naming a key that does not exist yet. {@code { "root": true }} is how a
   * clause reaches the whole form.
   */
  private void validateSchema(JsonNode node, String path, String name, int depth, List<MdyDynamicDiagnostic> out,
      List<MdyDynamicDiagnostic> perField, int[] count, Set<String> contextKeys, Set<String> scope) {
    count[0]++;
    if (depth > SCHEMA_MAX_DEPTH || count[0] > SCHEMA_MAX_NODES) {
      out.add(new MdyDynamicDiagnostic("MDY_DYNAMIC_SCHEMA_LIMIT", MdyDynamicDiagnostic.ERROR, path, "schema exceeds depth/node limits."));
      return;
    }
    String kind = node.isObject() && node.path("node").isTextual() ? node.path("node").asText() : null;
    if (!node.isObject() || kind == null || !SCHEMA_NODE_KINDS.contains(kind)) {
      out.add(new MdyDynamicDiagnostic("MDY_DYNAMIC_INVALID_NODE", MdyDynamicDiagnostic.ERROR, path, "node must be field, group, array, or record."));
      return;
    }
    for (String member : List.of("when", "asyncWhen")) {
      JsonNode clause = node.path(member);
      if (clause.isMissingNode()) continue;
      String at = path + "/" + member;
      List<String> problems = MdyExpressions.validateExpression(clause, at);
      if (!problems.isEmpty()) {
        out.add(new MdyDynamicDiagnostic("MDY_DYNAMIC_INVALID_CONDITION", MdyDynamicDiagnostic.ERROR, at, String.join("; ", problems)));
        continue;
      }
      List<String> unreadable = new ArrayList<>();
      for (String read : MdyExpressions.expressionPaths(clause)) {
        int dot = read.indexOf('.');
        if (!scope.contains(dot == -1 ? read : read.substring(0, dot))) unreadable.add(read);
      }
      if (!unreadable.isEmpty()) {
        out.add(new MdyDynamicDiagnostic("MDY_DYNAMIC_UNKNOWN_FIELD_REFERENCE", MdyDynamicDiagnostic.ERROR, at,
            "condition reads " + quoted(unreadable) + ", which nothing encloses this clause declares — a condition is "
                + "read against what encloses it, and { \"root\": true } is how it reaches the whole form."));
      }
      contextKeys.addAll(MdyExpressions.expressionContextKeys(clause));
    }
    if (kind.equals("field")) {
      if (!node.path("field").isObject()) {
        out.add(new MdyDynamicDiagnostic("MDY_DYNAMIC_INVALID_FIELD", MdyDynamicDiagnostic.ERROR, path + "/field", "field node requires a field object."));
        return;
      }
      // Every check a field gets in a flat list, applied wherever the field is, under the key its
      // parent gave it: a field in a tree carries no name of its own, and two bad fields named alike
      // would read as one sentence said twice. The key is passed rather than read off the path,
      // because a key may hold "/": "a/b" would read as "b", and "x/" as a field without a name.
      ObjectNode named = node.get("field").deepCopy();
      named.put("name", name);
      for (MdyDynamicDiagnostic finding : parseFlatItems(mapper.createArrayNode().add(named)).diagnostics) {
        perField.add(new MdyDynamicDiagnostic(finding.code(), MdyDynamicDiagnostic.ERROR, path + "/field", finding.message()));
      }
      return;
    }
    if (kind.equals("group")) {
      JsonNode children = node.path("children");
      if (!children.isObject()) {
        out.add(new MdyDynamicDiagnostic("MDY_DYNAMIC_INVALID_GROUP", MdyDynamicDiagnostic.ERROR, path, "group requires children."));
        return;
      }
      Set<String> here = new HashSet<>();
      children.fieldNames().forEachRemaining(here::add);
      for (var entry : children.properties()) {
        String key = entry.getKey();
        String childPath = path + "/children/" + pointerSegment(key);
        if (!isSafeDynamicName(key)) {
          out.add(new MdyDynamicDiagnostic("MDY_DYNAMIC_UNSAFE_NAME", MdyDynamicDiagnostic.ERROR, childPath, "unsafe child name."));
        } else {
          validateSchema(entry.getValue(), childPath, key, depth + 1, out, perField, count, contextKeys, here);
        }
      }
      return;
    }
    JsonNode item = node.path("item");
    if (kind.equals("record")) {
      if (!item.isObject()) {
        out.add(new MdyDynamicDiagnostic("MDY_DYNAMIC_INVALID_RECORD", MdyDynamicDiagnostic.ERROR, path, "record requires an item node."));
      } else {
        validateSchema(item, path + "/item", "item", depth + 1, out, perField, count, contextKeys, Set.of());
      }
      JsonNode rows = node.path("initialValue");
      if (!rows.isMissingNode() && !rows.isObject()) {
        out.add(new MdyDynamicDiagnostic("MDY_DYNAMIC_INVALID_RECORD", MdyDynamicDiagnostic.ERROR, path + "/initialValue", "record initialValue must be an object keyed by row key."));
      } else if (rows.isObject()) {
        if (rows.size() > SCHEMA_MAX_ARRAY_ROWS) {
          out.add(new MdyDynamicDiagnostic("MDY_DYNAMIC_SCHEMA_LIMIT", MdyDynamicDiagnostic.ERROR, path + "/initialValue", "record initialValue exceeds 100 rows."));
        }
        for (var entry : rows.properties()) {
          // A key that cannot be a path segment names a row nothing can address.
          if (!isSafeDynamicName(entry.getKey())) {
            out.add(new MdyDynamicDiagnostic("MDY_DYNAMIC_UNSAFE_NAME", MdyDynamicDiagnostic.ERROR, path + "/initialValue/" + entry.getKey(), "unsafe row key."));
          }
        }
      }
      return;
    }
    // array
    if (!item.isObject()) {
      out.add(new MdyDynamicDiagnostic("MDY_DYNAMIC_INVALID_ARRAY", MdyDynamicDiagnostic.ERROR, path, "array requires an item node."));
    } else {
      validateSchema(item, path + "/item", "item", depth + 1, out, perField, count, contextKeys, Set.of());
    }
    JsonNode initialValue = node.path("initialValue");
    if (!initialValue.isMissingNode() && !initialValue.isArray()) {
      out.add(new MdyDynamicDiagnostic("MDY_DYNAMIC_INVALID_ARRAY", MdyDynamicDiagnostic.ERROR, path + "/initialValue", "array initialValue must be an array."));
    } else if (initialValue.isArray() && initialValue.size() > SCHEMA_MAX_ARRAY_ROWS) {
      out.add(new MdyDynamicDiagnostic("MDY_DYNAMIC_SCHEMA_LIMIT", MdyDynamicDiagnostic.ERROR, path + "/initialValue", "array initialValue exceeds 100 rows."));
    }
  }

  /**
   * The flat fields of a validated schema, reporting into {@code diagnostics} each leaf it turns
   * down — one finding per leaf, which is what the caller counts.
   *
   * <p>A collection's row template is read too, once per item node and whether or not a row exists:
   * the template is the shape every row the application adds will have, so a leaf in it that cannot
   * be read is reported now rather than when the first row is added. Templates are read after the
   * tree, the last one met first, which is the order the TypeScript reader reports them in.
   */
  private List<MdyDynamicField> flattenSchema(JsonNode schema, List<MdyDynamicDiagnostic> diagnostics) {
    List<MdyDynamicField> out = new ArrayList<>();
    Set<JsonNode> seen = Collections.newSetFromMap(new IdentityHashMap<>());
    List<JsonNode> templates = new ArrayList<>();
    flattenSchemaInto(schema, "", null, out, diagnostics, seen, templates);
    while (!templates.isEmpty()) {
      // A template's fields are the shape of a row and not fields of this form, so they are not kept.
      flattenSchemaInto(templates.remove(templates.size() - 1), "", null, new ArrayList<>(), diagnostics, seen, templates);
    }
    return out;
  }

  private void flattenSchemaInto(JsonNode node, String path, JsonNode initial, List<MdyDynamicField> out,
      List<MdyDynamicDiagnostic> diagnostics, Set<JsonNode> seen, List<JsonNode> templates) {
    String kind = node.path("node").asText("");
    if (kind.equals("field")) {
      // A path is the payload key, the draft key and the widget id. Measured here and not on the
      // names, because a row index or key lengthens it and the rows are only known once walked.
      if (path.length() > MAX_PATH_LENGTH) {
        diagnostics.add(new MdyDynamicDiagnostic("MDY_DYNAMIC_PATH_TOO_LONG", MdyDynamicDiagnostic.ERROR, "/schema",
            "Dropped a dynamic field whose path is " + path.length() + " characters, past the " + MAX_PATH_LENGTH
                + " a path may be: a path is the payload key, the draft key and the widget id, and every read "
                + "of the value carries it."));
        return;
      }
      // The leaf is read by the flat reader under a placeholder name, because a generated dotted or
      // indexed path is structure the walk built and not a name the flat rule could accept; the path
      // is restored on what it keeps. A finding the flat reader places at an entry stays there; one
      // it places on the list as a whole names a list this document does not have, so it is placed
      // on the schema, as the TypeScript reader places it.
      ObjectNode leaf = node.get("field").deepCopy();
      leaf.put("name", "leaf");
      if (hasValue(initial)) leaf.set("initialValue", initial);
      FlatResult parsed = parseFlatItems(mapper.createArrayNode().add(leaf));
      for (MdyDynamicDiagnostic finding : parsed.diagnostics) {
        diagnostics.add(finding.path().equals("/fields")
            ? new MdyDynamicDiagnostic(finding.code(), finding.severity(), "/schema", finding.message())
            : finding);
      }
      for (MdyDynamicField field : parsed.accepted) out.add(withNameAndInitial(field, path, field.initialValue()));
      return;
    }
    if (kind.equals("group")) {
      JsonNode value = hasValue(initial) && initial.isObject() ? initial : null;
      for (var entry : node.path("children").properties()) {
        String key = entry.getKey();
        if (!isSafeDynamicName(key)) continue;
        JsonNode childInitial = value != null ? value.path(key) : null;
        flattenSchemaInto(entry.getValue(), path.isEmpty() ? key : path + "." + key, childInitial, out, diagnostics, seen, templates);
      }
      return;
    }
    JsonNode item = node.get("item");
    if (seen.add(item)) templates.add(item);
    if (kind.equals("record")) {
      // Which rows a record has is the application's word; a document can only declare the ones it
      // starts with, so those are the ones a flat view can name.
      JsonNode declared = hasValue(initial) && initial.isObject() ? initial
          : node.path("initialValue").isObject() ? node.path("initialValue") : null;
      if (declared != null) {
        for (var entry : declared.properties()) {
          if (!isSafeDynamicName(entry.getKey())) continue;
          String key = entry.getKey();
          flattenSchemaInto(item, path.isEmpty() ? key : path + "." + key, entry.getValue(), out, diagnostics, seen, templates);
        }
      }
      return;
    }
    // array
    JsonNode rows = hasValue(initial) && initial.isArray() ? initial
        : node.path("initialValue").isArray() ? node.path("initialValue") : null;
    if (rows != null) {
      for (int i = 0; i < rows.size(); i++) {
        flattenSchemaInto(item, path + "." + i, rows.get(i), out, diagnostics, seen, templates);
      }
    }
  }

  private static MdyDynamicField withNameAndInitial(MdyDynamicField field, String name, Object initialValue) {
    if (field instanceof MdyDynamicTextField f) {
      return new MdyDynamicTextField(name, f.kind(), f.label(), f.placeholder(), initialValue, f.validators());
    }
    if (field instanceof MdyDynamicNumberField f) {
      return new MdyDynamicNumberField(name, f.kind(), f.label(), f.placeholder(), initialValue, f.validators(), f.min(), f.max(), f.step());
    }
    if (field instanceof MdyDynamicBooleanField f) {
      return new MdyDynamicBooleanField(name, f.kind(), f.label(), f.placeholder(), initialValue, f.validators());
    }
    if (field instanceof MdyDynamicOptionsField f) {
      return new MdyDynamicOptionsField(name, f.kind(), f.label(), f.placeholder(), initialValue, f.validators(), f.options(), f.mode(), f.searchable());
    }
    if (field instanceof MdyDynamicDateField f) {
      return new MdyDynamicDateField(name, f.kind(), f.label(), f.placeholder(), initialValue, f.validators());
    }
    if (field instanceof MdyDynamicDaterangeField f) {
      return new MdyDynamicDaterangeField(name, f.kind(), f.label(), f.placeholder(), initialValue, f.validators());
    }
    if (field instanceof MdyDynamicFileField f) {
      return new MdyDynamicFileField(name, f.kind(), f.label(), f.placeholder(), initialValue, f.validators(), f.accept(), f.multiple());
    }
    if (field instanceof MdyDynamicColorsField f) {
      return new MdyDynamicColorsField(name, f.kind(), f.label(), f.placeholder(), initialValue, f.validators(), f.presets());
    }
    throw new IllegalStateException("Unknown MdyDynamicField implementation: " + field.getClass());
  }

  private static boolean hasValue(JsonNode node) {
    return node != null && !node.isMissingNode() && !node.isNull();
  }

  private Object toObject(JsonNode node) {
    return mapper.convertValue(node, Object.class);
  }

  /**
   * Why a name that passes {@link #isSafeSegment} still cannot name a field, or null. In the TS
   * reader's order: a character that cannot be seen makes two names read the same; past
   * {@link #MAX_PATH_LENGTH} the path costs at every read, because it is the payload key, the draft key
   * and the widget id; {@code toString} as a value's property makes every string conversion of the
   * value throw; {@link #ID_DELIMITER} separates the parts of a generated id; whitespace splits an
   * id reference such as {@code aria-describedby} into several. The code is decided with the
   * sentence, because a sentence that quotes the name can contain any text.
   */
  private static MdyDynamicDiagnostic nameRefusal(String name, JsonNode nameNode, String path) {
    if (hasInvisibleCharacters(name)) {
      return invalidField(path, "Dropped dynamic field " + jsonText(nameNode) + ": the name carries a character that cannot "
          + "be seen, so two names that read the same would be two different fields.");
    }
    if (name.length() > MAX_PATH_LENGTH) {
      return new MdyDynamicDiagnostic("MDY_DYNAMIC_PATH_TOO_LONG", MdyDynamicDiagnostic.ERROR, path,
          "Dropped a dynamic field whose path is " + name.length() + " characters, past the "
          + MAX_PATH_LENGTH + " a path may be: a path is the payload key, the draft key "
          + "and the widget id, and every read of the value carries it.");
    }
    if (breaksValueConversion(name)) {
      return invalidField(path, "Dropped dynamic field \"" + name + "\": a form's value is an object, so this name shadows the "
          + "method every string conversion of that value goes through, and `${value}` then throws.");
    }
    if (name.contains(ID_DELIMITER)) {
      return invalidField(path, "Dropped dynamic field \"" + name + "\": \"" + ID_DELIMITER + "\" separates the segments of a generated id, "
          + "so this name would collide with another field's parts.");
    }
    if (hasJsWhitespace(name)) {
      return invalidField(path, "Dropped dynamic field \"" + name + "\": a widget id is built from this name, and whitespace "
          + "splits an id reference into several, each resolving to nothing — so the control would "
          + "have no accessible name.");
    }
    return null;
  }

  private static MdyDynamicDiagnostic invalidField(String path, String message) {
    return new MdyDynamicDiagnostic("MDY_DYNAMIC_INVALID_FIELD", MdyDynamicDiagnostic.ERROR, path, message);
  }

  /** The names a document may give a field or a child: {@code isSafeDynamicName} in the TS contract. */
  private static boolean isSafeDynamicName(String name) {
    return isSafeSegment(name) && !breaksValueConversion(name) && !name.contains(ID_DELIMITER)
        && !hasJsWhitespace(name) && !hasInvisibleCharacters(name);
  }

  private static final int MAX_PATH_LENGTH = 512;
  private static final String ID_DELIMITER = "__";

  private static boolean breaksValueConversion(String name) {
    for (String part : name.split("\\.", -1)) {
      if (part.equals("toString")) return true;
    }
    return false;
  }

  /** The class two different names can hide behind: controls, zero-width and bidirectional marks, BOM. */
  private static boolean hasInvisibleCharacters(String name) {
    for (int i = 0; i < name.length(); i++) {
      char c = name.charAt(i);
      if (c <= 0x08 || c == 0x0B || c == 0x0C || (c >= 0x0E && c <= 0x1F) || (c >= 0x7F && c <= 0x9F)
          || (c >= 0x200B && c <= 0x200D) || (c >= 0x2028 && c <= 0x202E) || (c >= 0x2066 && c <= 0x2069)
          || c == 0xFEFF) {
        return true;
      }
    }
    return false;
  }

  /** Whether the name holds a character JavaScript's {@code \s} matches — the set {@code trim} removes. */
  private static boolean hasJsWhitespace(String name) {
    for (int i = 0; i < name.length(); i++) {
      if (isJsBlank(String.valueOf(name.charAt(i)))) return true;
    }
    return false;
  }

  private static boolean isSafeSegment(String value) {
    return !value.isEmpty() && !value.contains(".") && !FORBIDDEN_NAMES.contains(value);
  }

  /** Depth cap for nested layout: MDY_LAYOUT_MAX_DEPTH in the TS parser, LAYOUT_MAX_DEPTH in Rust. */
  private static final int LAYOUT_MAX_DEPTH = 32;

  /** The sizes a layout is authored against, mirroring MDY_LAYOUT_BREAKPOINTS. */
  private static final Set<String> LAYOUT_BREAKPOINTS = Set.of("base", "sm", "md", "lg");

  /** The widest track count a columns row may declare at any size: MDY_MAX_LAYOUT_COLUMNS in the TS parser. */
  private static final int LAYOUT_MAX_COLUMNS = 12;

  // ─── v2/v3 layout / rules: validate against resolved field names, keep raw nodes ───

  private void parseLayout(JsonNode layoutNode, Set<String> names, int version, List<JsonNode> out, List<MdyDynamicDiagnostic> diagnostics) {
    if (layoutNode.isMissingNode()) return;
    if (!layoutNode.isArray()) {
      diagnostics.add(new MdyDynamicDiagnostic("MDY_DYNAMIC_INVALID_LAYOUT", MdyDynamicDiagnostic.ERROR, "/layout", "layout must be an array."));
      return;
    }
    Set<String> placed = new LinkedHashSet<>();
    for (int i = 0; i < layoutNode.size(); i++) {
      JsonNode raw = layoutNode.get(i);
      String path = "/layout/" + i;
      // An array is an object to JavaScript, so it passes this door and is refused at the next for
      // its shape; the sentence is kept so both readers say the same thing about the same entry.
      if (!raw.isObject() && !raw.isArray()) {
        diagnostics.add(new MdyDynamicDiagnostic("MDY_DYNAMIC_INVALID_LAYOUT", MdyDynamicDiagnostic.ERROR, path, "layout node must be an object."));
        continue;
      }
      // A node at the top of the layout sits in no column, so it has nothing to be placed in. This
      // is the one place a layout node is visited without a parent to check its `at` against.
      if ("section".equals(raw.path("kind").asText(null)) && raw.has("at")) {
        diagnostics.add(new MdyDynamicDiagnostic("MDY_DYNAMIC_INVALID_LAYOUT", MdyDynamicDiagnostic.ERROR, path,
            "a section at the top of the layout occupies no column and cannot be placed."));
        continue;
      }
      reportLayoutMembers(raw, path, diagnostics);
      Set<String> candidate = new LinkedHashSet<>(placed);
      LayoutRefusal refusal = validLayoutNode(raw, names, candidate, 1, version >= 3);
      if (refusal != null) {
        diagnostics.add(refusal.diagnostic(path, version));
        continue;
      }
      placed = candidate;
      out.add(raw);
    }
  }

  /**
   * Why a layout node was refused, so the diagnostic blames what is actually wrong: a document
   * whose fields are all spelled correctly is not told it references an unknown one. Codes and
   * messages are the ones the TS and Rust readers emit for the same cause.
   */
  private enum LayoutRefusal {
    VERSION("MDY_DYNAMIC_UNSUPPORTED_VERSION", null),
    DEPTH("MDY_DYNAMIC_INVALID_LAYOUT", "layout nests deeper than " + LAYOUT_MAX_DEPTH + " levels."),
    SHAPE("MDY_DYNAMIC_INVALID_LAYOUT", "layout node has an invalid shape."),
    REFERENCE("MDY_DYNAMIC_UNKNOWN_FIELD_REFERENCE", "layout references an unknown or already-placed field.");

    private final String code;
    private final String message;

    LayoutRefusal(String code, String message) {
      this.code = code;
      this.message = message;
    }

    MdyDynamicDiagnostic diagnostic(String path, int version) {
      String text = this == VERSION
          ? "layout uses a placement this document's version (" + version + ") precedes; it needs version 3."
          : message;
      return new MdyDynamicDiagnostic(code, MdyDynamicDiagnostic.ERROR, path, text);
    }
  }

  /**
   * Validates one layout node and everything nested under it. A slot holds either a field
   * name or another layout node, so a column row can sit inside a section. Every leaf must
   * name a known field, and a field may only be placed once — the same field in two slots
   * would render twice and bind one value to both controls.
   *
   * <p>Placement — a slot's {@code at} and a nested section's {@code at} — arrived with v3. Below
   * it the keys do not exist, and accepting them would make this reader disagree with every other
   * reader of the same document about what the contract says.
   *
   * @param allowSlots whether the document's version has placement (v3 and later)
   * @return null when the node is valid, otherwise why it was refused
   */
  private LayoutRefusal validLayoutNode(JsonNode raw, Set<String> names, Set<String> placed, int depth, boolean allowSlots) {
    if (depth > LAYOUT_MAX_DEPTH) return LayoutRefusal.DEPTH;
    if (!raw.isObject() || !raw.path("id").isTextual()) return LayoutRefusal.SHAPE;
    String kind = raw.path("kind").asText(null);

    List<JsonNode> slots = new ArrayList<>();
    if ("section".equals(kind)) {
      JsonNode children = raw.path("children");
      if (!children.isArray()) return LayoutRefusal.SHAPE;
      slots.add(children);
    } else if ("columns".equals(kind)) {
      JsonNode columns = raw.path("columns");
      if (!columns.isArray()) return LayoutRefusal.SHAPE;
      for (JsonNode column : columns) {
        if (!column.isArray()) return LayoutRefusal.SHAPE;
        slots.add(column);
      }
    } else {
      return LayoutRefusal.SHAPE;
    }

    // How many tracks this node has, so a slot cannot be sent to a column it does not have.
    // Zero marks a section: placement is refused there, because the column is the only element
    // a placement can act on. A row's `at` may widen it at a size, so the widest count is the
    // ceiling; each count must be a small positive integer, because it reaches the renderer as a
    // track count and anything else draws a grid nobody asked for.
    int tracks = 0;
    if ("columns".equals(kind)) {
      tracks = Math.max(1, raw.path("columns").size());
      if (raw.has("at")) {
        JsonNode at = raw.get("at");
        if (!at.isObject()) return LayoutRefusal.SHAPE;
        var sizes = at.fields();
        while (sizes.hasNext()) {
          var size = sizes.next();
          JsonNode count = size.getValue();
          if (!LAYOUT_BREAKPOINTS.contains(size.getKey())) return LayoutRefusal.SHAPE;
          if (!isWholeNumber(count) || count.asInt() < 1 || count.asInt() > LAYOUT_MAX_COLUMNS) return LayoutRefusal.SHAPE;
          tracks = Math.max(tracks, count.asInt());
        }
      }
    }

    for (JsonNode slot : slots) {
      for (JsonNode child : slot) {
        if (child.isTextual()) {
          String name = child.asText();
          if (!names.contains(name) || !placed.add(name)) return LayoutRefusal.REFERENCE;
        } else if (child.isObject() && child.has("ref")) {
          // Contract v3's slot: a field name that also says where it sits, per size. Every way a
          // slot fails, its placement included, is a reference refusal, as in the TS reader.
          if (!allowSlots) return LayoutRefusal.VERSION;
          if (!child.path("ref").isTextual()) return LayoutRefusal.REFERENCE;
          String name = child.path("ref").asText();
          if (!names.contains(name) || !validPlacement(child.path("at"), tracks) || !placed.add(name)) return LayoutRefusal.REFERENCE;
        } else {
          LayoutRefusal nested = validLayoutNode(child, names, placed, depth + 1, allowSlots);
          if (nested != null) return nested;
          // A section's own `at` describes the column *this* node gives it, so it is checked
          // here rather than inside its own validation. A nested row's `at` is a track count and
          // belongs to that row, which is why only a section is asked.
          if ("section".equals(child.path("kind").asText(null)) && child.has("at")) {
            if (!allowSlots) return LayoutRefusal.VERSION;
            if (!validPlacement(child.path("at"), tracks)) return LayoutRefusal.SHAPE;
          }
        }
      }
    }
    return null;
  }

  /** Names as a message lists them: each in double quotes, comma-separated. */
  private static String quoted(List<String> names) {
    StringBuilder joined = new StringBuilder();
    for (String name : names) {
      if (joined.length() > 0) joined.append(", ");
      joined.append('"').append(name).append('"');
    }
    return joined.toString();
  }

  /** Whether a structured envelope carries a schema and a layout — v2 and everything after it. */
  private static boolean isStructuredVersion(int version) {
    return version == 2 || version == 3 || version == 4 || version == 5;
  }

  /**
   * A JSON number with a whole value that fits an int. {@code 2.0} and {@code 1e1} count, as they do
   * for {@code Number.isInteger}: JSON does not distinguish them from {@code 2} and {@code 10}, so a
   * reader that does refuses a document the TypeScript reader accepts.
   */
  private static boolean isWholeNumber(JsonNode node) {
    return node.isNumber() && node.canConvertToExactIntegral() && node.canConvertToInt();
  }

  /** The declared version when it is one this contract has, else -1. */
  private static int supportedVersion(JsonNode version) {
    return isWholeNumber(version) && isStructuredVersion(version.asInt()) ? version.asInt() : -1;
  }

  /**
   * A declared value as {@code JSON.stringify} writes it, so the refusal quotes the value in the words
   * the TS reader uses: {@code 7.0} reads {@code 7}, {@code 1e21} reads {@code 1e+21}, a number past
   * double precision reads the double it parses to, and object keys follow ECMAScript property order.
   */
  private static String jsonText(JsonNode value) {
    StringBuilder out = new StringBuilder();
    writeJson(value, out);
    return out.toString();
  }

  private static void writeJson(JsonNode value, StringBuilder out) {
    if (value.isNumber()) {
      out.append(numberText(value.doubleValue()));
    } else if (value.isTextual()) {
      writeString(value.textValue(), out);
    } else if (value.isBoolean()) {
      out.append(value.booleanValue());
    } else if (value.isArray()) {
      out.append('[');
      for (int i = 0; i < value.size(); i++) {
        if (i > 0) out.append(',');
        writeJson(value.get(i), out);
      }
      out.append(']');
    } else if (value.isObject()) {
      // ECMAScript own-key order: array-index keys ascending, then the rest as they arrived.
      List<String> indices = new ArrayList<>();
      List<String> others = new ArrayList<>();
      value.fieldNames().forEachRemaining(key -> (isArrayIndex(key) ? indices : others).add(key));
      indices.sort((a, b) -> Long.compare(Long.parseLong(a), Long.parseLong(b)));
      indices.addAll(others);
      out.append('{');
      for (int i = 0; i < indices.size(); i++) {
        if (i > 0) out.append(',');
        writeString(indices.get(i), out);
        out.append(':');
        writeJson(value.get(indices.get(i)), out);
      }
      out.append('}');
    } else {
      out.append("null");
    }
  }

  /** A canonical decimal integer below 2^32 − 1, the keys ECMAScript orders before every other. */
  private static boolean isArrayIndex(String key) {
    if (key.isEmpty() || key.length() > 10 || (key.length() > 1 && key.charAt(0) == '0')) return false;
    for (int i = 0; i < key.length(); i++) {
      if (key.charAt(i) < '0' || key.charAt(i) > '9') return false;
    }
    return Long.parseLong(key) < 4294967295L;
  }

  /** A string as {@code JSON.stringify} quotes it, a lone surrogate escaped rather than written. */
  private static void writeString(String text, StringBuilder out) {
    out.append('"');
    for (int i = 0; i < text.length(); i++) {
      char c = text.charAt(i);
      switch (c) {
        case '"' -> out.append("\\\"");
        case '\\' -> out.append("\\\\");
        case '\b' -> out.append("\\b");
        case '\f' -> out.append("\\f");
        case '\n' -> out.append("\\n");
        case '\r' -> out.append("\\r");
        case '\t' -> out.append("\\t");
        default -> {
          if (Character.isHighSurrogate(c) && i + 1 < text.length() && Character.isLowSurrogate(text.charAt(i + 1))) {
            out.append(c).append(text.charAt(++i));
          } else if (c < 0x20 || Character.isSurrogate(c)) {
            out.append(String.format("\\u%04x", (int) c));
          } else {
            out.append(c);
          }
        }
      }
    }
    out.append('"');
  }

  /**
   * Whether ECMAScript {@code String.prototype.trim} leaves nothing: its whitespace is the Unicode
   * {@code Zs} spaces, tab, vertical tab, form feed, U+FEFF and the four line terminators.
   * {@code String.isBlank} differs on both sides (it counts U+001C–U+001F and not U+00A0, U+2007,
   * U+202F or U+FEFF), so a message of no-break spaces would be read as one a person can read.
   */
  private static boolean isJsBlank(String text) {
    for (int i = 0; i < text.length(); i++) {
      char c = text.charAt(i);
      boolean space = c == '\t' || c == '\n' || c == 0x0B || c == '\f' || c == '\r' || c == 0x2028 || c == 0x2029
          || c == 0xFEFF || Character.getType(c) == Character.SPACE_SEPARATOR;
      if (!space) return false;
    }
    return true;
  }

  /**
   * A number as ECMAScript {@code Number::toString} writes it: the fewest significant digits that
   * read back as the same double, laid out plainly up to 21 integer digits and down to six leading
   * zeros, in exponent form beyond. A value JSON cannot hold writes {@code null}.
   */
  static String numberText(double number) {
    if (Double.isNaN(number) || Double.isInfinite(number)) return "null";
    if (number == 0) return "0";
    double magnitude = Math.abs(number);
    BigDecimal shortest = shortestDigits(magnitude).stripTrailingZeros();
    String digits = shortest.unscaledValue().toString();
    int k = digits.length();
    // The value is digits × 10^(n − k).
    int n = k - shortest.scale();
    String text;
    if (k <= n && n <= 21) {
      text = digits + "0".repeat(n - k);
    } else if (0 < n && n <= 21) {
      text = digits.substring(0, n) + "." + digits.substring(n);
    } else if (-6 < n && n <= 0) {
      text = "0." + "0".repeat(-n) + digits;
    } else {
      int exponent = n - 1;
      String tail = (exponent < 0 ? "-" : "+") + Math.abs(exponent);
      text = (k == 1 ? digits : digits.charAt(0) + "." + digits.substring(1)) + "e" + tail;
    }
    return number < 0 ? "-" + text : text;
  }

  /**
   * The decimal with the fewest significant digits that parses back to {@code magnitude}, the closer
   * of two candidates when both do and the even one on a tie. Both neighbours at each precision are
   * tried, because beside a power of two the round-trip interval is lopsided and the nearer
   * neighbour can miss where the farther one lands. {@code Double.toString} is not the source: before
   * JDK 19 it does not always give the shortest digits (JDK-4511638), and this module builds for 17.
   */
  private static BigDecimal shortestDigits(double magnitude) {
    BigDecimal exact = new BigDecimal(magnitude);
    for (int precision = 1; precision < 17; precision++) {
      BigDecimal below = exact.round(new MathContext(precision, RoundingMode.FLOOR));
      BigDecimal above = exact.round(new MathContext(precision, RoundingMode.CEILING));
      boolean belowReads = below.doubleValue() == magnitude;
      boolean aboveReads = above.doubleValue() == magnitude;
      if (belowReads && aboveReads) {
        int closer = exact.subtract(below).compareTo(above.subtract(exact));
        if (closer != 0) return closer < 0 ? below : above;
        return exact.round(new MathContext(precision, RoundingMode.HALF_EVEN));
      }
      if (belowReads) return below;
      if (aboveReads) return above;
    }
    return exact.round(new MathContext(17, RoundingMode.HALF_EVEN));
  }

  /**
   * A per-size placement the row can honour. {@code tracks} of 0 means there is no column at
   * all, and any placement is refused: {@code grid-column} and {@code display} belong to a grid
   * item, and only the column is one.
   */
  private boolean validPlacement(JsonNode at, int tracks) {
    // An explicit null is a placement written wrong, not one left out.
    if (at.isMissingNode()) return true;
    if (tracks == 0 || !at.isObject()) return false;
    var sizes = at.fieldNames();
    while (sizes.hasNext()) {
      String size = sizes.next();
      if (!LAYOUT_BREAKPOINTS.contains(size)) return false;
      JsonNode placement = at.get(size);
      if (!placement.isObject()) return false;
      JsonNode column = placement.path("column");
      JsonNode hidden = placement.path("hidden");
      // A size that states neither is a typo worth refusing, not a no-op to keep.
      if (column.isMissingNode() && hidden.isMissingNode()) return false;
      if (!column.isMissingNode() && (!isWholeNumber(column) || column.asInt() < 1 || column.asInt() > tracks)) return false;
      if (!hidden.isMissingNode() && !hidden.isBoolean()) return false;
    }
    return true;
  }

  private void parseRules(JsonNode rulesNode, Set<String> names, Map<String, String> kindOf, List<JsonNode> out, List<MdyDynamicDiagnostic> diagnostics) {
    if (rulesNode.isMissingNode()) return;
    if (!rulesNode.isArray()) {
      diagnostics.add(new MdyDynamicDiagnostic("MDY_DYNAMIC_INVALID_RULE", MdyDynamicDiagnostic.ERROR, "/rules", "rules must be an array."));
      return;
    }
    for (int i = 0; i < rulesNode.size(); i++) {
      JsonNode raw = rulesNode.get(i);
      String path = "/rules/" + i;
      // An array is an object to JavaScript, so it passes this door and is refused at the next for
      // having no effect; the sentence is kept so both readers say the same thing about the same entry.
      if (!raw.isObject() && !raw.isArray()) {
        diagnostics.add(new MdyDynamicDiagnostic("MDY_DYNAMIC_INVALID_RULE", MdyDynamicDiagnostic.ERROR, path, "rule must be an object."));
        continue;
      }
      reportUnknownMembers(raw, RULE_MEMBERS, "a rule", path, diagnostics);
      String effect = raw.path("effect").asText(null);
      String target = raw.path("target").isTextual() ? raw.path("target").asText() : null;
      JsonNode when = raw.path("when");
      String whenField = when.path("field").isTextual() ? when.path("field").asText() : null;
      String operator = when.path("operator").asText(null);
      boolean valid = effect != null && RULE_EFFECTS.contains(effect)
          && target != null && names.contains(target)
          && when.isObject()
          && whenField != null && names.contains(whenField)
          && operator != null && RULE_OPERATORS.contains(operator);
      if (!valid) {
        diagnostics.add(new MdyDynamicDiagnostic("MDY_DYNAMIC_INVALID_RULE", MdyDynamicDiagnostic.ERROR, path, "rule has an unsupported effect/operator or references an unknown field."));
        continue;
      }
      // The part the operator actually reads. A membership test against a string or an ordering
      // against an object parses as a rule and then answers false forever — a rule that cannot fire.
      String valueRefusal = ruleValueRefusal(operator, when.path("value"), kindOf.get(whenField));
      if (valueRefusal != null) {
        diagnostics.add(new MdyDynamicDiagnostic("MDY_DYNAMIC_INVALID_RULE", MdyDynamicDiagnostic.ERROR, path + "/when/value", valueRefusal));
        continue;
      }
      out.add(raw);
    }
  }

  /**
   * Why a rule's {@code value} cannot be read by its operator, or null when it can.
   *
   * <p>A unary operator reads no value, so one written beside it is ignored rather than wrong: a
   * generator that emits the same shape for every operator writes one, and refusing it would make a
   * document invalid for a member nothing consults.
   */
  private static String ruleValueRefusal(String operator, JsonNode value, String kind) {
    if (operator.equals("isEmpty") || operator.equals("isNotEmpty")) return null;
    if (operator.equals("in") || operator.equals("notIn")) {
      return value.isArray() ? null : operator + " tests membership of a list, and \"value\" is " + describeRuleValue(value) + ".";
    }
    if (ORDERING_RULE_OPERATORS.contains(operator)) {
      if (!value.isNumber() && !value.isTextual()) {
        return operator + " orders two numbers or two strings, and \"value\" is " + describeRuleValue(value) + ".";
      }
      if (value.isTextual() && kind != null && DATE_KINDS.contains(kind) && !isIsoDate(value.asText())) {
        return operator + " on a " + kind + " compares dates as text, so \"value\" must be a full ISO date (yyyy-MM-dd); \""
            + value.asText() + "\" would order wrongly.";
      }
    }
    return null;
  }

  /** A rule's value named by what it is, for a message about what it should have been. */
  private static String describeRuleValue(JsonNode value) {
    if (value.isMissingNode()) return "missing";
    if (value.isNull()) return "null";
    if (value.isArray()) return "an array";
    if (value.isTextual()) return "a string";
    if (value.isNumber()) return "a number";
    if (value.isBoolean()) return "a boolean";
    // The TypeScript reader spells it `a object`, from `a ${typeof value}`, and the two readers say the same sentence.
    return "a object";
  }

  /**
   * A full calendar date written {@code yyyy-MM-dd}. A year below 100 is not one: the TypeScript
   * reader builds the date through {@code Date.UTC}, which reads such a year as 19xx and then finds
   * it does not round-trip, so both readers refuse it.
   */
  private static boolean isIsoDate(String value) {
    if (!ISO_DATE.matcher(value).matches()) return false;
    int year = Integer.parseInt(value.substring(0, 4));
    if (year < 100) return false;
    try {
      LocalDate.of(year, Integer.parseInt(value.substring(5, 7)), Integer.parseInt(value.substring(8, 10)));
      return true;
    } catch (DateTimeException e) {
      return false;
    }
  }

  /**
   * Reads the document's cross-field validations, reporting each one it cannot use.
   *
   * <p>A validation's condition goes through the same expression check a schema clause does, and
   * every path it reads must name a field or a container in the form: a condition asking about a
   * field that is not there can never be satisfied, and it fails silently. The empty path is the
   * whole form value, which a validation may not name that way — {@code { "root": true }} is the
   * operand that reads the whole form.
   */
  private void parseValidations(JsonNode validationsNode, Set<String> names, List<MdyDynamicDiagnostic> diagnostics) {
    if (validationsNode.isMissingNode()) return;
    if (!validationsNode.isArray()) {
      diagnostics.add(new MdyDynamicDiagnostic("MDY_DYNAMIC_INVALID_VALIDATION", MdyDynamicDiagnostic.ERROR, "/validations", "validations must be an array."));
      return;
    }
    for (int i = 0; i < validationsNode.size(); i++) {
      JsonNode raw = validationsNode.get(i);
      String at = "/validations/" + i;
      // An array is an object to JavaScript, so it passes this door and is refused at the next for
      // having no message; the sentence is kept so both readers say the same thing about the same entry.
      if (!raw.isObject() && !raw.isArray()) {
        diagnostics.add(new MdyDynamicDiagnostic("MDY_DYNAMIC_INVALID_VALIDATION", MdyDynamicDiagnostic.ERROR, at, "validation must be an object."));
        continue;
      }
      reportUnknownMembers(raw, VALIDATION_MEMBERS, "a validation", at, diagnostics);
      JsonNode message = raw.path("message");
      if (!message.isTextual() || isJsBlank(message.asText())) {
        diagnostics.add(new MdyDynamicDiagnostic("MDY_DYNAMIC_INVALID_VALIDATION", MdyDynamicDiagnostic.ERROR, at, "validation needs a non-empty message."));
        continue;
      }
      // A target names a field, the same way a rule's does. An unknown one would attach the error to
      // nothing, and the user would never see why the form will not submit.
      if (raw.has("target") && !validValidationPath(raw.get("target"), names)) {
        diagnostics.add(new MdyDynamicDiagnostic("MDY_DYNAMIC_UNKNOWN_FIELD_REFERENCE", MdyDynamicDiagnostic.ERROR, at, "validation target references an unknown field."));
        continue;
      }
      JsonNode when = raw.path("when");
      List<String> problems = MdyExpressions.validateExpression(when, at + ".when");
      if (!problems.isEmpty()) {
        diagnostics.add(new MdyDynamicDiagnostic("MDY_DYNAMIC_INVALID_VALIDATION", MdyDynamicDiagnostic.ERROR, at, String.join("; ", problems)));
        continue;
      }
      List<String> unknown = new ArrayList<>();
      for (String path : MdyExpressions.expressionPaths(when)) {
        if (!validValidationPath(path, names)) unknown.add(path);
      }
      if (!unknown.isEmpty()) {
        diagnostics.add(new MdyDynamicDiagnostic("MDY_DYNAMIC_UNKNOWN_FIELD_REFERENCE", MdyDynamicDiagnostic.ERROR, at,
            "validation condition references unknown field(s): " + quoted(unknown)
                + (unknown.contains("") ? " — the whole form value is { \"root\": true }" : "") + "."));
      }
    }
  }

  private static boolean validValidationPath(JsonNode path, Set<String> names) {
    return path.isTextual() && validValidationPath(path.asText(), names);
  }

  /** A field in the form, or a container something in the form lives underneath. */
  private static boolean validValidationPath(String path, Set<String> names) {
    if (path.isEmpty()) return false;
    if (names.contains(path)) return true;
    String prefix = path + ".";
    for (String name : names) if (name.startsWith(prefix)) return true;
    return false;
  }


}
