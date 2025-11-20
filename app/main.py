"""
FastAPI based Eisenhower-matrix board with lightweight JSON persistence.
All business copy on the UI stays in Japanese, but the backend is plain FastAPI.
"""

from __future__ import annotations

from pathlib import Path
from typing import Dict, List

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from . import repository, schemas

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"

app = FastAPI(title="Eisenhower Board", version="0.2.0")
templates = Jinja2Templates(directory=str(BASE_DIR / "templates"))
app.mount(
    "/static",
    StaticFiles(directory=str(BASE_DIR / "static")),
    name="static",
)

repo = repository.DataRepository(DATA_DIR)

QUADRANT_LABELS = {
    1: "\u91cd\u8981\u304b\u3064\u7dca\u6025",
    2: "\u91cd\u8981\u3060\u304c\u7dca\u6025\u3067\u306f\u306a\u3044",
    3: "\u7dca\u6025\u3060\u304c\u91cd\u8981\u3067\u306f\u306a\u3044",
    4: "\u91cd\u8981\u3067\u3082\u7dca\u6025\u3067\u3082\u306a\u3044",
}

STATUS_COLORS = {
    "\u672a\u7740\u624b": "badge--todo",
    "\u9032\u884c\u4e2d": "badge--doing",
    "\u5b8c\u4e86": "badge--done",
}

STATUS_OPTIONS = [{"value": value, "label": value} for value in STATUS_COLORS.keys()]

PRIORITY_OPTIONS = [
    {"value": "\u9ad8", "label": "\u9ad8"},
    {"value": "\u4e2d", "label": "\u4e2d"},
    {"value": "\u4f4e", "label": "\u4f4e"},
]

COPY = {
    "page_label": "Internal preview",
    "page_title": "Eisenhower Matrix TODO Board",
    "page_sub": "Drag tasks between quadrants, edit inline, and sync with the mock API.",
    "add_task": "Add Task",
    "hint_title": "Launch locally",
    "staff_title": "Staff roster",
    "staff_sub": "Manage faces from Django admin / JSON for now.",
    "form_create": "Create task",
    "form_edit": "Update task",
    "delete_task": "Delete",
    "save_task": "Save",
    "cancel": "Cancel",
    "confirm": "Delete",
    "confirm_delete": "This action permanently removes the task. Continue?",
    "footnote": "\u00a9 2025 Eisenhower Board Mock",
}


def _serialized_tasks() -> List[Dict]:
    staff_map = repo.staff_map()
    tasks = [repository.serialize_task(task, staff_map) for task in repo.list_tasks()]
    tasks.sort(key=lambda item: (item["quadrant"], item.get("due_date") or ""))
    return tasks


def _ensure_staff(owner_id: int) -> None:
    if owner_id not in repo.staff_map():
        raise HTTPException(status_code=400, detail="owner_id \u304c\u5b58\u5728\u3057\u307e\u305b\u3093")


def _task_or_404(task_id: int) -> Dict:
    try:
        return repo.get_task(task_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="\u30bf\u30b9\u30af\u304c\u898b\u3064\u304b\u308a\u307e\u305b\u3093") from exc


@app.get("/", response_class=HTMLResponse)
async def render_board(request: Request) -> HTMLResponse:
    tasks = _serialized_tasks()
    staff = repo.list_staff()
    quadrant_faces = {
        1: {"emoji": "\U0001F525", "caption": "Do now"},
        2: {"emoji": "\U0001F9E0", "caption": "Plan it"},
        3: {"emoji": "\u26A0", "caption": "Delegate"},
        4: {"emoji": "\U0001F33F", "caption": "Eliminate/Relax"},
    }
    return templates.TemplateResponse(
        "index.html",
        {
            "request": request,
            "copy": COPY,
            "quadrant_labels": QUADRANT_LABELS,
            "status_colors": STATUS_COLORS,
            "status_options": STATUS_OPTIONS,
            "priority_options": PRIORITY_OPTIONS,
            "staff": staff,
            "initial_payload": {
                "tasks": tasks,
                "staff": staff,
                "quadrant_labels": QUADRANT_LABELS,
                "status_colors": STATUS_COLORS,
                "quadrant_faces": quadrant_faces,
            },
            "quadrant_faces": quadrant_faces,
        },
    )


@app.get("/api/staff", response_model=schemas.StaffList)
async def api_staff() -> Dict[str, List[Dict]]:
    return {"staff": repo.list_staff()}


@app.get("/api/tasks", response_model=schemas.TaskList)
async def api_tasks() -> Dict[str, List[Dict]]:
    return {"tasks": _serialized_tasks()}


@app.post(
    "/api/tasks",
    response_model=schemas.TaskOut,
    status_code=status.HTTP_201_CREATED,
)
async def api_create_task(payload: schemas.TaskCreate) -> Dict:
    _ensure_staff(payload.owner_id)
    created = repo.create_task(payload)
    return repository.serialize_task(created, repo.staff_map())


@app.put("/api/tasks/{task_id}", response_model=schemas.TaskOut)
async def api_update_task(task_id: int, payload: schemas.TaskUpdate) -> Dict:
    _task_or_404(task_id)
    if payload.owner_id is not None:
        _ensure_staff(payload.owner_id)
    updated = repo.update_task(task_id, payload)
    return repository.serialize_task(updated, repo.staff_map())


@app.patch("/api/tasks/{task_id}/quadrant", response_model=schemas.TaskOut)
async def api_move_task(task_id: int, payload: schemas.TaskQuadrantUpdate) -> Dict:
    _task_or_404(task_id)
    updated = repo.move_task(task_id, payload.quadrant)
    return repository.serialize_task(updated, repo.staff_map())


@app.delete("/api/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def api_delete_task(task_id: int) -> None:
    _task_or_404(task_id)
    repo.delete_task(task_id)
