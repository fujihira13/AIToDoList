/**
 * ユーティリティ関数
 * 共通で使用されるヘルパー関数を定義します
 */

import { state, priorityClassMap } from "./state.js";

/**
 * タスクリストをソートします
 * 象限 → 優先度 → 期限の順でソートします
 * @param {Array} list - ソートするタスクの配列
 * @returns {Array} ソートされたタスクの配列
 */
export function sortTasks(list) {
  const priorityOrder = { 高: 1, 中: 2, 低: 3 };
  return [...list].sort((a, b) => {
    const qa = a.quadrant || 4;
    const qb = b.quadrant || 4;
    if (qa !== qb) return qa - qb;
    // 優先度でソート（高い順）
    const pa = priorityOrder[a.priority] || 2;
    const pb = priorityOrder[b.priority] || 2;
    if (pa !== pb) return pa - pb;
    // 優先度が同じ場合は期限でソート
    const da = a.due_date || "9999-12-31";
    const db = b.due_date || "9999-12-31";
    return da.localeCompare(db);
  });
}

/**
 * 日付を日本語形式でフォーマットします
 * @param {string} value - 日付文字列（YYYY-MM-DD形式）
 * @returns {string} フォーマットされた日付文字列、または "-"
 */
export function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("ja-JP", { month: "short", day: "numeric" });
}

/**
 * スタッフIDからスタッフ情報を取得します
 * @param {number} id - スタッフID
 * @returns {Object|undefined} スタッフ情報、見つからない場合はundefined
 */
export function findStaff(id) {
  return state.staff.find((member) => member.id === id);
}

/**
 * アバター画像をレンダリングします
 * @param {Object} staff - スタッフ情報
 * @param {number|null} quadrant - 象限（1-4）、nullの場合は通常のアバター
 * @returns {string} HTML文字列
 */
export function renderAvatar(staff, quadrant = null) {
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

/**
 * 完了タスクをソートします（完了タブ用）
 * @param {Array} completedTasks - 完了タスクの配列
 * @param {string} sortOrder - ソート順序（"date-asc", "date-desc", "priority-asc", "priority-desc"）
 * @returns {Array} ソートされたタスクの配列
 */
export function sortCompletedTasks(completedTasks, sortOrder) {
  const priorityOrder = { 高: 1, 中: 2, 低: 3 };
  return [...completedTasks].sort((a, b) => {
    if (sortOrder.startsWith("date-")) {
      // 日付でソート
      const dateA = a.due_date || "";
      const dateB = b.due_date || "";
      if (sortOrder === "date-asc") {
        return dateA.localeCompare(dateB);
      } else {
        return dateB.localeCompare(dateA);
      }
    } else if (sortOrder.startsWith("priority-")) {
      // 優先度でソート
      const priorityA = priorityOrder[a.priority] || 2;
      const priorityB = priorityOrder[b.priority] || 2;
      if (sortOrder === "priority-asc") {
        return priorityA - priorityB;
      } else {
        return priorityB - priorityA;
      }
    }
    return 0;
  });
}

/**
 * メンバーリストをソートします（メンバー一覧用）
 * @param {Array} staffList - メンバーの配列
 * @param {string} sortOrder - ソート順序（"name-asc", "name-desc", "department-asc", "department-desc"）
 * @returns {Array} ソートされたメンバーの配列
 */
export function sortStaff(staffList, sortOrder) {
  // 日本語のソート用にIntl.Collatorを使用
  const collator = new Intl.Collator("ja", {
    numeric: true,
    sensitivity: "base",
  });
  
  return [...staffList].sort((a, b) => {
    if (sortOrder.startsWith("name-")) {
      // 名前でソート
      const nameA = a.name || "";
      const nameB = b.name || "";
      if (sortOrder === "name-asc") {
        return collator.compare(nameA, nameB);
      } else {
        return collator.compare(nameB, nameA);
      }
    } else if (sortOrder.startsWith("department-")) {
      // 職種（所属部署）でソート
      const deptA = a.department || "";
      const deptB = b.department || "";
      if (sortOrder === "department-asc") {
        // 職種が同じ場合は名前でソート
        if (deptA === deptB) {
          return collator.compare(a.name || "", b.name || "");
        }
        return collator.compare(deptA, deptB);
      } else {
        // 職種が同じ場合は名前でソート
        if (deptA === deptB) {
          return collator.compare(b.name || "", a.name || "");
        }
        return collator.compare(deptB, deptA);
      }
    }
    return 0;
  });
}

