from __future__ import annotations

from datetime import date
from typing import Literal, Optional

from pydantic import BaseModel, Field

StatusLiteral = Literal["\u672a\u7740\u624b", "\u9032\u884c\u4e2d", "\u5b8c\u4e86"]
PriorityLiteral = Literal["\u9ad8", "\u4e2d", "\u4f4e"]


class Staff(BaseModel):
    id: int
    name: str
    department: Optional[str] = None
    photo: Optional[str] = None  # 後方互換性のため残す
    photo_q1: Optional[str] = None  # 第1象限用（重要かつ緊急）
    photo_q2: Optional[str] = None  # 第2象限用（重要だが緊急ではない）
    photo_q3: Optional[str] = None  # 第3象限用（緊急だが重要ではない）
    photo_q4: Optional[str] = None  # 第4象限用（重要でも緊急でもない）


class StaffCreate(BaseModel):
    name: str = Field(..., max_length=50)
    department: Optional[str] = Field(None, max_length=50)
    photo: Optional[str] = None
    # 第1〜第4象限用の画像ファイル名
    # - create_staff 時にGemini / Nano Banana Proで自動生成された画像のファイル名を格納します
    photo_q1: Optional[str] = None
    photo_q2: Optional[str] = None
    photo_q3: Optional[str] = None
    photo_q4: Optional[str] = None


class StaffUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=50)
    department: Optional[str] = Field(None, max_length=50)
    photo: Optional[str] = None
    # 既存メンバーの画像を差し替える場合に、第1〜第4象限用の画像ファイル名を更新します
    photo_q1: Optional[str] = None
    photo_q2: Optional[str] = None
    photo_q3: Optional[str] = None
    photo_q4: Optional[str] = None


class TaskBase(BaseModel):
    title: str = Field(..., max_length=80)
    description: Optional[str] = Field(None, max_length=500)
    owner_id: int
    created_by: Optional[str] = None
    due_date: Optional[date] = None
    status: StatusLiteral = "\u672a\u7740\u624b"
    department: Optional[str] = None
    priority: PriorityLiteral = "\u4e2d"
    quadrant: int = Field(1, ge=1, le=4)


class TaskCreate(TaskBase):
    pass


class TaskUpdate(BaseModel):
    title: Optional[str] = Field(None, max_length=80)
    description: Optional[str] = Field(None, max_length=500)
    owner_id: Optional[int] = None
    created_by: Optional[str] = None
    due_date: Optional[date] = None
    status: Optional[StatusLiteral] = None
    department: Optional[str] = None
    priority: Optional[PriorityLiteral] = None
    quadrant: Optional[int] = Field(None, ge=1, le=4)


class TaskQuadrantUpdate(BaseModel):
    quadrant: int = Field(..., ge=1, le=4)


class TaskOut(TaskBase):
    id: int
    owner: Staff


class StaffList(BaseModel):
    staff: list[Staff]


class TaskList(BaseModel):
    tasks: list[TaskOut]


class GeminiTestRequest(BaseModel):
    """Gemini テスト用：1枚の画像を生成するための簡単なリクエストボディ。"""

    prompt: str = Field(
        ...,
        max_length=300,
        description="生成したい画像の説明文（プロンプト）",
    )


class GeminiTestResponse(BaseModel):
    """Gemini テスト用：生成された画像ファイルの情報を返します。"""

    filename: str
    url: str


class GeminiEditResponse(BaseModel):
    """Gemini 画像編集テスト用：編集された画像ファイルの情報を返します。"""

    filename: str
    url: str
