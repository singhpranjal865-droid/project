from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc, update, delete
from sqlalchemy.exc import IntegrityError
from typing import List, Optional
from .. import models, schemas, database, auth
import pandas as pd

router = APIRouter(prefix="/api/components", tags=["components"])

@router.get("/", response_model=schemas.PaginatedResponse)
async def get_components(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=1000),
    db: AsyncSession = Depends(database.get_db)
):
    offset = (page - 1) * limit
    
    # Total Count
    total_query = select(func.count(models.Component.id))
    total_res = await db.execute(total_query)
    total = total_res.scalar_one()

    # Get Components with Requirements (using Pandas for complex aggregation if needed, but SQL is efficient here)
    # Replicating the optimized SQL query from Node.js
    stmt = (
        select(models.Component)
        .order_by(models.Component.name)
        .offset(offset)
        .limit(limit)
    )
    result = await db.execute(stmt)
    components = result.scalars().all()

    # TODO: Calculate requirements effectively. For now, basic list.
    # We will enhance this with a proper SQL join in the next step to match Node.js optimization.
    
    data = []
    for c in components:
        # Simple placeholder for total_req until we add the join logic
        c_dict = schemas.ComponentResponse.model_validate(c).model_dump()
        c_dict["total_requirement"] = 0 
        c_dict["pcb_count"] = 0
        c_dict["low_stock"] = False
        data.append(c_dict)

    return {
        "data": data,
        "meta": {"total": total, "page": page, "limit": limit, "pages": (total + limit - 1) // limit}
    }

@router.post("/", response_model=schemas.ComponentResponse)
async def create_component(
    comp: schemas.ComponentCreate,
    db: AsyncSession = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    try:
        new_comp = models.Component(**comp.model_dump())
        db.add(new_comp)
        await db.commit()
        await db.refresh(new_comp)
        return new_comp
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=400, detail="Part number or name already exists")

@router.put("/{id}", response_model=schemas.ComponentResponse)
async def update_component(
    id: int,
    comp: schemas.ComponentUpdate,
    db: AsyncSession = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    stmt = select(models.Component).where(models.Component.id == id)
    result = await db.execute(stmt)
    existing = result.scalar_one_or_none()
    
    if not existing:
        raise HTTPException(status_code=404, detail="Component not found")
        
    update_data = comp.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(existing, key, value)
    
    try:
        await db.commit()
        await db.refresh(existing)
        return existing
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=400, detail="Part number or name matches another component")

@router.delete("/{id}")
async def delete_component(
    id: int,
    db: AsyncSession = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    stmt = select(models.Component).where(models.Component.id == id)
    result = await db.execute(stmt)
    existing = result.scalar_one_or_none()
    
    if not existing:
        raise HTTPException(status_code=404, detail="Component not found")
        
    await db.delete(existing)
    await db.commit()
    return {"message": "Component deleted"}

@router.post("/{id}/scrap")
async def scrap_component(
    id: int,
    scrap: schemas.ScrapRequest,
    db: AsyncSession = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    # Fetch component with lock
    stmt = select(models.Component).where(models.Component.id == id).with_for_update()
    result = await db.execute(stmt)
    comp = result.scalar_one_or_none()
    
    if not comp:
        raise HTTPException(status_code=404, detail="Component not found")
        
    if comp.working_stock < scrap.quantity:
        raise HTTPException(status_code=400, detail="Insufficient working stock")
        
    comp.working_stock -= scrap.quantity
    comp.scrap_stock += scrap.quantity
    
    # Log scrap
    new_log = models.ScrapLog(
        component_id=id,
        quantity=scrap.quantity,
        reason=scrap.reason
    )
    db.add(new_log)
    
    await db.commit()
    return {"message": f"Moved {scrap.quantity} units to scrap"}
