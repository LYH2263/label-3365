import { expect, test } from '@playwright/test';
import { apiCall, expectApiError, expectApiOk } from '../helpers/api.js';
import { loginByApi, registerCustomerByApi } from '../helpers/auth.js';
import { buildCustomer, buildDishName } from '../helpers/data.js';

async function createDishByMerchant(request, merchantCookie, testInfo, isAvailable = true) {
  const result = await apiCall(request, 'POST', '/api/dishes', {
    cookie: merchantCookie,
    body: {
      name: buildDishName(testInfo, isAvailable ? '可售菜' : '下架菜'),
      priceCents: 3000,
      description: 'api 边界用例',
      isAvailable
    }
  });
  expectApiOk(result);
  return result.payload.data.id;
}

test('API-01 OPTIONS 与未知路由', async ({ request }) => {
  const options = await request.fetch('/api/health', { method: 'OPTIONS' });
  expect(options.status()).toBe(204);

  const unknown = await apiCall(request, 'GET', '/api/not-exists-path');
  expectApiError(unknown, 404, 40400);
});

test('API-02 invalid json 与请求体类型错误', async ({ request }) => {
  const badJsonResponse = await request.fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    data: '{invalid json'
  });
  expect(badJsonResponse.status()).toBe(400);
  const badJsonPayload = await badJsonResponse.json();
  expect(badJsonPayload.code).toBe(40000);

  const wrongType = await apiCall(request, 'POST', '/api/dishes', {
    cookie: (await loginByApi(request, 'merchant_admin', 'Merchant@123')).cookie,
    body: {
      name: '类型错误菜',
      priceCents: '3000',
      description: 'price 类型错误',
      isAvailable: true
    }
  });
  expectApiError(wrongType, 400, 40000);
});

test('API-03 注册重复、权限边界', async ({ request }, testInfo) => {
  const customer = buildCustomer(testInfo, 'dup');
  await registerCustomerByApi(request, customer);

  const duplicate = await apiCall(request, 'POST', '/api/auth/register', {
    body: customer
  });
  expectApiError(duplicate, 409, 40900);

  const customerLogin = await loginByApi(request, customer.username, customer.password);
  const merchantLogin = await loginByApi(request, 'merchant_admin', 'Merchant@123');

  const customerCreateDish = await apiCall(request, 'POST', '/api/dishes', {
    cookie: customerLogin.cookie,
    body: {
      name: '越权菜品',
      priceCents: 1000,
      description: 'forbidden',
      isAvailable: true
    }
  });
  expectApiError(customerCreateDish, 403, 40300);

  const merchantSubmitOrder = await apiCall(request, 'POST', '/api/orders', {
    cookie: merchantLogin.cookie,
    body: { items: [{ dishId: 1, quantity: 1 }] }
  });
  expectApiError(merchantSubmitOrder, 403, 40300);
});

test('API-04 下单参数边界', async ({ request }, testInfo) => {
  const customer = buildCustomer(testInfo, 'ord');
  await registerCustomerByApi(request, customer);
  const customerLogin = await loginByApi(request, customer.username, customer.password);

  const itemsNotArray = await apiCall(request, 'POST', '/api/orders', {
    cookie: customerLogin.cookie,
    body: { items: {} }
  });
  expectApiError(itemsNotArray, 400, 40000);

  const itemNotObject = await apiCall(request, 'POST', '/api/orders', {
    cookie: customerLogin.cookie,
    body: { items: ['not-object'] }
  });
  expectApiError(itemNotObject, 400, 40000);

  const dishIdInvalid = await apiCall(request, 'POST', '/api/orders', {
    cookie: customerLogin.cookie,
    body: { items: [{ dishId: 0, quantity: 1 }] }
  });
  expectApiError(dishIdInvalid, 400, 40000);

  const qtyTooSmall = await apiCall(request, 'POST', '/api/orders', {
    cookie: customerLogin.cookie,
    body: { items: [{ dishId: 1, quantity: 0 }] }
  });
  expectApiError(qtyTooSmall, 400, 40000);

  const qtyTooLarge = await apiCall(request, 'POST', '/api/orders', {
    cookie: customerLogin.cookie,
    body: { items: [{ dishId: 1, quantity: 1000 }] }
  });
  expectApiError(qtyTooLarge, 400, 40000);

  const notFoundDish = await apiCall(request, 'POST', '/api/orders', {
    cookie: customerLogin.cookie,
    body: { items: [{ dishId: 99999999, quantity: 1 }] }
  });
  expectApiError(notFoundDish, 409, 40900);
});

test('API-05 下架菜冲突、状态流转与未登录', async ({ request }, testInfo) => {
  const merchant = await loginByApi(request, 'merchant_admin', 'Merchant@123');
  const customer = buildCustomer(testInfo, 'flow');
  await registerCustomerByApi(request, customer);
  const customerLogin = await loginByApi(request, customer.username, customer.password);

  const downDishId = await createDishByMerchant(request, merchant.cookie, testInfo, false);
  const dishNotFound = await apiCall(request, 'PUT', '/api/dishes/99999999', {
    cookie: merchant.cookie,
    body: {
      name: '不存在菜品',
      priceCents: 1000,
      description: 'not found',
      isAvailable: true
    }
  });
  expectApiError(dishNotFound, 404, 40400);

  const downOrder = await apiCall(request, 'POST', '/api/orders', {
    cookie: customerLogin.cookie,
    body: { items: [{ dishId: downDishId, quantity: 1 }] }
  });
  expectApiError(downOrder, 409, 40900);

  const upDishId = await createDishByMerchant(request, merchant.cookie, testInfo, true);
  const createOrder = await apiCall(request, 'POST', '/api/orders', {
    cookie: customerLogin.cookie,
    body: { items: [{ dishId: upDishId, quantity: 1 }] }
  });
  expectApiOk(createOrder);
  const orderId = createOrder.payload.data.orderId;

  const invalidStatusEnum = await apiCall(request, 'PUT', `/api/orders/${orderId}/status`, {
    cookie: merchant.cookie,
    body: { status: 'INVALID' }
  });
  expectApiError(invalidStatusEnum, 400, 40000);

  const customerConfirmOrder = await apiCall(request, 'PUT', `/api/orders/${orderId}/status`, {
    cookie: customerLogin.cookie,
    body: { status: 'CONFIRMED' }
  });
  expectApiError(customerConfirmOrder, 403, 40300);

  const deleteReferencedDish = await apiCall(request, 'DELETE', `/api/dishes/${upDishId}`, {
    cookie: merchant.cookie
  });
  expectApiError(deleteReferencedDish, 409, 40900);

  const illegalTransition = await apiCall(request, 'PUT', `/api/orders/${orderId}/status`, {
    cookie: merchant.cookie,
    body: { status: 'DONE' }
  });
  expectApiError(illegalTransition, 400, 40000);

  const notFoundOrder = await apiCall(request, 'PUT', '/api/orders/99999999/status', {
    cookie: merchant.cookie,
    body: { status: 'CONFIRMED' }
  });
  expectApiError(notFoundOrder, 404, 40400);

  const logout = await apiCall(request, 'POST', '/api/auth/logout', {
    cookie: customerLogin.cookie
  });
  expectApiOk(logout);

  const afterLogout = await apiCall(request, 'GET', '/api/orders', {
    cookie: customerLogin.cookie
  });
  expectApiError(afterLogout, 401, 40100);
});
