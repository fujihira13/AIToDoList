/**
 * イベントハンドリングモジュール
 * ユーザー操作の処理を担当します
 */

import {
  state,
  elements,
  setEditingId,
  setDeleteTargetId,
  setDeleteTargetStaffId,
  setEditingStaffId,
  setCompletedSortOrder,
  clearEditingState,
  clearStaffEditingState,
  getEditingId,
  getDeleteTargetId,
  getDeleteTargetStaffId,
  getEditingStaffId,
} from "./state.js";
import { findStaff } from "./utils.js";
import {
  createTask,
  updateTask,
  deleteTask,
  moveTask as apiMoveTask,
  createStaff,
  updateStaff,
  deleteStaff,
} from "./api.js";
import {
  renderBoard,
  renderStaff,
  renderPreview,
  renderDangerList,
  renderCompleted,
} from "./render.js";

/**
 * タスクフォームを開きます
 * @param {number|null} taskId - タスクID（新規作成の場合はnull）
 */
export function openForm(taskId = null) {
  setEditingId(taskId);
  resetFormStatus();
  if (!elements.taskForm) return;
  
  // メンバー選択肢を最新の状態に更新
  updateOwnerOptions();
  
  if (taskId) {
    const task = state.tasks.find((item) => item.id === taskId);
    if (!task) return;
    elements.taskFormTitle.textContent =
      elements.taskFormTitle.dataset.editLabel || "タスクを更新";
    elements.taskForm.task_id.value = task.id;
    elements.taskForm.title.value = task.title || "";
    elements.taskForm.description.value = task.description || "";
    elements.taskForm.owner_id.value = task.owner_id || "";
    elements.taskForm.created_by.value = task.created_by || "";
    elements.taskForm.status.value = task.status || "";
    elements.taskForm.priority.value = task.priority || "";
    elements.taskForm.quadrant.value = task.quadrant || 1;
    elements.taskForm.due_date.value = task.due_date || "";
  } else {
    elements.taskFormTitle.textContent =
      elements.taskFormTitle.dataset.createLabel || "タスクを作成";
    elements.taskForm.reset();
    setEditingId(null);
  }
  updateOwnerHint();
  if (typeof elements.taskDialog?.showModal === "function") {
    elements.taskDialog.showModal();
  } else {
    elements.taskDialog?.classList.add("modal--open");
  }
  elements.deleteTaskBtn.style.display = getEditingId() ? "inline-flex" : "none";
}

/**
 * タスクフォームを閉じます
 */
export function closeForm() {
  setEditingId(null);
  if (typeof elements.taskDialog?.close === "function") {
    elements.taskDialog.close();
  } else {
    elements.taskDialog?.classList.remove("modal--open");
  }
}

/**
 * フォームのステータスメッセージをリセットします
 * @param {string} message - 表示するメッセージ
 */
function resetFormStatus(message = "") {
  if (elements.formStatus) {
    elements.formStatus.textContent = message;
  }
}

/**
 * スタッフフォームのステータスメッセージをリセットします
 * @param {string} message - 表示するメッセージ
 */
function resetStaffFormStatus(message = "") {
  if (elements.staffFormStatus) {
    elements.staffFormStatus.textContent = message;
  }
}

/**
 * タスクフォームの送信を処理します
 * @param {Event} event - フォーム送信イベント
 */
export async function handleSubmit(event) {
  event.preventDefault();
  if (!elements.taskForm) return;
  const payload = {
    title: elements.taskForm.title.value.trim(),
    description: elements.taskForm.description.value.trim() || null,
    owner_id: Number(elements.taskForm.owner_id.value),
    created_by: elements.taskForm.created_by.value.trim() || null,
    due_date: elements.taskForm.due_date.value || null,
    status: elements.taskForm.status.value,
    priority: elements.taskForm.priority.value,
    quadrant: Number(elements.taskForm.quadrant.value),
  };
  if (!payload.title) {
    resetFormStatus("タイトルは必須です");
    return;
  }
  if (!payload.owner_id) {
    resetFormStatus("担当者は必須です");
    return;
  }
  const currentEditingId = getEditingId();
  try {
    const data = currentEditingId
      ? await updateTask(currentEditingId, payload)
      : await createTask(payload);
    if (currentEditingId) {
      state.tasks = state.tasks.map((task) =>
        task.id === data.id ? data : task
      );
    } else {
      state.tasks = [...state.tasks, data];
    }
    updateAllViews();
    closeForm();
  } catch (error) {
    resetFormStatus(error.message || "保存に失敗しました");
  }
}

/**
 * 担当者選択肢を最新のメンバーリストに更新します
 */
function updateOwnerOptions() {
  if (!elements.taskForm?.owner_id) return;
  const ownerSelect = elements.taskForm.owner_id;
  const currentValue = ownerSelect.value; // 現在選択されている値を保存
  
  // 最初の「-- 選択してください --」オプション以外を削除
  while (ownerSelect.options.length > 1) {
    ownerSelect.remove(1);
  }
  
  // state.staffの内容に基づいて新しいオプションを追加
  state.staff.forEach((person) => {
    const option = document.createElement("option");
    option.value = person.id;
    option.textContent = person.name;
    ownerSelect.appendChild(option);
  });
  
  // 元の選択値を復元（存在する場合）
  if (currentValue && Array.from(ownerSelect.options).some(opt => opt.value === currentValue)) {
    ownerSelect.value = currentValue;
  }
}

/**
 * 担当者選択時のヒントを更新します
 */
export function updateOwnerHint() {
  if (!elements.ownerDept || !elements.taskForm) return;
  const staff = findStaff(Number(elements.taskForm.owner_id.value));
  if (!staff) {
    elements.ownerDept.textContent = "";
    return;
  }
  elements.ownerDept.textContent = staff.department
    ? `所属: ${staff.department}`
    : "";
}

/**
 * タスク削除の確認ダイアログを表示します
 * @param {number} taskId - タスクID
 */
export function confirmDelete(taskId) {
  setDeleteTargetId(taskId);
  setDeleteTargetStaffId(null);
  if (elements.confirmMessage) {
    elements.confirmMessage.textContent =
      "この操作でタスクが完全に削除されます。続行しますか？";
  }
  if (typeof elements.confirmDialog?.showModal === "function") {
    elements.confirmDialog.showModal();
  } else {
    elements.confirmDialog?.classList.add("modal--open");
  }
}

/**
 * スタッフ削除の確認ダイアログを表示します
 * @param {number} staffId - スタッフID
 */
export function confirmDeleteStaff(staffId) {
  setDeleteTargetStaffId(staffId);
  setDeleteTargetId(null);
  const staff = state.staff.find((s) => s.id === staffId);
  const staffName = staff ? staff.name : "";
  if (elements.confirmMessage) {
    elements.confirmMessage.textContent = `メンバー「${staffName}」を削除しますか？この操作は取り消せません。`;
  }
  if (typeof elements.confirmDialog?.showModal === "function") {
    elements.confirmDialog.showModal();
  } else {
    elements.confirmDialog?.classList.add("modal--open");
  }
}

/**
 * 確認ダイアログを閉じます
 */
export function closeConfirm() {
  setDeleteTargetId(null);
  setDeleteTargetStaffId(null);
  if (typeof elements.confirmDialog?.close === "function") {
    elements.confirmDialog.close();
  } else {
    elements.confirmDialog?.classList.remove("modal--open");
  }
}

/**
 * 削除処理を実行します
 */
export async function handleDelete() {
  const currentDeleteTargetId = getDeleteTargetId();
  const currentDeleteTargetStaffId = getDeleteTargetStaffId();
  if (currentDeleteTargetId) {
    // タスクの削除
    try {
      await deleteTask(currentDeleteTargetId);
      state.tasks = state.tasks.filter((task) => task.id !== currentDeleteTargetId);
      updateAllViews();
      closeConfirm();
      closeForm();
    } catch (error) {
      resetFormStatus(error.message || "削除に失敗しました");
      closeConfirm();
    }
  } else if (currentDeleteTargetStaffId) {
    // メンバーの削除
    try {
      await deleteStaff(currentDeleteTargetStaffId);
      state.staff = state.staff.filter((s) => s.id !== currentDeleteTargetStaffId);
      renderStaff();
      renderBoard();
      updateAllViews();
      closeConfirm();
      closeStaffForm();
    } catch (error) {
      resetStaffFormStatus(error.message || "メンバーの削除に失敗しました");
      closeConfirm();
    }
  }
}

/**
 * タスクの象限を移動します
 * @param {number} taskId - タスクID
 * @param {number} quadrant - 新しい象限（1-4）
 */
export async function moveTask(taskId, quadrant) {
  try {
    const data = await apiMoveTask(taskId, quadrant);
    state.tasks = state.tasks.map((task) =>
      task.id === data.id ? data : task
    );
    updateAllViews();
  } catch (error) {
    resetFormStatus(error.message || "タスクの移動に失敗しました");
  }
}

/**
 * スタッフフォームを開きます
 * @param {number|null} staffId - スタッフID（新規作成の場合はnull）
 */
export function openStaffForm(staffId = null) {
  if (!elements.staffForm) return;
  setEditingStaffId(staffId);
  resetStaffFormStatus();

  if (staffId) {
    const staff = state.staff.find((s) => s.id === staffId);
    if (!staff) return;
    elements.staffFormTitle.textContent = "メンバーを編集";
    elements.submitStaffBtn.textContent = "更新";
    elements.deleteStaffBtn.style.display = "inline-flex";
    if (elements.formStaffId) elements.formStaffId.value = staff.id;
    elements.staffForm.staff_name.value = staff.name || "";
    elements.staffForm.staff_department.value = staff.department || "";
    elements.staffForm.staff_photo.value = "";
  } else {
    elements.staffFormTitle.textContent = "メンバーを追加";
    elements.submitStaffBtn.textContent = "追加";
    elements.deleteStaffBtn.style.display = "none";
    elements.staffForm.reset();
    setEditingStaffId(null);
  }

  if (typeof elements.staffDialog?.showModal === "function") {
    elements.staffDialog.showModal();
  } else {
    elements.staffDialog?.classList.add("modal--open");
  }
}

/**
 * スタッフフォームを閉じます
 */
export function closeStaffForm() {
  if (typeof elements.staffDialog?.close === "function") {
    elements.staffDialog.close();
  } else {
    elements.staffDialog?.classList.remove("modal--open");
  }
  if (elements.staffForm) {
    elements.staffForm.reset();
  }
  setEditingStaffId(null);
}

/**
 * スタッフフォームの送信を処理します
 * @param {Event} event - フォーム送信イベント
 */
export async function handleStaffSubmit(event) {
  event.preventDefault();
  if (!elements.staffForm) return;

  // FormDataを作成し、フィールド名をAPIが期待する形式に変換
  const formData = new FormData(elements.staffForm);
  // staff_name を name に変換（バックエンドAPIは name を期待しているため）
  const staffName = formData.get("staff_name");
  if (staffName) {
    formData.set("name", staffName);
    formData.delete("staff_name");
  }
  
  const currentEditingStaffId = getEditingStaffId();

  try {
    const data = currentEditingStaffId
      ? await updateStaff(currentEditingStaffId, formData)
      : await createStaff(formData);
    if (currentEditingStaffId) {
      state.staff = state.staff.map((s) => (s.id === data.id ? data : s));
    } else {
      state.staff = [...state.staff, data];
    }
    renderStaff();
    renderBoard();
    updateAllViews();
    closeStaffForm();
  } catch (error) {
    resetStaffFormStatus(
      error.message ||
        (currentEditingStaffId
          ? "メンバーの更新に失敗しました"
          : "メンバーの追加に失敗しました")
    );
  }
}

/**
 * タブを切り替えます
 * @param {string} tabName - タブ名（"board", "preview", "danger", "members", "completed"）
 */
export function switchTab(tabName) {
  elements.tabBtns.forEach((btn) => {
    if (btn.dataset.tab === tabName) {
      btn.classList.add("tab-btn--active");
    } else {
      btn.classList.remove("tab-btn--active");
    }
  });
  elements.tabPanels.forEach((panel) => {
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
  } else if (tabName === "members") {
    renderStaff();
  } else if (tabName === "completed") {
    renderCompleted();
  }
}

/**
 * すべてのビューを更新します（現在表示中のタブに応じて）
 */
function updateAllViews() {
  renderBoard();
  // プレビュー画面が表示されている場合は更新
  if (
    document
      .getElementById("previewTab")
      ?.classList.contains("tab-panel--active")
  ) {
    renderPreview();
  }
  // デンジャーリストが表示されている場合は更新
  if (
    document.getElementById("dangerTab")?.classList.contains("tab-panel--active")
  ) {
    renderDangerList();
  }
  // 完了タブが表示されている場合は更新
  if (
    document
      .getElementById("completedTab")
      ?.classList.contains("tab-panel--active")
  ) {
    renderCompleted();
  }
}

