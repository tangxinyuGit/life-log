import os
from pathlib import Path

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./data/app.db")

engine = create_async_engine(DATABASE_URL, echo=False)

async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def get_session() -> AsyncSession:  # type: ignore[misc]
    async with async_session() as session:
        yield session


def ensure_data_directory() -> None:
    """Create the data directory if it doesn't exist."""
    # Extract the file path from the SQLite URL
    if DATABASE_URL.startswith("sqlite"):
        # Handle both sqlite:/// and sqlite+aiosqlite:///
        db_path = DATABASE_URL.split("///", 1)[-1]
        parent = Path(db_path).parent
        parent.mkdir(parents=True, exist_ok=True)
