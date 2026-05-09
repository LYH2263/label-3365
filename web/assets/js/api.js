export async function apiRequest(path, options = {}) {
  const {
    method = "GET",
    body,
    redirectOn401 = true,
    headers = {}
  } = options;

  const requestInit = {
    method,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...headers
    }
  };

  if (body !== undefined) {
    requestInit.body = JSON.stringify(body);
  }

  const response = await fetch(path, requestInit);
  let payload;
  try {
    payload = await response.json();
  } catch (error) {
    payload = { code: 50000, message: "响应解析失败", data: null };
  }

  const isUnauthorized = response.status === 401 || payload.code === 40100;
  if (isUnauthorized && redirectOn401) {
    const current = window.location.pathname;
    if (current !== "/login.html" && current !== "/register.html") {
      window.location.href = "/login.html?reason=expired";
    }
  }

  if (!response.ok || payload.code !== 0) {
    const error = new Error(payload.message || "请求失败");
    error.code = payload.code;
    error.status = response.status;
    throw error;
  }

  return payload.data;
}

export function showMessage(el, message, type = "error") {
  if (!el) return;
  el.textContent = message || "";
  el.className = type;
}
