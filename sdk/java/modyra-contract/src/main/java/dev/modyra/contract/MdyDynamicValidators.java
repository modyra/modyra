package dev.modyra.contract;

import com.fasterxml.jackson.annotation.JsonInclude;

/** Mirrors {@code MdyDynamicValidators} in packages/core/src/dynamic-config.ts — every field optional (absent means "no constraint"). */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record MdyDynamicValidators(
    Boolean required,
    Boolean email,
    Double min,
    Double max,
    Integer minLength,
    Integer maxLength,
    String pattern
) {
  public static final MdyDynamicValidators NONE = new MdyDynamicValidators(null, null, null, null, null, null, null);
}
