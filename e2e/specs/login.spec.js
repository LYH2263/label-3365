import { expect, test } from '@playwright/test';
import { registerCustomerByApi } from '../helpers/auth.js';
import { buildCustomer } from '../helpers/data.js';

test('LOGIN-01 未登录停留登录页 + 登录失败提示 + expired 提示', async ({ page }) => {
  await page.goto('/login.html?reason=expired');
  await expect(page).toHaveURL(/\/login\.html\?reason=expired/);
  await expect(page.getByTestId('login-message')).toContainText('登录已过期');

  await page.getByTestId('login-username').fill('merchant_admin');
  await page.getByTestId('login-password').fill('wrong-password');
  await page.getByTestId('login-submit').click();

  await expect(page).toHaveURL(/\/login\.html/);
  await expect(page.getByTestId('login-message')).toContainText('用户名或密码错误');
});

test('LOGIN-02 商家登录成功 + 已登录访问登录页自动跳转', async ({ page }) => {
  await page.goto('/login.html');
  await page.getByTestId('login-username').fill('merchant_admin');
  await page.getByTestId('login-password').fill('Merchant@123');
  await page.getByTestId('login-submit').click();

  await expect(page).toHaveURL(/\/merchant\/dishes\.html/);

  await page.goto('/login.html');
  await expect(page).toHaveURL(/\/merchant\/dishes\.html/);
});

test('LOGIN-03 顾客登录成功 + 顾客已登录访问登录页自动跳转', async ({ page, request }, testInfo) => {
  const customer = buildCustomer(testInfo, 'lg');
  await registerCustomerByApi(request, customer);

  await page.goto('/login.html');
  await page.getByTestId('login-username').fill(customer.username);
  await page.getByTestId('login-password').fill(customer.password);
  await page.getByTestId('login-submit').click();
  await expect(page).toHaveURL(/\/customer\/menu\.html/);

  await page.goto('/login.html');
  await expect(page).toHaveURL(/\/customer\/menu\.html/);
});

test('LOGIN-04 登录页 api.js redirectOn401=false 分支（不强制跳转）', async ({ page }) => {
  await page.goto('/login.html');
  const result = await page.evaluate(async () => {
    const { apiRequest } = await import('/assets/js/api.js');
    try {
      await apiRequest('/api/orders', { redirectOn401: false });
      return { ok: true };
    } catch (error) {
      return { ok: false, message: error.message, current: window.location.pathname };
    }
  });

  expect(result.ok).toBe(false);
  expect(result.current).toBe('/login.html');
});
