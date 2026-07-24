package dev.modyra.contract;

import com.fasterxml.jackson.annotation.JsonSubTypes;
import com.fasterxml.jackson.annotation.JsonTypeInfo;

/**
 * Mirrors the {@code MdyDynamicField} discriminated union in
 * packages/core/src/dynamic-config.ts — a sealed interface plus one record
 * per structural field family, exactly like the TS union's five member
 * types. Several {@code kind} string values map to the same record (e.g.
 * "text"/"textarea"/"email"/"password" all deserialize to
 * {@link MdyDynamicTextField}) — registered as repeated
 * {@code @JsonSubTypes.Type} entries below, one per accepted kind string.
 */
@JsonTypeInfo(use = JsonTypeInfo.Id.NAME, include = JsonTypeInfo.As.EXISTING_PROPERTY, property = "kind", visible = true)
@JsonSubTypes({
    @JsonSubTypes.Type(value = MdyDynamicTextField.class, name = "text"),
    @JsonSubTypes.Type(value = MdyDynamicTextField.class, name = "textarea"),
    @JsonSubTypes.Type(value = MdyDynamicTextField.class, name = "email"),
    @JsonSubTypes.Type(value = MdyDynamicTextField.class, name = "password"),
    @JsonSubTypes.Type(value = MdyDynamicNumberField.class, name = "number"),
    @JsonSubTypes.Type(value = MdyDynamicNumberField.class, name = "slider"),
    @JsonSubTypes.Type(value = MdyDynamicBooleanField.class, name = "checkbox"),
    @JsonSubTypes.Type(value = MdyDynamicBooleanField.class, name = "toggle"),
    @JsonSubTypes.Type(value = MdyDynamicOptionsField.class, name = "select"),
    @JsonSubTypes.Type(value = MdyDynamicOptionsField.class, name = "radio"),
    @JsonSubTypes.Type(value = MdyDynamicOptionsField.class, name = "multiselect"),
    @JsonSubTypes.Type(value = MdyDynamicOptionsField.class, name = "segmented"),
    @JsonSubTypes.Type(value = MdyDynamicDateField.class, name = "datepicker"),
    @JsonSubTypes.Type(value = MdyDynamicDateField.class, name = "timepicker"),
})
public sealed interface MdyDynamicField
    permits MdyDynamicTextField, MdyDynamicNumberField, MdyDynamicBooleanField, MdyDynamicOptionsField, MdyDynamicDateField {
  String name();

  String kind();

  String label();

  String placeholder();

  Object initialValue();

  MdyDynamicValidators validators();
}
