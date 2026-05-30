import math
from datetime import date, datetime, time

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_session
from app.models import Tag, TimeEntry
from app.schemas import EntryCreate, EntryRead, EntryUpdate, PaginatedEntries, TagRead

router = APIRouter(tags=["entries"])


# ---------------------------------------------------------------------------
# Helper: resolve tag names → Tag objects, auto-creating if needed
# ---------------------------------------------------------------------------
async def _resolve_tags(session: AsyncSession, tag_names: list[str]) -> list[Tag]:
    if not tag_names:
        return []

    tags: list[Tag] = []
    for name in tag_names:
        name = name.strip()
        if not name:
            continue
        result = await session.execute(select(Tag).where(Tag.name == name))
        tag = result.scalar_one_or_none()
        if tag is None:
            tag = Tag(name=name)
            session.add(tag)
            await session.flush()  # get the id
        tags.append(tag)
    return tags


# ---------------------------------------------------------------------------
# Entries CRUD
# ---------------------------------------------------------------------------

@router.post("/entries", response_model=EntryRead, status_code=201)
async def create_entry(
    body: EntryCreate,
    session: AsyncSession = Depends(get_session),
):
    tags = await _resolve_tags(session, body.tags)

    entry = TimeEntry(
        title=body.title,
        start_time=body.start_time,
        end_time=body.end_time,
        category_id=body.category_id,
        note=body.note,
        mood=body.mood,
        energy=body.energy,
    )
    entry.tags = tags
    session.add(entry)
    await session.commit()

    # Re-fetch with relationships loaded for response serialization
    stmt = (
        select(TimeEntry)
        .options(selectinload(TimeEntry.category), selectinload(TimeEntry.tags))
        .where(TimeEntry.id == entry.id)
    )
    result = await session.execute(stmt)
    return result.scalar_one()


@router.get("/entries", response_model=PaginatedEntries)
async def list_entries(
    date_filter: date | None = Query(None, alias="date"),
    start_date: date | None = Query(None),
    end_date: date | None = Query(None),
    category_id: int | None = Query(None),
    keyword: str | None = Query(None),
    tag: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=500),
    session: AsyncSession = Depends(get_session),
):
    stmt = select(TimeEntry).options(selectinload(TimeEntry.category), selectinload(TimeEntry.tags))
    count_stmt = select(func.count(TimeEntry.id))

    # Filter: single date
    if date_filter is not None:
        day_start = datetime.combine(date_filter, time.min)
        day_end = datetime.combine(date_filter, time.max)
        stmt = stmt.where(TimeEntry.start_time >= day_start, TimeEntry.start_time <= day_end)
        count_stmt = count_stmt.where(TimeEntry.start_time >= day_start, TimeEntry.start_time <= day_end)

    # Filter: date range
    if start_date is not None:
        range_start = datetime.combine(start_date, time.min)
        stmt = stmt.where(TimeEntry.start_time >= range_start)
        count_stmt = count_stmt.where(TimeEntry.start_time >= range_start)
    if end_date is not None:
        range_end = datetime.combine(end_date, time.max)
        stmt = stmt.where(TimeEntry.start_time <= range_end)
        count_stmt = count_stmt.where(TimeEntry.start_time <= range_end)

    # Filter: category
    if category_id is not None:
        stmt = stmt.where(TimeEntry.category_id == category_id)
        count_stmt = count_stmt.where(TimeEntry.category_id == category_id)

    # Filter: keyword (search title and note)
    if keyword:
        pattern = f"%{keyword}%"
        stmt = stmt.where(TimeEntry.title.ilike(pattern) | TimeEntry.note.ilike(pattern))
        count_stmt = count_stmt.where(TimeEntry.title.ilike(pattern) | TimeEntry.note.ilike(pattern))

    # Filter: tag
    if tag:
        stmt = stmt.where(TimeEntry.tags.any(Tag.name == tag))
        count_stmt = count_stmt.where(TimeEntry.tags.any(Tag.name == tag))

    # Total count
    total_result = await session.execute(count_stmt)
    total = total_result.scalar_one()

    # Pagination
    total_pages = max(1, math.ceil(total / page_size))
    offset = (page - 1) * page_size

    stmt = stmt.order_by(TimeEntry.start_time.desc()).offset(offset).limit(page_size)
    result = await session.execute(stmt)
    entries = result.scalars().all()

    return PaginatedEntries(
        items=entries,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.get("/entries/{entry_id}", response_model=EntryRead)
async def get_entry(
    entry_id: int,
    session: AsyncSession = Depends(get_session),
):
    stmt = select(TimeEntry).options(selectinload(TimeEntry.category), selectinload(TimeEntry.tags)).where(TimeEntry.id == entry_id)
    result = await session.execute(stmt)
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    return entry


@router.put("/entries/{entry_id}", response_model=EntryRead)
async def update_entry(
    entry_id: int,
    body: EntryUpdate,
    session: AsyncSession = Depends(get_session),
):
    stmt = select(TimeEntry).options(selectinload(TimeEntry.category), selectinload(TimeEntry.tags)).where(TimeEntry.id == entry_id)
    result = await session.execute(stmt)
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")

    update_data = body.model_dump(exclude_unset=True)

    # Handle tags separately
    if "tags" in update_data:
        tag_names = update_data.pop("tags")
        entry.tags = await _resolve_tags(session, tag_names)

    for key, value in update_data.items():
        setattr(entry, key, value)

    await session.commit()
    await session.refresh(entry)
    return entry


@router.delete("/entries/{entry_id}", status_code=204)
async def delete_entry(
    entry_id: int,
    session: AsyncSession = Depends(get_session),
):
    entry = await session.get(TimeEntry, entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")

    await session.delete(entry)
    await session.commit()


# ---------------------------------------------------------------------------
# Tags
# ---------------------------------------------------------------------------

@router.get("/tags", response_model=list[TagRead])
async def list_tags(
    keyword: str | None = Query(None),
    session: AsyncSession = Depends(get_session),
):
    stmt = select(Tag).order_by(Tag.name)
    if keyword:
        stmt = stmt.where(Tag.name.contains(keyword))
    result = await session.execute(stmt)
    return result.scalars().all()
