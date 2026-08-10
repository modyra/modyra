# A worked `MdyStudioProject`

One hand-written project model, in full, so the decision records can point at concrete nodes,
references and validators instead of describing them.

It is documentation: no parser reads it, no package ships it, nothing runs it. What it is for is
being *specific* — [ADR 0001](architecture/0001-project-and-contract-model.md) through
[0005](architecture/0005-expressions-and-references.md) cite the ids below when they claim that a
rename preserves references, or that the same project compiles to byte-identical output.

The ids here (`nd_*`, `val_*`, `impl_*`) are illustrative. How ids are really generated is
[ADR 0002](architecture/0002-ids-and-paths.md).

```json
{
  "studioVersion": 1,
  "id": "prj_checkout",
  "name": "Checkout",
  "schema": {
    "node": "group",
    "id": "nd_root",
    "name": "root",
    "children": [
      {
        "node": "field",
        "id": "nd_country",
        "name": "country",
        "label": "Country",
        "fieldKind": "select",
        "valueType": "string",
        "initialValue": "IT",
        "validators": [],
        "options": [{ "value": "IT", "label": "Italy" }]
      },
      {
        "node": "group",
        "id": "nd_shipping",
        "name": "shipping",
        "label": "Shipping address",
        "children": [
          {
            "node": "field",
            "id": "nd_city",
            "name": "city",
            "fieldKind": "text",
            "valueType": "string",
            "initialValue": "",
            "validators": [{ "id": "val_city_required", "kind": "required" }]
          },
          {
            "node": "field",
            "id": "nd_zip",
            "name": "zip",
            "fieldKind": "text",
            "valueType": "string",
            "initialValue": "",
            "validators": [
              { "id": "val_zip_required", "kind": "required" },
              {
                "id": "val_zip_pattern",
                "kind": "pattern",
                "pattern": "^\\d{5}$",
                "message": "5 digits"
              }
            ]
          }
        ]
      },
      {
        "node": "array",
        "id": "nd_items",
        "name": "items",
        "label": "Items",
        "item": {
          "node": "group",
          "id": "nd_item",
          "name": "item",
          "children": [
            {
              "node": "field",
              "id": "nd_sku",
              "name": "sku",
              "fieldKind": "text",
              "valueType": "string",
              "initialValue": "",
              "validators": [{ "id": "val_sku_required", "kind": "required" }]
            },
            {
              "node": "field",
              "id": "nd_qty",
              "name": "qty",
              "fieldKind": "number",
              "valueType": "number",
              "initialValue": 1,
              "validators": [{ "id": "val_qty_min", "kind": "min", "value": 1 }]
            }
          ]
        },
        "initialRows": [{ "sku": "TSHIRT-BLK-M", "qty": 2 }],
        "validators": []
      },
      {
        "node": "field",
        "id": "nd_coupon",
        "name": "coupon",
        "fieldKind": "text",
        "valueType": "string",
        "initialValue": "",
        "validators": [],
        "serverValidator": {
          "id": "val_coupon_server",
          "kind": "server",
          "implementationRef": "impl_validate_coupon",
          "dependencies": [{ "nodeId": "nd_country" }],
          "debounceMs": 400,
          "timeoutMs": 5000,
          "skipWhen": { "op": "isEmpty", "operand": { "nodeId": "nd_coupon" } },
          "errorMessage": "Coupon not valid for your country"
        }
      }
    ]
  },
  "formValidators": [
    {
      "id": "val_items_min_one",
      "kind": "form",
      "dependencies": [{ "nodeId": "nd_items" }],
      "condition": {
        "op": "greaterThan",
        "operands": [{ "op": "lengthAtLeast", "operand": { "nodeId": "nd_items" } }, 0]
      },
      "message": "Add at least one item to the order",
      "errorTarget": { "nodeId": "nd_items" }
    }
  ],
  "behaviors": {
    "draft": { "key": "checkout-draft", "exclude": [{ "nodeId": "nd_coupon" }] },
    "submit": { "implementationRef": "impl_create_order" },
    "serverErrorMapping": "path/kind/message"
  },
  "implementations": {
    "impl_validate_coupon": {
      "id": "impl_validate_coupon",
      "role": "serverValidator",
      "displayName": "validateCoupon",
      "mode": "stub"
    },
    "impl_create_order": {
      "id": "impl_create_order",
      "role": "submitAction",
      "displayName": "createOrder",
      "mode": "stub"
    }
  },
  "presentation": {},
  "targets": {},
  "metadata": {}
}
```

## Rejection-test evidence this example provides

- **Java addable without canvas change?** Every reference here (`nd_*` in
  `dependencies`, `errorTarget`, `skipWhen.operand`) is an opaque ID, and every
  custom-logic hook (`impl_validate_coupon`, `impl_create_order`) is a symbolic
  `implementationRef`, not source. A Java target reads the same JSON and needs no
  field on this model to understand "Java" — see `architecture/0004-target-plugin-api.md`.
- **Rename/move preserves references?** `nd_country`, `nd_items`, `nd_coupon` are
  referenced by ID from `dependencies`/`errorTarget`/`skipWhen` elsewhere in the
  document. Renaming `country` to `shippingCountry` or moving `coupon` into a new
  group changes derived paths only; every reference above is untouched — see
  [ADR 0002](architecture/0002-ids-and-paths.md).
- **Byte-identical output from same normalized project?** Nothing here is
  timestamp- or order-of-edit-dependent; a Contract/Core compiler run twice on this
  exact JSON has no non-deterministic input to key off — see
  `architecture/0001-project-and-contract-model.md`.
