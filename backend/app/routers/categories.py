from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.models import Category
from app.schemas import CategoryCreate, CategoryRead, CategoryUpdate

router = APIRouter(tags=["categories"])


@router.get("/categories", response_model=list[CategoryRead])
async def list_categories(
    include_archived: bool = Query(False),
    session: AsyncSession = Depends(get_session),
):
    stmt = select(Category).order_by(Category.sort_order)
    if not include_archived:
        stmt = stmt.where(Category.is_archived == False)  # noqa: E712
    result = await session.execute(stmt)
    return result.scalars().all()


@router.post("/categories", response_model=CategoryRead, status_code=201)
async def create_category(
    body: CategoryCreate,
    session: AsyncSession = Depends(get_session),
):
    # Check uniqueness
    existing = await session.execute(select(Category).where(Category.name == body.name))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Category with this name already exists")

    category = Category(**body.model_dump())
    session.add(category)
    await session.commit()
    await session.refresh(category)
    return category


@router.put("/categories/{category_id}", response_model=CategoryRead)
async def update_category(
    category_id: int,
    body: CategoryUpdate,
    session: AsyncSession = Depends(get_session),
):
    category = await session.get(Category, category_id)
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")

    update_data = body.model_dump(exclude_unset=True)

    # Check name uniqueness if name is being updated
    if "name" in update_data:
        existing = await session.execute(
            select(Category).where(Category.name == update_data["name"], Category.id != category_id)
        )
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=409, detail="Category with this name already exists")

    for key, value in update_data.items():
        setattr(category, key, value)

    await session.commit()
    await session.refresh(category)
    return category


@router.delete("/categories/{category_id}", status_code=204)
async def delete_category(
    category_id: int,
    session: AsyncSession = Depends(get_session),
):
    category = await session.get(Category, category_id)
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")

    # Soft delete — set is_archived = True
    category.is_archived = True
    await session.commit()
