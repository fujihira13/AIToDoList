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
  const addStaffBtn = document.getElementById("addStaffBtn");
  const dialog = document.getElementById("taskDialog");
  const staffDialog = document.getElementById("staffDialog");
  const form = document.getElementById("taskForm");
  const staffForm = document.getElementById("staffForm");
  const formTitle = document.getElementById("taskFormTitle");
  const deleteBtn = document.getElementById("deleteTaskBtn");
  const cancelBtn = document.getElementById("cancelTaskBtn");
  const cancelStaffBtn = document.getElementById("cancelStaffBtn");
  const formStatus = document.getElementById("formStatus");
  const staffFormStatus = document.getElementById("staffFormStatus");
  const ownerDept = document.getElementById("ownerDept");
  const confirmDialog = document.getElementById("confirmDialog");
  const confirmDeleteBtn = document.getElementById("confirmDeleteBtn");
  const confirmCancelBtn = document.getElementById("confirmCancelBtn");
  const tabBtns = document.querySelectorAll(".tab-btn");
  const tabPanels = document.querySelectorAll(".tab-panel");
  const quadrantOverviewEl = document.getElementById("quadrantOverview");
  const staffDistributionEl = document.getElementById("staffDistribution");
  const dangerGaugeEl = document.getElementById("dangerGauge");
  const dangerStaffListEl = document.getElementById("dangerStaffList");
  const dangerListEl = document.getElementById("dangerList");

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
    const quadrant = task.quadrant || 1;

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
            ${renderAvatar(owner, quadrant)}
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

  function renderAvatar(staff, quadrant = null) {
    if (!staff) return "";
    
    // 象限が指定されている場合、その象限用の画像を使用
    let photo = null;
    if (quadrant && staff[`photo_q${quadrant}`]) {
      photo = staff[`photo_q${quadrant}`];
    } else if (staff.photo) {
      // 後方互換性のため、photoフィールドも確認
      photo = staff.photo;
    }
    
    if (photo) {
      return `<img src="/static/avatars/${photo}" alt="${staff.name}" class="avatar" />`;
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
      // プレビュー画面が表示されている場合は更新
      if (document.getElementById("previewTab")?.classList.contains("tab-panel--active")) {
        renderPreview();
      }
      // デンジャーリストが表示されている場合は更新
      if (document.getElementById("dangerTab")?.classList.contains("tab-panel--active")) {
        renderDangerList();
      }
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
      // プレビュー画面が表示されている場合は更新
      if (document.getElementById("previewTab")?.classList.contains("tab-panel--active")) {
        renderPreview();
      }
      // デンジャーリストが表示されている場合は更新
      if (document.getElementById("dangerTab")?.classList.contains("tab-panel--active")) {
        renderDangerList();
      }
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
      // プレビュー画面が表示されている場合は更新
      if (document.getElementById("previewTab")?.classList.contains("tab-panel--active")) {
        renderPreview();
      }
      // デンジャーリストが表示されている場合は更新
      if (document.getElementById("dangerTab")?.classList.contains("tab-panel--active")) {
        renderDangerList();
      }
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

  // タブ切り替え機能
  function switchTab(tabName) {
    tabBtns.forEach((btn) => {
      if (btn.dataset.tab === tabName) {
        btn.classList.add("tab-btn--active");
      } else {
        btn.classList.remove("tab-btn--active");
      }
    });
    tabPanels.forEach((panel) => {
      if (panel.id === `${tabName}Tab`) {
        panel.classList.add("tab-panel--active");
      } else {
        panel.classList.remove("tab-panel--active");
      }
    });
    if (tabName === "preview") {
      renderPreview();
    } else if (tabName === "danger") {
      renderDangerList();
    }
  }

  // プレビュー画面のレンダリング
  function renderPreview() {
    renderQuadrantOverview();
    renderStaffDistribution();
  }

  // 象限概要の表示（2x2マトリクス形式）
  function renderQuadrantOverview() {
    if (!quadrantOverviewEl) return;
    quadrantOverviewEl.innerHTML = "";
    
    // 象限ごとのアクションラベル（画像に合わせた表現）
    const actionLabels = {
      1: "やる",
      2: "予定する",
      3: "任せる",
      4: "削除する",
    };
    
    // 象限の順序を2x2グリッドに合わせて調整（1=左上, 2=右上, 3=左下, 4=右下）
    const quadrantOrder = [1, 2, 3, 4];
    
    quadrantOrder.forEach((quadrant) => {
      const tasks = state.tasks.filter((task) => task.quadrant === quadrant);
      const face = state.faces[quadrant] || {};
      const label = state.labels[quadrant] || "";
      const action = actionLabels[quadrant] || "";
      
      // 職員別のタスク数を集計（重複を避けるため、職員IDをキーに）
      const staffMap = new Map();
      tasks.forEach((task) => {
        const owner = findStaff(task.owner_id);
        if (owner) {
          if (!staffMap.has(owner.id)) {
            staffMap.set(owner.id, { staff: owner, count: 0 });
          }
          staffMap.get(owner.id).count++;
        }
      });
      
      // 職員リストを配列に変換してソート（タスク数が多い順）
      const staffList = Array.from(staffMap.values()).sort((a, b) => b.count - a.count);
      
      const summary = document.createElement("div");
      summary.className = "quadrant-summary";
      summary.dataset.quadrant = String(quadrant);
      summary.innerHTML = `
        <div class="quadrant-summary__header">
          <h3 class="quadrant-summary__label">${label}</h3>
          <p class="quadrant-summary__count">${tasks.length}</p>
        </div>
        <div class="quadrant-summary__staff-list">
          ${staffList.length > 0
            ? staffList
                .map(({ staff, count }) => `
                  <div class="quadrant-summary__staff-item">
                    <div class="quadrant-summary__staff-name">
                      ${renderAvatar(staff, quadrant)}
                      <span>${staff.name}</span>
                    </div>
                    <span class="quadrant-summary__staff-count">${count}件</span>
                  </div>
                `)
                .join("")
            : ''}
        </div>
      `;
      quadrantOverviewEl.appendChild(summary);
    });
  }

  // デンジャーリストのレンダリング
  function renderDangerList() {
    renderDangerGauge();
    renderDangerStaffList();
    renderDangerTaskList();
  }

  // デンジャーゲージの表示
  function renderDangerGauge() {
    if (!dangerGaugeEl) return;
    
    const dangerTasks = state.tasks.filter((task) => task.quadrant === 1 && task.status !== "完了");
    const count = dangerTasks.length;
    const isDanger = count >= 3;
    const percentage = Math.min((count / 3) * 100, 100);
    
    dangerGaugeEl.innerHTML = `
      <div class="danger-gauge">
        <div class="danger-gauge__header">
          <h2 class="danger-gauge__title">重要かつ緊急のタスク数</h2>
          <div class="danger-gauge__count">${count}件</div>
        </div>
        <div class="danger-gauge__meter">
          <div class="danger-gauge__fill" style="width: ${percentage}%"></div>
        </div>
        ${isDanger ? '<div class="danger-gauge__warning">危険</div>' : ''}
      </div>
    `;
  }

  // スタッフ別危険度の表示
  function renderDangerStaffList() {
    if (!dangerStaffListEl) return;
    
    dangerStaffListEl.innerHTML = "";
    
    // 各スタッフの第1象限タスク数を集計（完了タスクを除外）
    const staffDangerMap = new Map();
    const dangerTasks = state.tasks.filter((task) => task.quadrant === 1 && task.status !== "完了");
    
    dangerTasks.forEach((task) => {
      const owner = findStaff(task.owner_id);
      if (owner) {
        if (!staffDangerMap.has(owner.id)) {
          staffDangerMap.set(owner.id, {
            staff: owner,
            count: 0,
            tasks: []
          });
        }
        const entry = staffDangerMap.get(owner.id);
        entry.count++;
        entry.tasks.push(task);
      }
    });
    
    // スタッフリストを配列に変換（第1象限タスク数が多い順、次に全スタッフ）
    const staffWithDanger = Array.from(staffDangerMap.values()).sort((a, b) => b.count - a.count);
    const staffWithoutDanger = state.staff
      .filter((staff) => !staffDangerMap.has(staff.id))
      .map((staff) => ({ staff, count: 0, tasks: [] }));
    
    const allStaff = [...staffWithDanger, ...staffWithoutDanger];
    
    if (allStaff.length === 0) {
      const empty = document.createElement("p");
      empty.className = "danger-staff-list__empty";
      empty.textContent = "スタッフが登録されていません";
      dangerStaffListEl.appendChild(empty);
      return;
    }
    
    allStaff.forEach(({ staff, count, tasks }) => {
      const isDanger = count >= 3;
      const percentage = Math.min((count / 3) * 100, 100);
      
      const card = document.createElement("article");
      card.className = `danger-staff-card ${isDanger ? "danger-staff-card--danger" : ""}`;
      card.innerHTML = `
        <div class="danger-staff-card__header">
          <div class="danger-staff-card__info">
            ${renderAvatar(staff, 1)}
            <div class="danger-staff-card__details">
              <h3 class="danger-staff-card__name">${staff.name}</h3>
              <p class="danger-staff-card__dept">${staff.department || ""}</p>
            </div>
          </div>
          <div class="danger-staff-card__count ${isDanger ? "danger-staff-card__count--danger" : ""}">
            ${count}件
          </div>
        </div>
        <div class="danger-staff-card__gauge">
          <div class="danger-staff-card__gauge-fill" style="width: ${percentage}%"></div>
        </div>
        ${isDanger ? '<div class="danger-staff-card__warning">危険</div>' : ''}
        ${tasks.length > 0 ? `
          <div class="danger-staff-card__tasks">
            ${tasks.map((task) => `
              <div class="danger-staff-card__task-item" data-task-id="${task.id}">
                <span class="danger-staff-card__task-title">${task.title}</span>
                <span class="danger-staff-card__task-status badge ${state.statusColors[task.status] || "badge--todo"}">${task.status || ""}</span>
              </div>
            `).join("")}
          </div>
        ` : ""}
      `;
      
      // タスクアイテムにクリックイベントを追加
      card.querySelectorAll(".danger-staff-card__task-item").forEach((item) => {
        item.addEventListener("click", (e) => {
          e.stopPropagation();
          const taskId = Number(item.dataset.taskId);
          if (taskId) {
            openForm(taskId);
          }
        });
      });
      
      dangerStaffListEl.appendChild(card);
    });
  }

  // デンジャータスクリストの表示
  function renderDangerTaskList() {
    if (!dangerListEl) return;
    
    const dangerTasks = state.tasks.filter((task) => task.quadrant === 1 && task.status !== "完了");
    dangerListEl.innerHTML = "";
    
    if (dangerTasks.length === 0) {
      const empty = document.createElement("p");
      empty.className = "danger-list__empty";
      empty.textContent = "重要かつ緊急のタスクはありません";
      dangerListEl.appendChild(empty);
      return;
    }
    
    sortTasks(dangerTasks).forEach((task) => {
      const card = buildDangerTaskCard(task);
      dangerListEl.appendChild(card);
    });
  }

  // デンジャータスクカードの構築
  function buildDangerTaskCard(task) {
    const card = document.createElement("article");
    card.className = "danger-task-card";
    card.dataset.taskId = String(task.id);
    card.addEventListener("click", () => openForm(task.id));

    const owner = findStaff(task.owner_id);
    const statusClass = state.statusColors[task.status] || "badge--todo";
    const priorityClass = priorityClassMap[task.priority] || "low";

    card.innerHTML = `
      <header class="danger-task-card__header">
        <span class="danger-task-card__priority danger-task-card__priority--${priorityClass}">
          ${task.priority || ""}
        </span>
        <span class="badge ${statusClass}">${task.status || ""}</span>
      </header>
      <h3 class="danger-task-card__title">${task.title}</h3>
      ${task.description ? `<p class="danger-task-card__description">${task.description}</p>` : ""}
      <dl class="danger-task-card__meta">
        <div>
          <dt>担当者</dt>
          <dd>
            ${renderAvatar(owner, 1)}
            ${owner ? owner.name : "-"}
            ${owner && owner.department ? `(${owner.department})` : ""}
          </dd>
        </div>
        <div>
          <dt>期限</dt>
          <dd>${formatDate(task.due_date)}</dd>
        </div>
        ${task.created_by ? `
        <div>
          <dt>作成者</dt>
          <dd>${task.created_by}</dd>
        </div>
        ` : ""}
      </dl>
    `;
    return card;
  }

  // 職員別タスク分布の表示
  function renderStaffDistribution() {
    if (!staffDistributionEl) return;
    staffDistributionEl.innerHTML = "";
    
    state.staff.forEach((staff) => {
      // 各職員の象限別タスク数を集計
      const quadrantCounts = { 1: 0, 2: 0, 3: 0, 4: 0 };
      const staffTasks = state.tasks.filter((task) => task.owner_id === staff.id);
      staffTasks.forEach((task) => {
        const q = task.quadrant || 1;
        quadrantCounts[q] = (quadrantCounts[q] || 0) + 1;
      });
      
      const total = staffTasks.length;
      const maxCount = Math.max(...Object.values(quadrantCounts), 1);
      
      const item = document.createElement("div");
      item.className = "staff-distribution-item";
      item.innerHTML = `
        <div class="staff-distribution-item__header">
          <div class="staff-distribution-item__title-row">
            <h3 class="staff-distribution-item__name">${staff.name}</h3>
            <div class="staff-distribution-item__total">${total}件</div>
          </div>
          <div class="staff-distribution-item__info">
            ${renderAvatar(staff)}
            <p class="staff-distribution-item__dept">${staff.department || ""}</p>
          </div>
        </div>
        <div class="staff-distribution-item__quadrants">
          ${quadrants
            .map((q) => {
              const count = quadrantCounts[q] || 0;
              const height = maxCount > 0 ? (count / maxCount) * 100 : 0;
              const qClass = `quadrant-bar__fill--q${q}`;
              return `
                <div class="quadrant-bar">
                  <div class="quadrant-bar__label">第${q}象限</div>
                  <div class="quadrant-bar__container">
                    <div class="quadrant-bar__fill ${qClass}" style="height: ${height}%"></div>
                  </div>
                  <div class="quadrant-bar__value">${count}</div>
                </div>
              `;
            })
            .join("")}
        </div>
      `;
      staffDistributionEl.appendChild(item);
    });
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
  
  // メンバー追加フォーム
  function openStaffForm() {
    if (!staffForm) return;
    resetStaffFormStatus();
    if (typeof staffDialog?.showModal === "function") {
      staffDialog.showModal();
    } else {
      staffDialog?.classList.add("modal--open");
    }
  }

  function closeStaffForm() {
    if (typeof staffDialog?.close === "function") {
      staffDialog.close();
    } else {
      staffDialog?.classList.remove("modal--open");
    }
    if (staffForm) {
      staffForm.reset();
    }
  }

  function resetStaffFormStatus(message = "") {
    if (staffFormStatus) {
      staffFormStatus.textContent = message;
    }
  }

  async function handleStaffSubmit(event) {
    event.preventDefault();
    if (!staffForm) return;
    
    const formData = new FormData(staffForm);
    
    try {
      const response = await fetch("/api/staff", {
        method: "POST",
        body: formData,
      });
      
      if (!response.ok) {
        let message = "メンバーの追加に失敗しました";
        try {
          const payload = await response.json();
          if (typeof payload.detail === "string") message = payload.detail;
        } catch (_) {
          // ignore
        }
        throw new Error(message);
      }
      
      const data = await response.json();
      state.staff = [...state.staff, data];
      renderStaff();
      renderBoard();
      // プレビュー画面が表示されている場合は更新
      if (document.getElementById("previewTab")?.classList.contains("tab-panel--active")) {
        renderPreview();
      }
      // デンジャーリストが表示されている場合は更新
      if (document.getElementById("dangerTab")?.classList.contains("tab-panel--active")) {
        renderDangerList();
      }
      closeStaffForm();
    } catch (error) {
      resetStaffFormStatus(error.message || "メンバーの追加に失敗しました");
    }
  }

  addStaffBtn?.addEventListener("click", openStaffForm);
  cancelStaffBtn?.addEventListener("click", closeStaffForm);
  staffForm?.addEventListener("submit", handleStaffSubmit);
  
  // タブボタンのイベント
  tabBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      switchTab(btn.dataset.tab);
    });
  });

  renderBoard();
  renderStaff();
})();
