import { expect, test } from '@playwright/test';
import { registerCustomerByApi } from '../helpers/auth.js';
import { buildCustomer, longText } from '../helpers/data.js';

test('REGISTER-01 两次密码不一致前端拦截', async ({ page }, testInfo) => {
  const customer = buildCustomer(testInfo, 'regm');
  await page.goto('/register.html');
  await page.getByTestId('register-username').fill(customer.username);
  await page.getByTestId('register-display-name').fill(customer.displayName);
  await page.getByTestId('register-password').fill('Customer@123');
  await page.getByTestId('register-confirm-password').fill('Customer@1234');
  await page.getByTestId('register-phone').fill(customer.phone);
  await page.getByTestId('register-submit').click();

  await expect(page.getByTestId('register-message')).toContainText('两次密码不一致');
  await expect(page).toHaveURL(/\/register\.html/);
});

test('REGISTER-02 注册成功并跳转登录', async ({ page }, testInfo) => {
  const customer = buildCustomer(testInfo, 'regs');
  await page.goto('/register.html');
  await page.getByTestId('register-username').fill(customer.username);
  await page.getByTestId('register-display-name').fill(customer.displayName);
  await page.getByTestId('register-password').fill(customer.password);
  await page.getByTestId('register-confirm-password').fill(customer.password);
  await page.getByTestId('register-phone').fill(customer.phone);
  await page.getByTestId('register-submit').click();

  await expect(page.getByTestId('register-message')).toContainText('注册成功');
  await expect(page).toHaveURL(/\/login\.html/);
});

test('REGISTER-03 重复用户名返回 409', async ({ page, request }, testInfo) => {
  const customer = buildCustomer(testInfo, 'regd');
  await registerCustomerByApi(request, customer);

  await page.goto('/register.html');
  await page.getByTestId('register-username').fill(customer.username);
  await page.getByTestId('register-display-name').fill(customer.displayName);
  await page.getByTestId('register-password').fill(customer.password);
  await page.getByTestId('register-confirm-password').fill(customer.password);
  await page.getByTestId('register-phone').fill(customer.phone);
  await page.getByTestId('register-submit').click();

  await expect(page.getByTestId('register-message')).toContainText('用户名已存在');
});

test('REGISTER-04 用户名/密码/手机号边界校验', async ({ page }, testInfo) => {
  const customer = buildCustomer(testInfo, 'rege');

  await page.goto('/register.html');
  await page.getByTestId('register-username').fill('ab');
  await page.getByTestId('register-display-name').fill(customer.displayName);
  await page.getByTestId('register-password').fill(customer.password);
  await page.getByTestId('register-confirm-password').fill(customer.password);
  await page.getByTestId('register-phone').fill(customer.phone);
  await page.getByTestId('register-submit').click();
  await expect(page.getByTestId('register-message')).toContainText('用户名需为');

  await page.getByTestId('register-username').fill('bad@name');
  await page.getByTestId('register-submit').click();
  await expect(page.getByTestId('register-message')).toContainText('用户名需为');

  await page.evaluate(() => {
    const input = document.querySelector('[data-testid="register-username"]');
    input.value = 'A'.repeat(40);
  });
  await page.getByTestId('register-submit').click();
  await expect(page.getByTestId('register-message')).toContainText('用户名需为');

  await page.getByTestId('register-username').fill(customer.username);
  await page.evaluate(() => {
    const form = document.querySelector('[data-testid="register-form"]');
    document.querySelector('[data-testid="register-password"]').value = '1234567';
    document.querySelector('[data-testid="register-confirm-password"]').value = '1234567';
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });
  await expect(page.getByTestId('register-message')).toContainText('密码长度需在 8-64 位');

  const tooLongPwd = longText(65);
  await page.evaluate((pwd) => {
    const form = document.querySelector('[data-testid="register-form"]');
    document.querySelector('[data-testid="register-password"]').value = pwd;
    document.querySelector('[data-testid="register-confirm-password"]').value = pwd;
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  }, tooLongPwd);
  await expect(page.getByTestId('register-message')).toContainText('密码长度需在 8-64 位');

  await page.getByTestId('register-password').fill(customer.password);
  await page.getByTestId('register-confirm-password').fill(customer.password);
  await page.getByTestId('register-phone').fill('not-phone');
  await page.getByTestId('register-submit').click();
  await expect(page.getByTestId('register-message')).toContainText('手机号格式不正确');
});
