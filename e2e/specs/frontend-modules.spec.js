import { expect, test } from '@playwright/test';

test('FRONTEND-MODULE-01 api.js 在登录页遇到 401 不重定向离开登录页', async ({ page }) => {
  await page.goto('/login.html');
  const result = await page.evaluate(async () => {
    const { apiRequest } = await import('/assets/js/api.js');
    try {
      await apiRequest('/api/orders');
      return { ok: true, path: window.location.pathname };
    } catch (error) {
      return { ok: false, path: window.location.pathname, message: error.message };
    }
  });

  expect(result.ok).toBe(false);
  expect(result.path).toBe('/login.html');
});

test('FRONTEND-MODULE-02 api.js 非 JSON 响应解析失败分支', async ({ page }) => {
  await page.goto('/login.html');
  const result = await page.evaluate(async () => {
    const { apiRequest } = await import('/assets/js/api.js');
    try {
      await apiRequest('/non-json-plain-text-endpoint', { redirectOn401: false });
      return { ok: true };
    } catch (error) {
      return { ok: false, message: error.message, code: error.code };
    }
  });

  expect(result.ok).toBe(false);
  expect(result.message).toBe('响应解析失败');
  expect(result.code).toBe(50000);
});
