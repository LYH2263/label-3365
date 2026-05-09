import { expect, test } from '@playwright/test';
import { apiCall, expectApiOk } from '../helpers/api.js';
import { loginByApi, loginByUI, registerCustomerByApi } from '../helpers/auth.js';
import { buildCustomer } from '../helpers/data.js';

test('MERCHANT-ORDERS-01 未登录访问跳登录', async ({ page }) => {
  await page.goto('/merchant/orders.html');
  await expect(page).toHaveURL(/\/login\.html\?reason=expired/);
});

test('MERCHANT-ORDERS-02 顾客访问商家订单页触发角色分支', async ({ page, request }, testInfo) => {
  const customer = buildCustomer(testInfo, 'mor');
  await registerCustomerByApi(request, customer);
  await loginByUI(page, customer.username, customer.password);
  await expect(page).toHaveURL(/\/customer\/menu\.html/);

  await page.goto('/merchant/orders.html');
  await expect(page.getByTestId('app-dialog')).toBeVisible();
  await expect(page.getByTestId('app-dialog-message')).toContainText('无权限访问该页面');
  await page.getByTestId('app-dialog-confirm').click();
  await expect(page).toHaveURL(/\/customer\/menu\.html/);
});

test('MERCHANT-ORDERS-03 空态/筛选/状态流转/非法流转', async ({ page, request }, testInfo) => {
  await loginByUI(page, 'merchant_admin', 'Merchant@123');
  await expect(page).toHaveURL(/\/merchant\/dishes\.html/);

  await page.route('**/api/orders*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ code: 0, message: 'ok', data: [] })
    });
  });
  await page.goto('/merchant/orders.html');
  await expect(page.getByTestId('merchant-orders-empty')).toBeVisible();
  await page.unroute('**/api/orders*');

  const customer = buildCustomer(testInfo, 'mof');
  await registerCustomerByApi(request, customer);
  const customerLogin = await loginByApi(request, customer.username, customer.password);

  const dishes = await apiCall(request, 'GET', '/api/dishes', {
    cookie: customerLogin.cookie
  });
  expectApiOk(dishes);

  const orderCreate = await apiCall(request, 'POST', '/api/orders', {
    cookie: customerLogin.cookie,
    body: {
      items: [{ dishId: dishes.payload.data[0].id, quantity: 1 }]
    }
  });
  expectApiOk(orderCreate);
  const orderId = orderCreate.payload.data.orderId;

  await page.goto('/merchant/orders.html');
  await expect(page.getByTestId(`merchant-order-card-${orderId}`)).toBeVisible();

  await page.getByTestId('merchant-orders-filter').selectOption('NEW');
  await expect(page.getByTestId(`merchant-order-card-${orderId}`)).toBeVisible();

  await page.getByTestId(`merchant-order-status-${orderId}`).selectOption('CONFIRMED');
  await page.getByTestId(`merchant-order-update-${orderId}`).click({ force: true });
  await expect(page.getByTestId(`merchant-order-card-${orderId}`)).toContainText('CONFIRMED');

  await page.getByTestId(`merchant-order-status-${orderId}`).selectOption('DONE');
  await page.getByTestId(`merchant-order-update-${orderId}`).click({ force: true });
  await expect(page.getByTestId(`merchant-order-card-${orderId}`)).toContainText('DONE');

  await expect(page.getByTestId(`merchant-order-card-${orderId}`)).toContainText('DONE');

  await page.getByTestId(`merchant-order-status-${orderId}`).selectOption('CONFIRMED');
  await expect(page.getByTestId(`merchant-order-status-${orderId}`)).toHaveValue('CONFIRMED');
  const illegalUpdateResponse = page.waitForResponse((resp) => {
    return resp.request().method() === 'PUT' && resp.url().includes(`/api/orders/${orderId}/status`);
  });
  await page.getByTestId(`merchant-order-update-${orderId}`).click({ force: true });
  const illegalResp = await illegalUpdateResponse;
  const illegalPayload = await illegalResp.json();
  expect(illegalResp.status()).toBe(400);
  expect(illegalPayload.code).toBe(40000);
  await expect(page.getByTestId(`merchant-order-card-${orderId}`)).toContainText('DONE');

  await page.getByTestId('merchant-orders-filter').selectOption('DONE');
  await expect(page.getByTestId(`merchant-order-card-${orderId}`)).toBeVisible();

  await page.getByTestId('merchant-orders-refresh').click();
  await expect(page.getByTestId('merchant-orders-message')).toContainText('共');
});
