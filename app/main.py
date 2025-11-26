"""
FastAPI based Eisenhower-matrix board with lightweight JSON persistence.
All business copy on the UI stays in Japanese, but the backend is plain FastAPI.
"""

from __future__ import annotations

import shutil
from pathlib import Path
from typing import Dict, List
from uuid import uuid4

from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile, status
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from starlette.middleware.base import BaseHTTPMiddleware

from . import repository, schemas

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
AVATARS_DIR = BASE_DIR / "static" / "avatars"

app = FastAPI(title="Eisenhower Board", version="0.2.0")
templates = Jinja2Templates(directory=str(BASE_DIR / "templates"))

# 開発環境で静的ファイルのキャッシュを無効化するミドルウェア
class NoCacheMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        response = await call_next(request)
        if request.url.path.startswith("/static/"):
            response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
            response.headers["Pragma"] = "no-cache"
            response.headers["Expires"] = "0"
        return response

app.add_middleware(NoCacheMiddleware)

app.mount(
    "/static",
    StaticFiles(directory=str(BASE_DIR / "static")),
    name="static",
)

repo = repository.DataRepository(DATA_DIR)
AVATARS_DIR.mkdir(parents=True, exist_ok=True)

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
    "page_label": "\u793e\u5185\u5411\u3051\u30d7\u30ec\u30d3\u30e5\u30fc",
    "page_title": "",
    "page_sub": "\u30bf\u30b9\u30af\u3092\u30c9\u30e9\u30c3\u30b0\u3067\u79fb\u52d5\u3057\u306a\u304c\u3089\u305d\u306e\u5834\u3067\u7de8\u96c6\u3057\u3001\u30e2\u30c3\u30afAPI\u3068\u540c\u671f\u3067\u304d\u307e\u3059\u3002",
    "add_task": "\u30bf\u30b9\u30af\u3092\u8ffd\u52a0",
    "hint_title": "\u30ed\u30fc\u30ab\u30eb\u3067\u8d77\u52d5",
    "staff_title": "\u30e1\u30f3\u30d0\u30fc\u4e00\u89a7",
    "staff_sub": "\u9854\u5199\u3084\u60c5\u5831\u306f\u5f53\u9762Django\u7ba1\u7406\u307e\u305f\u306fJSON\u3067\u5bfe\u5fdc\u3057\u3066\u304f\u3060\u3055\u3044\u3002",
    "form_create": "\u30bf\u30b9\u30af\u3092\u4f5c\u6210",
    "form_edit": "\u30bf\u30b9\u30af\u3092\u66f4\u65b0",
    "delete_task": "\u524a\u9664",
    "save_task": "\u4fdd\u5b58",
    "cancel": "\u30ad\u30e3\u30f3\u30bb\u30eb",
    "confirm": "\u524a\u9664",
    "confirm_delete": "\u3053\u306e\u64cd\u4f5c\u3067\u30bf\u30b9\u30af\u304c\u5b8c\u5168\u306b\u524a\u9664\u3055\u308c\u307e\u3059\u3002\u7d9a\u884c\u3057\u307e\u3059\u304b\uff1f",
    "footnote": "\u00a9 2025 Eisenhower Board Mock (\u793e\u5185\u7528)",
}


def _serialized_tasks() -> List[Dict]:
    staff_map = repo.staff_map()
    tasks = [repository.serialize_task(task, staff_map) for task in repo.list_tasks()]
    tasks.sort(key=lambda item: (item["quadrant"], item.get("due_date") or ""))
    return tasks


def _ensure_staff(owner_id: int) -> None:
    if owner_id not in repo.staff_map():
        raise HTTPException(status_code=400, detail="担当者が存在しません")


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
        1: {"emoji": "\U0001F525", "caption": "\u4eca\u3059\u3050\u5bfe\u5fdc"},
        2: {"emoji": "\U0001F9E0", "caption": "\u8a08\u753b\u7684\u306b\u9032\u3081\u308b"},
        3: {"emoji": "\u26A0", "caption": "\u4ed6\u8005\u306b\u4efb\u305b\u308b"},
        4: {"emoji": "\U0001F33F", "caption": "\u624b\u653e\u3057\u307e\u305f\u306f\u4f11\u3080"},
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


@app.post(
    "/api/staff",
    response_model=schemas.Staff,
    status_code=status.HTTP_201_CREATED,
)
async def api_create_staff(
    name: str = Form(...),
    department: str = Form(None),
    photo: UploadFile = File(None),
) -> Dict:
    """メンバーを追加します。アバター画像をアップロードできます。"""
    # 画像ファイルを保存
    photo_filename = None
    if photo and photo.filename:
        # ファイル拡張子を取得
        ext = Path(photo.filename).suffix or ".png"
        # ユニークなファイル名を生成
        filename = f"{uuid4()}{ext}"
        file_path = AVATARS_DIR / filename
        
        # ファイルを保存
        with file_path.open("wb") as buffer:
            shutil.copyfileobj(photo.file, buffer)
        
        photo_filename = filename
    
    # メンバーを作成
    payload = schemas.StaffCreate(
        name=name,
        department=department if department else None,
        photo=photo_filename,
    )
    created = repo.create_staff(payload)
    return created


@app.put("/api/staff/{staff_id}", response_model=schemas.Staff)
async def api_update_staff(
    staff_id: int,
    name: str = Form(...),
    department: str = Form(None),
    photo: UploadFile = File(None),
) -> Dict:
    """メンバーを更新します。アバター画像をアップロードできます。"""
    try:
        staff = repo.get_staff(staff_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="メンバーが見つかりません") from exc
    
    # 画像ファイルを保存
    photo_filename = None
    if photo and photo.filename:
        # 古い画像ファイルを削除
        for key in ["photo", "photo_q1", "photo_q2", "photo_q3", "photo_q4"]:
            if key in staff and staff[key]:
                img_path = AVATARS_DIR / staff[key]
                if img_path.exists():
                    img_path.unlink()
        
        # ファイル拡張子を取得
        ext = Path(photo.filename).suffix or ".png"
        # ユニークなファイル名を生成
        filename = f"{uuid4()}{ext}"
        file_path = AVATARS_DIR / filename
        
        # ファイルを保存
        with file_path.open("wb") as buffer:
            shutil.copyfileobj(photo.file, buffer)
        
        photo_filename = filename
    else:
        # 画像がアップロードされていない場合は既存の画像を保持
        photo_filename = staff.get("photo")
    
    # メンバーを更新
    payload = schemas.StaffUpdate(
        name=name,
        department=department if department else None,
        photo=photo_filename,
    )
    updated = repo.update_staff(staff_id, payload)
    return updated


@app.delete("/api/staff/{staff_id}", status_code=status.HTTP_204_NO_CONTENT)
async def api_delete_staff(staff_id: int) -> None:
    """メンバーを削除します。"""
    try:
        staff = repo.get_staff(staff_id)
        
        # 画像ファイルを削除
        for key in ["photo", "photo_q1", "photo_q2", "photo_q3", "photo_q4"]:
            if key in staff and staff[key]:
                img_path = AVATARS_DIR / staff[key]
                if img_path.exists():
                    img_path.unlink()
        
        repo.delete_staff(staff_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="メンバーが見つかりません") from exc
