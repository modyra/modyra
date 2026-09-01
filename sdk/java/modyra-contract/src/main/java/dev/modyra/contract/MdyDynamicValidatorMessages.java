package dev.modyra.contract;

import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * Mirrors {@code MdyDynamicValidatorMessages} in packages/core/src/dynamic-config.ts — what each
 * rule says when it refuses, in the author's own words.
 *
 * <p>Every field optional: a rule with no sentence here refuses in the form's own language.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record MdyDynamicValidatorMessages(
    String required,
    String email,
    String integer,
    String min,
    String max,
    String minLength,
    String maxLength,
    String pattern
) {
  public static final MdyDynamicValidatorMessages NONE =
      new MdyDynamicValidatorMessages(null, null, null, null, null, null, null, null);
}
