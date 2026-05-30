from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select, func

from app.database import engine, async_session, ensure_data_directory
from app.models import Base, Category
from app.routers import categories, entries, stats


DEFAULT_CATEGORIES = [
    {"name": "工作", "color": "#6366f1", "icon": "💼", "sort_order": 0},
    {"name": "学习", "color": "#22c55e", "icon": "📚", "sort_order": 1},
    {"name": "娱乐", "color": "#f59e0b", "icon": "🎮", "sort_order": 2},
    {"name": "睡眠", "color": "#8b5cf6", "icon": "😴", "sort_order": 3},
    {"name": "运动", "color": "#ef4444", "icon": "🏃", "sort_order": 4},
    {"name": "通勤", "color": "#06b6d4", "icon": "🚌", "sort_order": 5},
    {"name": "其他", "color": "#6b7280", "icon": "📌", "sort_order": 6},
]


async def seed_default_categories() -> None:
    """Insert default categories if the categories table is empty."""
    async with async_session() as session:
        result = await session.execute(select(func.count(Category.id)))
        count = result.scalar_one()
        if count == 0:
            for cat_data in DEFAULT_CATEGORIES:
                session.add(Category(**cat_data))
            await session.commit()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    ensure_data_directory()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await seed_default_categories()
    yield
    # Shutdown
    await engine.dispose()


app = FastAPI(
    title="Life Log API",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — allow all origins for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(categories.router, prefix="/api/v1")
app.include_router(entries.router, prefix="/api/v1")
app.include_router(stats.router, prefix="/api/v1")


@app.get("/health")
async def health_check():
    return {"status": "ok"}
