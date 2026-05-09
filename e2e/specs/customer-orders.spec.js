import { expect, test } from '@playwright/test';
import { apiCall, expectApiOk } from '../helpers/api.js';
import { loginByApi, loginByUI, registerCustomerByApi } from '../helpers/auth.js';
import { buildCustomer } from '../helpers/data.js';

test('CUSTOMER-ORDERS-01 未登录访问跳登录', async ({ page }) => {
  await page.goto('/customer/orders.html');
  await expect(page).toHaveURL(/\/login\.html\?reason=expired/);
});

test('CUSTOMER-ORDERS-02 空态/列表态/刷新/取消分支', async ({ page, request }, testInfo) => {
  const customer = buildCustomer(testInfo, 'co');
  await registerCustomerByApi(request, customer);

  await loginByUI(page, customer.username, customer.password);
  await expect(page).toHaveURL(/\/customer\/menu\.html/);
  await page.goto('/customer/orders.html');

  await expect(page.getByTestId('customer-orders-empty')).toBeVisible();

  const customerLogin = await loginByApi(request, customer.username, customer.password);
  const dishes = await apiCall(request, 'GET', '/api/dishes', {
    cookie: customerLogin.cookie
  });
  expectApiOk(dishes);

  const order = await apiCall(request, 'POST', '/api/orders', {
    cookie: customerLogin.cookie,
    body: {
      items: [{ dishId: dishes.payload.data[0].id, quantity: 2 }]
    }
  });
  expectApiOk(order);
  const orderId = order.payload.data.orderId;

  await page.getByTestId('customer-orders-refresh').click();
  await expect(page.getByTestId(`customer-order-card-${orderId}`)).toBeVisible();
  await expect(page.getByTestId('customer-orders-message')).toContainText('共');
  await expect(page.getByTestId(`customer-order-cancel-${orderId}`)).toBeVisible();

  await page.getByTestId(`customer-order-cancel-${orderId}`).click();
  await expect(page.getByTestId('app-dialog')).toBeVisible();
  await expect(page.getByTestId('app-dialog-message')).toContainText(`确认取消订单 #${orderId}`);
  await page.getByTestId('app-dialog-confirm').click();

  await expect(page.getByTestId('customer-orders-message')).toContainText(`订单 #${orderId} 已取消`);
  await expect(page.getByTestId(`customer-order-status-${orderId}`)).toContainText('CANCELLED');
  await expect(page.getByTestId(`customer-order-card-${orderId}`)).not.toContainText('取消订单');
});
