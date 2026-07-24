package dev.modyra.contract;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;

/** Numeric kinds: number, slider. Mirrors {@code MdyDynamicNumberField}. */
@JsonIgnoreProperties(ignoreUnknown = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
public record MdyDynamicNumberField(
    String name,
    String kind,
    String label,
    String placeholder,
    Object initialValue,
    MdyDynamicValidators validators,
    Double min,
    Double max,
    Double step
) implements MdyDynamicField {
}
