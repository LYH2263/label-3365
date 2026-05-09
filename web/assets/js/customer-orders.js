import { apiRequest, showMessage } from "/assets/js/api.js";
import { requireAuth } from "/assets/js/auth.js";
import { formatPrice } from "/assets/js/cart.js";
import { showConfirmDialog } from "/assets/js/dialog.js";

const listEl = document.getElementById("orders");
const messageEl = document.getElementById("message");
const refreshBtn = document.getElementById("refreshBtn");

let orders = [];

async function loadOrders(options = {}) {
  const { showSummary = true } = options;
  try {
    await requireAuth(["CUSTOMER"]);
    orders = await apiRequest("/api/orders");
    renderOrders(orders);
    if (showSummary) {
      showMessage(messageEl, `共 ${orders.length} 笔订单`, "success");
    }
  } catch (error) {
    showMessage(messageEl, error.message || "加载订单失败");
  }
}

function renderOrders(orders) {
  if (!orders.length) {
    listEl.innerHTML = "<p class='muted' data-testid='customer-orders-empty'>暂无订单</p>";
    return;
  }
  listEl.innerHTML = orders
    .map((order) => {
      const itemsHtml = order.items
        .map(
          (item) => `<li>${item.dishNameSnapshot} × ${item.quantity} = ${formatPrice(
            item.priceCentsSnapshot * item.quantity
          )}</li>`
        )
        .join("");
      return `
        <section class="panel" data-testid="customer-order-card-${order.id}">
          <div class="header-bar">
            <div>
              <h3>订单 #${order.id} <span class="badge" data-testid="customer-order-status-${order.id}">${order.status}</span></h3>
              <p class="muted">创建时间：${order.createdAt}</p>
            </div>
            <div class="inline-actions">
              ${
                order.status === "NEW"
                  ? `<button data-action="cancel" data-id="${order.id}" data-testid="customer-order-cancel-${order.id}">取消订单</button>`
                  : ""
              }
            </div>
          </div>
          <p>总金额：${formatPrice(order.totalCents)}</p>
          <ul>${itemsHtml}</ul>
        </section>
      `;
    })
    .join("");
}

listEl.addEventListener("click", async (event) => {
  const target = event.target.closest("button");
  if (!target || target.dataset.action !== "cancel") return;

  const orderId = Number(target.dataset.id);
  const order = orders.find((item) => item.id === orderId);
  if (!order) return;

  const confirmed = await showConfirmDialog(`确认取消订单 #${orderId} 吗？`, {
    title: "取消订单",
    confirmText: "确认取消",
    cancelText: "继续保留"
  });
  if (!confirmed) return;

  try {
    await apiRequest(`/api/orders/${orderId}/status`, {
      method: "PUT",
      body: { status: "CANCELLED" }
    });
    await loadOrders({ showSummary: false });
    showMessage(messageEl, `订单 #${orderId} 已取消`, "success");
  } catch (error) {
    showMessage(messageEl, error.message || "取消订单失败");
  }
});

refreshBtn.addEventListener("click", () => {
  loadOrders({ showSummary: true });
});
loadOrders();
