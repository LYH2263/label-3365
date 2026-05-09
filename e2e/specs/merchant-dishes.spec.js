import { expect, test } from '@playwright/test';
import { loginByUI, registerCustomerByApi } from '../helpers/auth.js';
import { buildCustomer, buildDishName, longText } from '../helpers/data.js';

async function fillEditDialog(page, values = {}) {
  await expect(page.getByTestId('app-dialog')).toBeVisible();
  if (values.name !== undefined) {
    await page.getByTestId('app-dialog-input-name').fill(values.name);
  }
  if (values.priceYuan !== undefined) {
    await page.getByTestId('app-dialog-input-priceYuan').fill(values.priceYuan);
  }
  if (values.description !== undefined) {
    await page.getByTestId('app-dialog-input-description').fill(values.description);
  }
  if (values.isAvailable !== undefined) {
    const checkbox = page.getByTestId('app-dialog-input-isAvailable');
    if (values.isAvailable) {
      await checkbox.check();
    } else {
      await checkbox.uncheck();
    }
  }
}

async function submitEditDialog(page) {
  await expect(page.getByTestId('app-dialog')).toBeVisible();
  await page.getByTestId('app-dialog-confirm').click();
}

async function dismissEditDialog(page) {
  await expect(page.getByTestId('app-dialog')).toBeVisible();
  await page.getByTestId('app-dialog-cancel').click();
}

test('MERCHANT-DISHES-01 未登录访问跳登录', async ({ page }) => {
  await page.goto('/merchant/dishes.html');
  await expect(page).toHaveURL(/\/login\.html\?reason=expired/);
});

test('MERCHANT-DISHES-02 顾客访问商家页触发 auth.js 角色分支', async ({ page, request }, testInfo) => {
  const customer = buildCustomer(testInfo, 'mdr');
  await registerCustomerByApi(request, customer);

  await loginByUI(page, customer.username, customer.password);
  await expect(page).toHaveURL(/\/customer\/menu\.html/);

  await page.goto('/merchant/dishes.html');
  await expect(page.getByTestId('app-dialog')).toBeVisible();
  await expect(page.getByTestId('app-dialog-message')).toContainText('无权限访问该页面');
  await page.getByTestId('app-dialog-confirm').click();
  await expect(page).toHaveURL(/\/customer\/menu\.html/);
});

test('MERCHANT-DISHES-03 菜品页空态 + 新增/编辑/上下架与边界', async ({ page }, testInfo) => {
  await loginByUI(page, 'merchant_admin', 'Merchant@123');
  await expect(page).toHaveURL(/\/merchant\/dishes\.html/);

  await page.route('**/api/dishes?scope=all', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ code: 0, message: 'ok', data: [] })
    });
  });
  await page.goto('/merchant/dishes.html');
  await expect(page.getByTestId('merchant-dishes-empty')).toBeVisible();
  await page.unroute('**/api/dishes?scope=all');

  await page.reload();

  const dishNameOff = buildDishName(testInfo, '下架初值');
  await page.getByTestId('merchant-dish-name').fill(dishNameOff);
  await page.getByTestId('merchant-dish-price').fill('25.60');
  await page.getByTestId('merchant-dish-description').fill('用于测试初始下架');
  await page.getByTestId('merchant-dish-available').uncheck();
  await page.getByTestId('merchant-dish-submit').click();
  await expect(page.getByTestId('merchant-dishes-message')).toContainText('新增菜品成功');

  const rowOff = page.locator('[data-testid^="merchant-dish-row-"]').filter({ hasText: dishNameOff }).first();
  await expect(rowOff).toBeVisible();
  await expect(rowOff.locator('[data-testid^="merchant-dish-status-"]')).toContainText('下架');

  const dishNameOn = buildDishName(testInfo, '上架初值');
  await page.getByTestId('merchant-dish-name').fill(dishNameOn);
  await page.getByTestId('merchant-dish-price').fill('28.80');
  await page.getByTestId('merchant-dish-description').fill('用于测试初始上架');
  await page.getByTestId('merchant-dish-available').check();
  await page.getByTestId('merchant-dish-submit').click();
  await expect(page.getByTestId('merchant-dishes-message')).toContainText('新增菜品成功');

  const rowOn = page.locator('[data-testid^="merchant-dish-row-"]').filter({ hasText: dishNameOn }).first();
  await expect(rowOn).toBeVisible();
  await expect(rowOn.locator('[data-testid^="merchant-dish-status-"]')).toContainText('可售');

  await rowOn.locator('[data-testid^="merchant-dish-toggle-"]').click({ force: true });
  await expect(page.getByTestId('merchant-dishes-message')).toContainText('菜品已下架');

  await page.evaluate(() => {
    const form = document.querySelector('[data-testid="merchant-create-dish-form"]');
    const name = document.querySelector('[data-testid="merchant-dish-name"]');
    const price = document.querySelector('[data-testid="merchant-dish-price"]');
    const desc = document.querySelector('[data-testid="merchant-dish-description"]');
    name.value = '';
    price.value = '1000';
    desc.value = 'name empty';
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });
  await expect(page.getByTestId('merchant-dishes-message')).toContainText('菜品名称不能为空');

  await page.getByTestId('merchant-dish-name').fill(buildDishName(testInfo, '价格边界'));
  await page.evaluate(() => {
    const form = document.querySelector('[data-testid="merchant-create-dish-form"]');
    const price = document.querySelector('[data-testid="merchant-dish-price"]');
    const desc = document.querySelector('[data-testid="merchant-dish-description"]');
    price.value = '0';
    desc.value = '价格为0';
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });
  await expect(page.getByTestId('merchant-dishes-message')).toContainText('priceCents 必须为正整数');

  const tooLongDescription = longText(513);
  await page.evaluate((text) => {
    const form = document.querySelector('[data-testid="merchant-create-dish-form"]');
    const name = document.querySelector('[data-testid="merchant-dish-name"]');
    const price = document.querySelector('[data-testid="merchant-dish-price"]');
    const desc = document.querySelector('[data-testid="merchant-dish-description"]');
    name.value = `描述边界_${Date.now()}`;
    price.value = '1234';
    desc.value = text;
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  }, tooLongDescription);
  await expect(page.getByTestId('merchant-dishes-message')).toContainText('描述长度不能超过 512');

  await rowOff.locator('[data-testid^="merchant-dish-edit-"]').click({ force: true });
  await expect(page.getByTestId('app-dialog-input-name')).toBeVisible();
  await expect(page.getByTestId('app-dialog-input-priceYuan')).toBeVisible();
  await expect(page.getByTestId('app-dialog-input-description')).toBeVisible();
  await expect(page.getByTestId('app-dialog-input-isAvailable')).toBeVisible();
  await dismissEditDialog(page);
  await expect(page.getByTestId('app-dialog')).toBeHidden();
  await expect(rowOff.locator('[data-testid^="merchant-dish-name-"]')).toContainText(dishNameOff);

  await rowOff.locator('[data-testid^="merchant-dish-edit-"]').click({ force: true });
  await fillEditDialog(page, { name: `${dishNameOff}_tmp` });
  await dismissEditDialog(page);
  await expect(page.getByTestId('app-dialog')).toBeHidden();
  await expect(rowOff.locator('[data-testid^="merchant-dish-name-"]')).toContainText(dishNameOff);

  const editedName = `${dishNameOff}_edited`;
  await rowOff.locator('[data-testid^="merchant-dish-edit-"]').click({ force: true });
  await fillEditDialog(page, {
    name: editedName,
    priceYuan: '39.99',
    description: '编辑成功描述',
    isAvailable: true
  });
  await submitEditDialog(page);
  await expect(page.getByTestId('app-dialog')).toBeHidden();
  await expect(page.getByTestId('merchant-dishes-message')).toContainText('菜品编辑成功');

  const editedRow = page.locator('[data-testid^="merchant-dish-row-"]').filter({ hasText: editedName }).first();
  await expect(editedRow).toBeVisible();
  await expect(editedRow.locator('[data-testid^="merchant-dish-status-"]')).toContainText('可售');

  await editedRow.locator('[data-testid^="merchant-dish-edit-"]').click({ force: true });
  await fillEditDialog(page, {
    name: `${editedName}_bad`,
    priceYuan: 'abc',
    description: 'invalid price'
  });
  await submitEditDialog(page);
  await expect(page.getByTestId('app-dialog')).toBeHidden();
  await expect(page.getByTestId('merchant-dishes-message')).toContainText('字段类型错误');

  await page.getByTestId('merchant-dish-filter-keyword').fill(editedName);
  await page.getByTestId('merchant-dish-search').click();
  await expect(editedRow).toBeVisible();
  await expect(page.locator('[data-testid^="merchant-dish-row-"]').filter({ hasText: dishNameOn })).toHaveCount(0);
  await expect(page.getByTestId('merchant-dishes-message')).toContainText('共 1 道菜品');

  await page.getByTestId('merchant-dish-filter-keyword').fill('not-exist-keyword');
  await page.getByTestId('merchant-dish-filter-status').selectOption('false');
  await page.getByTestId('merchant-dish-search').click();
  await expect(page.getByTestId('merchant-dishes-empty')).toContainText('暂无符合条件的菜品');

  await page.getByTestId('merchant-dish-reset').click();
  await expect(editedRow).toBeVisible();

  const deletableName = buildDishName(testInfo, '待删除');
  await page.getByTestId('merchant-dish-name').fill(deletableName);
  await page.getByTestId('merchant-dish-price').fill('16.80');
  await page.getByTestId('merchant-dish-description').fill('用于测试删除');
  await page.getByTestId('merchant-dish-available').check();
  await page.getByTestId('merchant-dish-submit').click();
  await expect(page.getByTestId('merchant-dishes-message')).toContainText('新增菜品成功');

  const deletableRow = page.locator('[data-testid^="merchant-dish-row-"]').filter({ hasText: deletableName }).first();
  await expect(deletableRow).toBeVisible();
  await deletableRow.locator('[data-testid^="merchant-dish-delete-"]').click({ force: true });
  await expect(page.getByTestId('app-dialog')).toBeVisible();
  await expect(page.getByTestId('app-dialog-message')).toContainText('删除后不可恢复');
  await page.getByTestId('app-dialog-confirm').click();
  await expect(page.getByTestId('merchant-dishes-message')).toContainText('菜品已删除');
  await expect(page.locator('[data-testid^="merchant-dish-row-"]').filter({ hasText: deletableName })).toHaveCount(0);
});
