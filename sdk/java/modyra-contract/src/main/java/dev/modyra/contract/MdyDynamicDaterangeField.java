package dev.modyra.contract;

import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * Start/end date kind: daterange. Mirrors {@code MdyDynamicDaterangeField}. A record of its own,
 * not another name on {@link MdyDynamicDateField}, because its value is a pair rather than one
 * instant, and a type test should say which shape it holds.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record MdyDynamicDaterangeField(
    String name,
    String kind,
    String label,
    String placeholder,
    Object initialValue,
    MdyDynamicValidators validators
) implements MdyDynamicField {
}
