/**
 * レンダリングモジュール
 * UIの描画を担当します
 */

import {
  state,
  elements,
  quadrants,
  priorityClassMap,
  getCompletedSortOrder,
  getStaffFilterText,
  setStaffFilterText,
  getStaffSortOrder,
} from "./state.js";
import {
  sortTasks,
  formatDate,
  findStaff,
  renderAvatar,
  sortCompletedTasks,
  sortStaff,
} from "./utils.js";

/**
 * ボード全体をレンダリングします
 */
export function renderBoard() {
  if (!elements.board) return;
  elements.board.innerHTML = "";
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
        // イベントを発火して、events.jsで処理
        const moveEvent = new CustomEvent("moveTask", {
          detail: { taskId, quadrant },
        });
        document.dispatchEvent(moveEvent);
      }
    });

    const header = document.createElement("div");
    header.className = "quadrant__header";
    const face = state.faces[quadrant] || {};
    header.innerHTML = `
      <div>
        <h2>${state.labels[quadrant] || ""}</h2>
      </div>
      <span class="quadrant__count"></span>
    `;
    const counter = header.querySelector(".quadrant__count");
    container.appendChild(header);

    const body = document.createElement("div");
    body.className = "quadrant__body";

    // 完了タスクを除外
    const tasks = state.tasks.filter(
      (task) => task.quadrant === quadrant && task.status !== "完了"
    );
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
    elements.board.appendChild(container);
  });
}

/**
 * タスクカードを構築します
 * @param {Object} task - タスクデータ
 * @returns {HTMLElement} タスクカード要素
 */
export function buildTaskCard(task) {
  const card = document.createElement("article");
  card.className = "task-card";
  card.draggable = true;
  card.dataset.taskId = String(task.id);
  card.addEventListener("dragstart", (event) => {
    event.dataTransfer?.setData("text/task-id", String(task.id));
    event.dataTransfer?.setDragImage(card, 20, 20);
  });
  card.addEventListener("click", () => {
    // イベントを発火して、events.jsで処理
    const event = new CustomEvent("openTaskForm", {
      detail: { taskId: task.id },
    });
    document.dispatchEvent(event);
  });

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

/**
 * スタッフリストをレンダリングします
 */
export function renderStaff() {
  if (!elements.staffList) return;
  elements.staffList.innerHTML = "";

  // state.staffが配列でない場合は空配列を使用
  const staffArray = Array.isArray(state.staff) ? state.staff : [];

  // フィルター入力欄の値から状態を更新
  const staffFilterInput = document.getElementById("staffFilter");
  let filterText = "";
  if (staffFilterInput) {
    // 入力欄の値を状態に反映
    filterText = staffFilterInput.value.trim();
    setStaffFilterText(filterText);
    // 小文字に変換して検索用に使用
    filterText = filterText.toLowerCase();
  } else {
    // 入力欄が存在しない場合は状態から取得
    filterText = getStaffFilterText().toLowerCase().trim();
  }

  // フィルター適用：名前にフィルターテキストが含まれるメンバーのみを抽出
  let filteredStaff = staffArray;
  if (filterText) {
    filteredStaff = staffArray.filter((person) => {
      const name = (person.name || "").toLowerCase();
      return name.includes(filterText);
    });
  }

  // ソート順に従ってメンバーをソート
  const sortOrder = getStaffSortOrder() || "name-asc";
  const sortedStaff = sortStaff(filteredStaff, sortOrder);

  // メンバーが0件の場合のメッセージ表示
  if (sortedStaff.length === 0) {
    const empty = document.createElement("p");
    empty.className = "staff-list__empty";
    empty.textContent = filterText
      ? `「${filterText}」に一致するメンバーが見つかりませんでした`
      : "メンバーが登録されていません";
    elements.staffList.appendChild(empty);
    return;
  }

  sortedStaff.forEach((person) => {
    const item = document.createElement("article");
    item.className = "staff-card";
    item.style.cursor = "pointer";
    item.addEventListener("click", () => {
      // イベントを発火して、events.jsで処理
      const event = new CustomEvent("openStaffForm", {
        detail: { staffId: person.id },
      });
      document.dispatchEvent(event);
    });
    item.innerHTML = `
      ${renderAvatar(person)}
      <div>
        <p class="staff-card__name">${person.name}</p>
        <p class="staff-card__dept">${person.department || ""}</p>
      </div>
    `;
    elements.staffList.appendChild(item);
  });
}

/**
 * プレビュー画面をレンダリングします
 */
export function renderPreview() {
  renderQuadrantOverview();
  renderStaffDistribution();
}

/**
 * 象限概要を表示します（2x2マトリクス形式）
 */
function renderQuadrantOverview() {
  if (!elements.quadrantOverview) return;
  elements.quadrantOverview.innerHTML = "";

  // 象限の順序を2x2グリッドに合わせて調整（1=左上, 2=右上, 3=左下, 4=右下）
  const quadrantOrder = [1, 2, 3, 4];

  quadrantOrder.forEach((quadrant) => {
    // 完了タスクを除外
    const tasks = state.tasks.filter(
      (task) => task.quadrant === quadrant && task.status !== "完了"
    );
    const face = state.faces[quadrant] || {};
    const label = state.labels[quadrant] || "";

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
    const staffList = Array.from(staffMap.values()).sort(
      (a, b) => b.count - a.count
    );

    const summary = document.createElement("div");
    summary.className = "quadrant-summary";
    summary.dataset.quadrant = String(quadrant);
    summary.innerHTML = `
      <div class="quadrant-summary__header">
        <h3 class="quadrant-summary__label">${label}</h3>
        <p class="quadrant-summary__count">${tasks.length}</p>
      </div>
      <div class="quadrant-summary__staff-list">
        ${
          staffList.length > 0
            ? staffList
                .map(
                  ({ staff, count }) => `
                <div class="quadrant-summary__staff-item">
                  <div class="quadrant-summary__staff-name">
                    ${renderAvatar(staff, quadrant)}
                    <span>${staff.name}</span>
                  </div>
                  <span class="quadrant-summary__staff-count">${count}件</span>
                </div>
              `
                )
                .join("")
            : ""
        }
      </div>
    `;
    elements.quadrantOverview.appendChild(summary);
  });
}

/**
 * 職員別タスク分布を表示します
 */
function renderStaffDistribution() {
  if (!elements.staffDistribution) return;
  elements.staffDistribution.innerHTML = "";

  state.staff.forEach((staff) => {
    // 各職員の象限別タスク数を集計（完了タスクを除外）
    const quadrantCounts = { 1: 0, 2: 0, 3: 0, 4: 0 };
    const staffTasks = state.tasks.filter(
      (task) => task.owner_id === staff.id && task.status !== "完了"
    );
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
                <div class="quadrant-bar__label">${state.labels[q] || ""}</div>
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
    elements.staffDistribution.appendChild(item);
  });
}

/**
 * デンジャーリストをレンダリングします
 */
export function renderDangerList() {
  renderDangerGauge();
  renderDangerStaffList();
  renderDangerTaskList();
}

/**
 * デンジャーゲージを表示します
 */
function renderDangerGauge() {
  if (!elements.dangerGauge) return;

  const dangerTasks = state.tasks.filter(
    (task) => task.quadrant === 1 && task.status !== "完了"
  );
  const count = dangerTasks.length;
  const isDanger = count >= 3;
  const percentage = Math.min((count / 3) * 100, 100);

  elements.dangerGauge.innerHTML = `
    <div class="danger-gauge">
      <div class="danger-gauge__header">
        <h2 class="danger-gauge__title">重要かつ緊急のタスク数</h2>
        <div class="danger-gauge__count">${count}件</div>
      </div>
      <div class="danger-gauge__meter">
        <div class="danger-gauge__fill" style="width: ${percentage}%"></div>
      </div>
      ${isDanger ? '<div class="danger-gauge__warning">危険</div>' : ""}
    </div>
  `;
}

/**
 * スタッフ別危険度を表示します
 */
function renderDangerStaffList() {
  if (!elements.dangerStaffList) return;

  elements.dangerStaffList.innerHTML = "";

  // 各スタッフの第1象限タスク数を集計（完了タスクを除外）
  const staffDangerMap = new Map();
  const dangerTasks = state.tasks.filter(
    (task) => task.quadrant === 1 && task.status !== "完了"
  );

  dangerTasks.forEach((task) => {
    const owner = findStaff(task.owner_id);
    if (owner) {
      if (!staffDangerMap.has(owner.id)) {
        staffDangerMap.set(owner.id, {
          staff: owner,
          count: 0,
          tasks: [],
        });
      }
      const entry = staffDangerMap.get(owner.id);
      entry.count++;
      entry.tasks.push(task);
    }
  });

  // 3件以上のスタッフを集計（警告文表示用）
  const criticalStaff = Array.from(staffDangerMap.values())
    .filter((entry) => entry.count >= 3)
    .map((entry) => entry.staff.name);

  // タイトル部分に警告文を追加
  const dangerSection = elements.dangerStaffList.closest(".danger-section");
  if (dangerSection) {
    const titleElement = dangerSection.querySelector(".danger-section__title");
    if (titleElement) {
      // 既存の警告文を削除
      const existingWarning = titleElement.querySelector(".danger-warning");
      if (existingWarning) {
        existingWarning.remove();
      }

      // 3件以上のスタッフがいる場合は警告文を追加
      if (criticalStaff.length > 0) {
        const warningElement = document.createElement("span");
        warningElement.className = "danger-warning";
        warningElement.textContent = `${criticalStaff.join(
          "、"
        )}さんが炎上しそうです`;
        titleElement.appendChild(warningElement);
      }
    }
  }

  // スタッフリストを配列に変換（第1象限タスク数が多い順、次に全スタッフ）
  const staffWithDanger = Array.from(staffDangerMap.values()).sort(
    (a, b) => b.count - a.count
  );
  const staffWithoutDanger = state.staff
    .filter((staff) => !staffDangerMap.has(staff.id))
    .map((staff) => ({ staff, count: 0, tasks: [] }));

  const allStaff = [...staffWithDanger, ...staffWithoutDanger];

  if (allStaff.length === 0) {
    const empty = document.createElement("p");
    empty.className = "danger-staff-list__empty";
    empty.textContent = "スタッフが登録されていません";
    elements.dangerStaffList.appendChild(empty);
    return;
  }

  allStaff.forEach(({ staff, count, tasks }) => {
    const isDanger = count >= 3;
    const percentage = Math.min((count / 3) * 100, 100);

    const card = document.createElement("article");
    card.className = `danger-staff-card ${
      isDanger ? "danger-staff-card--danger" : ""
    }`;
    card.innerHTML = `
      <div class="danger-staff-card__header">
        <div class="danger-staff-card__info">
          ${renderAvatar(staff, 1)}
          <div class="danger-staff-card__details">
            <h3 class="danger-staff-card__name">${staff.name}</h3>
            <p class="danger-staff-card__dept">${staff.department || ""}</p>
          </div>
        </div>
        <div class="danger-staff-card__count ${
          isDanger ? "danger-staff-card__count--danger" : ""
        }">
          ${count}件
        </div>
      </div>
      <div class="danger-staff-card__gauge">
        <div class="danger-staff-card__gauge-fill" style="width: ${percentage}%"></div>
      </div>
      ${isDanger ? '<div class="danger-staff-card__warning">危険</div>' : ""}
      ${
        tasks.length > 0
          ? `
        <div class="danger-staff-card__tasks">
          ${tasks
            .map(
              (task) => `
            <div class="danger-staff-card__task-item" data-task-id="${task.id}">
              <span class="danger-staff-card__task-title">${task.title}</span>
              <span class="danger-staff-card__task-status badge ${
                state.statusColors[task.status] || "badge--todo"
              }">${task.status || ""}</span>
            </div>
          `
            )
            .join("")}
        </div>
      `
          : ""
      }
    `;

    // タスクアイテムにクリックイベントを追加
    card.querySelectorAll(".danger-staff-card__task-item").forEach((item) => {
      item.addEventListener("click", (e) => {
        e.stopPropagation();
        const taskId = Number(item.dataset.taskId);
        if (taskId) {
          // イベントを発火して、events.jsで処理
          const event = new CustomEvent("openTaskForm", { detail: { taskId } });
          document.dispatchEvent(event);
        }
      });
    });

    elements.dangerStaffList.appendChild(card);
  });
}

/**
 * デンジャータスクリストを表示します
 */
function renderDangerTaskList() {
  if (!elements.dangerList) return;

  const dangerTasks = state.tasks.filter(
    (task) => task.quadrant === 1 && task.status !== "完了"
  );
  elements.dangerList.innerHTML = "";

  if (dangerTasks.length === 0) {
    const empty = document.createElement("p");
    empty.className = "danger-list__empty";
    empty.textContent = "重要かつ緊急のタスクはありません";
    elements.dangerList.appendChild(empty);
    return;
  }

  sortTasks(dangerTasks).forEach((task) => {
    const card = buildDangerTaskCard(task);
    elements.dangerList.appendChild(card);
  });
}

/**
 * デンジャータスクカードを構築します
 * @param {Object} task - タスクデータ
 * @returns {HTMLElement} タスクカード要素
 */
function buildDangerTaskCard(task) {
  const card = document.createElement("article");
  card.className = "danger-task-card";
  card.dataset.taskId = String(task.id);
  card.addEventListener("click", () => {
    // イベントを発火して、events.jsで処理
    const event = new CustomEvent("openTaskForm", {
      detail: { taskId: task.id },
    });
    document.dispatchEvent(event);
  });

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
    ${
      task.description
        ? `<p class="danger-task-card__description">${task.description}</p>`
        : ""
    }
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
      ${
        task.created_by
          ? `
      <div>
        <dt>作成者</dt>
        <dd>${task.created_by}</dd>
      </div>
      `
          : ""
      }
    </dl>
  `;
  return card;
}

/**
 * 完了タスクをレンダリングします
 */
export function renderCompleted() {
  if (!elements.completedList) return;
  elements.completedList.innerHTML = "";

  const completedTasks = state.tasks.filter((task) => task.status === "完了");

  if (completedTasks.length === 0) {
    const empty = document.createElement("p");
    empty.className = "completed-list__empty";
    empty.textContent = "完了したタスクはありません";
    elements.completedList.appendChild(empty);
    return;
  }

  // ソート処理
  const sortedTasks = sortCompletedTasks(
    completedTasks,
    getCompletedSortOrder()
  );

  // 象限ごとにグループ化
  const tasksByQuadrant = { 1: [], 2: [], 3: [], 4: [] };
  sortedTasks.forEach((task) => {
    const q = task.quadrant || 1;
    if (tasksByQuadrant[q]) {
      tasksByQuadrant[q].push(task);
    }
  });

  // 各象限のタスクを表示
  quadrants.forEach((quadrant) => {
    const quadrantTasks = tasksByQuadrant[quadrant];
    if (quadrantTasks.length === 0) return;

    const section = document.createElement("section");
    section.className = "completed-quadrant";
    const header = document.createElement("div");
    header.className = "completed-quadrant__header";
    header.innerHTML = `<h3>${state.labels[quadrant] || ""} (${
      quadrantTasks.length
    }件)</h3>`;
    section.appendChild(header);

    const taskContainer = document.createElement("div");
    taskContainer.className = "completed-quadrant__tasks";

    quadrantTasks.forEach((task) => {
      taskContainer.appendChild(buildTaskCard(task));
    });

    section.appendChild(taskContainer);
    elements.completedList.appendChild(section);
  });
}
