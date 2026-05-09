import { apiRequest, showMessage } from "/assets/js/api.js";

const form = document.getElementById("registerForm");
const messageEl = document.getElementById("message");

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(form);
  const username = String(formData.get("username") || "").trim();
  const password = String(formData.get("password") || "").trim();
  const confirmPassword = String(formData.get("confirmPassword") || "").trim();
  const displayName = String(formData.get("displayName") || "").trim();
  const phone = String(formData.get("phone") || "").trim();

  if (password !== confirmPassword) {
    showMessage(messageEl, "两次密码不一致");
    return;
  }

  try {
    await apiRequest("/api/auth/register", {
      method: "POST",
      body: { username, password, displayName, phone },
      redirectOn401: false
    });
    showMessage(messageEl, "注册成功，正在跳转登录页", "success");
    setTimeout(() => {
      window.location.href = "/login.html";
    }, 600);
  } catch (error) {
    showMessage(messageEl, error.message || "注册失败");
  }
});
