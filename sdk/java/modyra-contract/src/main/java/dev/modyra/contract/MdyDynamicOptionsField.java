package dev.modyra.contract;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.List;

/**
 * Option-based kinds: select, radio, multiselect, segmented. Mirrors
 * {@code MdyDynamicOptionsField}. The declared options are also a
 * whitelist on the Java side, same as TS's {@code buildDynamicFieldValidators}
 * (see {@link MdyDynamicFormParser} for the structural check that options
 * is present and non-empty).
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record MdyDynamicOptionsField(
    String name,
    String kind,
    String label,
    String placeholder,
    Object initialValue,
    MdyDynamicValidators validators,
    List<MdySelectOption> options,
    /**
     * Multiselect only. {@code "single"} is a toggle set, {@code "multi"} a bag whose chip counts
     * repeats. Carried because the widget contract declares a different anatomy per mode, so a
     * document that loses it describes a different widget than the one it was written for.
     */
    String mode
) implements MdyDynamicField {
}
