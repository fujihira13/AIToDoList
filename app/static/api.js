/**
 * API通信モジュール
 * サーバーとの通信を担当します
 */

/**
 * 汎用APIリクエスト関数
 * @param {string} url - リクエストURL
 * @param {Object} options - fetchオプション
 * @returns {Promise} レスポンスデータ
 */
export async function request(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
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

/**
 * タスクを作成します
 * @param {Object} payload - タスクデータ
 * @returns {Promise<Object>} 作成されたタスク
 */
export async function createTask(payload) {
  return request("/api/tasks", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/**
 * タスクを更新します
 * @param {number} taskId - タスクID
 * @param {Object} payload - 更新データ
 * @returns {Promise<Object>} 更新されたタスク
 */
export async function updateTask(taskId, payload) {
  return request(`/api/tasks/${taskId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

/**
 * タスクを削除します
 * @param {number} taskId - タスクID
 * @returns {Promise<void>}
 */
export async function deleteTask(taskId) {
  return request(`/api/tasks/${taskId}`, {
    method: "DELETE",
  });
}

/**
 * タスクの象限を移動します
 * @param {number} taskId - タスクID
 * @param {number} quadrant - 新しい象限（1-4）
 * @returns {Promise<Object>} 更新されたタスク
 */
export async function moveTask(taskId, quadrant) {
  return request(`/api/tasks/${taskId}/quadrant`, {
    method: "PATCH",
    body: JSON.stringify({ quadrant }),
  });
}

/**
 * スタッフを作成します
 * @param {FormData} formData - フォームデータ
 * @returns {Promise<Object>} 作成されたスタッフ
 */
export async function createStaff(formData) {
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

  return response.json();
}

/**
 * スタッフを更新します
 * @param {number} staffId - スタッフID
 * @param {FormData} formData - フォームデータ
 * @returns {Promise<Object>} 更新されたスタッフ
 */
export async function updateStaff(staffId, formData) {
  const response = await fetch(`/api/staff/${staffId}`, {
    method: "PUT",
    body: formData,
  });

  if (!response.ok) {
    let message = "メンバーの更新に失敗しました";
    try {
      const payload = await response.json();
      if (typeof payload.detail === "string") message = payload.detail;
    } catch (_) {
      // ignore
    }
    throw new Error(message);
  }

  return response.json();
}

/**
 * スタッフを削除します
 * @param {number} staffId - スタッフID
 * @returns {Promise<void>}
 */
export async function deleteStaff(staffId) {
  return request(`/api/staff/${staffId}`, {
    method: "DELETE",
  });
}

/**
 * Geminiテスト用の画像を生成します
 * @param {string} prompt - 生成したい画像の説明文
 * @returns {Promise<{filename: string, url: string}>}
 */
export async function generateTestImage(prompt) {
  return request("/api/gemini/test-image", {
    method: "POST",
    body: JSON.stringify({ prompt }),
  });
}

