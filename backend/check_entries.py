import asyncio, json, os, sys
sys.path.insert(0, '/home/tang/projects/life-log/backend')
os.chdir('/home/tang/projects/life-log/backend')
os.environ['DATABASE_URL'] = 'sqlite+aiosqlite:///./data/app.db'
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.database import async_session
from app.models import TimeEntry

async def main():
    async with async_session() as s:
        r = await s.execute(
            select(TimeEntry)
            .options(selectinload(TimeEntry.category))
            .options(selectinload(TimeEntry.tags))
        )
        entries = r.scalars().all()
        print(f"Total entries: {len(entries)}")
        for e in entries:
            print(json.dumps({
                'id': e.id,
                'title': e.title,
                'start': str(e.start_time),
                'end': str(e.end_time),
                'cat': e.category.name if e.category else None,
                'note': e.note,
                'tags': [t.name for t in e.tags],
            }, ensure_ascii=False, indent=2))

asyncio.run(main())
