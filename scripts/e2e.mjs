import assert from "node:assert/strict";

const baseUrl = process.env.APP_BASE_URL || "http://127.0.0.1:18080";

async function request(method, path, options = {}) {
  const { body, cookie } = options;
  const headers = { "Content-Type": "application/json" };
  if (cookie) {
    headers.Cookie = cookie;
  }

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });

  let payload;
  try {
    payload = await response.json();
  } catch (error) {
    payload = { code: -1, message: "invalid json", data: null };
  }

  return {
    status: response.status,
    payload,
    cookie: parseCookie(response.headers.get("set-cookie"))
  };
}

function parseCookie(setCookie) {
  if (!setCookie) return "";
  return setCookie.split(";")[0];
}

async function login(username, password) {
  const res = await request("POST", "/api/auth/login", {
    body: { username, password }
  });
  assert.equal(res.status, 200, `登录失败: ${username}`);
  assert.equal(res.payload.code, 0);
  assert.ok(res.cookie.startsWith("session_token="));
  return { cookie: res.cookie, profile: res.payload.data };
}

async function run() {
  const anonOrders = await request("GET", "/api/orders");
  assert.equal(anonOrders.status, 401);
  assert.equal(anonOrders.payload.code, 40100);

  const merchant = await login("merchant_admin", "Merchant@123");
  assert.equal(merchant.profile.role, "MERCHANT");

  const newDishName = `测试菜-${Date.now()}`;
  const createDish = await request("POST", "/api/dishes", {
    cookie: merchant.cookie,
    body: {
      name: newDishName,
      priceCents: 4500,
      description: "自动化验收菜品",
      isAvailable: true
    }
  });
  assert.equal(createDish.status, 200);
  const availableDishId = createDish.payload.data.id;

  const hiddenDish = await request("POST", "/api/dishes", {
    cookie: merchant.cookie,
    body: {
      name: `${newDishName}-下架`,
      priceCents: 5100,
      description: "默认下架",
      isAvailable: false
    }
  });
  assert.equal(hiddenDish.status, 200);
  const hiddenDishId = hiddenDish.payload.data.id;

  const customerName = `customer_${Date.now()}`;
  const register = await request("POST", "/api/auth/register", {
    body: {
      username: customerName,
      password: "Customer@123",
      displayName: "自动化顾客",
      phone: "13800138000"
    }
  });
  assert.equal(register.status, 200);

  const customer = await login(customerName, "Customer@123");
  assert.equal(customer.profile.role, "CUSTOMER");

  const customerDishes = await request("GET", "/api/dishes", { cookie: customer.cookie });
  assert.equal(customerDishes.status, 200);
  const visibleDishIds = customerDishes.payload.data.map((dish) => dish.id);
  assert.ok(visibleDishIds.includes(availableDishId), "顾客看不到可售菜品");
  assert.ok(!visibleDishIds.includes(hiddenDishId), "顾客看到了下架菜品");

  const beforeOrders = await request("GET", "/api/orders", { cookie: customer.cookie });
  assert.equal(beforeOrders.status, 200);
  const beforeCount = beforeOrders.payload.data.length;

  const createOrder = await request("POST", "/api/orders", {
    cookie: customer.cookie,
    body: {
      items: [
        { dishId: availableDishId, quantity: 2 },
        { dishId: visibleDishIds[0], quantity: 1 }
      ]
    }
  });
  assert.equal(createOrder.status, 200);
  assert.equal(createOrder.payload.data.status, "NEW");

  const myOrders = await request("GET", "/api/orders", { cookie: customer.cookie });
  assert.equal(myOrders.status, 200);
  assert.ok(myOrders.payload.data.length >= beforeCount + 1);
  const latestOrder = myOrders.payload.data[0];
  assert.equal(latestOrder.status, "NEW");

  const merchantOrders = await request("GET", "/api/orders", { cookie: merchant.cookie });
  assert.equal(merchantOrders.status, 200);
  const merchantOrder = merchantOrders.payload.data.find((order) => order.id === latestOrder.id);
  assert.ok(merchantOrder, "商家看不到顾客订单");

  const updateStatus = await request("PUT", `/api/orders/${latestOrder.id}/status`, {
    cookie: merchant.cookie,
    body: { status: "CONFIRMED" }
  });
  assert.equal(updateStatus.status, 200);

  const myOrdersAfterStatus = await request("GET", "/api/orders", { cookie: customer.cookie });
  const updatedOrder = myOrdersAfterStatus.payload.data.find((order) => order.id === latestOrder.id);
  assert.equal(updatedOrder.status, "CONFIRMED");

  const hideDish = await request("PUT", `/api/dishes/${availableDishId}`, {
    cookie: merchant.cookie,
    body: {
      name: newDishName,
      priceCents: 4500,
      description: "自动化验收菜品",
      isAvailable: false
    }
  });
  assert.equal(hideDish.status, 200);

  const failedOrder = await request("POST", "/api/orders", {
    cookie: customer.cookie,
    body: {
      items: [{ dishId: availableDishId, quantity: 1 }]
    }
  });
  assert.equal(failedOrder.status, 409);
  assert.equal(failedOrder.payload.code, 40900);

  const myOrdersAfterFailed = await request("GET", "/api/orders", { cookie: customer.cookie });
  assert.equal(myOrdersAfterFailed.payload.data.length, myOrdersAfterStatus.payload.data.length);

  const forbiddenDishCreate = await request("POST", "/api/dishes", {
    cookie: customer.cookie,
    body: {
      name: "越权菜品",
      priceCents: 1000,
      description: "should fail",
      isAvailable: true
    }
  });
  assert.equal(forbiddenDishCreate.status, 403);
  assert.equal(forbiddenDishCreate.payload.code, 40300);

  const forbiddenOrderSubmit = await request("POST", "/api/orders", {
    cookie: merchant.cookie,
    body: {
      items: [{ dishId: availableDishId, quantity: 1 }]
    }
  });
  assert.equal(forbiddenOrderSubmit.status, 403);

  const customerLogout = await request("POST", "/api/auth/logout", {
    cookie: customer.cookie
  });
  assert.equal(customerLogout.status, 200);

  const afterLogout = await request("GET", "/api/orders", {
    cookie: customer.cookie
  });
  assert.equal(afterLogout.status, 401);

  console.log("e2e acceptance passed");
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
