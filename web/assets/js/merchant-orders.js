import { apiRequest, showMessage } from "/assets/js/api.js";
import { requireAuth } from "/assets/js/auth.js";
import { formatPrice } from "/assets/js/cart.js";

const listEl = document.getElementById("orders");
const filterEl = document.getElementById("statusFilter");
const refreshBtn = document.getElementById("refreshBtn");
const messageEl = document.getElementById("message");

let orders = [];

function statusOptions(selected) {
  const statuses = ["NEW", "CONFIRMED", "CANCELLED", "DONE"];
  return statuses
    .map((status) => `<option value="${status}" ${selected === status ? "selected" : ""}>${status}</option>`)
    .join("");
}

function renderOrders() {
  if (!orders.length) {
    listEl.innerHTML = "<p class='muted' data-testid='merchant-orders-empty'>暂无订单</p>";
    return;
  }

  listEl.innerHTML = orders
    .map((order) => {
      const items = order.items
        .map(
          (item) => `<li>${item.dishNameSnapshot} × ${item.quantity} = ${formatPrice(
            item.priceCentsSnapshot * item.quantity
          )}</li>`
        )
        .join("");

      return `
      <section class="panel" data-testid="merchant-order-card-${order.id}">
        <div class="header-bar">
          <div>
            <h3>订单 #${order.id} <span class="badge">${order.status}</span></h3>
            <p class="muted">顾客：${order.customerDisplayName || "-"}（${order.customerUsername || "-"}）</p>
            <p class="muted">创建时间：${order.createdAt}</p>
          </div>
          <div class="inline-actions">
            <select data-action="status" data-id="${order.id}" data-testid="merchant-order-status-${order.id}">
              ${statusOptions(order.status)}
            </select>
            <button data-action="update" data-id="${order.id}" data-testid="merchant-order-update-${order.id}">更新状态</button>
          </div>
        </div>
        <p>总金额：${formatPrice(order.totalCents)}</p>
        <ul>${items}</ul>
      </section>
      `;
    })
    .join("");
}

async function loadOrders() {
  await requireAuth(["MERCHANT"]);
  const status = filterEl.value;
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  orders = await apiRequest(`/api/orders${query}`);
  renderOrders();
  showMessage(messageEl, `共 ${orders.length} 笔订单`, "success");
}

listEl.addEventListener("click", async (event) => {
  const target = event.target.closest("button");
  if (!target || target.dataset.action !== "update") return;
  const orderId = Number(target.dataset.id);
  const select = listEl.querySelector(`select[data-id="${orderId}"]`);
  if (!select) return;

  try {
    const nextStatus = select.value;
    await apiRequest(`/api/orders/${orderId}/status`, {
      method: "PUT",
      body: { status: nextStatus }
    });
    if (filterEl.value && filterEl.value !== nextStatus) {
      filterEl.value = "";
    }
    showMessage(messageEl, `订单 #${orderId} 状态更新成功`, "success");
    await loadOrders();
  } catch (error) {
    showMessage(messageEl, error.message || "状态更新失败");
  }
});

refreshBtn.addEventListener("click", loadOrders);
filterEl.addEventListener("change", loadOrders);
loadOrders().catch((error) => {
  showMessage(messageEl, error.message || "加载订单失败");
});
