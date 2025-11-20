"""
FastAPI ベースのモック版アイゼンハワーマトリクス Web アプリ。

uvicorn で起動すると http://127.0.0.1:8000/ にボード画面が表示される。
"""

from pathlib import Path
from typing import Any, Dict, List

from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

# プロジェクト内のテンプレート / 静的ファイルの場所を表す Path オブジェクトを作成しておく
BASE_DIR = Path(__file__).resolve().parent

app = FastAPI(title="Eisenhower Board Mock", version="0.1.0")

# Jinja2 テンプレートエンジンにテンプレート格納場所を教える
templates = Jinja2Templates(directory=str(BASE_DIR / "templates"))

# CSS や画像を提供するために /static パスをマウント
app.mount(
    "/static",
    StaticFiles(directory=str(BASE_DIR / "static")),
    name="static",
)

TaskDict = Dict[str, Any]


def build_mock_tasks() -> List[TaskDict]:
    """画面用のダミーデータを返す。"""
    return [
        {
            "title": "機能要件ドラフトのレビュー",
            "owner": "佐藤",
            "department": "企画",
            "status": "進行中",
            "due_date": "2025-11-30",
            "priority": "高",
            "quadrant": 1,
        },
        {
            "title": "UI モックアップ共有会",
            "owner": "山田",
            "department": "デザイン",
            "status": "未着手",
            "due_date": "2025-12-05",
            "priority": "中",
            "quadrant": 2,
        },
        {
            "title": "プリンタトナー交換",
            "owner": "田中",
            "department": "総務",
            "status": "完了",
            "due_date": "2025-11-18",
            "priority": "低",
            "quadrant": 3,
        },
        {
            "title": "BGM プレイリスト更新",
            "owner": "鈴木",
            "department": "広報",
            "status": "未着手",
            "due_date": "2025-12-20",
            "priority": "低",
            "quadrant": 4,
        },
    ]


def group_by_quadrant(tasks: List[TaskDict]) -> Dict[int, List[TaskDict]]:
    """各タスクを象限ごとに振り分ける。"""
    quadrants: Dict[int, List[TaskDict]] = {1: [], 2: [], 3: [], 4: []}
    for task in tasks:
        target_list = quadrants.get(task["quadrant"], quadrants[4])
        target_list.append(task)
    return quadrants


@app.get("/", response_class=HTMLResponse)
async def render_board(request: Request) -> HTMLResponse:
    """メインボード画面をレンダリングして返す。"""
    tasks = build_mock_tasks()
    quadrants = group_by_quadrant(tasks)
    quadrant_labels = {
        1: "重要かつ緊急",
        2: "重要だが緊急ではない",
        3: "緊急だが重要ではない",
        4: "重要でも緊急でもない",
    }
    status_colors = {
        "未着手": "badge--todo",
        "進行中": "badge--doing",
        "完了": "badge--done",
    }
    return templates.TemplateResponse(
        "index.html",
        {
            "request": request,
            "quadrants": quadrants,
            "quadrant_labels": quadrant_labels,
            "status_colors": status_colors,
        },
    )


@app.get("/api/tasks")
async def list_tasks() -> Dict[str, List[TaskDict]]:
    """JSON API でタスク一覧を返すシンプルなエンドポイント。"""
    return {"tasks": build_mock_tasks()}

