import math
from datetime import date, datetime, time

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_session
from app.models import Category, Tag, TimeEntry
from app.schemas import EntryCreate, EntryRead, EntryUpdate, PaginatedEntries, TagRead

router = APIRouter(tags=["entries"])

MAX_TAG_LENGTH = 50


# ---------------------------------------------------------------------------
# Helper: resolve tag names → Tag objects, auto-creating if needed
# ---------------------------------------------------------------------------
async def _resolve_tags(session: AsyncSession, tag_names: list[str]) -> list[Tag]:
    # Trim, strip empties, truncate, lower-case (tags are case-insensitive)
    cleaned: list[str] = []
    seen: set[str] = set()
    for raw in tag_names:
        name = raw.strip().lower()[:MAX_TAG_LENGTH]
        if name and name not in seen:
            cleaned.append(name)
            seen.add(name)

    if not cleaned:
        return []

    # Batch-query existing tags
    result = await session.execute(select(Tag).where(Tag.name.in_(cleaned)))
    existing = {t.name: t for t in result.scalars().all()}

    tags: list[Tag] = []
    for name in cleaned:
        tag = existing.get(name)
        if tag is None:
            # Handle concurrent unique-violation gracefully with SAVEPOINT
            try:
                async with session.begin_nested():
                    session.add(Tag(name=name))
            except Exception:
                # Re-query — another request already created this tag
                re_result = await session.execute(select(Tag).where(Tag.name == name))
                tag = re_result.scalar_one_or_none()
                if tag is None:
                    raise
                tags.append(tag)
                continue
            # Flush to get the id after nested transaction committed
            await session.flush()
            # Re-fetch the newly created tag
            re_result = await session.execute(select(Tag).where(Tag.name == name))
            tag = re_result.scalar_one()
        tags.append(tag)
    return tags


# ---------------------------------------------------------------------------
# Helper: validate category_id exists
# ---------------------------------------------------------------------------
async def _validate_category(session: AsyncSession, category_id: int | None) -> None:
    if category_id is None:
        return
    cat = await session.get(Category, category_id)
    if cat is None:
        raise HTTPException(status_code=422, detail=f"Category id={category_id} not found")


# ---------------------------------------------------------------------------
# Helper: reload entry with relationships
# ---------------------------------------------------------------------------
async def _reload_entry(session: AsyncSession, entry_id: int) -> TimeEntry:
    stmt = (
        select(TimeEntry)
        .options(selectinload(TimeEntry.category), selectinload(TimeEntry.tags))
        .where(TimeEntry.id == entry_id)
    )
    result = await session.execute(stmt)
    entry = result.scalar_one_or_none()
    if entry is None:
        raise HTTPException(status_code=404, detail="Entry not found")
    return entry


# ---------------------------------------------------------------------------
# Helper: check for overlapping entries
# ---------------------------------------------------------------------------
async def _check_overlap(
    session: AsyncSession,
    start_time: datetime,
    end_time: datetime,
    exclude_id: int | None = None,
) -> None:
    """Raise 409 if any entry overlaps with [start_time, end_time)."""
    stmt = select(TimeEntry).where(
        TimeEntry.start_time < end_time,
        TimeEntry.end_time > start_time,
    )
    if exclude_id is not None:
        stmt = stmt.where(TimeEntry.id != exclude_id)

    result = await session.execute(stmt)
    conflict = result.scalar_one_or_none()
    if conflict is not None:
        raise HTTPException(
            status_code=409,
            detail=f"时间与已有记录「{conflict.title}」重叠",
        )


# ---------------------------------------------------------------------------
# Entries CRUD
# ---------------------------------------------------------------------------

@router.post("/entries", response_model=EntryRead, status_code=201)
async def create_entry(
    body: EntryCreate,
    session: AsyncSession = Depends(get_session),
):
    if body.end_time <= body.start_time:
        raise HTTPException(status_code=422, detail="end_time must be after start_time")

    await _validate_category(session, body.category_id)
    await _check_overlap(session, body.start_time, body.end_time)

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

    return await _reload_entry(session, entry.id)


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

    # Validate time range if both ends are being updated
    new_start = update_data.get("start_time", entry.start_time)
    new_end = update_data.get("end_time", entry.end_time)
    if new_end <= new_start:
        raise HTTPException(status_code=422, detail="end_time must be after start_time")

    await _check_overlap(session, new_start, new_end, exclude_id=entry_id)

    # Validate category_id if being updated
    if "category_id" in update_data:
        await _validate_category(session, update_data["category_id"])

    # Handle tags separately
    if "tags" in update_data:
        tag_names = update_data.pop("tags")
        entry.tags = await _resolve_tags(session, tag_names)

    for key, value in update_data.items():
        setattr(entry, key, value)

    await session.commit()
    return await _reload_entry(session, entry_id)


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
