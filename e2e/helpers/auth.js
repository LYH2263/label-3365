import { expect } from '@playwright/test';
import { apiCall, expectApiOk } from './api.js';

export async function registerCustomerByApi(request, customer) {
  const result = await apiCall(request, 'POST', '/api/auth/register', { body: customer });
  expectApiOk(result);
  return result;
}

export async function loginByApi(request, username, password) {
  const result = await apiCall(request, 'POST', '/api/auth/login', {
    body: { username, password }
  });
  expectApiOk(result);
  expect(result.cookie.startsWith('session_token=')).toBeTruthy();
  return {
    cookie: result.cookie,
    profile: result.payload.data
  };
}

export async function loginByUI(page, username, password) {
  await page.goto('/login.html');
  await page.getByTestId('login-username').fill(username);
  await page.getByTestId('login-password').fill(password);
  await page.getByTestId('login-submit').click();
}
