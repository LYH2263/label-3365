import { expect, test } from '@playwright/test';
import { apiCall, expectApiOk } from '../helpers/api.js';
import { loginByApi, loginByUI, registerCustomerByApi } from '../helpers/auth.js';
import { buildCustomer } from '../helpers/data.js';

test('CUSTOMER-MENU-01 未登录访问跳登录', async ({ page }) => {
  await page.goto('/customer/menu.html');
  await expect(page).toHaveURL(/\/login\.html\?reason=expired/);
});

test('CUSTOMER-MENU-02 购物车分支 + localStorage 恢复 + 正常下单', async ({ page, request }, testInfo) => {
  const customer = buildCustomer(testInfo, 'cm');
  await registerCustomerByApi(request, customer);

  await loginByUI(page, customer.username, customer.password);
  await expect(page).toHaveURL(/\/customer\/menu\.html/);

  await expect(page.getByTestId('cart-empty')).toBeVisible();
  await expect(page.getByTestId('customer-cart-total')).toHaveText('¥0.00');

  const firstAdd = page.locator('[data-testid^="dish-add-"]').first();
  const dishId = await firstAdd.getAttribute('data-id');
  await firstAdd.click({ force: true });
  await firstAdd.click({ force: true });
  await expect(page.getByTestId(`cart-quantity-${dishId}`)).toHaveText('2');

  await page.getByTestId(`cart-increase-${dishId}`).click({ force: true });
  await expect(page.getByTestId(`cart-quantity-${dishId}`)).toHaveText('3');

  await page.getByTestId(`cart-decrease-${dishId}`).click({ force: true });
  await expect(page.getByTestId(`cart-quantity-${dishId}`)).toHaveText('2');

  await page.getByTestId(`cart-remove-${dishId}`).click({ force: true });
  await expect(page.getByTestId('cart-empty')).toBeVisible();

  await page.getByTestId('customer-submit-order').click({ force: true });
  await expect(page.getByTestId('customer-menu-message')).toContainText('购物车为空');

  await firstAdd.click({ force: true });
  await expect(page.getByTestId(`cart-quantity-${dishId}`)).toHaveText('1');

  await page.reload();
  await expect(page.getByTestId(`cart-quantity-${dishId}`)).toHaveText('1');

  await page.getByTestId('customer-submit-order').click({ force: true });
  await expect(page.getByTestId('customer-menu-message')).toContainText('下单成功');
  await expect(page).toHaveURL(/\/customer\/orders\.html/);
});

test('CUSTOMER-MENU-03 购物车含下架菜品下单失败', async ({ page, request }, testInfo) => {
  const customer = buildCustomer(testInfo, 'cmf');
  await registerCustomerByApi(request, customer);

  await loginByUI(page, customer.username, customer.password);
  await expect(page).toHaveURL(/\/customer\/menu\.html/);

  const firstAdd = page.locator('[data-testid^="dish-add-"]').first();
  const dishId = Number(await firstAdd.getAttribute('data-id'));
  await firstAdd.click({ force: true });

  const merchant = await loginByApi(request, 'merchant_admin', 'Merchant@123');
  const allDishes = await apiCall(request, 'GET', '/api/dishes?scope=all', {
    cookie: merchant.cookie
  });
  expectApiOk(allDishes);
  const targetDish = allDishes.payload.data.find((dish) => dish.id === dishId);

  const downResult = await apiCall(request, 'PUT', `/api/dishes/${dishId}`, {
    cookie: merchant.cookie,
    body: {
      name: targetDish.name,
      priceCents: targetDish.priceCents,
      description: targetDish.description,
      isAvailable: false
    }
  });
  expectApiOk(downResult);

  await page.getByTestId('customer-submit-order').click({ force: true });
  await expect(page.getByTestId('customer-menu-message')).toContainText('已下架');
  await expect(page).toHaveURL(/\/customer\/menu\.html/);
});

test('CUSTOMER-MENU-04 localStorage 损坏 JSON 分支恢复为空', async ({ page, request }, testInfo) => {
  const customer = buildCustomer(testInfo, 'cml');
  await registerCustomerByApi(request, customer);

  await loginByUI(page, customer.username, customer.password);
  await expect(page).toHaveURL(/\/customer\/menu\.html/);

  await page.evaluate(() => {
    localStorage.setItem('chuanzi_cart_v1', '{bad-json');
  });
  await page.reload();

  await expect(page.getByTestId('cart-empty')).toBeVisible();
  await expect(page.getByTestId('customer-cart-total')).toHaveText('¥0.00');
});
