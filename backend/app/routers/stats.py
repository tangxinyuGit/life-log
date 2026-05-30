from datetime import date, datetime, time

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.models import TimeEntry, Category

router = APIRouter(tags=["stats"])

FALLBACK_COLOR = "#6b7280"
FALLBACK_NAME = "未分类"


# ---- Response models ----

class DayStat(BaseModel):
    date: str
    hours: float


class CategoryStat(BaseModel):
    category_id: int | None = None
    name: str
    color: str
    icon: str | None = None
    hours: float
    percentage: float


class MoodEnergyStat(BaseModel):
    average: float | None = Field(default=None)
    count: int = 0


class StatsSummary(BaseModel):
    total_hours: float = 0.0
    total_entries: int = 0
    active_days: int = 0
    avg_hours_per_active_day: float = 0.0
    by_day: list[DayStat] = Field(default_factory=list)
    by_category: list[CategoryStat] = Field(default_factory=list)
    mood: MoodEnergyStat = Field(default_factory=MoodEnergyStat)
    energy: MoodEnergyStat = Field(default_factory=MoodEnergyStat)


# ---- Endpoint ----

@router.get("/stats/summary", response_model=StatsSummary)
async def get_stats_summary(
    start_date: date = Query(...),
    end_date: date = Query(...),
    session: AsyncSession = Depends(get_session),
) -> StatsSummary:
    day_start = datetime.combine(start_date, time.min)
    day_end = datetime.combine(end_date, time.max)

    # Fetch entries in range
    stmt = (
        select(TimeEntry)
        .where(TimeEntry.start_time >= day_start, TimeEntry.start_time <= day_end)
        .order_by(TimeEntry.start_time)
    )
    result = await session.execute(stmt)
    entries = result.scalars().all()

    # Fetch categories for mapping
    cat_result = await session.execute(select(Category))
    cats = {c.id: c for c in cat_result.scalars().all()}

    if not entries:
        return StatsSummary()

    # ---- Compute stats ----

    total_hours = 0.0
    day_hours: dict[str, float] = {}
    cat_hours: dict[str, dict] = {}  # key → { name, color, icon, hours }
    moods: list[int] = []
    energies: list[int] = []

    for entry in entries:
        dur = (entry.end_time - entry.start_time).total_seconds() / 3600.0
        total_hours += dur

        # By day
        d = entry.start_time.strftime("%Y-%m-%d")
        day_hours[d] = day_hours.get(d, 0.0) + dur

        # By category
        if entry.category_id and entry.category_id in cats:
            cat = cats[entry.category_id]
            key = str(cat.id)
            if key not in cat_hours:
                cat_hours[key] = {
                    "category_id": cat.id,
                    "name": cat.name,
                    "color": cat.color,
                    "icon": cat.icon,
                    "hours": 0.0,
                }
            cat_hours[key]["hours"] += dur
        else:
            if "__uncategorized__" not in cat_hours:
                cat_hours["__uncategorized__"] = {
                    "category_id": None,
                    "name": FALLBACK_NAME,
                    "color": FALLBACK_COLOR,
                    "icon": None,
                    "hours": 0.0,
                }
            cat_hours["__uncategorized__"]["hours"] += dur

        # Mood / Energy
        if entry.mood is not None:
            moods.append(entry.mood)
        if entry.energy is not None:
            energies.append(entry.energy)

    # Day stats sorted by date
    active_days = len(day_hours)
    by_day = sorted(
        [DayStat(date=d, hours=round(h, 2)) for d, h in day_hours.items()],
        key=lambda x: x.date,
    )

    # Category stats sorted by hours descending
    by_category = sorted(
        [
            CategoryStat(
                category_id=c["category_id"],
                name=c["name"],
                color=c["color"],
                icon=c["icon"],
                hours=round(c["hours"], 2),
                percentage=round(c["hours"] / total_hours * 100, 1) if total_hours > 0 else 0.0,
            )
            for c in cat_hours.values()
        ],
        key=lambda x: x.hours,
        reverse=True,
    )

    avg_hours = round(total_hours / active_days, 2) if active_days > 0 else 0.0

    return StatsSummary(
        total_hours=round(total_hours, 2),
        total_entries=len(entries),
        active_days=active_days,
        avg_hours_per_active_day=avg_hours,
        by_day=by_day,
        by_category=by_category,
        mood=MoodEnergyStat(
            average=round(sum(moods) / len(moods), 1) if moods else None,
            count=len(moods),
        ),
        energy=MoodEnergyStat(
            average=round(sum(energies) / len(energies), 1) if energies else None,
            count=len(energies),
        ),
    )
