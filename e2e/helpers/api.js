import { expect } from '@playwright/test';

export function parseSessionCookie(setCookieHeader) {
  if (!setCookieHeader) return '';
  return setCookieHeader.split(';')[0];
}

export async function apiCall(request, method, path, options = {}) {
  const { body, cookie, headers = {}, rawBody } = options;
  const finalHeaders = { ...headers };
  if (cookie) {
    finalHeaders.Cookie = cookie;
  }

  const response = await request.fetch(path, {
    method,
    headers: {
      ...(rawBody !== undefined ? {} : { 'Content-Type': 'application/json' }),
      ...finalHeaders
    },
    data: rawBody !== undefined ? rawBody : body
  });

  const text = await response.text();
  let payload = null;
  try {
    payload = JSON.parse(text);
  } catch (error) {
    payload = null;
  }

  return {
    status: response.status(),
    payload,
    text,
    cookie: parseSessionCookie(response.headers()['set-cookie'])
  };
}

export function expectApiError(result, status, code) {
  expect(result.status).toBe(status);
  expect(result.payload).toBeTruthy();
  expect(result.payload.code).toBe(code);
}

export function expectApiOk(result) {
  expect(result.status).toBe(200);
  expect(result.payload).toBeTruthy();
  expect(result.payload.code).toBe(0);
}
