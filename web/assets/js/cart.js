const CART_KEY = "chuanzi_cart_v1";

function defaultStorage() {
  if (typeof window !== "undefined" && window.localStorage) {
    return window.localStorage;
  }
  return null;
}

export function loadCart(storage = defaultStorage()) {
  if (!storage) return [];
  const raw = storage.getItem(CART_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

export function saveCart(items, storage = defaultStorage()) {
  if (!storage) return;
  storage.setItem(CART_KEY, JSON.stringify(items));
}

export function clearCart(storage = defaultStorage()) {
  if (!storage) return;
  storage.removeItem(CART_KEY);
}

export function addToCart(items, dish) {
  const next = [...items];
  const idx = next.findIndex((item) => item.dishId === dish.id);
  if (idx >= 0) {
    next[idx] = { ...next[idx], quantity: next[idx].quantity + 1 };
  } else {
    next.push({
      dishId: dish.id,
      name: dish.name,
      priceCents: dish.priceCents,
      quantity: 1
    });
  }
  return next;
}

export function setQuantity(items, dishId, quantity) {
  if (quantity <= 0) {
    return items.filter((item) => item.dishId !== dishId);
  }
  return items.map((item) =>
    item.dishId === dishId ? { ...item, quantity } : item
  );
}

export function removeItem(items, dishId) {
  return items.filter((item) => item.dishId !== dishId);
}

export function totalCents(items) {
  return items.reduce((sum, item) => sum + item.priceCents * item.quantity, 0);
}

export function toOrderItems(items) {
  return items.map((item) => ({
    dishId: item.dishId,
    quantity: item.quantity
  }));
}

export function formatPrice(cents) {
  return `¥${(cents / 100).toFixed(2)}`;
}
