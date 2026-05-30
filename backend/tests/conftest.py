import os
import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from app.database import get_session
from app.models import Base, Category


# In-memory SQLite — each test run gets a fresh DB
TEST_DB_URL = "sqlite+aiosqlite://"

_test_engine = create_async_engine(TEST_DB_URL, echo=False)
_test_sessionmaker = async_sessionmaker(_test_engine, class_=AsyncSession, expire_on_commit=False)


async def _override_get_session():
    async with _test_sessionmaker() as session:
        yield session


# Default categories matching main.py (independent of prod data)
DEFAULT_CATS = [
    {"name": "工作", "color": "#6366f1", "icon": "💼", "sort_order": 0},
    {"name": "学习", "color": "#22c55e", "icon": "📚", "sort_order": 1},
    {"name": "娱乐", "color": "#f59e0b", "icon": "🎮", "sort_order": 2},
    {"name": "睡眠", "color": "#8b5cf6", "icon": "😴", "sort_order": 3},
    {"name": "运动", "color": "#ef4444", "icon": "🏃", "sort_order": 4},
    {"name": "通勤", "color": "#06b6d4", "icon": "🚌", "sort_order": 5},
    {"name": "其他", "color": "#6b7280", "icon": "📌", "sort_order": 6},
]


@pytest.fixture
async def setup_db():
    """Create schema + seed categories once; returns dict with first category id."""
    async with _test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with _test_sessionmaker() as session:
        from sqlalchemy import select, func
        result = await session.execute(select(func.count(Category.id)))
        if result.scalar_one() == 0:
            for cat_data in DEFAULT_CATS:
                session.add(Category(**cat_data))
            await session.commit()

    # Fetch the first category id for test use
    async with _test_sessionmaker() as session:
        from sqlalchemy import select
        result = await session.execute(select(Category.id).order_by(Category.id).limit(1))
        first_id = result.scalar_one()

    return {"first_category_id": first_id}


@pytest.fixture
async def client(setup_db):
    """HTTP client that overrides the DB dependency to use test engine."""
    from app.main import app
    app.dependency_overrides[get_session] = _override_get_session
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()
