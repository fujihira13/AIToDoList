/**
 * メインアプリケーションファイル
 * 初期化とイベントリスナーの設定を行います
 */

import { elements, getEditingId, getEditingStaffId, setCompletedSortOrder } from "./state.js";
import {
  openForm,
  closeForm,
  handleSubmit,
  updateOwnerHint,
  confirmDelete,
  handleDelete,
  closeConfirm,
  openStaffForm,
  closeStaffForm,
  handleStaffSubmit,
  confirmDeleteStaff,
  switchTab,
} from "./events.js";
import { renderBoard, renderStaff } from "./render.js";

/**
 * アプリケーションの初期化
 */
function init() {
  // タスクフォーム関連のイベント
  elements.addTaskBtn?.addEventListener("click", () => openForm(null));
  elements.cancelTaskBtn?.addEventListener("click", closeForm);
  elements.taskForm?.addEventListener("submit", handleSubmit);
  elements.taskForm?.owner_id?.addEventListener("change", updateOwnerHint);

  // 期限フィールドのクリック時にカレンダーを表示
  if (elements.taskForm?.due_date) {
    elements.taskForm.due_date.addEventListener("click", async () => {
      // showPicker()メソッドがサポートされている場合は使用
      // これにより、クリック時にカレンダーが確実に表示されます
      if (typeof elements.taskForm.due_date.showPicker === "function") {
        try {
          await elements.taskForm.due_date.showPicker();
        } catch (error) {
          // showPicker()が失敗した場合は、通常のフォーカス処理にフォールバック
          elements.taskForm.due_date.focus();
        }
      } else {
        // showPicker()がサポートされていない場合は、フォーカスを設定
        elements.taskForm.due_date.focus();
      }
    });
  }

  elements.deleteTaskBtn?.addEventListener("click", () => {
    const currentEditingId = getEditingId();
    if (currentEditingId) {
      confirmDelete(currentEditingId);
    }
  });

  // 確認ダイアログ関連のイベント
  elements.confirmDeleteBtn?.addEventListener("click", handleDelete);
  elements.confirmCancelBtn?.addEventListener("click", closeConfirm);
  elements.confirmCloseBtn?.addEventListener("click", closeConfirm);

  // スタッフフォーム関連のイベント
  elements.addStaffBtn?.addEventListener("click", () => openStaffForm(null));
  elements.cancelStaffBtn?.addEventListener("click", closeStaffForm);
  elements.staffForm?.addEventListener("submit", handleStaffSubmit);
  elements.deleteStaffBtn?.addEventListener("click", () => {
    const currentEditingStaffId = getEditingStaffId();
    if (currentEditingStaffId) {
      confirmDeleteStaff(currentEditingStaffId);
    }
  });

  // 完了タブのソート機能
  elements.completedSortOrder?.addEventListener("change", (e) => {
    setCompletedSortOrder(e.target.value);
    import("./render.js").then(({ renderCompleted }) => renderCompleted());
  });

  // タブボタンのイベント
  elements.tabBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      switchTab(btn.dataset.tab);
    });
  });

  // 初期レンダリング
  renderBoard();
  renderStaff();
}

// DOMContentLoadedイベントで初期化
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

