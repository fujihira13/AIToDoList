(() => {
  const dataScript = document.getElementById("initial-data");
  let initial = {};
  if (dataScript) {
    try {
      initial = JSON.parse(dataScript.textContent || "{}");
    } catch (error) {
      console.warn("初期データの解析に失敗しました", error);
    }
  }

  const state = {
    tasks: initial.tasks || [],
    staff: initial.staff || [],
    labels: initial.quadrant_labels || {},
    faces: initial.quadrant_faces || {},
    statusColors: initial.status_colors || {},
  };

  const priorityClassMap = {
    "高": "high",
    "中": "medium",
    "低": "low",
  };

  const boardEl = document.getElementById("board");
  const staffEl = document.getElementById("staffList");
  const addBtn = document.getElementById("addTaskBtn");
  const dialog = document.getElementById("taskDialog");
  const form = document.getElementById("taskForm");
  const formTitle = document.getElementById("taskFormTitle");
  const deleteBtn = document.getElementById("deleteTaskBtn");
  const cancelBtn = document.getElementById("cancelTaskBtn");
  const formStatus = document.getElementById("formStatus");
  const ownerDept = document.getElementById("ownerDept");
  const confirmDialog = document.getElementById("confirmDialog");
  const confirmDeleteBtn = document.getElementById("confirmDeleteBtn");
  const confirmCancelBtn = document.getElementById("confirmCancelBtn");

  let editingId = null;
  let deleteTargetId = null;

  const quadrants = [1, 2, 3, 4];

  function sortTasks(list) {
    return [...list].sort((a, b) => {
      const qa = a.quadrant || 4;
      const qb = b.quadrant || 4;
      if (qa !== qb) return qa - qb;
      const da = a.due_date || "9999-12-31";
      const db = b.due_date || "9999-12-31";
      return da.localeCompare(db);
    });
  }

  function renderBoard() {
    if (!boardEl) return;
    boardEl.innerHTML = "";
    quadrants.forEach((quadrant) => {
      const container = document.createElement("section");
      container.className = "board__quadrant";
      container.dataset.quadrant = String(quadrant);
      container.addEventListener("dragover", (event) => {
        event.preventDefault();
        container.classList.add("board__quadrant--hover");
      });
      container.addEventListener("dragleave", () => {
        container.classList.remove("board__quadrant--hover");
      });
      container.addEventListener("drop", (event) => {
        event.preventDefault();
        container.classList.remove("board__quadrant--hover");
        const taskId = Number(event.dataTransfer?.getData("text/task-id"));
        if (taskId) {
          moveTask(taskId, quadrant);
        }
      });

      const header = document.createElement("div");
      header.className = "quadrant__header";
      const face = state.faces[quadrant] || {};
      header.innerHTML = `
        <div>
          <p class="quadrant__number">第${quadrant}象限</p>
          <h2>${state.labels[quadrant] || ""}</h2>
          <p class="quadrant__face">${face.emoji || ""} ${face.caption || ""}</p>
        </div>
        <span class="quadrant__count"></span>
      `;
      const counter = header.querySelector(".quadrant__count");
      container.appendChild(header);

      const body = document.createElement("div");
      body.className = "quadrant__body";

      const tasks = state.tasks.filter((task) => task.quadrant === quadrant);
      counter.textContent = `${tasks.length} 件`;

      if (tasks.length === 0) {
        const empty = document.createElement("p");
        empty.className = "task-card task-card--empty";
        empty.textContent = "タスクはまだありません";
        body.appendChild(empty);
      } else {
        sortTasks(tasks).forEach((task) => {
          body.appendChild(buildTaskCard(task));
        });
      }

      container.appendChild(body);
      boardEl.appendChild(container);
    });
  }

  function buildTaskCard(task) {
    const card = document.createElement("article");
    card.className = "task-card";
    card.draggable = true;
    card.dataset.taskId = String(task.id);
    card.addEventListener("dragstart", (event) => {
      event.dataTransfer?.setData("text/task-id", String(task.id));
      event.dataTransfer?.setDragImage(card, 20, 20);
    });
    card.addEventListener("click", () => openForm(task.id));

    const owner = findStaff(task.owner_id);
    const statusClass = state.statusColors[task.status] || "badge--todo";
    const priorityClass = priorityClassMap[task.priority] || "low";

    card.innerHTML = `
      <header class="task-card__header">
        <span class="task-card__priority task-card__priority--${priorityClass}">
          ${task.priority || ""}
        </span>
        <span class="badge ${statusClass}">${task.status || ""}</span>
      </header>
      <h3 class="task-card__title">${task.title}</h3>
      <dl class="task-card__meta">
        <div>
          <dt>担当者</dt>
          <dd>
            ${renderAvatar(owner)}
            ${owner ? owner.name : "-"}
            ${owner && owner.department ? `(${owner.department})` : ""}
          </dd>
        </div>
        <div>
          <dt>期限</dt>
          <dd>${formatDate(task.due_date)}</dd>
        </div>
      </dl>
    `;
    return card;
  }

  function renderAvatar(staff) {
    if (!staff) return "";
    if (staff.photo) {
      return `<img src="/static/avatars/${staff.photo}" alt="${staff.name}" class="avatar" />`;
    }
    const initial = staff.name ? staff.name.charAt(0) : "?";
    return `<span class="avatar">${initial}</span>`;
  }

  function renderStaff() {
    if (!staffEl) return;
    staffEl.innerHTML = "";
    state.staff.forEach((person) => {
      const item = document.createElement("article");
      item.className = "staff-card";
      item.innerHTML = `
        ${renderAvatar(person)}
        <div>
          <p class="staff-card__name">${person.name}</p>
          <p class="staff-card__dept">${person.department || ""}</p>
        </div>
      `;
      staffEl.appendChild(item);
    });
  }

  function findStaff(id) {
    return state.staff.find((member) => member.id === id);
  }

  function openForm(taskId = null) {
    editingId = taskId;
    resetFormStatus();
    if (!form) return;
    if (taskId) {
      const task = state.tasks.find((item) => item.id === taskId);
      if (!task) return;
      formTitle.textContent = formTitle.dataset.editLabel || "タスクを更新";
      form.task_id.value = task.id;
      form.title.value = task.title || "";
      form.description.value = task.description || "";
      form.owner_id.value = task.owner_id || "";
      form.created_by.value = task.created_by || "";
      form.status.value = task.status || "";
      form.priority.value = task.priority || "";
      form.quadrant.value = task.quadrant || 1;
      form.due_date.value = task.due_date || "";
    } else {
      formTitle.textContent = formTitle.dataset.createLabel || "タスクを作成";
      form.reset();
      editingId = null;
    }
    updateOwnerHint();
    if (typeof dialog?.showModal === "function") {
      dialog.showModal();
    } else {
      dialog?.classList.add("modal--open");
    }
    deleteBtn.style.display = editingId ? "inline-flex" : "none";
  }

  function closeForm() {
    editingId = null;
    if (typeof dialog?.close === "function") {
      dialog.close();
    } else {
      dialog?.classList.remove("modal--open");
    }
  }

  function resetFormStatus(message = "") {
    if (formStatus) {
      formStatus.textContent = message;
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!form) return;
    const payload = {
      title: form.title.value.trim(),
      description: form.description.value.trim() || null,
      owner_id: Number(form.owner_id.value),
      created_by: form.created_by.value.trim() || null,
      due_date: form.due_date.value || null,
      status: form.status.value,
      priority: form.priority.value,
      quadrant: Number(form.quadrant.value),
    };
    if (!payload.title) {
      resetFormStatus("タイトルは必須です");
      return;
    }
    if (!payload.owner_id) {
      resetFormStatus("担当者は必須です");
      return;
    }
    const url = editingId ? `/api/tasks/${editingId}` : "/api/tasks";
    const method = editingId ? "PUT" : "POST";
    try {
      const data = await request(url, {
        method,
        body: JSON.stringify(payload),
      });
      if (editingId) {
        state.tasks = state.tasks.map((task) => (task.id === data.id ? data : task));
      } else {
        state.tasks = [...state.tasks, data];
      }
      renderBoard();
      closeForm();
    } catch (error) {
      resetFormStatus(error.message || "保存に失敗しました");
    }
  }

  function updateOwnerHint() {
    if (!ownerDept || !form) return;
    const staff = findStaff(Number(form.owner_id.value));
    if (!staff) {
      ownerDept.textContent = "";
      return;
    }
    ownerDept.textContent = staff.department ? `所属: ${staff.department}` : "";
  }

  function confirmDelete(taskId) {
    deleteTargetId = taskId;
    if (typeof confirmDialog?.showModal === "function") {
      confirmDialog.showModal();
    } else {
      confirmDialog?.classList.add("modal--open");
    }
  }

  function closeConfirm() {
    deleteTargetId = null;
    if (typeof confirmDialog?.close === "function") {
      confirmDialog.close();
    } else {
      confirmDialog?.classList.remove("modal--open");
    }
  }

  async function handleDelete() {
    if (!deleteTargetId) return;
    try {
      await request(`/api/tasks/${deleteTargetId}`, { method: "DELETE" });
      state.tasks = state.tasks.filter((task) => task.id !== deleteTargetId);
      renderBoard();
      closeConfirm();
      closeForm();
    } catch (error) {
      resetFormStatus(error.message || "削除に失敗しました");
      closeConfirm();
    }
  }

  async function moveTask(taskId, quadrant) {
    try {
      const data = await request(`/api/tasks/${taskId}/quadrant`, {
        method: "PATCH",
        body: JSON.stringify({ quadrant }),
      });
      state.tasks = state.tasks.map((task) => (task.id === data.id ? data : task));
      renderBoard();
    } catch (error) {
      resetFormStatus(error.message || "タスクの移動に失敗しました");
    }
  }

  async function request(url, options = {}) {
    const response = await fetch(url, {
      headers: { "Content-Type": "application/json", ...(options.headers || {}) },
      ...options,
    });
    if (!response.ok) {
      let message = "リクエストに失敗しました";
      try {
        const payload = await response.json();
        if (typeof payload.detail === "string") message = payload.detail;
      } catch (_) {
        // ignore
      }
      throw new Error(message);
    }
    if (response.status === 204) return null;
    return response.json();
  }

  function formatDate(value) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString("ja-JP", { month: "short", day: "numeric" });
  }

  // Event wiring
  addBtn?.addEventListener("click", () => openForm(null));
  cancelBtn?.addEventListener("click", closeForm);
  form?.addEventListener("submit", handleSubmit);
  form?.owner_id?.addEventListener("change", updateOwnerHint);
  deleteBtn?.addEventListener("click", () => {
    if (editingId) {
      confirmDelete(editingId);
    }
  });
  confirmDeleteBtn?.addEventListener("click", handleDelete);
  confirmCancelBtn?.addEventListener("click", closeConfirm);

  renderBoard();
  renderStaff();
})();
