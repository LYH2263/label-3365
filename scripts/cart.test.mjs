import assert from "node:assert/strict";
import {
  addToCart,
  loadCart,
  saveCart,
  setQuantity,
  removeItem,
  totalCents,
  toOrderItems
} from "../web/assets/js/cart.js";

class MockStorage {
  constructor() {
    this.map = new Map();
  }

  getItem(key) {
    return this.map.has(key) ? this.map.get(key) : null;
  }

  setItem(key, value) {
    this.map.set(key, value);
  }

  removeItem(key) {
    this.map.delete(key);
  }
}

const storage = new MockStorage();
let cart = loadCart(storage);
assert.equal(cart.length, 0);

cart = addToCart(cart, { id: 11, name: "宫保鸡丁", priceCents: 3200 });
cart = addToCart(cart, { id: 11, name: "宫保鸡丁", priceCents: 3200 });
cart = addToCart(cart, { id: 22, name: "鱼香肉丝", priceCents: 2800 });
assert.equal(cart.length, 2);
assert.equal(totalCents(cart), 9200);

cart = setQuantity(cart, 11, 3);
assert.equal(totalCents(cart), 12400);

saveCart(cart, storage);
const recovered = loadCart(storage);
assert.equal(recovered.length, 2);
assert.equal(recovered.find((item) => item.dishId === 11).quantity, 3);

const removed = removeItem(recovered, 22);
assert.equal(removed.length, 1);
assert.deepEqual(toOrderItems(removed), [{ dishId: 11, quantity: 3 }]);

console.log("cart test passed");
