import { apiRequest, showMessage } from "/assets/js/api.js";
import { requireAuth } from "/assets/js/auth.js";
import {
  addToCart,
  clearCart,
  formatPrice,
  loadCart,
  removeItem,
  saveCart,
  setQuantity,
  toOrderItems,
  totalCents
} from "/assets/js/cart.js";

const dishesBody = document.getElementById("dishesBody");
const cartBody = document.getElementById("cartBody");
const cartTotalEl = document.getElementById("cartTotal");
const messageEl = document.getElementById("message");
const submitBtn = document.getElementById("submitOrderBtn");

let dishes = [];
let cart = loadCart();

function renderDishes() {
  dishesBody.innerHTML = dishes
    .map(
      (dish) => `
      <tr data-testid="dish-row-${dish.id}">
        <td>${dish.name}</td>
        <td>${formatPrice(dish.priceCents)}</td>
        <td>${dish.description || "-"}</td>
        <td><button data-action="add" data-id="${dish.id}" data-testid="dish-add-${dish.id}">加入购物车</button></td>
      </tr>
    `
    )
    .join("");
}

function renderCart() {
  if (!cart.length) {
    cartBody.innerHTML = `<tr data-testid="cart-empty"><td colspan="5" class="muted">购物车为空</td></tr>`;
    cartTotalEl.textContent = formatPrice(0);
    return;
  }

  cartBody.innerHTML = cart
    .map(
      (item) => `
      <tr data-testid="cart-row-${item.dishId}">
        <td>${item.name}</td>
        <td>${formatPrice(item.priceCents)}</td>
        <td>
          <div class="inline-actions">
            <button data-action="decrease" data-id="${item.dishId}" class="secondary" data-testid="cart-decrease-${item.dishId}">-</button>
            <span data-testid="cart-quantity-${item.dishId}">${item.quantity}</span>
            <button data-action="increase" data-id="${item.dishId}" data-testid="cart-increase-${item.dishId}">+</button>
          </div>
        </td>
        <td data-testid="cart-subtotal-${item.dishId}">${formatPrice(item.priceCents * item.quantity)}</td>
        <td><button data-action="remove" data-id="${item.dishId}" class="danger" data-testid="cart-remove-${item.dishId}">移除</button></td>
      </tr>
    `
    )
    .join("");

  cartTotalEl.textContent = formatPrice(totalCents(cart));
}

async function loadDishes() {
  await requireAuth(["CUSTOMER"]);
  dishes = await apiRequest("/api/dishes");
  renderDishes();
  renderCart();
}

dishesBody.addEventListener("click", (event) => {
  const target = event.target.closest("button");
  if (!target) return;
  const id = Number(target.dataset.id);
  const dish = dishes.find((d) => d.id === id);
  if (!dish) return;
  cart = addToCart(cart, dish);
  saveCart(cart);
  renderCart();
  showMessage(messageEl, "已加入购物车", "success");
});

cartBody.addEventListener("click", (event) => {
  const target = event.target.closest("button");
  if (!target) return;
  const id = Number(target.dataset.id);
  const action = target.dataset.action;
  const current = cart.find((item) => item.dishId === id);
  if (!current) return;

  if (action === "increase") {
    cart = setQuantity(cart, id, current.quantity + 1);
  }
  if (action === "decrease") {
    cart = setQuantity(cart, id, current.quantity - 1);
  }
  if (action === "remove") {
    cart = removeItem(cart, id);
  }

  saveCart(cart);
  renderCart();
});

submitBtn.addEventListener("click", async () => {
  if (!cart.length) {
    showMessage(messageEl, "购物车为空");
    return;
  }

  try {
    const data = await apiRequest("/api/orders", {
      method: "POST",
      body: { items: toOrderItems(cart) }
    });
    clearCart();
    cart = [];
    renderCart();
    showMessage(messageEl, `下单成功，订单号 ${data.orderId}`, "success");
    setTimeout(() => {
      window.location.href = "/customer/orders.html";
    }, 500);
  } catch (error) {
    showMessage(messageEl, error.message || "下单失败");
  }
});

loadDishes().catch((error) => {
  showMessage(messageEl, error.message || "加载菜品失败");
});
