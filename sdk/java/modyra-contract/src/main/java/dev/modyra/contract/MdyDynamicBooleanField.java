package dev.modyra.contract;

import com.fasterxml.jackson.annotation.JsonInclude;

/** Boolean kinds: checkbox, toggle. Mirrors {@code MdyDynamicBooleanField}. */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record MdyDynamicBooleanField(
    String name,
    String kind,
    String label,
    String placeholder,
    Object initialValue,
    MdyDynamicValidators validators
) implements MdyDynamicField {
}
