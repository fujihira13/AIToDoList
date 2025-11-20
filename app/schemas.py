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
    photo: Optional[str] = None


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
