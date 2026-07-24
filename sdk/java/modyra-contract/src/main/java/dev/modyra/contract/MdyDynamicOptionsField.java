package dev.modyra.contract;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.List;

/**
 * Option-based kinds: select, radio, multiselect, segmented. Mirrors
 * {@code MdyDynamicOptionsField}. The declared options are also a
 * whitelist on the Java side, same as TS's {@code buildDynamicFieldValidators}
 * (see {@link MdyDynamicFormParser} for the structural check that options
 * is present and non-empty).
 */
@JsonIgnoreProperties(ignoreUnknown = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
public record MdyDynamicOptionsField(
    String name,
    String kind,
    String label,
    String placeholder,
    Object initialValue,
    MdyDynamicValidators validators,
    List<MdySelectOption> options
) implements MdyDynamicField {
}
