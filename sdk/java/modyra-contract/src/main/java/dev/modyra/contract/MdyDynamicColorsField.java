package dev.modyra.contract;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.List;

/**
 * Colour kind. Mirrors {@code MdyDynamicColorsField}.
 *
 * <p>Each preset is either a colour string or a {@code {value, label}} object, so they are carried
 * as read: a typed element would have to pick one of the two and would drop a label on the way back
 * out.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record MdyDynamicColorsField(
    String name,
    String kind,
    String label,
    String placeholder,
    Object initialValue,
    MdyDynamicValidators validators,
    List<Object> presets
) implements MdyDynamicField {
}
