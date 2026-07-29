import { expect, test } from "@playwright/test";
import { openStudio, showLiveForm, showStructure } from "./support/studio.js";

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
  await openStudio(page);
  // Studio restores its last IndexedDB session. Each canvas scenario needs
  // a deterministic blank project instead of inheriting fields or blocking
  // diagnostics created by the preceding test in the same browser context.
  await page.locator("[data-new]").click();
});

test("Live form mounts @modyra/plain while Structure remains the authoring fallback", async ({ page }) => {
  await page.locator('[data-template="text"]').click();
  await page.locator('[data-name]').fill("customerName");
  await page.locator('[data-name]').blur();

  await expect(page.locator('[data-canvas-surface="form"]')).toBeVisible();
  const input = page.locator('[data-plain-canvas] input[type="text"]').first();
  await expect(input).toBeVisible();
  await input.fill("Ada");
  await expect(input).toHaveValue("Ada");
  await expect(input).toBeFocused();

  await expect(page.locator('.outline .tree-node')).toHaveCount(1);
  await expect(page.locator('[data-name]')).toHaveValue("customerName");
});

test("blocking Contract diagnostics produce an editor-safe live-form placeholder", async ({ page }) => {
  await page.locator('[data-template="select"]').click();
  await page.locator('details[data-section="options"] summary').click();
  await page.locator('[data-remove-option="0"]').click();

  // The placeholder now names what is blocking, with a jump to each one, instead of just
  // saying "unavailable" and leaving you to hunt for it.
  await expect(page.locator('.plain-canvas-unavailable')).toContainText("The live form can't be built yet");
  await expect(page.locator('.plain-canvas-unavailable .diagnostic-row')).not.toHaveCount(0);
  await expect(page.locator('[data-plain-canvas]')).toHaveCount(0);

  await expect(page.locator('.outline .tree-node .indicator.issue')).toHaveCount(1);
});

test("live canvas fields expose stable node IDs and select the matching Inspector node", async ({ page }) => {
  await page.locator('[data-template="text"]').click();
  const nodeId = await page.locator('.plain-canvas-field[data-node]').getAttribute('data-node');
  await page.locator('[data-name]').fill('customerName');
  await page.locator('[data-name]').blur();
  await page.locator('[data-label]').fill('Customer name');
  await page.locator('[data-label]').blur();

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

  await expect(page.locator('.plain-canvas-field')).toHaveCount(2);
  await expect(page.locator('[data-plain-insert="before"]')).toHaveCount(2);
  await expect(page.locator('[data-plain-insert="after"]')).toHaveCount(1);
  // Every non-structure kind the Contract can render, labelled the way the palette labels it.
  await expect(page.locator('[data-plain-insert="after"] option')).toHaveText([
    '+ Add field', 'Text', 'Long text', 'Email', 'Password', 'Number', 'Slider', 'Date', 'Time',
    'Checkbox', 'Toggle', 'Dropdown', 'Radio group', 'Segmented', 'Multi-select',
  ]);

  await page.locator('[data-plain-insert="before"]').nth(1).selectOption('number');
  await expect(page.locator('.plain-canvas-field')).toHaveCount(3);
  await expect(page.locator('.plain-canvas-field').nth(1)).toHaveAttribute('data-field-path', /^number/);
  await expect(page.locator('.plain-canvas-field').nth(1).locator('[data-inline-edit="label"]')).toBeFocused();

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
  // Nesting via keyboard is a Structure-outline gesture; the assertions below are on the live form.
  await showStructure(page);
  await page.locator('.outline .tree-node [data-node]').last().focus();
  await page.keyboard.press(' ');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await showLiveForm(page);

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

  const groups = page.locator('.plain-canvas-group');
  await expect(groups).toHaveCount(2);
  await expect(groups.nth(0)).toHaveAttribute('data-group-path', 'billing');
  await expect(groups.nth(1)).toHaveAttribute('data-group-path', 'shipping');
  await expect(groups.nth(1)).toHaveAttribute('draggable', 'true');

  const billingId = await groups.nth(0).getAttribute('data-plain-group');
  const shippingId = await groups.nth(1).getAttribute('data-plain-group');

  expect(billingId).not.toBeNull();
  expect(shippingId).not.toBeNull();

  await groups.nth(1).locator(':scope > legend > .plain-canvas-grip').dragTo(
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

  await shipping.locator(':scope > legend > .plain-canvas-grip').dragTo(
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

  const array = page.locator('.plain-canvas-array');
  await expect(array).toHaveCount(1);
  await expect(array).toHaveAttribute('data-plain-array', arrayId!);
  await expect(array).toHaveAttribute('data-array-path', 'items');
  await expect(array.locator('.plain-canvas-array-count')).toHaveText('0 rows');
  await expect(array.locator('.plain-canvas-array-empty')).toHaveText('No initial rows');

  const selectArray = array.getByRole('button', {
    name: 'Select array items in Studio',
  });

  await selectArray.click();
  await expect(array).toHaveClass(/selected/);
  await expect(page.locator('[data-name]')).toHaveValue('items');
  await expect(selectArray).toBeFocused();
});


test("live canvas array controls add and remove initial rows through history", async ({ page }) => {
  await page.locator('[data-template="array"]').click();
  await page.locator('[data-name]').fill('items');
  await page.locator('[data-name]').blur();

  const array = page.locator('.plain-canvas-array');
  const add = array.getByRole('button', { name: 'Add initial row to items' });
  const remove = array.getByRole('button', { name: 'Remove last initial row from items' });
  await expect(remove).toBeDisabled();

  await add.click();
  await expect(array.locator('.plain-canvas-array-count')).toHaveText('1 row');
  await expect(array.locator('.plain-canvas-array-row')).toHaveCount(1);
  await expect(add).toBeFocused();
  await expect(remove).toBeEnabled();

  await add.click();
  await expect(array.locator('.plain-canvas-array-count')).toHaveText('2 rows');
  await expect(array.locator('.plain-canvas-array-row')).toHaveCount(2);

  await remove.click();
  await expect(array.locator('.plain-canvas-array-count')).toHaveText('1 row');
  await expect(remove).toBeFocused();

  await page.locator('[data-undo]').click();
  await expect(array.locator('.plain-canvas-array-count')).toHaveText('2 rows');
  await page.locator('[data-undo]').click();
  await expect(array.locator('.plain-canvas-array-count')).toHaveText('1 row');
  await page.locator('[data-undo]').click();
  await expect(array.locator('.plain-canvas-array-count')).toHaveText('0 rows');
  await expect(array.locator('.plain-canvas-array-empty')).toHaveText('No initial rows');
});


test("live canvas completes array authoring with row and container controls", async ({ page }) => {
  await page.locator('[data-template="group"]').click();
  await page.locator('[data-name]').fill('catalog'); await page.locator('[data-name]').blur();
  const groupId = await page.locator('[data-node]').first().getAttribute('data-node');
  await page.locator('[data-template="array"]').click();
  await page.locator('[data-name]').fill('items'); await page.locator('[data-name]').blur();
  const array = page.locator('.plain-canvas-array');
  await array.getByRole('button', { name: 'Add initial row to items' }).click();
  await array.getByRole('button', { name: 'Add initial row to items' }).click();
  const rows = array.locator('.plain-canvas-array-row');
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0).getByRole('button', { name: /Move up initial row 1/ })).toBeDisabled();
  await rows.nth(1).getByRole('button', { name: /Move up initial row 2/ }).click();
  await expect(rows.nth(0).getByRole('button', { name: /Move up initial row 1/ })).toBeDisabled();
  await rows.nth(0).getByRole('button', { name: /Remove initial row 1/ }).click();
  await expect(rows).toHaveCount(1);
  await page.locator('[data-undo]').click();
  await expect(rows).toHaveCount(2);
  await array.getByRole('button', { name: 'Edit item schema for items' }).click();
  await expect(page.locator('[data-name]')).toHaveValue(/item/);
  await array.getByRole('combobox', { name: 'Move array items into group' }).selectOption(groupId!);
  await expect(array).toHaveAttribute('data-array-path', 'catalog.items');
  await array.getByRole('button', { name: 'Move array items to form root' }).click();
  await expect(array).toHaveAttribute('data-array-path', 'items');
  await page.locator('[data-undo]').click();
  await expect(array).toHaveAttribute('data-array-path', 'catalog.items');
});

test("an array whose row is a group shows that group inside the array", async ({ page }) => {
  await page.locator('[data-template="array"]').click();

  const array = page.locator('.plain-canvas-array');
  await expect(array).toHaveCount(1);
  await expect(array.locator('.plain-canvas-array-item')).toHaveText(/Item schema: group/);

  // The row's shape is the array's shape: it renders inside it, not as a sibling at the form root,
  // which is where it landed while only groups counted as containers.
  await expect(array.locator('.plain-canvas-group')).toHaveCount(1);
  await expect(page.locator('.plain-canvas-form > .plain-canvas-group')).toHaveCount(0);
});

test("a repeater draws where it was declared, not at the end of the form", async ({ page }) => {
  await page.locator('[data-template="text"]').click();
  await page.locator('[data-template="array"]').click();
  await page.locator('[data-template="text"]').click();

  // The canvas is the arrangement, so a repeater declared between two fields draws between them.
  // Both containers used to be appended to the host, which put every array last whatever the model
  // said, and left an array's row shape sitting beside it instead of inside it.
  const shape = await page.locator('.plain-canvas-form').evaluate((form) => {
    const out: string[] = [];
    const walk = (el: Element, depth: number): void => {
      for (const child of Array.from(el.children)) {
        if (child.classList.contains("plain-canvas-field")) out.push(`${depth}:field`);
        else if (child.classList.contains("plain-canvas-array")) { out.push(`${depth}:array`); walk(child, depth + 1); }
        else if (child.classList.contains("plain-canvas-group")) { out.push(`${depth}:group`); walk(child, depth + 1); }
        else walk(child, depth);
      }
    };
    walk(form, 0);
    return out;
  });
  expect(shape).toEqual(["0:field", "0:array", "1:group", "0:field"]);
});
