// The dynamic form config domain (field unions, JSON-safe validators,
// runtime validation of untrusted payloads) is framework-agnostic and
// lives in @modyra/core — re-exported here so existing import sites keep
// working. Only the renderer component is Angular.
export * from "@modyra/core/dynamic-config";
