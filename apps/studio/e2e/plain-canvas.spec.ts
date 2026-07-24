import { expect, test } from "@playwright/test";

async function dispatchHtmlDrag(
  page: import("@playwright/test").Page,
  source: import("@playwright/test").Locator,
  target: import("@playwright/test").Locator,
): Promise<void> {
  const sourceHandle = await source.elementHandle();
  const targetHandle = await target.elementHandle();

  if (!sourceHandle || !targetHandle) {
    throw new Error("HTML drag source or target is not attached");
  }

  await page.evaluate(
    ({ sourceElement, targetElement }) => {
      const dataTransfer = new DataTransfer();

      sourceElement.dispatchEvent(
        new DragEvent("dragstart", {
          bubbles: true,
          cancelable: true,
          dataTransfer,
        }),
      );

      targetElement.dispatchEvent(
        new DragEvent("dragenter", {
          bubbles: true,
          cancelable: true,
          dataTransfer,
        }),
      );

      targetElement.dispatchEvent(
        new DragEvent("dragover", {
          bubbles: true,
          cancelable: true,
          dataTransfer,
        }),
      );

      targetElement.dispatchEvent(
        new DragEvent("drop", {
          bubbles: true,
          cancelable: true,
          dataTransfer,
        }),
      );

      sourceElement.dispatchEvent(
        new DragEvent("dragend", {
          bubbles: true,
          cancelable: true,
          dataTransfer,
        }),
      );
    },
    {
      sourceElement: sourceHandle,
      targetElement: targetHandle,
    },
  );
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.waitForSelector(".studio");
  // Studio restores its last IndexedDB session. Each canvas scenario needs
  // a deterministic blank project instead of inheriting fields or blocking
  // diagnostics created by the preceding test in the same browser context.
  await page.locator("[data-new]").click();
});

test("Live form mounts @modyra/plain while Structure remains the authoring fallback", async ({ page }) => {
  await page.locator('[data-template="text"]').click();
  await page.locator('[data-name]').fill("customerName");
  await page.locator('[data-name]').blur();

  await page.locator('[data-canvas-mode="form"]').click();
  await expect(page.locator('[data-canvas-surface="form"]')).toBeVisible();
  const input = page.locator('[data-plain-canvas] input[type="text"]').first();
  await expect(input).toBeVisible();
  await input.fill("Ada");
  await expect(input).toHaveValue("Ada");
  await expect(input).toBeFocused();

  await page.locator('[data-canvas-mode="structure"]').click();
  await expect(page.locator('.tree-node')).toHaveCount(1);
  await expect(page.locator('[data-name]')).toHaveValue("customerName");
});

test("blocking Contract diagnostics produce an editor-safe live-form placeholder", async ({ page }) => {
  await page.locator('[data-template="select"]').click();
  await page.locator('details[data-section="options"] summary').click();
  await page.locator('[data-remove-option="0"]').click();
  await page.locator('[data-canvas-mode="form"]').click();

  await expect(page.locator('.plain-canvas-unavailable')).toContainText("blocking Contract diagnostics");
  await expect(page.locator('[data-plain-canvas]')).toHaveCount(0);

  await page.locator('[data-canvas-mode="structure"]').click();
  await expect(page.locator('.tree-node .indicator.issue')).toHaveCount(1);
});

test("live canvas fields expose stable node IDs and select the matching Inspector node", async ({ page }) => {
  await page.locator('[data-template="text"]').click();
  const nodeId = await page.locator('[data-node]').getAttribute('data-node');
  await page.locator('[data-name]').fill('customerName');
  await page.locator('[data-name]').blur();
  await page.locator('[data-label]').fill('Customer name');
  await page.locator('[data-label]').blur();

  await page.locator('[data-canvas-mode="form"]').click();
  const field = page.locator('.plain-canvas-field');
  await expect(field).toHaveAttribute('data-node', nodeId!);
  await expect(field).toHaveAttribute('data-field-path', 'customerName');

  await page.locator('[data-plain-select]').click();
  await expect(page.locator('.plain-canvas-field.selected')).toHaveAttribute('data-node', nodeId!);
  await expect(page.locator('[data-inspector-tab="node"]')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('[data-name]')).toHaveValue('customerName');
  await expect(page.locator('[data-plain-select]')).toBeFocused();
});


test("live canvas duplicate and delete actions use the existing command history", async ({ page }) => {
  await page.locator('[data-template="text"]').click();
  await page.locator('[data-name]').fill('customerName');
  await page.locator('[data-name]').blur();
  await page.locator('[data-canvas-mode="form"]').click();

  await expect(page.locator('.plain-canvas-field')).toHaveCount(1);
  await page.locator('.plain-canvas-field [data-duplicate]').click();
  await expect(page.locator('.plain-canvas-field')).toHaveCount(2);

  await page.locator('.plain-canvas-field').first().locator('[data-delete]').click();
  await expect(page.locator('.plain-canvas-field')).toHaveCount(1);

  await page.locator('[data-undo]').click();
  await expect(page.locator('.plain-canvas-field')).toHaveCount(2);
  await page.locator('[data-undo]').click();
  await expect(page.locator('.plain-canvas-field')).toHaveCount(1);
});


test("live canvas insertion points add fields before, between, and after existing fields", async ({ page }) => {
  await page.locator('[data-template="text"]').click();
  await page.locator('[data-name]').fill('firstName');
  await page.locator('[data-name]').blur();
  await page.locator('[data-template="email"]').click();
  await page.locator('[data-name]').fill('email');
  await page.locator('[data-name]').blur();
  await page.locator('[data-canvas-mode="form"]').click();

  await expect(page.locator('.plain-canvas-field')).toHaveCount(2);
  await expect(page.locator('[data-plain-insert="before"]')).toHaveCount(2);
  await expect(page.locator('[data-plain-insert="after"]')).toHaveCount(1);
  await expect(page.locator('[data-plain-insert="after"] option')).toHaveText([
    '+ Add field', 'text', 'textarea', 'email', 'number', 'checkbox', 'select', 'multiselect', 'date',
  ]);

  await page.locator('[data-plain-insert="before"]').nth(1).selectOption('number');
  await expect(page.locator('.plain-canvas-field')).toHaveCount(3);
  await expect(page.locator('.plain-canvas-field').nth(1)).toHaveAttribute('data-field-path', /^number/);
  await expect(page.locator('.plain-canvas-field').nth(1).locator('[data-plain-select]')).toBeFocused();

  await page.locator('[data-plain-insert="after"]').selectOption('email');
  await expect(page.locator('.plain-canvas-field')).toHaveCount(4);
  await expect(page.locator('.plain-canvas-field').last()).toHaveAttribute('data-field-path', /^email/);
});


test("live canvas move controls reorder fields through command history", async ({ page }) => {
  await page.locator('[data-template="text"]').click();
  await page.locator('[data-name]').fill('firstName');
  await page.locator('[data-name]').blur();
  await page.locator('[data-template="email"]').click();
  await page.locator('[data-name]').fill('email');
  await page.locator('[data-name]').blur();
  await page.locator('[data-canvas-mode="form"]').click();

  const fields = page.locator('.plain-canvas-field');
  await expect(fields).toHaveCount(2);
  await expect(fields.nth(0)).toHaveAttribute('data-field-path', 'firstName');
  await expect(fields.nth(1)).toHaveAttribute('data-field-path', 'email');
  await expect(fields.nth(0).locator('[aria-label="Move firstName up"]')).toBeDisabled();
  await expect(fields.nth(1).locator('[aria-label="Move email down"]')).toBeDisabled();

  await fields.nth(1).locator('[aria-label="Move email up"]').click();
  await expect(fields.nth(0)).toHaveAttribute('data-field-path', 'email');
  await expect(fields.nth(1)).toHaveAttribute('data-field-path', 'firstName');
  await expect(fields.nth(0).locator('[data-plain-select]')).toBeFocused();

  await page.locator('[data-undo]').click();
  await expect(fields.nth(0)).toHaveAttribute('data-field-path', 'firstName');
  await expect(fields.nth(1)).toHaveAttribute('data-field-path', 'email');
  await page.locator('[data-redo]').click();
  await expect(fields.nth(0)).toHaveAttribute('data-field-path', 'email');
});


test("live canvas pointer drag reorders fields and remains undoable", async ({ page }) => {
  await page.locator('[data-template="text"]').click();
  await page.locator('[data-name]').fill('firstName');
  await page.locator('[data-name]').blur();
  await page.locator('[data-template="email"]').click();
  await page.locator('[data-name]').fill('email');
  await page.locator('[data-name]').blur();
  await page.locator('[data-canvas-mode="form"]').click();

  const fields = page.locator('.plain-canvas-field');
  await expect(fields.nth(0)).toHaveAttribute('data-field-path', 'firstName');
  await expect(fields.nth(1)).toHaveAttribute('data-field-path', 'email');
  await expect(fields.nth(1)).toHaveAttribute('draggable', 'true');

  await fields.nth(1).dragTo(page.locator('.plain-canvas-drop[data-before]').first());
  await expect(fields.nth(0)).toHaveAttribute('data-field-path', 'email');
  await expect(fields.nth(1)).toHaveAttribute('data-field-path', 'firstName');

  await page.locator('[data-undo]').click();
  await expect(fields.nth(0)).toHaveAttribute('data-field-path', 'firstName');
  await expect(fields.nth(1)).toHaveAttribute('data-field-path', 'email');
});


test("palette fields can be dragged directly onto live canvas insertion points", async ({ page }) => {
  await page.locator('[data-template="text"]').click();
  await page.locator('[data-name]').fill('firstName');
  await page.locator('[data-name]').blur();
  await page.locator('[data-canvas-mode="form"]').click();

  const fields = page.locator('.plain-canvas-field');
  await expect(fields).toHaveCount(1);
  await page.locator('[data-template="email"]').dragTo(page.locator('.plain-canvas-drop[data-after]'));

  await expect(fields).toHaveCount(2);
  await expect(fields.nth(0)).toHaveAttribute('data-field-path', 'firstName');
  await expect(fields.nth(1)).toHaveAttribute('data-field-path', /^email/);
  await expect(fields.nth(1).locator('[data-plain-select]')).toBeFocused();

  await page.locator('[data-undo]').click();
  await expect(fields).toHaveCount(1);
});


test("live canvas renders groups and accepts palette fields inside them", async ({ page }) => {
  await page.locator('[data-template="group"]').click();
  await page.locator('[data-name]').fill('shipping');
  await page.locator('[data-name]').blur();
  const groupId = await page.locator('[data-node]').first().getAttribute('data-node');
  await page.locator('[data-template="text"]').click();
  await page.keyboard.press(' ');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await page.locator('[data-canvas-mode="form"]').click();

  const group = page.locator('.plain-canvas-group');
  await expect(group).toHaveCount(1);
  await expect(group).toHaveAttribute('data-plain-group', groupId!);
  await expect(group.locator('.plain-canvas-field')).toHaveCount(1);
  await group.locator('[data-plain-select]').first().click();
  await expect(group).toHaveClass(/selected/);
  await expect(page.locator('[data-name]')).toHaveValue('shipping');

  await page.locator('[data-template="email"]').dragTo(group.locator('.plain-canvas-drop-inside'));
  await expect(group.locator('.plain-canvas-field')).toHaveCount(2);
  await expect(group.locator('.plain-canvas-field').last()).toHaveAttribute('data-field-path', /^shipping\.email/);
  await page.locator('[data-undo]').click();
  await expect(group.locator('.plain-canvas-field')).toHaveCount(1);
});


test("live canvas moves existing fields between a group and the form root", async ({ page }) => {
  await page.locator('[data-template="group"]').click();
  await page.locator('[data-name]').fill('shipping');
  await page.locator('[data-name]').blur();
  await page.locator('[data-template="text"]').click();
  await page.locator('[data-name]').fill('city');
  await page.locator('[data-name]').blur();
  await page.keyboard.press(' ');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await page.locator('[data-canvas-mode="form"]').click();

  const group = page.locator('.plain-canvas-group');
  const fields = page.locator('.plain-canvas-field');
  await expect(group.locator('.plain-canvas-field')).toHaveCount(1);
  await expect(fields).toHaveAttribute('data-field-path', 'shipping.city');

  await fields.dragTo(
    page.locator('.plain-canvas-drop-root'),
    {
      sourcePosition: { x: 8, y: 8 },
    },
  );
  await expect(group).toHaveCount(1);
  await expect(group.locator('.plain-canvas-field')).toHaveCount(0);
  await expect(group.locator('.plain-canvas-drop-inside')).toBeAttached();
  await expect(fields).toHaveAttribute('data-field-path', 'city');
  await expect(fields).toHaveClass(/selected/);
  await expect(fields.locator('[data-plain-select]')).toHaveAttribute(
    'aria-pressed',
    'true',
  );

  await dispatchHtmlDrag(
    page,
    fields,
    group.locator(
      ':scope > .plain-canvas-group-body > .plain-canvas-drop-inside',
    ),
  );
  await expect(group.locator('.plain-canvas-field')).toHaveCount(1);
  await expect(fields).toHaveAttribute('data-field-path', 'shipping.city');

  await page.locator('[data-undo]').click();
  await expect(group.locator('.plain-canvas-field')).toHaveCount(0);
  await expect(fields).toHaveAttribute('data-field-path', 'city');
  await page.locator('[data-undo]').click();
  await expect(group.locator('.plain-canvas-field')).toHaveCount(1);
});


test("live canvas drags groups to reorder and nest them", async ({ page }) => {
  await page.locator('[data-template="group"]').click();
  await page.locator('[data-name]').fill('billing');
  await page.locator('[data-name]').blur();
  await page.locator('[data-template="group"]').click();
  await page.locator('[data-name]').fill('shipping');
  await page.locator('[data-name]').blur();
  await page.locator('[data-canvas-mode="form"]').click();

  const groups = page.locator('.plain-canvas-group');
  await expect(groups).toHaveCount(2);
  await expect(groups.nth(0)).toHaveAttribute('data-group-path', 'billing');
  await expect(groups.nth(1)).toHaveAttribute('data-group-path', 'shipping');
  await expect(groups.nth(1)).toHaveAttribute('draggable', 'true');

  const billingId = await groups.nth(0).getAttribute('data-plain-group');
  const shippingId = await groups.nth(1).getAttribute('data-plain-group');

  expect(billingId).not.toBeNull();
  expect(shippingId).not.toBeNull();

  await groups.nth(1).dragTo(
    page.locator(`.plain-canvas-drop[data-before="${billingId}"]`),
  );
  await expect(groups.nth(0)).toHaveAttribute(
    'data-plain-group',
    shippingId!,
  );

  const billing = page.locator(
    `.plain-canvas-group[data-plain-group="${billingId}"]`,
  );
  const shipping = page.locator(
    `.plain-canvas-group[data-plain-group="${shippingId}"]`,
  );

  await expect(billing).toHaveCount(1);
  await expect(shipping).toHaveCount(1);

  await shipping.dragTo(
    billing.locator(':scope > .plain-canvas-group-body > .plain-canvas-drop-inside'),
  );
  await expect(billing.locator(':scope > .plain-canvas-group-body > .plain-canvas-group')).toHaveCount(1);
  await expect(shipping).toHaveAttribute('data-group-path', 'billing.shipping');
  await expect(shipping).toHaveClass(/selected/);

  await page.locator('[data-undo]').click();
  await expect(shipping).toHaveAttribute('data-group-path', 'shipping');
  await page.locator('[data-undo]').click();
  await expect(groups.nth(0)).toHaveAttribute('data-group-path', 'billing');
});


test("live canvas group controls reorder nest and return groups to root", async ({ page }) => {
  await page.locator('[data-template="group"]').click(); await page.locator('[data-name]').fill('billing'); await page.locator('[data-name]').blur();
  await page.locator('[data-template="group"]').click(); await page.locator('[data-name]').fill('shipping'); await page.locator('[data-name]').blur();
  await page.locator('[data-canvas-mode="form"]').click();
  const groups = page.locator('.plain-canvas-group');
  const billingId = await groups.nth(0).getAttribute('data-plain-group');

  expect(billingId).not.toBeNull();

  await groups
    .nth(1)
    .getByRole('button', { name: 'Move up shipping' })
    .click();

  await expect(groups.nth(0)).toHaveAttribute(
    'data-group-path',
    'shipping',
  );

  const shippingAtRoot = page.locator(
    '.plain-canvas-group[data-group-path="shipping"]',
  );

  const moveInto = shippingAtRoot.getByRole('combobox', {
    name: 'Move shipping into group',
  });

  await expect(
    moveInto.locator(`option[value="${billingId}"]`),
  ).toHaveCount(1);

  await moveInto.selectOption(billingId!);

  const shipping = page.locator(
    '.plain-canvas-group[data-group-path="billing.shipping"]',
  );
  await expect(shipping).toHaveCount(1);
  await shipping.getByRole('button', { name: 'Move shipping to form root' }).click();
  await expect(page.locator('.plain-canvas-group[data-group-path="shipping"]')).toHaveCount(1);
  await page.locator('[data-undo]').click();
  await expect(page.locator('.plain-canvas-group[data-group-path="billing.shipping"]')).toHaveCount(1);
});


test("live canvas field controls move fields into groups and back to root", async ({ page }) => {
  await page.locator('[data-template="group"]').click();
  await page.locator('[data-name]').fill('shipping');
  await page.locator('[data-name]').blur();
  const groupId = await page.locator('[data-node]').first().getAttribute('data-node');
  await page.locator('[data-template="text"]').click();
  await page.locator('[data-name]').fill('city');
  await page.locator('[data-name]').blur();
  await page.locator('[data-canvas-mode="form"]').click();

  const field = page.locator('.plain-canvas-field');
  const moveInto = field.getByRole('combobox', { name: 'Move city into group' });
  await expect(moveInto.locator(`option[value="${groupId}"]`)).toHaveCount(1);
  await moveInto.selectOption(groupId!);
  await expect(field).toHaveAttribute('data-field-path', 'shipping.city');
  await expect(field.locator('[data-plain-select]')).toBeFocused();

  await field.getByRole('button', { name: 'Move shipping.city to form root' }).click();
  await expect(field).toHaveAttribute('data-field-path', 'city');
  await expect(field.locator('[data-plain-select]')).toBeFocused();

  await page.locator('[data-undo]').click();
  await expect(field).toHaveAttribute('data-field-path', 'shipping.city');
});


test("live canvas renders empty arrays and selects them in the Inspector", async ({ page }) => {
  await page.locator('[data-template="array"]').click();
  await page.locator('[data-name]').fill('items');
  await page.locator('[data-name]').blur();
  const arrayId = await page.locator('[data-node]').first().getAttribute('data-node');
  await page.locator('[data-canvas-mode="form"]').click();

  const array = page.locator('.plain-canvas-array');
  await expect(array).toHaveCount(1);
  await expect(array).toHaveAttribute('data-plain-array', arrayId!);
  await expect(array).toHaveAttribute('data-array-path', 'items');
  await expect(array.locator('.plain-canvas-array-count')).toHaveText('0 initial rows');
  await expect(array.locator('.plain-canvas-array-empty')).toHaveText('No initial rows');

  await array.locator('[data-plain-select]').click();
  await expect(array).toHaveClass(/selected/);
  await expect(page.locator('[data-name]')).toHaveValue('items');
  await expect(array.locator('[data-plain-select]')).toBeFocused();
});
