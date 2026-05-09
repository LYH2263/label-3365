import { apiRequest, showMessage } from "/assets/js/api.js";
import { landingPath } from "/assets/js/auth.js";

const form = document.getElementById("loginForm");
const messageEl = document.getElementById("message");

async function bootstrap() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("reason") === "expired") {
    showMessage(messageEl, "登录已过期，请重新登录");
  }

  try {
    const me = await apiRequest("/api/account/me", { redirectOn401: false });
    if (me && me.role) {
      window.location.href = landingPath(me.role);
    }
  } catch (error) {
    // 未登录时无需处理
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(form);
  const username = String(formData.get("username") || "").trim();
  const password = String(formData.get("password") || "").trim();

  try {
    const data = await apiRequest("/api/auth/login", {
      method: "POST",
      body: { username, password },
      redirectOn401: false
    });
    window.location.href = landingPath(data.role);
  } catch (error) {
    showMessage(messageEl, error.message || "登录失败");
  }
});

bootstrap();
