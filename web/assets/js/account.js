import { apiRequest, showMessage } from "/assets/js/api.js";
import { logout, requireAuth } from "/assets/js/auth.js";

const profileForm = document.getElementById("profileForm");
const passwordForm = document.getElementById("passwordForm");
const profileMessageEl = document.getElementById("profileMessage");
const passwordMessageEl = document.getElementById("passwordMessage");
const userMetaEl = document.getElementById("userMeta");
const logoutBtn = document.getElementById("logoutBtn");
const customerEntryEl = document.querySelector('[data-testid="account-to-customer-menu"]');
const merchantEntryEl = document.querySelector('[data-testid="account-to-merchant-dishes"]');

let me;

async function loadMe() {
  me = await requireAuth();
  if (customerEntryEl) {
    customerEntryEl.hidden = me.role !== "CUSTOMER";
  }
  if (merchantEntryEl) {
    merchantEntryEl.hidden = me.role !== "MERCHANT";
  }
  userMetaEl.textContent = `当前用户：${me.username}（${me.role}）`;
  profileForm.displayName.value = me.displayName || "";
  profileForm.phone.value = me.phone || "";
}

profileForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(profileForm);
  try {
    const data = await apiRequest("/api/account/me", {
      method: "PUT",
      body: {
        displayName: String(formData.get("displayName") || "").trim(),
        phone: String(formData.get("phone") || "").trim()
      }
    });
    showMessage(profileMessageEl, "资料已更新", "success");
    me = data;
    userMetaEl.textContent = `当前用户：${me.username}（${me.role}）`;
  } catch (error) {
    showMessage(profileMessageEl, error.message || "更新失败");
  }
});

passwordForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(passwordForm);
  const oldPassword = String(formData.get("oldPassword") || "").trim();
  const newPassword = String(formData.get("newPassword") || "").trim();
  const confirmPassword = String(formData.get("confirmPassword") || "").trim();
  if (newPassword !== confirmPassword) {
    showMessage(passwordMessageEl, "新密码与确认密码不一致");
    return;
  }

  try {
    await apiRequest("/api/account/password", {
      method: "PUT",
      body: { oldPassword, newPassword }
    });
    passwordForm.reset();
    showMessage(passwordMessageEl, "密码修改成功", "success");
  } catch (error) {
    showMessage(passwordMessageEl, error.message || "修改失败");
  }
});

logoutBtn.addEventListener("click", async () => {
  await logout();
});

loadMe();
