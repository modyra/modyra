/**
 * Same instance documented in .modyra/studio/checkout-example.md — kept in
 * sync manually until P1's own fixture loader supersedes this (plan section
 * 13/17). A function (not a shared object literal) so each test gets its
 * own fresh, independently mutable copy.
 */
export function createCheckoutProject() {
  return {
    studioVersion: 1,
    id: "prj_checkout",
    name: "Checkout",
    schema: {
      node: "group",
      id: "nd_root",
      name: "root",
      children: [
        {
          node: "field",
          id: "nd_country",
          name: "country",
          label: "Country",
          fieldKind: "select",
          valueType: "string",
          initialValue: "IT",
          validators: [],
          options: [{ value: "IT", label: "Italy" }],
        },
        {
          node: "group",
          id: "nd_shipping",
          name: "shipping",
          label: "Shipping address",
          children: [
            {
              node: "field",
              id: "nd_city",
              name: "city",
              fieldKind: "text",
              valueType: "string",
              initialValue: "",
              validators: [{ id: "val_city_required", kind: "required" }],
            },
            {
              node: "field",
              id: "nd_zip",
              name: "zip",
              fieldKind: "text",
              valueType: "string",
              initialValue: "",
              validators: [
                { id: "val_zip_required", kind: "required" },
                { id: "val_zip_pattern", kind: "pattern", pattern: "^\\d{5}$", message: "5 digits" },
              ],
            },
          ],
        },
        {
          node: "array",
          id: "nd_items",
          name: "items",
          label: "Items",
          item: {
            node: "group",
            id: "nd_item",
            name: "item",
            children: [
              {
                node: "field",
                id: "nd_sku",
                name: "sku",
                fieldKind: "text",
                valueType: "string",
                initialValue: "",
                validators: [{ id: "val_sku_required", kind: "required" }],
              },
              {
                node: "field",
                id: "nd_qty",
                name: "qty",
                fieldKind: "number",
                valueType: "number",
                initialValue: 1,
                validators: [{ id: "val_qty_min", kind: "min", value: 1 }],
              },
            ],
          },
          initialRows: [{ sku: "TSHIRT-BLK-M", qty: 2 }],
          validators: [],
        },
        {
          node: "field",
          id: "nd_coupon",
          name: "coupon",
          fieldKind: "text",
          valueType: "string",
          initialValue: "",
          validators: [],
          serverValidator: {
            id: "val_coupon_server",
            kind: "server",
            implementationRef: "impl_validate_coupon",
            dependencies: [{ nodeId: "nd_country" }],
            debounceMs: 400,
            timeoutMs: 5000,
            skipWhen: { op: "isEmpty", operand: { nodeId: "nd_coupon" } },
            errorMessage: "Coupon not valid for your country",
          },
        },
      ],
    },
    formValidators: [
      {
        id: "val_items_min_one",
        kind: "form",
        dependencies: [{ nodeId: "nd_items" }],
        condition: {
          op: "greaterThan",
          operands: [{ op: "lengthAtLeast", operand: { nodeId: "nd_items" } }, 0],
        },
        message: "Add at least one item to the order",
        errorTarget: { nodeId: "nd_items" },
      },
    ],
    behaviors: {
      draft: { key: "checkout-draft", exclude: [{ nodeId: "nd_coupon" }] },
      submit: { implementationRef: "impl_create_order" },
      serverErrorMapping: "path/kind/message",
    },
    implementations: {
      impl_validate_coupon: {
        id: "impl_validate_coupon",
        role: "serverValidator",
        displayName: "validateCoupon",
        mode: "stub",
      },
      impl_create_order: {
        id: "impl_create_order",
        role: "submitAction",
        displayName: "createOrder",
        mode: "stub",
      },
    },
    presentation: {},
    targets: {},
    metadata: {},
  };
}
