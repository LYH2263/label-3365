import { apiRequest } from "./api.js";
import { showAlertDialog } from "./dialog.js";

export async function requireAuth(allowedRoles = []) {
  const me = await apiRequest("/api/account/me");
  if (allowedRoles.length > 0 && !allowedRoles.includes(me.role)) {
    await showAlertDialog("无权限访问该页面");
    window.location.href = landingPath(me.role);
    throw new Error("forbidden");
  }
  return me;
}

export async function logout() {
  await apiRequest("/api/auth/logout", { method: "POST", redirectOn401: false });
  window.location.href = "/login.html";
}

export function landingPath(role) {
  if (role === "MERCHANT") return "/merchant/dishes.html";
  return "/customer/menu.html";
}
