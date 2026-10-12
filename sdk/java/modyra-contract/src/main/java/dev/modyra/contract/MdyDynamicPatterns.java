package dev.modyra.contract;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * What a regular expression written in a document may not be.
 *
 * <p>A pattern reaches this reader as text from a CMS, a saved project or a POST, and two things are
 * decided about it before any engine runs it. {@link #costRefusal} answers whether its <em>shape</em>
 * can be made to backtrack exponentially — a repeated group whose body can be divided several ways,
 * or repeated alternatives that can match the same text (ADR 0050). {@link #compiles} answers whether
 * it is a regular expression at all.
 *
 * <p>Both answers are the ones the TypeScript reader gives, because the contract is defined against
 * JavaScript's {@code RegExp}: a document is published once and read by every SDK, so a pattern
 * refused by one reader and run by another is a rule that exists in one deployment and not in the
 * next. {@code java.util.regex} does not give that answer and is not asked for it. Its grammar
 * differs in both directions — it compiles {@code \b+}, {@code ^+}, {@code (?<=a)+} and a leading
 * {@code {2}}, which JavaScript refuses as nothing to repeat, and it refuses {@code a{,5}}, {@code []},
 * {@code \0}, {@code \c} and {@code &#92;u{41}}, which JavaScript reads as literals or escapes. The syntax
 * check is therefore a reading of the ECMAScript pattern grammar, with the Annex B extensions a
 * flagless {@code new RegExp(source)} applies.
 *
 * <p>The cost check compares what two pieces of a pattern can match by compiling each piece and
 * asking it about every character of a fixed sample. Those pieces are compiled with
 * {@code java.util.regex} after passing the same grammar in Unicode mode, which is what the TypeScript
 * reader compiles them under; the few constructs the two engines spell differently are rewritten by
 * {@link #forJava} on the way. A piece this reader cannot compile is undecidable, and undecidable is
 * read the way the TypeScript reader reads it: a branch it cannot start is not refused on suspicion,
 * and a seam it cannot read is refused.
 */
final class MdyDynamicPatterns {

  /**
   * How long a pattern from a document may be, in UTF-16 units.
   *
   * <p>The same cap for a validator's {@code pattern} and a condition's {@code matches} source: a
   * pattern is read every time the form is read, and the cost check below is itself a scan whose work
   * grows with the source.
   */
  static final int MAX_LENGTH = 256;

  private MdyDynamicPatterns() {
  }

  // ─── Cost: whether the shape of a pattern backtracks exponentially ───

  /** A group being read: where its body starts, whether that body is variable, where its alternatives start. */
  private static final class Group {
    /**
     * Whether the group's body can match runs of different lengths.
     *
     * <p>This is the half that makes a repetition ambiguous: a body of fixed length consumes the same
     * number of characters however the match arrives at it, so the engine has one way to divide the
     * input and nothing to backtrack over. A body that can be short or long has many, and repeating
     * it multiplies them.
     */
    boolean variable;
    /** Where each top-level alternative of this group starts. */
    final List<Integer> alternatives = new ArrayList<>();

    Group(int start) {
      alternatives.add(start);
    }
  }

  /** How many times a quantifier may repeat what it follows; {@code max} is infinite for the open-ended ones. */
  private record Repetition(double min, double max, int end) {
  }

  /** One element of a group's body: what one occurrence accepts, its own source, and how often it repeats. */
  private record Atom(Pattern matcher, String source, double min, double max) {
  }

  private static final Pattern EXACT_COUNT = Pattern.compile("(\\d+)");
  private static final Pattern OPEN_COUNT = Pattern.compile("(\\d+),\\s*");
  private static final Pattern RANGE_COUNT = Pattern.compile("(\\d+),\\s*(\\d+)");
  private static final Pattern ZERO_MINIMUM = Pattern.compile("0*,");
  private static final Pattern GROUP_OPENING = Pattern.compile("^\\((\\?(:|=|!|<=|<!|<[^>]*>))?");
  private static final Pattern GROUP_CLOSING = Pattern.compile("\\)\\z");

  /** Escapes that stand for a set of characters rather than for one. */
  private static final String CLASS_ESCAPES = "dDwWsS";

  /** Escapes that stand for one character written unprintably. */
  private static final Map<Character, String> LITERAL_ESCAPES = Map.of(
      'n', "\n", 't', "\t", 'r', "\r", 'f', "\f", 'v', "\013", '0', "\0");

  /**
   * Characters used to decide whether two pieces of a pattern can match the same thing.
   *
   * <p>Comparing two character classes needs something to compare them <em>over</em>: {@code [a-z]}
   * and {@code \w} are sets written in different notations, and the cheap way to ask whether they
   * intersect is to ask which of these each one accepts. Printable ASCII covers what patterns are
   * written about; the whitespace and the two non-Latin letters are there so that {@code .} and
   * {@code \n}, or {@code \w} and a letter outside ASCII, are not called disjoint because nothing in
   * the sample could tell them apart.
   */
  private static final List<String> ALPHABET = alphabet();

  private static List<String> alphabet() {
    List<String> out = new ArrayList<>();
    for (char c = 0x20; c <= 0x7e; c++) out.add(String.valueOf(c));
    out.addAll(List.of("\n", "\t", "\r", "é", "ß", "中"));
    return List.copyOf(out);
  }

  /**
   * Why this pattern is refused, or {@code null} when it is allowed.
   *
   * <p>The message names the shape rather than the position: a document's author reads it in a
   * diagnostic, and the shape is the thing they have to change. The check is deliberately
   * conservative — a refusal removes a rule the author wrote, so bounded repetition is left alone and
   * an alternation whose branches cannot be compared is not refused on suspicion.
   */
  static String costRefusal(String source) {
    List<Group> groups = new ArrayList<>();
    String refusal = null;

    for (int at = 0; at < source.length() && refusal == null; at++) {
      char character = source.charAt(at);
      if (character == '\\') {
        at++;
        continue;
      }
      if (character == '[') {
        // A character class is opaque here: nothing inside it repeats or groups.
        int close = source.indexOf(']', at + 1);
        at = close == -1 ? source.length() : close;
        continue;
      }
      if (character == '(') {
        // `(?:`, `(?=`, `(?!`, `(?<=`, `(?<!`, `(?<name>` — the `?` there names the kind of group and
        // is not a quantifier: `(?:ab){3}` is a fixed body repeated a fixed number of times.
        int body = at + 1;
        if (body < source.length() && source.charAt(body) == '?') {
          body++;
          char after = body < source.length() ? source.charAt(body) : 0;
          char next = body + 1 < source.length() ? source.charAt(body + 1) : 0;
          if (after == '<' && next != '=' && next != '!') {
            int named = source.indexOf('>', body);
            body = named == -1 ? body + 1 : named + 1;
          } else if (after == '<') {
            body += 2;
          } else {
            body++;
          }
        }
        groups.add(new Group(body));
        at = body - 1;
        continue;
      }
      if (character == '|') {
        if (!groups.isEmpty()) groups.get(groups.size() - 1).alternatives.add(at + 1);
        continue;
      }
      if (character == ')') {
        if (groups.isEmpty()) continue;
        Group group = groups.remove(groups.size() - 1);
        Repetition repetition = repetitionAt(source, at + 1);
        // Repeated at all is `max >= 2`: once is not a repetition, and a group that may be skipped is
        // not one either. Whether the count is written or open-ended does not change the shape — it
        // only writes the exponent as a number instead of leaving it as the length of the input.
        boolean repeats = repetition != null && repetition.max >= 2;
        if (repeats) {
          List<String> branches = alternativesOf(source, group, at);
          if (group.variable && branches.stream().anyMatch(MdyDynamicPatterns::bodyIsAmbiguous)) {
            refusal = "a repeated group whose body can be divided several ways, which backtracks exponentially";
          } else if (overlap(branches)) {
            refusal = "repeated alternatives that can match the same text, which backtracks exponentially";
          }
        }
        // What this group contributes to the one around it: a variable body stays variable however
        // it is repeated, and a fixed body becomes variable when the repetition itself is variable.
        if (group.variable || (repetition != null && repetition.min != repetition.max)) {
          if (!groups.isEmpty()) groups.get(groups.size() - 1).variable = true;
        }
        if (repetition != null) at = repetition.end;
        continue;
      }
      Repetition repetition = repetitionAt(source, at);
      if (repetition != null) {
        // A quantifier whose minimum and maximum differ is what makes the run around it variable.
        // `{2}` on a single character is not: it consumes two, always, and offers nothing to divide.
        if (repetition.min != repetition.max && !groups.isEmpty()) {
          groups.get(groups.size() - 1).variable = true;
        }
        at = repetition.end;
      }
    }

    return refusal;
  }

  /**
   * The quantifier at {@code at}, or {@code null} when nothing there is one.
   *
   * <p>{@code {} is only a quantifier when what follows spells a count: a pattern may contain a
   * literal brace, and reading {@code {a}} as a repetition would make the scan lose its place.
   */
  private static Repetition repetitionAt(String source, int at) {
    if (at >= source.length()) return null;
    char character = source.charAt(at);
    if (character == '*') return new Repetition(0, Double.POSITIVE_INFINITY, at);
    if (character == '+') return new Repetition(1, Double.POSITIVE_INFINITY, at);
    if (character == '?') return new Repetition(0, 1, at);
    if (character != '{') return null;
    int close = source.indexOf('}', at);
    if (close == -1) return null;
    String body = source.substring(at + 1, close);
    Matcher exact = EXACT_COUNT.matcher(body);
    if (exact.matches()) {
      double count = Double.parseDouble(exact.group(1));
      return new Repetition(count, count, close);
    }
    Matcher open = OPEN_COUNT.matcher(body);
    if (open.matches()) return new Repetition(Double.parseDouble(open.group(1)), Double.POSITIVE_INFINITY, close);
    Matcher range = RANGE_COUNT.matcher(body);
    if (range.matches()) return new Repetition(Double.parseDouble(range.group(1)), Double.parseDouble(range.group(2)), close);
    return null;
  }

  /** Where a character class ends, accounting for {@code ]} as the first member and for escapes. */
  private static int classEnd(String source, int open) {
    int at = open + 1;
    if (at < source.length() && source.charAt(at) == '^') at++;
    if (at < source.length() && source.charAt(at) == ']') at++;
    for (; at < source.length(); at++) {
      if (source.charAt(at) == '\\') {
        at++;
        continue;
      }
      if (source.charAt(at) == ']') return at;
    }
    return -1;
  }

  /**
   * What an alternative can start with, as something that answers for one character — or
   * {@code null} when that cannot be decided cheaply.
   *
   * <p>{@code null} is the answer that matters: it is what stops a branch this cannot read from being
   * refused on suspicion. A nested group and a backreference stay undecidable deliberately.
   */
  private static Pattern firstMatcher(String branch) {
    if (branch.isEmpty()) return null;
    char head = branch.charAt(0);

    if (head == '\\') {
      if (branch.length() < 2) return null;
      char escaped = branch.charAt(1);
      if (CLASS_ESCAPES.indexOf(escaped) >= 0) return optionalAfter(branch, 2) ? null : build("\\" + escaped);
      if (escaped == 'b' || escaped == 'B') return null;
      if (isDigit(escaped)) return null;
      String literal = LITERAL_ESCAPES.get(escaped);
      if (literal != null) return optionalAfter(branch, 2) ? null : build(escapeLiteral(literal));
      if (isAsciiLetter(escaped)) return null;
      return optionalAfter(branch, 2) ? null : build(escapeLiteral(String.valueOf(escaped)));
    }

    if (head == '[') {
      int close = classEnd(branch, 0);
      if (close == -1) return null;
      return optionalAfter(branch, close + 1) ? null : build(branch.substring(0, close + 1));
    }

    // `.` is a set like any other, and an accurate one matters: `(.|\n)*` is the ordinary way to
    // write "any character at all", and its two branches genuinely cannot match the same character.
    if (head == '.') return optionalAfter(branch, 1) ? null : build(".");

    if ("(^$*+?{|".indexOf(head) >= 0) return null;
    return optionalAfter(branch, 1) ? null : build(escapeLiteral(String.valueOf(head)));
  }

  /** Whether what precedes {@code at} may be absent, which makes the branch's first character undecidable. */
  private static boolean optionalAfter(String branch, int at) {
    if (at >= branch.length()) return false;
    char quantifier = branch.charAt(at);
    if (quantifier == '?' || quantifier == '*') return true;
    if (quantifier != '{') return false;
    int close = branch.indexOf('}', at);
    return close != -1 && ZERO_MINIMUM.matcher(branch.substring(at + 1, close)).lookingAt();
  }

  /**
   * A literal as a pattern body that matches only itself.
   *
   * <p>{@code -} is not escaped: it is only special inside a character class, and {@code \-} is an
   * invalid escape under the Unicode flag the pieces are compiled with — escaped, a hyphen would be a
   * character nothing could be compared against.
   */
  private static String escapeLiteral(String text) {
    StringBuilder out = new StringBuilder(text.length() * 2);
    for (int at = 0; at < text.length(); at++) {
      char character = text.charAt(at);
      if ("\\^$.*+?()[]{}|/".indexOf(character) >= 0) out.append('\\');
      out.append(character);
    }
    return out.toString();
  }

  /** Top-level alternatives of a group body, given where each one starts. */
  private static List<String> alternativesOf(String source, Group group, int end) {
    List<Integer> bounds = new ArrayList<>(group.alternatives);
    bounds.add(end);
    // Each start is recorded *after* its `|`, so every alternative but the last ends one character
    // before the next start — the `|` itself.
    List<String> out = new ArrayList<>();
    for (int index = 0; index < bounds.size() - 1; index++) {
      int from = bounds.get(index);
      int to = bounds.get(index + 1) - (index + 2 < bounds.size() ? 1 : 0);
      out.add(source.substring(from, Math.max(from, to)));
    }
    return out;
  }

  /**
   * The literal string an alternative is, or {@code null} when it is not one.
   *
   * <p>"Not one" is anything that makes the branch match more than the characters it is written
   * with: a quantifier, a class, a group, an escape that stands for a set. An escaped literal is still
   * a literal — {@code \.} is a full stop and nothing else.
   */
  private static String plainWord(String branch) {
    StringBuilder word = new StringBuilder();
    for (int at = 0; at < branch.length(); at++) {
      char character = branch.charAt(at);
      if (character == '\\') {
        if (at + 1 >= branch.length()) return null;
        char escaped = branch.charAt(at + 1);
        if (CLASS_ESCAPES.indexOf(escaped) >= 0 || isAsciiLetter(escaped) || isDigit(escaped)) {
          String literal = LITERAL_ESCAPES.get(escaped);
          if (literal == null) return null;
          word.append(literal);
        } else {
          word.append(escaped);
        }
        at++;
        continue;
      }
      if ("[](){}|*+?.^$".indexOf(character) >= 0) return null;
      word.append(character);
    }
    return word.length() > 0 ? word.toString() : null;
  }

  /**
   * Whether two alternatives can both match at the same position.
   *
   * <p>Plain words first, compared whole: a list of words is the ordinary way to write a closed set
   * of values, and none of {@code (foo|bar|baz)} can be mistaken for another once the second
   * character is read. What makes literal alternatives ambiguous is one being a <em>prefix</em> of
   * another — {@code (a|ab)+}. Anything else is compared as a set intersection over
   * {@link #ALPHABET}: {@code [a-z]} and {@code \w} and {@code a} are three spellings, and what
   * decides ambiguity is what they accept.
   */
  private static boolean overlap(List<String> branches) {
    List<String> words = new ArrayList<>();
    for (String branch : branches) words.add(plainWord(branch));
    if (words.stream().allMatch(word -> word != null)) {
      for (int index = 0; index < words.size(); index++) {
        for (int at = 0; at < words.size(); at++) {
          if (at != index && words.get(at).startsWith(words.get(index))) return true;
        }
      }
      return false;
    }
    List<Pattern> matchers = new ArrayList<>();
    for (String branch : branches) matchers.add(firstMatcher(branch));
    for (int i = 0; i < matchers.size(); i++) {
      Pattern a = matchers.get(i);
      if (a == null) continue;
      for (int j = i + 1; j < matchers.size(); j++) {
        Pattern b = matchers.get(j);
        if (b == null) continue;
        if (ALPHABET.stream().anyMatch(character -> a.matcher(character).matches() && b.matcher(character).matches())) return true;
      }
    }
    return false;
  }

  /**
   * The body of one alternative, split into the elements it is a sequence of.
   *
   * <p>{@code null} when the body holds something this cannot read as a sequence — a backreference,
   * an assertion — which is the answer that keeps an unreadable pattern out of a refusal.
   */
  private static List<Atom> atomsOf(String branch) {
    List<Atom> atoms = new ArrayList<>();
    int at = 0;
    while (at < branch.length()) {
      char character = branch.charAt(at);
      if (character == '^' || character == '$') {
        at++;
        continue;
      }
      int end = at;
      Pattern matcher = null;
      if (character == '\\') {
        if (at + 1 >= branch.length()) return null;
        char escaped = branch.charAt(at + 1);
        // A backreference repeats whatever another group took, so what it accepts is not a property
        // of the source at all.
        if (isDigit(escaped) || escaped == 'b' || escaped == 'B') return null;
        end = at + 1;
        matcher = CLASS_ESCAPES.indexOf(escaped) >= 0
            ? safeMatcher("\\" + escaped)
            : isAsciiLetter(escaped)
                ? null
                : safeMatcher(escapeLiteral(LITERAL_ESCAPES.getOrDefault(escaped, String.valueOf(escaped))));
      } else if (character == '[') {
        int close = classEnd(branch, at);
        if (close == -1) return null;
        end = close;
        matcher = safeMatcher(branch.substring(at, close + 1));
      } else if (character == '.') {
        matcher = safeMatcher(".");
      } else if (character == '(') {
        // A nested group is one element, and what it accepts is everything its own elements accept.
        // Left undecidable it would take the whole seam with it: a hostname's `(?:[a-z0-9-]*[a-z0-9])?`
        // sits between a letter and the dot that ends the repetition.
        int close = groupEnd(branch, at);
        if (close == -1) return null;
        end = close;
        matcher = groupMatcher(branch.substring(at, close + 1));
      } else if (character == ')' || character == '|') {
        return null;
      } else {
        matcher = safeMatcher(escapeLiteral(String.valueOf(character)));
      }
      Repetition repetition = repetitionAt(branch, end + 1);
      atoms.add(new Atom(
          matcher,
          branch.substring(at, end + 1),
          repetition == null ? 1 : repetition.min,
          repetition == null ? 1 : repetition.max));
      at = (repetition == null ? end : repetition.end) + 1;
    }
    return atoms;
  }

  /**
   * Everything a group accepts, as one matcher — the union of every element of every alternative.
   *
   * <p>Not "what it starts with": the question a seam asks is whether the stretchy part can take the
   * character that ends the repetition, and it can do that from anywhere inside itself.
   */
  private static Pattern groupMatcher(String group) {
    String inner = GROUP_CLOSING.matcher(GROUP_OPENING.matcher(group).replaceFirst("")).replaceFirst("");
    List<String> sources = new ArrayList<>();
    for (String branch : topLevelAlternatives(inner)) {
      List<Atom> atoms = atomsOf(branch);
      if (atoms == null) return null;
      for (Atom atom : atoms) {
        if (atom.matcher == null) return null;
        sources.add(atom.source);
      }
    }
    if (sources.isEmpty()) return null;
    return safeMatcher(String.join("|", sources));
  }

  /** A body split on the {@code |} that belongs to it, skipping the ones inside groups and classes. */
  private static List<String> topLevelAlternatives(String body) {
    List<String> out = new ArrayList<>();
    int from = 0;
    int depth = 0;
    for (int at = 0; at < body.length(); at++) {
      char character = body.charAt(at);
      if (character == '\\') {
        at++;
        continue;
      }
      if (character == '[') {
        int close = classEnd(body, at);
        if (close == -1) break;
        at = close;
        continue;
      }
      if (character == '(') {
        depth++;
      } else if (character == ')') {
        depth--;
      } else if (character == '|' && depth == 0) {
        out.add(body.substring(from, at));
        from = at + 1;
      }
    }
    out.add(body.substring(from));
    return out;
  }

  /** Where the group opened at {@code at} closes, skipping classes and escapes. */
  private static int groupEnd(String source, int at) {
    int depth = 0;
    for (int index = at; index < source.length(); index++) {
      char character = source.charAt(index);
      if (character == '\\') {
        index++;
        continue;
      }
      if (character == '[') {
        int close = classEnd(source, index);
        if (close == -1) return -1;
        index = close;
        continue;
      }
      if (character == '(') {
        depth++;
      } else if (character == ')') {
        depth--;
        if (depth == 0) return index;
      }
    }
    return -1;
  }

  /**
   * A pattern body compiled to something that answers for one character, or {@code null} when it
   * will not.
   *
   * <p>The body is held to the Unicode-mode grammar first, because that is the grammar the contract
   * compiles these pieces under and it is stricter than the flagless one: {@code \-} outside a class,
   * a lone {@code ]}, an escape that names nothing are all refusals there. Only a body that passes is
   * handed to {@code java.util.regex}, spelled the way it reads it.
   */
  private static Pattern safeMatcher(String body) {
    String wrapped = "^(?:" + body + ")$";
    if (!new JsSyntax(wrapped, true).valid()) return null;
    try {
      return Pattern.compile("^(?:" + forJava(body) + ")$");
    } catch (IllegalArgumentException e) {
      return null;
    }
  }

  private static Pattern build(String body) {
    return safeMatcher(body);
  }

  /**
   * A Unicode-mode JavaScript pattern body spelled for {@code java.util.regex}.
   *
   * <p>The two engines agree on everything a form pattern is ordinarily made of. They part on a
   * handful of spellings, each rewritten here: {@code [} and {@code &} inside a class are literals in
   * JavaScript and a nested class or an intersection in Java; {@code \v} is one vertical tab in
   * JavaScript and a class of vertical whitespace in Java; {@code \0} and a class's {@code \b} are
   * characters JavaScript names and Java does not; {@code &#92;u{…}} is Java's {@code \x{…}}; and the
   * empty class and its negation, which Java cannot write at all, become a pattern that matches
   * nothing and one that matches anything.
   */
  private static String forJava(String body) {
    StringBuilder out = new StringBuilder(body.length() + 8);
    boolean inClass = false;
    for (int at = 0; at < body.length(); at++) {
      char character = body.charAt(at);
      if (character == '\\' && at + 1 < body.length()) {
        char escaped = body.charAt(at + 1);
        at++;
        if (escaped == 'v') {
          out.append("\\x0B");
        } else if (escaped == '0') {
          out.append("\\x00");
        } else if (escaped == 'b' && inClass) {
          out.append("\\x08");
        } else if (escaped == 'u' && at + 1 < body.length() && body.charAt(at + 1) == '{') {
          int close = body.indexOf('}', at);
          out.append("\\x").append(body, at + 1, close + 1);
          at = close;
        } else {
          out.append('\\').append(escaped);
        }
        continue;
      }
      if (inClass) {
        if (character == ']') {
          inClass = false;
        } else if (character == '[' || character == '&') {
          out.append('\\');
        }
        out.append(character);
        continue;
      }
      if (character == '[') {
        if (body.startsWith("[]", at)) {
          out.append("(?!)");
          at++;
          continue;
        }
        if (body.startsWith("[^]", at)) {
          out.append("[\\s\\S]");
          at += 2;
          continue;
        }
        inClass = true;
      }
      out.append(character);
    }
    return out.toString();
  }

  /** Whether everything {@code inner} accepts, the stretchy {@code outer} accepts too. Undecidable counts as yes. */
  private static boolean containedIn(Atom inner, Atom outer) {
    if (inner.matcher == null || outer.matcher == null) return true;
    return ALPHABET.stream().allMatch(character ->
        !inner.matcher.matcher(character).matches() || outer.matcher.matcher(character).matches());
  }

  /**
   * Whether repeating this body gives the engine more than one way to divide the same input.
   *
   * <p>A variable element creates the <em>opportunity</em> to divide the input several ways; only
   * ambiguity makes the engine try all of them. What the cheap patterns have is a forced boundary:
   * something the stretchy part cannot itself match sits between one repetition and the next, so
   * there is exactly one place the division can fall — a dot after digits, a hyphen after letters.
   * The question is asked at the seam, in the only two shapes it has: the body ends stretchy, and the
   * next repetition starts with the body's first element; or the body ends fixed, and what precedes
   * that ending is stretchy. Undecidable is read as ambiguous, so a body this cannot take apart is
   * still refused when it repeats.
   */
  private static boolean bodyIsAmbiguous(String branch) {
    List<Atom> atoms = atomsOf(branch);
    if (atoms == null || atoms.isEmpty()) return false;
    if (atoms.stream().noneMatch(atom -> atom.min != atom.max)) return false;
    // An ending that may be absent is not an ending: `([A-Za-z]+[0-9]*)+` looks pinned by its digits
    // and is the classic blowup with none of them present, so trailing elements that can contribute
    // nothing are dropped before the seam is read.
    int end = atoms.size() - 1;
    while (end >= 0 && atoms.get(end).min == 0) end--;
    // Nothing that must be there at all: a body that can match empty and repeats is the loop that
    // makes no progress, which is ambiguous by construction.
    if (end < 0) return true;

    Atom last = atoms.get(end);
    if (last.min != last.max) {
      if (containedIn(atoms.get(0), last)) return true;
      // Nothing ends the body, so an internal seam is free too: two stretchy elements side by side
      // that can both take the same character divide the run between them wherever they like, and
      // repeating that multiplies it.
      for (int index = 0; index < end; index++) {
        Atom a = atoms.get(index);
        Atom b = atoms.get(index + 1);
        if (a.min == a.max || b.min == b.max) continue;
        if (a.matcher == null || b.matcher == null) return true;
        if (ALPHABET.stream().anyMatch(character ->
            a.matcher.matcher(character).matches() && b.matcher.matcher(character).matches())) return true;
      }
      return false;
    }

    // The boundary is anywhere in the fixed run after the last stretchy element, not only at its
    // very end: `("[^"]*",)` ends in a comma the stretchy part *can* take, and is pinned all the same
    // by the quote before it.
    int stretchy = end;
    while (stretchy >= 0 && atoms.get(stretchy).min == atoms.get(stretchy).max) stretchy--;
    if (stretchy < 0) return false;
    for (int index = stretchy + 1; index <= end; index++) {
      if (!containedIn(atoms.get(index), atoms.get(stretchy))) return false;
    }
    return true;
  }

  private static boolean isDigit(char character) {
    return character >= '0' && character <= '9';
  }

  private static boolean isAsciiLetter(char character) {
    return (character >= 'a' && character <= 'z') || (character >= 'A' && character <= 'Z');
  }

  // ─── Syntax: whether `new RegExp(source)` compiles ───

  /** Whether {@code source} is a regular expression a flagless JavaScript {@code RegExp} compiles. */
  static boolean compiles(String source) {
    return new JsSyntax(source, false).valid();
  }

  /**
   * A reading of the ECMAScript pattern grammar that answers only whether the source parses.
   *
   * <p>Flagless mode is the grammar with Annex B: a brace that does not spell a count is a literal,
   * so is a lone {@code ]} or {@code }}, an escape that names nothing stands for its own letter, a
   * backreference to a group the pattern does not have is an octal or identity escape, and a
   * lookahead may be quantified. Unicode mode withdraws every one of those and adds {@code &#92;u{…}}
   * and {@code \p{…}}. In both, an assertion cannot be quantified, two quantifiers cannot follow one
   * another, a range in a class must be in order, a group must close, a named reference must name a
   * group that exists, and two groups may share a name only when no match can reach both.
   */
  private static final class JsSyntax {
    private static final String SYNTAX_CHARACTERS = "^$\\.*+?()[]{}|";

    private final String source;
    private final boolean unicode;
    private final int length;
    private int at;
    /** How many capturing groups the whole pattern has, so a decimal escape can be told from a backreference. */
    private final int groupCount;
    /** Every group name the pattern declares, so a {@code \k<…>} may refer forward. */
    private final Set<String> names = new HashSet<>();
    /** Whether the pattern declares any group name, which is what makes {@code \k} a reference. */
    private final boolean named;
    /** Where each declared name sits among the pattern's alternations, for the duplicate-name rule. */
    private final Map<String, List<List<Integer>>> declared = new HashMap<>();
    /** The alternations enclosing the current position, as pairs of (alternation, chosen branch). */
    private final List<Integer> path = new ArrayList<>();
    private int alternations = 0;

    JsSyntax(String source, boolean unicode) {
      this.source = source;
      this.unicode = unicode;
      this.length = source.length();
      // The grammar's decisions about `\k` and `\7` depend on the whole pattern, so groups are
      // counted before it is read.
      int count = 0;
      boolean anyNamed = false;
      for (int i = 0; i < length; i++) {
        char c = source.charAt(i);
        if (c == '\\') {
          i++;
          continue;
        }
        if (c == '[') {
          int close = classClose(i);
          if (close == -1) break;
          i = close;
          continue;
        }
        if (c != '(') continue;
        if (i + 1 < length && source.charAt(i + 1) == '?') {
          if (i + 3 < length && source.charAt(i + 2) == '<' && source.charAt(i + 3) != '=' && source.charAt(i + 3) != '!') {
            count++;
            anyNamed = true;
            int close = source.indexOf('>', i + 3);
            if (close != -1) names.add(source.substring(i + 3, close));
          }
        } else {
          count++;
        }
      }
      this.groupCount = count;
      this.named = anyNamed;
    }

    /** Where the class opened at {@code open} closes under the JavaScript rule — the first unescaped {@code ]}. */
    private int classClose(int open) {
      for (int i = open + 1; i < length; i++) {
        char c = source.charAt(i);
        if (c == '\\') {
          i++;
          continue;
        }
        if (c == ']') return i;
      }
      return -1;
    }

    boolean valid() {
      try {
        at = 0;
        disjunction();
        if (at < length) fail();
        return true;
      } catch (Invalid e) {
        return false;
      }
    }

    private static final class Invalid extends RuntimeException {
      Invalid() {
        super(null, null, false, false);
      }
    }

    private static void fail() {
      throw new Invalid();
    }

    private char peek() {
      return at < length ? source.charAt(at) : 0;
    }

    private char peek(int ahead) {
      return at + ahead < length ? source.charAt(at + ahead) : 0;
    }

    private void disjunction() {
      path.add(alternations++);
      path.add(0);
      alternative();
      while (peek() == '|' && at < length) {
        at++;
        path.set(path.size() - 1, path.get(path.size() - 1) + 1);
        alternative();
      }
      path.remove(path.size() - 1);
      path.remove(path.size() - 1);
    }

    private void alternative() {
      while (at < length) {
        char c = source.charAt(at);
        if (c == '|' || c == ')') return;
        term();
      }
    }

    private void term() {
      char c = source.charAt(at);
      switch (c) {
        case '^', '$' -> at++;
        case '\\' -> {
          if (peek(1) == 'b' || peek(1) == 'B') {
            at += 2;
          } else {
            at++;
            atomEscape();
            quantifier();
          }
        }
        case '(' -> group();
        case '[' -> {
          characterClass();
          quantifier();
        }
        case '*', '+', '?' -> fail();
        case '{' -> {
          // A brace that spells a count with nothing before it has nothing to repeat; one that does
          // not is a literal — in flagless mode. Unicode mode has no literal brace.
          if (bracedQuantifier(at) != null || unicode) fail();
          at++;
          quantifier();
        }
        case '}', ']' -> {
          if (unicode) fail();
          at++;
          quantifier();
        }
        default -> {
          at++;
          quantifier();
        }
      }
    }

    /** Consumes the quantifier at the current position, if there is one, with its lazy marker. */
    private void quantifier() {
      char c = peek();
      if (c == '*' || c == '+' || c == '?') {
        at++;
      } else if (c == '{') {
        int[] braced = bracedQuantifier(at);
        if (braced == null) return;
        if (braced[1] == 1) fail();
        at = braced[0];
      } else {
        return;
      }
      if (peek() == '?') at++;
    }

    /**
     * The braced quantifier at {@code open}, as {@code {end, outOfOrder}}, or {@code null} when the
     * braces do not spell a count: {@code {n}}, {@code {n,}} or {@code {n,m}} with decimal digits
     * and nothing else.
     */
    private int[] bracedQuantifier(int open) {
      int i = open + 1;
      int minStart = i;
      while (i < length && isDigit(source.charAt(i))) i++;
      if (i == minStart) return null;
      String min = source.substring(minStart, i);
      String max = null;
      if (i < length && source.charAt(i) == ',') {
        i++;
        int maxStart = i;
        while (i < length && isDigit(source.charAt(i))) i++;
        if (i > maxStart) max = source.substring(maxStart, i);
      }
      if (i >= length || source.charAt(i) != '}') return null;
      boolean outOfOrder = max != null && compareCounts(min, max) > 0;
      return new int[] {i + 1, outOfOrder ? 1 : 0};
    }

    /** Numeric order of two digit strings of any length. */
    private static int compareCounts(String a, String b) {
      String x = a.replaceFirst("^0+(?=\\d)", "");
      String y = b.replaceFirst("^0+(?=\\d)", "");
      if (x.length() != y.length()) return Integer.compare(x.length(), y.length());
      return x.compareTo(y);
    }

    private void group() {
      at++;
      if (peek() == '?') {
        at++;
        if (at >= length) fail();
        char kind = source.charAt(at);
        if (kind == ':') {
          at++;
          disjunction();
          close();
          quantifier();
          return;
        }
        if (kind == '=' || kind == '!') {
          at++;
          disjunction();
          close();
          // A lookahead is quantifiable in flagless mode and nowhere else.
          if (!unicode) quantifier();
          return;
        }
        if (kind == '<') {
          at++;
          if (peek() == '=' || peek() == '!') {
            at++;
            disjunction();
            close();
            return;
          }
          String name = groupName();
          declare(name);
          disjunction();
          close();
          quantifier();
          return;
        }
        modifiers();
        disjunction();
        close();
        quantifier();
        return;
      }
      disjunction();
      close();
      quantifier();
    }

    private void close() {
      if (peek() != ')' || at >= length) fail();
      at++;
    }

    /** {@code (?ims-ims:} — each flag once, the two sets disjoint, not both empty. */
    private void modifiers() {
      Set<Character> add = new HashSet<>();
      Set<Character> remove = new HashSet<>();
      while (at < length && "ims".indexOf(source.charAt(at)) >= 0) {
        if (!add.add(source.charAt(at))) fail();
        at++;
      }
      if (peek() == '-' && at < length) {
        at++;
        while (at < length && "ims".indexOf(source.charAt(at)) >= 0) {
          char flag = source.charAt(at);
          if (add.contains(flag) || !remove.add(flag)) fail();
          at++;
        }
        if (add.isEmpty() && remove.isEmpty()) fail();
      } else if (add.isEmpty()) {
        fail();
      }
      if (peek() != ':' || at >= length) fail();
      at++;
    }

    /** Reads a group name up to and including its closing {@code >}. */
    private String groupName() {
      StringBuilder name = new StringBuilder();
      boolean first = true;
      while (true) {
        if (at >= length) fail();
        int codePoint;
        if (source.charAt(at) == '\\') {
          at++;
          if (peek() != 'u') fail();
          at++;
          codePoint = unicodeEscapeInName();
        } else {
          codePoint = source.codePointAt(at);
          at += Character.charCount(codePoint);
        }
        if (codePoint == '>' && !first) break;
        boolean allowed = first
            ? Character.isUnicodeIdentifierStart(codePoint) || codePoint == '$' || codePoint == '_'
            : (Character.isUnicodeIdentifierPart(codePoint) && !Character.isIdentifierIgnorable(codePoint))
                || codePoint == '$' || codePoint == 0x200C || codePoint == 0x200D;
        if (!allowed) fail();
        name.appendCodePoint(codePoint);
        first = false;
      }
      return name.toString();
    }

    /** The code point of a {@code &#92;uXXXX} or {@code &#92;u{…}} escape inside a group name, after the {@code u}. */
    private int unicodeEscapeInName() {
      if (peek() == '{') {
        at++;
        int start = at;
        while (at < length && isHex(source.charAt(at))) at++;
        if (at == start || peek() != '}') fail();
        int value = parseHex(source.substring(start, at));
        at++;
        return value;
      }
      if (!hexRun(4)) fail();
      int value = parseHex(source.substring(at, at + 4));
      at += 4;
      // A lead surrogate may be followed by its trail written as a second escape.
      if (Character.isHighSurrogate((char) value) && peek() == '\\' && peek(1) == 'u' && at + 6 <= length) {
        String trail = source.substring(at + 2, at + 6);
        if (trail.chars().allMatch(c -> isHex((char) c)) && Character.isLowSurrogate((char) parseHex(trail))) {
          at += 6;
          return Character.toCodePoint((char) value, (char) parseHex(trail));
        }
      }
      return value;
    }

    /** Records a declared group name; two with the same name must be on different branches of one alternation. */
    private void declare(String name) {
      List<Integer> here = List.copyOf(path);
      List<List<Integer>> earlier = declared.computeIfAbsent(name, key -> new ArrayList<>());
      for (List<Integer> other : earlier) {
        if (!exclusive(here, other)) fail();
      }
      earlier.add(here);
    }

    /** Whether two positions sit on different branches of a common alternation, so no match reaches both. */
    private static boolean exclusive(List<Integer> a, List<Integer> b) {
      for (int i = 0; i + 1 < a.size() && i + 1 < b.size(); i += 2) {
        if (!a.get(i).equals(b.get(i))) return false;
        if (!a.get(i + 1).equals(b.get(i + 1))) return true;
      }
      return false;
    }

    /** The escape after a {@code \} outside a class, with {@code \b} and {@code \B} already taken as assertions. */
    private void atomEscape() {
      if (at >= length) fail();
      char e = source.charAt(at);
      if (e >= '1' && e <= '9') {
        int start = at;
        while (at < length && isDigit(source.charAt(at))) at++;
        // A backreference when the pattern has that many groups; otherwise, in flagless mode, a legacy
        // octal or identity escape, which no digits can make invalid.
        if (!refersToGroup(source.substring(start, at)) && unicode) fail();
        return;
      }
      if (e == '0') {
        at++;
        if (isDigit(peek())) {
          if (unicode) fail();
          while (at < length && isDigit(source.charAt(at))) at++;
        }
        return;
      }
      if (CLASS_ESCAPES.indexOf(e) >= 0) {
        at++;
        return;
      }
      if (e == 'p' || e == 'P') {
        at++;
        if (unicode) propertyEscape();
        return;
      }
      if (e == 'k') {
        at++;
        if (unicode || named) groupReference();
        return;
      }
      if (e == 'c') {
        if (isAsciiLetter(peek(1))) {
          at += 2;
          return;
        }
        // Flagless mode reads the backslash as a literal and the `c` as the next atom.
        if (unicode) fail();
        return;
      }
      if (e == 'x') {
        at++;
        if (hexRun(2)) {
          at += 2;
        } else if (unicode) {
          fail();
        }
        return;
      }
      if (e == 'u') {
        at++;
        if (hexRun(4)) {
          at += 4;
        } else if (unicode && peek() == '{') {
          bracedCodePoint();
        } else if (unicode) {
          fail();
        }
        return;
      }
      if ("fnrtv".indexOf(e) >= 0) {
        at++;
        return;
      }
      if (unicode && SYNTAX_CHARACTERS.indexOf(e) < 0 && e != '/') fail();
      at++;
    }

    private boolean refersToGroup(String digits) {
      return compareCounts(digits, Integer.toString(groupCount)) <= 0;
    }

    /** {@code <name>} after {@code \k}, naming a group the pattern declares somewhere. */
    private void groupReference() {
      if (peek() != '<' || at >= length) fail();
      at++;
      String name = groupName();
      if (!names.contains(name)) fail();
    }

    /** {@code {Name}} or {@code {Name=Value}} after {@code \p}; whether the name exists is not asked. */
    private void propertyEscape() {
      if (peek() != '{' || at >= length) fail();
      at++;
      int start = at;
      while (at < length && (isAsciiLetter(source.charAt(at)) || isDigit(source.charAt(at)) || source.charAt(at) == '_')) at++;
      if (at == start) fail();
      if (peek() == '=' && at < length) {
        at++;
        int valueStart = at;
        while (at < length && (isAsciiLetter(source.charAt(at)) || isDigit(source.charAt(at)) || source.charAt(at) == '_')) at++;
        if (at == valueStart) fail();
      }
      if (peek() != '}' || at >= length) fail();
      at++;
    }

    /** {@code {H…}} after {@code &#92;u} in Unicode mode, naming a code point that exists. */
    private int bracedCodePoint() {
      at++;
      int start = at;
      while (at < length && isHex(source.charAt(at))) at++;
      if (at == start || peek() != '}') fail();
      String digits = source.substring(start, at).replaceFirst("^0+(?=.)", "");
      if (digits.length() > 6 || Integer.parseInt(digits, 16) > 0x10FFFF) fail();
      at++;
      return Integer.parseInt(digits, 16);
    }

    private void characterClass() {
      at++;
      if (peek() == '^' && at < length) at++;
      while (true) {
        if (at >= length) fail();
        if (source.charAt(at) == ']') {
          at++;
          return;
        }
        int from = classAtom();
        if (peek() == '-' && at < length && peek(1) != ']' && at + 1 < length) {
          at++;
          int to = classAtom();
          // A range whose end is a set is not a range: an error in Unicode mode, three literals otherwise.
          if (from < 0 || to < 0) {
            if (unicode) fail();
            continue;
          }
          if (from > to) fail();
        }
      }
    }

    /** One member of a class: its code point, or {@code -1} for an escape that stands for a set. */
    private int classAtom() {
      char c = source.charAt(at);
      if (c != '\\') {
        int codePoint = unicode ? source.codePointAt(at) : c;
        at += unicode ? Character.charCount(codePoint) : 1;
        return codePoint;
      }
      at++;
      if (at >= length) fail();
      char e = source.charAt(at);
      if (e == 'b') {
        at++;
        return 8;
      }
      if (e == '-') {
        at++;
        return '-';
      }
      if (CLASS_ESCAPES.indexOf(e) >= 0) {
        at++;
        return -1;
      }
      if (e == 'p' || e == 'P') {
        at++;
        if (!unicode) return e;
        propertyEscape();
        return -1;
      }
      if (e == 'c') {
        char next = peek(1);
        if (isAsciiLetter(next) || (!unicode && (isDigit(next) || next == '_'))) {
          at += 2;
          return next % 32;
        }
        if (unicode) fail();
        return '\\';
      }
      if (e == '0') {
        at++;
        if (!isDigit(peek())) return 0;
        if (unicode) fail();
        return legacyOctal(0);
      }
      if (e >= '1' && e <= '9') {
        if (unicode) fail();
        if (e >= '8') {
          at++;
          return e;
        }
        return legacyOctal(-1);
      }
      if (e == 'k') {
        if (unicode || named) fail();
        at++;
        return 'k';
      }
      if (e == 'x') {
        at++;
        if (hexRun(2)) {
          int value = parseHex(source.substring(at, at + 2));
          at += 2;
          return value;
        }
        if (unicode) fail();
        return 'x';
      }
      if (e == 'u') {
        at++;
        if (hexRun(4)) {
          int value = parseHex(source.substring(at, at + 4));
          at += 4;
          return value;
        }
        if (unicode && peek() == '{') return bracedCodePoint();
        if (unicode) fail();
        return 'u';
      }
      switch (e) {
        case 'f' -> {
          at++;
          return 12;
        }
        case 'n' -> {
          at++;
          return 10;
        }
        case 'r' -> {
          at++;
          return 13;
        }
        case 't' -> {
          at++;
          return 9;
        }
        case 'v' -> {
          at++;
          return 11;
        }
        default -> {
          if (unicode && SYNTAX_CHARACTERS.indexOf(e) < 0 && e != '/') fail();
          at++;
          return e;
        }
      }
    }

    /** Up to three octal digits with a value below 0400, starting at the current position; {@code first} is a digit already read, or -1. */
    private int legacyOctal(int first) {
      int value = first < 0 ? 0 : first;
      int digits = first < 0 ? 0 : 1;
      while (at < length && digits < 3) {
        char d = source.charAt(at);
        if (d < '0' || d > '7') break;
        if (value * 8 + (d - '0') > 0377) break;
        value = value * 8 + (d - '0');
        at++;
        digits++;
      }
      return value;
    }

    private boolean hexRun(int count) {
      if (at + count > length) return false;
      for (int i = 0; i < count; i++) {
        if (!isHex(source.charAt(at + i))) return false;
      }
      return true;
    }

    private static boolean isHex(char c) {
      return isDigit(c) || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F');
    }

    private static int parseHex(String digits) {
      return Integer.parseInt(digits, 16);
    }
  }
}
