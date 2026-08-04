package dev.modyra.contract;

import com.fasterxml.jackson.annotation.JsonInclude;

/** Date/time kinds: datepicker, timepicker. Mirrors {@code MdyDynamicDateField}. */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record MdyDynamicDateField(
    String name,
    String kind,
    String label,
    String placeholder,
    Object initialValue,
    MdyDynamicValidators validators
) implements MdyDynamicField {
}
