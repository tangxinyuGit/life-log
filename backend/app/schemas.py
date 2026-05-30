from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Tag
# ---------------------------------------------------------------------------
class TagRead(BaseModel):
    id: int
    name: str
    created_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Category
# ---------------------------------------------------------------------------
class CategoryCreate(BaseModel):
    name: str
    color: str = "#6366f1"
    icon: Optional[str] = None
    sort_order: int = 0


class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None
    icon: Optional[str] = None
    sort_order: Optional[int] = None
    is_archived: Optional[bool] = None


class CategoryRead(BaseModel):
    id: int
    name: str
    color: str
    icon: Optional[str] = None
    sort_order: int
    is_archived: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Time Entry
# ---------------------------------------------------------------------------
class EntryCreate(BaseModel):
    title: str
    start_time: datetime
    end_time: datetime
    category_id: Optional[int] = None
    note: str = ""
    mood: Optional[int] = Field(default=None, ge=1, le=5)
    energy: Optional[int] = Field(default=None, ge=1, le=5)
    tags: list[str] = Field(default_factory=list)


class EntryUpdate(BaseModel):
    title: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    category_id: Optional[int] = None
    note: Optional[str] = None
    mood: Optional[int] = Field(default=None, ge=1, le=5)
    energy: Optional[int] = Field(default=None, ge=1, le=5)
    tags: Optional[list[str]] = Field(default=None)


class EntryRead(BaseModel):
    id: int
    title: str
    start_time: datetime
    end_time: datetime
    category_id: Optional[int] = None
    category: Optional[CategoryRead] = None
    note: str
    mood: Optional[int] = None
    energy: Optional[int] = None
    tags: list[TagRead] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class PaginatedEntries(BaseModel):
    items: list[EntryRead]
    total: int
    page: int
    page_size: int
    total_pages: int
