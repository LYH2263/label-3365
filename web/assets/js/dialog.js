let dialogQueue = Promise.resolve();

export function showAlertDialog(message, options = {}) {
  return enqueueDialog({
    mode: "alert",
    title: options.title || "提示",
    message,
    confirmText: options.confirmText || "确定"
  });
}

export function showConfirmDialog(message, options = {}) {
  return enqueueDialog({
    mode: "confirm",
    title: options.title || "请确认",
    message,
    confirmText: options.confirmText || "确认",
    cancelText: options.cancelText || "取消"
  });
}

export function showPromptDialog(message, options = {}) {
  return enqueueDialog({
    mode: "prompt",
    title: options.title || "请输入",
    message,
    confirmText: options.confirmText || "确定",
    cancelText: options.cancelText || "取消",
    inputType: options.inputType || "text",
    placeholder: options.placeholder || "",
    defaultValue: String(options.defaultValue ?? "")
  });
}

export function showFormDialog(options = {}) {
  return enqueueDialog({
    mode: "form",
    title: options.title || "编辑信息",
    message: options.message || "",
    confirmText: options.confirmText || "保存",
    cancelText: options.cancelText || "取消",
    fields: Array.isArray(options.fields) ? options.fields : []
  });
}

function enqueueDialog(config) {
  const task = () => openDialog(config);
  const next = dialogQueue.then(task, task);
  dialogQueue = next.catch(() => {});
  return next;
}

function openDialog(config) {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "app-dialog-overlay";
    overlay.dataset.testid = "app-dialog";

    const dialog = document.createElement("div");
    dialog.className = "app-dialog";
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-labelledby", "app-dialog-title");
    dialog.setAttribute("aria-describedby", "app-dialog-message");

    const titleEl = document.createElement("h3");
    titleEl.id = "app-dialog-title";
    titleEl.className = "app-dialog-title";
    titleEl.dataset.testid = "app-dialog-title";
    titleEl.textContent = config.title;

    const messageEl = document.createElement("p");
    messageEl.id = "app-dialog-message";
    messageEl.className = "app-dialog-message";
    messageEl.dataset.testid = "app-dialog-message";
    messageEl.textContent = String(config.message || "");

    dialog.appendChild(titleEl);
    dialog.appendChild(messageEl);

    const actions = document.createElement("div");
    actions.className = "app-dialog-actions";

    const formItems = [];
    let inputEl = null;
    if (config.mode === "prompt") {
      inputEl = document.createElement("input");
      inputEl.type = config.inputType;
      inputEl.className = "app-dialog-input";
      inputEl.setAttribute("data-testid", "app-dialog-input");
      inputEl.placeholder = config.placeholder;
      inputEl.value = config.defaultValue;
      inputEl.autocomplete = "off";
      dialog.appendChild(inputEl);
    }
    if (config.mode === "form") {
      const formEl = document.createElement("div");
      formEl.className = "app-dialog-form";
      formEl.setAttribute("data-testid", "app-dialog-form");

      config.fields.forEach((field, index) => {
        const name = String(field.name || `field_${index + 1}`);
        const type = field.type || "text";
        const wrapper = document.createElement("div");
        wrapper.className = "app-dialog-field";
        wrapper.setAttribute("data-testid", `app-dialog-field-${name}`);

        const label = document.createElement("label");
        label.className = "app-dialog-field-label";
        label.textContent = String(field.label || name);

        let control;
        if (type === "textarea") {
          control = document.createElement("textarea");
        } else {
          control = document.createElement("input");
          control.type = type === "checkbox" ? "checkbox" : type;
        }

        control.className = "app-dialog-field-input";
        control.name = name;
        control.setAttribute("data-testid", `app-dialog-input-${name}`);
        if (field.placeholder !== undefined && type !== "checkbox") {
          control.placeholder = String(field.placeholder);
        }
        if (field.required) {
          control.required = true;
        }
        if (field.maxlength !== undefined && type !== "checkbox") {
          control.maxLength = Number(field.maxlength);
        }
        if (field.minlength !== undefined && type !== "checkbox") {
          control.minLength = Number(field.minlength);
        }
        if (field.min !== undefined && type !== "checkbox") {
          control.min = String(field.min);
        }
        if (field.max !== undefined && type !== "checkbox") {
          control.max = String(field.max);
        }
        if (field.step !== undefined && type !== "checkbox") {
          control.step = String(field.step);
        }

        if (type === "checkbox") {
          control.checked = Boolean(field.defaultValue);
          wrapper.classList.add("app-dialog-field-checkbox");
          label.prepend(control);
          wrapper.appendChild(label);
        } else {
          control.value = String(field.defaultValue ?? "");
          wrapper.appendChild(label);
          wrapper.appendChild(control);
        }

        formItems.push({ name, type, control });
        formEl.appendChild(wrapper);
      });

      dialog.appendChild(formEl);
    }

    let cancelBtn = null;
    if (config.mode !== "alert") {
      cancelBtn = document.createElement("button");
      cancelBtn.type = "button";
      cancelBtn.className = "secondary";
      cancelBtn.dataset.testid = "app-dialog-cancel";
      cancelBtn.textContent = config.cancelText;
      actions.appendChild(cancelBtn);
    }

    const confirmBtn = document.createElement("button");
    confirmBtn.type = "button";
    confirmBtn.dataset.testid = "app-dialog-confirm";
    confirmBtn.textContent = config.confirmText;
    actions.appendChild(confirmBtn);

    dialog.appendChild(actions);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const teardown = (result) => {
      document.removeEventListener("keydown", onKeydown);
      confirmBtn.removeEventListener("click", onConfirm);
      cancelBtn?.removeEventListener("click", onCancel);
      overlay.removeEventListener("click", onOverlayClick);
      overlay.remove();
      document.body.style.overflow = previousOverflow;
      resolve(result);
    };

    const onConfirm = () => {
      if (config.mode === "prompt") {
        teardown(inputEl ? inputEl.value : "");
        return;
      }
      if (config.mode === "form") {
        const values = {};
        formItems.forEach((item) => {
          values[item.name] = item.type === "checkbox" ? item.control.checked : item.control.value;
        });
        teardown(values);
        return;
      }
      teardown(true);
    };
    const onCancel = () => teardown(false);
    const onOverlayClick = (event) => {
      if (event.target !== overlay) return;
      if (config.mode !== "alert") {
        teardown(false);
      }
    };
    const onKeydown = (event) => {
      if (event.key === "Escape" && config.mode !== "alert") {
        event.preventDefault();
        onCancel();
        return;
      }
      if (event.key === "Enter") {
        const isTextarea = event.target instanceof HTMLTextAreaElement;
        if (config.mode === "form" && isTextarea && !event.ctrlKey && !event.metaKey) {
          return;
        }
        event.preventDefault();
        onConfirm();
      }
    };

    confirmBtn.addEventListener("click", onConfirm);
    cancelBtn?.addEventListener("click", onCancel);
    overlay.addEventListener("click", onOverlayClick);
    document.addEventListener("keydown", onKeydown);
    if (inputEl) {
      inputEl.focus();
      inputEl.select();
    } else if (config.mode === "form") {
      const firstInput = formItems.find((item) => item.type !== "checkbox");
      if (firstInput) {
        firstInput.control.focus();
        if (typeof firstInput.control.select === "function") {
          firstInput.control.select();
        }
      } else {
        confirmBtn.focus();
      }
    } else {
      confirmBtn.focus();
    }
  });
}
