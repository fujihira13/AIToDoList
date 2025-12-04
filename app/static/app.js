/**
 * メインアプリケーションファイル
 * 初期化とイベントリスナーの設定を行います
 */

import {
  elements,
  getEditingId,
  getEditingStaffId,
  setCompletedSortOrder,
  setStaffSortOrder,
  setStaffFilterText,
} from "./state.js";
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
  moveTask,
} from "./events.js";
import { renderBoard, renderStaff } from "./render.js";
import { generateTestImage } from "./api.js";

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

  // メンバー一覧のソート機能
  elements.staffSortOrder?.addEventListener("change", (e) => {
    setStaffSortOrder(e.target.value);
    import("./render.js").then(({ renderStaff }) => renderStaff());
  });

  // メンバー一覧のフィルター機能
  const staffFilterInput = document.getElementById("staffFilter");
  if (staffFilterInput) {
    staffFilterInput.addEventListener("input", (e) => {
      setStaffFilterText(e.target.value);
      import("./render.js").then(({ renderStaff }) => renderStaff());
    });
  }

  // タブボタンのイベント
  elements.tabBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      switchTab(btn.dataset.tab);
    });
  });

  // カスタムイベントのリスナー（循環参照を避けるため）
  document.addEventListener("openTaskForm", (event) => {
    openForm(event.detail.taskId);
  });

  document.addEventListener("openStaffForm", (event) => {
    openStaffForm(event.detail.staffId);
  });

  document.addEventListener("moveTask", (event) => {
    moveTask(event.detail.taskId, event.detail.quadrant);
  });

  // Gemini テスト用ボタン
  if (
    elements.geminiTestBtn &&
    elements.geminiTestPrompt &&
    elements.geminiTestResult
  ) {
    elements.geminiTestBtn.addEventListener("click", async () => {
      const prompt =
        elements.geminiTestPrompt.value.trim() ||
        "コスプレしたバナナの画像を生成してください。";

      elements.geminiTestBtn.disabled = true;
      const originalLabel = elements.geminiTestBtn.textContent;
      elements.geminiTestBtn.textContent = "生成中…";
      elements.geminiTestResult.textContent =
        "Gemini API を呼び出しています…";

      try {
        const data = await generateTestImage(prompt);
        elements.geminiTestResult.innerHTML = `
          <p>生成された画像（static/avatars 配下に保存されています）:</p>
          <img src="${data.url}" alt="Geminiテスト画像" class="avatar" />
          <p>ファイル名: ${data.filename}</p>
        `;
      } catch (error) {
        elements.geminiTestResult.textContent =
          error.message || "画像の生成に失敗しました";
      } finally {
        elements.geminiTestBtn.disabled = false;
        elements.geminiTestBtn.textContent = originalLabel || "テスト画像を生成";
      }
    });
  }

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
