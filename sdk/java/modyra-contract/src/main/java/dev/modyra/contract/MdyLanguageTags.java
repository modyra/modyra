package dev.modyra.contract;

import java.util.HashSet;
import java.util.Set;

/**
 * Whether a locale is one {@code Intl.getCanonicalLocales} accepts: ECMA-402's
 * {@code IsStructurallyValidLanguageTag}, which is the {@code unicode_bcp47_locale_id} grammar of
 * UTS #35 without its compatibility forms — no {@code root}, no tag starting with a script, no
 * underscore, no grandfathered or private-use-only tag — and with no variant and no extension
 * singleton written twice.
 *
 * <p>{@link java.util.Locale.Builder#setLanguageTag} is not the answer: it reads RFC 5646, which admits
 * extlang subtags, grandfathered tags and a tag that is only private use, each of which
 * JavaScript throws on. A locale a JavaScript renderer throws on takes the form down at mount, so
 * the two readers have to draw the same line.
 */
final class MdyLanguageTags {

  private MdyLanguageTags() {}

  static boolean isStructurallyValid(String tag) {
    String[] subtags = asciiLowercase(tag).split("-", -1);
    int[] at = {0};
    if (!languageId(subtags, at)) return false;
    Set<Character> singletons = new HashSet<>();
    while (at[0] < subtags.length) {
      String singleton = subtags[at[0]];
      if (singleton.length() != 1 || !isAlphanumeric(singleton)) return false;
      char kind = singleton.charAt(0);
      at[0]++;
      if (kind == 'x') return privateUse(subtags, at);
      if (!singletons.add(kind)) return false;
      boolean read = switch (kind) {
        case 'u' -> unicodeExtension(subtags, at);
        case 't' -> transformedExtension(subtags, at);
        default -> otherExtension(subtags, at);
      };
      if (!read) return false;
    }
    return true;
  }

  /**
   * The tag with A–Z lowered and nothing else touched. {@link String#toLowerCase} would turn the
   * Kelvin sign into {@code k} and so accept a tag JavaScript refuses for holding a character
   * outside ASCII.
   */
  private static String asciiLowercase(String tag) {
    StringBuilder out = new StringBuilder(tag.length());
    for (int i = 0; i < tag.length(); i++) {
      char c = tag.charAt(i);
      out.append(c >= 'A' && c <= 'Z' ? (char) (c + ('a' - 'A')) : c);
    }
    return out.toString();
  }

  /** {@code language (-script)? (-region)? (-variant)*}, every variant distinct. */
  private static boolean languageId(String[] subtags, int[] at) {
    if (at[0] >= subtags.length || !isLanguage(subtags[at[0]])) return false;
    at[0]++;
    if (at[0] < subtags.length && isScript(subtags[at[0]])) at[0]++;
    if (at[0] < subtags.length && isRegion(subtags[at[0]])) at[0]++;
    Set<String> variants = new HashSet<>();
    while (at[0] < subtags.length && isVariant(subtags[at[0]])) {
      if (!variants.add(subtags[at[0]])) return false;
      at[0]++;
    }
    return true;
  }

  /** {@code -u}: attributes, then keywords — a two-character key and the types after it — and at least one of either. */
  private static boolean unicodeExtension(String[] subtags, int[] at) {
    int start = at[0];
    while (at[0] < subtags.length && isAlphanumeric(subtags[at[0]], 3, 8)) at[0]++;
    while (at[0] < subtags.length && isUnicodeKey(subtags[at[0]])) {
      at[0]++;
      while (at[0] < subtags.length && isAlphanumeric(subtags[at[0]], 3, 8)) at[0]++;
    }
    return at[0] > start && endsAnExtension(subtags, at);
  }

  /** {@code -t}: a language id, fields — a key of a letter and a digit, then one value or more — or both. */
  private static boolean transformedExtension(String[] subtags, int[] at) {
    int start = at[0];
    if (at[0] < subtags.length && isLanguage(subtags[at[0]]) && !languageId(subtags, at)) return false;
    while (at[0] < subtags.length && isTransformedKey(subtags[at[0]])) {
      at[0]++;
      int values = at[0];
      while (at[0] < subtags.length && isAlphanumeric(subtags[at[0]], 3, 8)) at[0]++;
      if (at[0] == values) return false;
    }
    return at[0] > start && endsAnExtension(subtags, at);
  }

  /** Any other singleton: one subtag or more of two to eight characters. */
  private static boolean otherExtension(String[] subtags, int[] at) {
    int start = at[0];
    while (at[0] < subtags.length && isAlphanumeric(subtags[at[0]], 2, 8)) at[0]++;
    return at[0] > start && endsAnExtension(subtags, at);
  }

  /** {@code -x}: the rest of the tag, one subtag or more of one to eight characters. */
  private static boolean privateUse(String[] subtags, int[] at) {
    if (at[0] >= subtags.length) return false;
    for (; at[0] < subtags.length; at[0]++) {
      if (!isAlphanumeric(subtags[at[0]], 1, 8)) return false;
    }
    return true;
  }

  /** An extension ends at the end of the tag or at the next singleton. */
  private static boolean endsAnExtension(String[] subtags, int[] at) {
    return at[0] == subtags.length || subtags[at[0]].length() == 1;
  }

  private static boolean isLanguage(String s) {
    return isAlpha(s) && (s.length() == 2 || s.length() == 3 || (s.length() >= 5 && s.length() <= 8));
  }

  private static boolean isScript(String s) {
    return s.length() == 4 && isAlpha(s);
  }

  private static boolean isRegion(String s) {
    return (s.length() == 2 && isAlpha(s)) || (s.length() == 3 && isDigits(s));
  }

  private static boolean isVariant(String s) {
    return isAlphanumeric(s, 5, 8) || (s.length() == 4 && isDigit(s.charAt(0)) && isAlphanumeric(s));
  }

  private static boolean isUnicodeKey(String s) {
    return s.length() == 2 && isAlphanumeric(s) && isLetter(s.charAt(1));
  }

  private static boolean isTransformedKey(String s) {
    return s.length() == 2 && isLetter(s.charAt(0)) && isDigit(s.charAt(1));
  }

  private static boolean isAlphanumeric(String s, int min, int max) {
    return s.length() >= min && s.length() <= max && isAlphanumeric(s);
  }

  private static boolean isAlphanumeric(String s) {
    for (int i = 0; i < s.length(); i++) {
      if (!isLetter(s.charAt(i)) && !isDigit(s.charAt(i))) return false;
    }
    return true;
  }

  private static boolean isAlpha(String s) {
    for (int i = 0; i < s.length(); i++) {
      if (!isLetter(s.charAt(i))) return false;
    }
    return true;
  }

  private static boolean isDigits(String s) {
    for (int i = 0; i < s.length(); i++) {
      if (!isDigit(s.charAt(i))) return false;
    }
    return true;
  }

  /** ASCII only: the grammar's {@code alpha} is {@code [A-Za-z]}, and the tag is lowercased first. */
  private static boolean isLetter(char c) {
    return c >= 'a' && c <= 'z';
  }

  private static boolean isDigit(char c) {
    return c >= '0' && c <= '9';
  }
}
