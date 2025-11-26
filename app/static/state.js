/**
 * アプリケーションの状態管理
 * グローバルな状態とDOM要素の参照を管理します
 */

// 初期データの読み込み
const dataScript = document.getElementById("initial-data");
let initial = {};
if (dataScript) {
  try {
    initial = JSON.parse(dataScript.textContent || "{}");
  } catch (error) {
    console.warn("初期データの解析に失敗しました", error);
  }
}

// アプリケーションの状態
export const state = {
  tasks: initial.tasks || [],
  staff: initial.staff || [],
  labels: initial.quadrant_labels || {},
  faces: initial.quadrant_faces || {},
  statusColors: initial.status_colors || {},
};

// 編集状態の管理
let editingId = null;
let deleteTargetId = null;
let deleteTargetStaffId = null;
let editingStaffId = null;
let completedSortOrder = "date-asc";
let staffSortOrder = "department-asc";
let staffFilterText = "";

// Getter関数
export function getEditingId() {
  return editingId;
}

export function getDeleteTargetId() {
  return deleteTargetId;
}

export function getDeleteTargetStaffId() {
  return deleteTargetStaffId;
}

export function getEditingStaffId() {
  return editingStaffId;
}

export function getCompletedSortOrder() {
  return completedSortOrder;
}

export function getStaffFilterText() {
  return staffFilterText;
}

export function getStaffSortOrder() {
  return staffSortOrder;
}

// 状態更新関数
export function setEditingId(id) {
  editingId = id;
}

export function setDeleteTargetId(id) {
  deleteTargetId = id;
}

export function setDeleteTargetStaffId(id) {
  deleteTargetStaffId = id;
}

export function setEditingStaffId(id) {
  editingStaffId = id;
}

export function setCompletedSortOrder(order) {
  completedSortOrder = order;
}

export function setStaffFilterText(text) {
  staffFilterText = text;
}

export function setStaffSortOrder(order) {
  staffSortOrder = order;
}

export function clearEditingState() {
  editingId = null;
  deleteTargetId = null;
  deleteTargetStaffId = null;
}

export function clearStaffEditingState() {
  editingStaffId = null;
  deleteTargetStaffId = null;
}

// DOM要素の参照
export const elements = {
  board: document.getElementById("board"),
  staffList: document.getElementById("staffList"),
  addTaskBtn: document.getElementById("addTaskBtn"),
  addStaffBtn: document.getElementById("addStaffBtn"),
  taskDialog: document.getElementById("taskDialog"),
  staffDialog: document.getElementById("staffDialog"),
  taskForm: document.getElementById("taskForm"),
  staffForm: document.getElementById("staffForm"),
  formStaffId: document.getElementById("staff_id"),
  taskFormTitle: document.getElementById("taskFormTitle"),
  deleteTaskBtn: document.getElementById("deleteTaskBtn"),
  cancelTaskBtn: document.getElementById("cancelTaskBtn"),
  cancelStaffBtn: document.getElementById("cancelStaffBtn"),
  formStatus: document.getElementById("formStatus"),
  staffFormStatus: document.getElementById("staffFormStatus"),
  ownerDept: document.getElementById("ownerDept"),
  confirmDialog: document.getElementById("confirmDialog"),
  confirmDeleteBtn: document.getElementById("confirmDeleteBtn"),
  confirmCancelBtn: document.getElementById("confirmCancelBtn"),
  confirmCloseBtn: document.getElementById("confirmCloseBtn"),
  tabBtns: document.querySelectorAll(".tab-btn"),
  tabPanels: document.querySelectorAll(".tab-panel"),
  quadrantOverview: document.getElementById("quadrantOverview"),
  staffDistribution: document.getElementById("staffDistribution"),
  dangerGauge: document.getElementById("dangerGauge"),
  dangerStaffList: document.getElementById("dangerStaffList"),
  dangerList: document.getElementById("dangerList"),
  completedList: document.getElementById("completedList"),
  completedSortOrder: document.getElementById("completedSortOrder"),
  staffSortOrder: document.getElementById("staffSortOrder"),
  staffFilter: document.getElementById("staffFilter"),
  staffFormTitle: document.getElementById("staffFormTitle"),
  submitStaffBtn: document.getElementById("submitStaffBtn"),
  deleteStaffBtn: document.getElementById("deleteStaffBtn"),
  confirmMessage: document.getElementById("confirmMessage"),
};

// 定数
export const quadrants = [1, 2, 3, 4];

export const priorityClassMap = {
  高: "high",
  中: "medium",
  低: "low",
};

