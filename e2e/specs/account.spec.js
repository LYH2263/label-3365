import { expect, test } from '@playwright/test';
import { loginByUI, registerCustomerByApi } from '../helpers/auth.js';
import { buildCustomer } from '../helpers/data.js';

test('ACCOUNT-01 未登录访问账户页跳登录', async ({ page }) => {
  await page.goto('/account.html');
  await expect(page).toHaveURL(/\/login\.html\?reason=expired/);
});

test('ACCOUNT-02 账户资料分支 + 密码分支 + 退出登录', async ({ page, request }, testInfo) => {
  const customer = buildCustomer(testInfo, 'acc');
  await registerCustomerByApi(request, customer);

  await loginByUI(page, customer.username, customer.password);
  await expect(page).toHaveURL(/\/customer\/menu\.html/);

  await page.goto('/account.html');
  await expect(page.getByTestId('account-user-meta')).toContainText(customer.username);

  await page.getByTestId('account-display-name').fill(`${customer.displayName}_new`);
  await page.getByTestId('account-phone').fill('13812345678');
  await page.getByTestId('account-save-profile').click();
  await expect(page.getByTestId('account-profile-message')).toContainText('资料已更新');

  await page.getByTestId('account-phone').fill('bad_phone');
  await page.getByTestId('account-save-profile').click();
  await expect(page.getByTestId('account-profile-message')).toContainText('手机号格式不正确');

  await page.getByTestId('account-old-password').fill(customer.password);
  await page.getByTestId('account-new-password').fill('Customer@999');
  await page.getByTestId('account-confirm-password').fill('Customer@998');
  await page.getByTestId('account-change-password').click();
  await expect(page.getByTestId('account-password-message')).toContainText('新密码与确认密码不一致');

  await page.getByTestId('account-old-password').fill(customer.password);
  await page.getByTestId('account-new-password').fill(customer.password);
  await page.getByTestId('account-confirm-password').fill(customer.password);
  await page.getByTestId('account-change-password').click();
  await expect(page.getByTestId('account-password-message')).toContainText('新旧密码不能相同');

  await page.getByTestId('account-old-password').fill('WrongOld@123');
  await page.getByTestId('account-new-password').fill('Customer@888');
  await page.getByTestId('account-confirm-password').fill('Customer@888');
  await page.getByTestId('account-change-password').click();
  await expect(page.getByTestId('account-password-message')).toContainText('旧密码错误');

  const newPassword = 'Customer@777';
  await page.getByTestId('account-old-password').fill(customer.password);
  await page.getByTestId('account-new-password').fill(newPassword);
  await page.getByTestId('account-confirm-password').fill(newPassword);
  await page.getByTestId('account-change-password').click();
  await expect(page.getByTestId('account-password-message')).toContainText('密码修改成功');

  await page.getByTestId('account-logout').click();
  await expect(page).toHaveURL(/\/login\.html/);

  await page.getByTestId('login-username').fill(customer.username);
  await page.getByTestId('login-password').fill(customer.password);
  await page.getByTestId('login-submit').click();
  await expect(page.getByTestId('login-message')).toContainText('用户名或密码错误');

  await page.getByTestId('login-password').fill(newPassword);
  await page.getByTestId('login-submit').click();
  await expect(page).toHaveURL(/\/customer\/menu\.html/);
});
