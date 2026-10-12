package dev.modyra.contract;

import com.fasterxml.jackson.annotation.JsonInclude;

/** File kind. Mirrors {@code MdyDynamicFileField}; {@code accept} and {@code multiple} are the native input's. */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record MdyDynamicFileField(
    String name,
    String kind,
    String label,
    String placeholder,
    Object initialValue,
    MdyDynamicValidators validators,
    String accept,
    Boolean multiple
) implements MdyDynamicField {
}
