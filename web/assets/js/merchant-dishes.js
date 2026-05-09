import { apiRequest, showMessage } from "/assets/js/api.js";
import { requireAuth } from "/assets/js/auth.js";
import { formatPrice } from "/assets/js/cart.js";
import { showConfirmDialog, showFormDialog } from "/assets/js/dialog.js";

const createForm = document.getElementById("createDishForm");
const queryForm = document.getElementById("dishQueryForm");
const listBody = document.getElementById("dishListBody");
const messageEl = document.getElementById("message");
const refreshBtn = document.getElementById("refreshBtn");
const resetFilterBtn = document.getElementById("resetFilterBtn");

let dishes = [];

function parseYuanToCents(value) {
  const text = String(value ?? "").trim();
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return Number.NaN;
  return Math.round(Number(text) * 100);
}

function centsToYuanText(cents) {
  return (Number(cents) / 100).toFixed(2);
}

function getFilters() {
  const formData = new FormData(queryForm);
  return {
    keyword: String(formData.get("keyword") || "").trim(),
    isAvailable: String(formData.get("isAvailable") || "all")
  };
}

function buildQueryString(filters) {
  const params = new URLSearchParams({ scope: "all" });
  if (filters.keyword) {
    params.set("keyword", filters.keyword);
  }
  if (filters.isAvailable !== "all") {
    params.set("isAvailable", filters.isAvailable);
  }
  return `?${params.toString()}`;
}

function hasActiveFilters(filters) {
  return Boolean(filters.keyword) || filters.isAvailable !== "all";
}

function renderList(filters = getFilters()) {
  if (!dishes.length) {
    const emptyText = hasActiveFilters(filters) ? "暂无符合条件的菜品" : "暂无菜品";
    listBody.innerHTML = `<tr data-testid="merchant-dishes-empty"><td colspan="6" class="muted">${emptyText}</td></tr>`;
    return;
  }

  listBody.innerHTML = dishes
    .map(
      (dish) => `
      <tr data-testid="merchant-dish-row-${dish.id}">
        <td data-testid="merchant-dish-id-${dish.id}">${dish.id}</td>
        <td data-testid="merchant-dish-name-${dish.id}">${dish.name}</td>
        <td data-testid="merchant-dish-price-${dish.id}">${formatPrice(dish.priceCents)}</td>
        <td data-testid="merchant-dish-desc-${dish.id}">${dish.description || "-"}</td>
        <td data-testid="merchant-dish-status-${dish.id}">${dish.isAvailable ? "可售" : "下架"}</td>
        <td>
          <div class="inline-actions">
            <button data-action="edit" data-id="${dish.id}" data-testid="merchant-dish-edit-${dish.id}">编辑</button>
            <button data-action="toggle" data-id="${dish.id}" class="secondary" data-testid="merchant-dish-toggle-${dish.id}">${
              dish.isAvailable ? "下架" : "上架"
            }</button>
            <button data-action="delete" data-id="${dish.id}" class="danger" data-testid="merchant-dish-delete-${dish.id}">删除</button>
          </div>
        </td>
      </tr>
    `
    )
    .join("");
}

async function fetchDishes(options = {}) {
  const { showSummary = false } = options;
  await requireAuth(["MERCHANT"]);
  const filters = getFilters();
  dishes = await apiRequest(`/api/dishes${buildQueryString(filters)}`);
  renderList(filters);
  if (showSummary) {
    showMessage(messageEl, `共 ${dishes.length} 道菜品`, "success");
  }
}

createForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(createForm);
  try {
    await apiRequest("/api/dishes", {
      method: "POST",
      body: {
        name: String(formData.get("name") || "").trim(),
        priceCents: parseYuanToCents(formData.get("priceYuan")),
        description: String(formData.get("description") || "").trim(),
        isAvailable: formData.get("isAvailable") === "on"
      }
    });
    createForm.reset();
    showMessage(messageEl, "新增菜品成功", "success");
    await fetchDishes();
  } catch (error) {
    showMessage(messageEl, error.message || "新增失败");
  }
});

listBody.addEventListener("click", async (event) => {
  const target = event.target.closest("button");
  if (!target) return;

  const id = Number(target.dataset.id);
  const dish = dishes.find((item) => item.id === id);
  if (!dish) return;

  if (target.dataset.action === "delete") {
    const confirmed = await showConfirmDialog(`确认删除菜品「${dish.name}」吗？删除后不可恢复。`, {
      title: "删除菜品",
      confirmText: "删除",
      cancelText: "取消"
    });
    if (!confirmed) return;

    try {
      await apiRequest(`/api/dishes/${id}`, {
        method: "DELETE"
      });
      showMessage(messageEl, "菜品已删除", "success");
      await fetchDishes();
    } catch (error) {
      showMessage(messageEl, error.message || "删除失败");
    }
    return;
  }

  if (target.dataset.action === "toggle") {
    try {
      await apiRequest(`/api/dishes/${id}`, {
        method: "PUT",
        body: {
          name: dish.name,
          priceCents: dish.priceCents,
          description: dish.description,
          isAvailable: !dish.isAvailable
        }
      });
      showMessage(messageEl, `菜品已${dish.isAvailable ? "下架" : "上架"}`, "success");
      await fetchDishes();
    } catch (error) {
      showMessage(messageEl, error.message || "更新失败");
    }
  }

  if (target.dataset.action === "edit") {
    const formValues = await showFormDialog({
      title: "编辑菜品",
      message: "请确认并修改以下字段",
      confirmText: "保存",
      fields: [
        {
          name: "name",
          label: "菜品名称",
          defaultValue: dish.name,
          maxlength: 128
        },
        {
          name: "priceYuan",
          label: "价格（元）",
          placeholder: "例如：18.00",
          defaultValue: centsToYuanText(dish.priceCents)
        },
        {
          name: "description",
          label: "描述",
          type: "textarea",
          defaultValue: dish.description || "",
          maxlength: 512
        },
        {
          name: "isAvailable",
          label: "上架可售",
          type: "checkbox",
          defaultValue: dish.isAvailable
        }
      ]
    });
    if (!formValues) return;
    try {
      await apiRequest(`/api/dishes/${id}`, {
        method: "PUT",
        body: {
          name: String(formValues.name || "").trim(),
          priceCents: parseYuanToCents(formValues.priceYuan),
          description: String(formValues.description || "").trim(),
          isAvailable: Boolean(formValues.isAvailable)
        }
      });
      showMessage(messageEl, "菜品编辑成功", "success");
      await fetchDishes();
    } catch (error) {
      showMessage(messageEl, error.message || "编辑失败");
    }
  }
});

queryForm.addEventListener("submit", (event) => {
  event.preventDefault();
  fetchDishes({ showSummary: true }).catch((error) => {
    showMessage(messageEl, error.message || "查询菜品失败");
  });
});

resetFilterBtn.addEventListener("click", () => {
  queryForm.reset();
  fetchDishes({ showSummary: true }).catch((error) => {
    showMessage(messageEl, error.message || "重置筛选失败");
  });
});

refreshBtn.addEventListener("click", () => {
  fetchDishes({ showSummary: true }).catch((error) => {
    showMessage(messageEl, error.message || "加载菜品失败");
  });
});

fetchDishes().catch((error) => {
  showMessage(messageEl, error.message || "加载菜品失败");
});
