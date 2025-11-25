from __future__ import annotations

import json
from pathlib import Path
from threading import Lock
from typing import Any, Dict, List, Optional

from . import schemas

TaskRecord = Dict[str, Any]
StaffRecord = Dict[str, Any]


class DataRepository:
    """File-based micro datastore (no external DB required)."""

    def __init__(self, data_dir: Path) -> None:
        self._data_dir = data_dir
        self._data_dir.mkdir(parents=True, exist_ok=True)
        self._tasks_file = self._data_dir / "tasks.json"
        self._staff_file = self._data_dir / "staff.json"
        self._lock = Lock()
        self._tasks: List[TaskRecord] = self._load_json(self._tasks_file, [])
        self._staff: List[StaffRecord] = self._load_json(self._staff_file, [])
        self._next_task_id = self._calculate_next_id(self._tasks)
        self._next_staff_id = self._calculate_next_id(self._staff)

    # ---------- public API ----------
    def list_staff(self) -> List[StaffRecord]:
        return list(self._staff)

    def staff_map(self) -> Dict[int, StaffRecord]:
        return {entry["id"]: entry for entry in self._staff}

    def list_tasks(self) -> List[TaskRecord]:
        return [task.copy() for task in self._tasks]

    def get_task(self, task_id: int) -> TaskRecord:
        for task in self._tasks:
            if task["id"] == task_id:
                return task
        raise KeyError(task_id)

    def create_task(self, payload: schemas.TaskCreate) -> TaskRecord:
        data = self._normalize_task(payload.model_dump())
        with self._lock:
            data["id"] = self._next_task_id
            self._next_task_id += 1
            self._tasks.append(data)
            self._persist_tasks()
        return data.copy()

    def update_task(self, task_id: int, payload: schemas.TaskUpdate) -> TaskRecord:
        update_data = self._normalize_task_update(payload.model_dump(exclude_unset=True))
        with self._lock:
            task = self.get_task(task_id)
            task.update(update_data)
            self._persist_tasks()
            return task.copy()

    def delete_task(self, task_id: int) -> None:
        with self._lock:
            index = next((i for i, task in enumerate(self._tasks) if task["id"] == task_id), -1)
            if index == -1:
                raise KeyError(task_id)
            self._tasks.pop(index)
            self._persist_tasks()

    def move_task(self, task_id: int, quadrant: int) -> TaskRecord:
        with self._lock:
            task = self.get_task(task_id)
            task["quadrant"] = quadrant
            self._persist_tasks()
            return task.copy()

    def create_staff(self, payload: schemas.StaffCreate) -> StaffRecord:
        data = payload.model_dump(exclude_unset=True)
        with self._lock:
            data["id"] = self._next_staff_id
            self._next_staff_id += 1
            self._staff.append(data)
            self._persist_staff()
        return data.copy()

    def get_staff(self, staff_id: int) -> StaffRecord:
        for staff in self._staff:
            if staff["id"] == staff_id:
                return staff
        raise KeyError(staff_id)

    def update_staff(self, staff_id: int, payload: schemas.StaffUpdate) -> StaffRecord:
        update_data = payload.model_dump(exclude_unset=True)
        with self._lock:
            staff = self.get_staff(staff_id)
            staff.update(update_data)
            self._persist_staff()
            return staff.copy()

    def delete_staff(self, staff_id: int) -> None:
        with self._lock:
            index = next((i for i, staff in enumerate(self._staff) if staff["id"] == staff_id), -1)
            if index == -1:
                raise KeyError(staff_id)
            self._staff.pop(index)
            self._persist_staff()

    # ---------- helpers ----------
    def _calculate_next_id(self, records: List[TaskRecord]) -> int:
        if not records:
            return 1
        return max(task["id"] for task in records) + 1

    def _load_json(self, file_path: Path, default: Any) -> Any:
        if not file_path.exists():
            return default
        text = file_path.read_text(encoding="utf-8")
        return json.loads(text)

    def _persist_tasks(self) -> None:
        self._tasks_file.write_text(
            json.dumps(self._tasks, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

    def _persist_staff(self) -> None:
        self._staff_file.write_text(
            json.dumps(self._staff, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

    @staticmethod
    def _normalize_task(data: Dict[str, Any]) -> Dict[str, Any]:
        due_date = data.get("due_date")
        if due_date is not None:
            data["due_date"] = str(due_date)
        return data

    @staticmethod
    def _normalize_task_update(data: Dict[str, Any]) -> Dict[str, Any]:
        if "due_date" in data and data["due_date"] is not None:
            data["due_date"] = str(data["due_date"])
        return data


def serialize_task(task: TaskRecord, staff_map: Dict[int, StaffRecord]) -> Dict[str, Any]:
    owner = staff_map.get(task.get("owner_id"))
    return {
        **task,
        "owner": owner,
    }
