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
import { generateTestImage, editImageWithPrompt, generateFourExpressions } from "./api.js";

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

  // Gemini 画像編集テスト用
  // 画像プレビューの表示
  if (elements.geminiEditPhoto && elements.geminiEditPreview) {
    elements.geminiEditPhoto.addEventListener("change", (event) => {
      const file = event.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          elements.geminiEditPreview.innerHTML = `
            <p style="margin-bottom: 0.5rem; color: #666;">アップロードした画像:</p>
            <img src="${e.target.result}" alt="プレビュー" style="max-width: 200px; max-height: 200px; border-radius: 8px; border: 1px solid #ddd;" />
          `;
        };
        reader.readAsDataURL(file);
      } else {
        elements.geminiEditPreview.innerHTML = "";
      }
    });
  }

  // 画像編集ボタン
  if (
    elements.geminiEditBtn &&
    elements.geminiEditPhoto &&
    elements.geminiEditPrompt &&
    elements.geminiEditResult
  ) {
    elements.geminiEditBtn.addEventListener("click", async () => {
      const file = elements.geminiEditPhoto.files[0];
      if (!file) {
        elements.geminiEditResult.textContent = "画像ファイルを選択してください。";
        return;
      }

      const prompt =
        elements.geminiEditPrompt.value.trim() ||
        "この人物を怒っている表情にしてください。同じ人物であることが分かるように顔立ちや雰囲気を保ってください。";

      elements.geminiEditBtn.disabled = true;
      const originalLabel = elements.geminiEditBtn.textContent;
      elements.geminiEditBtn.textContent = "編集中…";
      elements.geminiEditResult.textContent =
        "Gemini API で画像を編集しています… (数秒から数十秒かかることがあります)";

      try {
        const data = await editImageWithPrompt(file, prompt);
        elements.geminiEditResult.innerHTML = `
          <p style="color: #28a745; font-weight: bold;">✓ 画像の編集に成功しました！</p>
          <p>編集された画像（static/avatars 配下に保存されています）:</p>
          <div style="display: flex; gap: 1rem; align-items: flex-start; flex-wrap: wrap;">
            <div>
              <p style="margin-bottom: 0.5rem; color: #666;">元の画像:</p>
              <img src="${elements.geminiEditPreview.querySelector("img")?.src || ""}" alt="元の画像" style="max-width: 200px; max-height: 200px; border-radius: 8px; border: 1px solid #ddd;" />
            </div>
            <div style="font-size: 2rem; align-self: center;">→</div>
            <div>
              <p style="margin-bottom: 0.5rem; color: #666;">編集後の画像:</p>
              <img src="${data.url}" alt="編集後の画像" style="max-width: 200px; max-height: 200px; border-radius: 8px; border: 2px solid #28a745;" />
            </div>
          </div>
          <p style="margin-top: 1rem;">ファイル名: ${data.filename}</p>
        `;
      } catch (error) {
        elements.geminiEditResult.innerHTML = `
          <p style="color: #dc3545; font-weight: bold;">✗ 画像の編集に失敗しました</p>
          <p>${error.message || "不明なエラーが発生しました"}</p>
        `;
      } finally {
        elements.geminiEditBtn.disabled = false;
        elements.geminiEditBtn.textContent = originalLabel || "画像を編集";
      }
    });
  }

  // Gemini 4表情生成テスト用
  // 画像プレビューの表示
  if (elements.geminiFourPhoto && elements.geminiFourPreview) {
    elements.geminiFourPhoto.addEventListener("change", (event) => {
      const file = event.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          elements.geminiFourPreview.innerHTML = `
            <p style="margin-bottom: 0.5rem; color: #666;">アップロードした画像:</p>
            <img src="${e.target.result}" alt="プレビュー" style="max-width: 200px; max-height: 200px; border-radius: 8px; border: 1px solid #ddd;" />
          `;
        };
        reader.readAsDataURL(file);
      } else {
        elements.geminiFourPreview.innerHTML = "";
      }
    });
  }

  // 4表情生成ボタン
  if (
    elements.geminiFourBtn &&
    elements.geminiFourPhoto &&
    elements.geminiFourResult
  ) {
    elements.geminiFourBtn.addEventListener("click", async () => {
      const file = elements.geminiFourPhoto.files[0];
      if (!file) {
        elements.geminiFourResult.textContent = "画像ファイルを選択してください。";
        return;
      }

      elements.geminiFourBtn.disabled = true;
      const originalLabel = elements.geminiFourBtn.textContent;
      elements.geminiFourBtn.textContent = "生成中…";
      elements.geminiFourResult.innerHTML = `
        <p>Gemini API で4種類の表情を生成しています…</p>
        <p style="color: #666; font-size: 0.9rem;">（4枚の画像を順番に生成するため、1〜2分かかることがあります）</p>
      `;

      try {
        const data = await generateFourExpressions(file);
        const originalSrc = elements.geminiFourPreview.querySelector("img")?.src || "";
        
        elements.geminiFourResult.innerHTML = `
          <p style="color: #28a745; font-weight: bold; margin-bottom: 1rem;">✓ 4種類の表情が生成されました！</p>
          
          <div style="margin-bottom: 1rem;">
            <p style="margin-bottom: 0.5rem; color: #666;">元の画像:</p>
            <img src="${originalSrc}" alt="元の画像" style="max-width: 150px; max-height: 150px; border-radius: 8px; border: 1px solid #ddd;" />
          </div>
          
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1rem;">
            <div style="border: 2px solid #dc3545; border-radius: 8px; padding: 1rem;">
              <p style="font-weight: bold; color: #dc3545; margin-bottom: 0.5rem;">Q1: 重要かつ緊急（怒り）</p>
              <img src="${data.q1_url}" alt="Q1" style="max-width: 100%; border-radius: 4px;" />
              <p style="font-size: 0.8rem; color: #666; margin-top: 0.5rem;">${data.q1_filename}</p>
            </div>
            
            <div style="border: 2px solid #28a745; border-radius: 8px; padding: 1rem;">
              <p style="font-weight: bold; color: #28a745; margin-bottom: 0.5rem;">Q2: 重要だが緊急ではない（やる気）</p>
              <img src="${data.q2_url}" alt="Q2" style="max-width: 100%; border-radius: 4px;" />
              <p style="font-size: 0.8rem; color: #666; margin-top: 0.5rem;">${data.q2_filename}</p>
            </div>
            
            <div style="border: 2px solid #ffc107; border-radius: 8px; padding: 1rem;">
              <p style="font-weight: bold; color: #856404; margin-bottom: 0.5rem;">Q3: 緊急だが重要ではない（困惑）</p>
              <img src="${data.q3_url}" alt="Q3" style="max-width: 100%; border-radius: 4px;" />
              <p style="font-size: 0.8rem; color: #666; margin-top: 0.5rem;">${data.q3_filename}</p>
            </div>
            
            <div style="border: 2px solid #17a2b8; border-radius: 8px; padding: 1rem;">
              <p style="font-weight: bold; color: #17a2b8; margin-bottom: 0.5rem;">Q4: 重要でも緊急でもない（リラックス）</p>
              <img src="${data.q4_url}" alt="Q4" style="max-width: 100%; border-radius: 4px;" />
              <p style="font-size: 0.8rem; color: #666; margin-top: 0.5rem;">${data.q4_filename}</p>
            </div>
          </div>
        `;
      } catch (error) {
        elements.geminiFourResult.innerHTML = `
          <p style="color: #dc3545; font-weight: bold;">✗ 4表情の生成に失敗しました</p>
          <p>${error.message || "不明なエラーが発生しました"}</p>
        `;
      } finally {
        elements.geminiFourBtn.disabled = false;
        elements.geminiFourBtn.textContent = originalLabel || "4種類の表情を生成";
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
