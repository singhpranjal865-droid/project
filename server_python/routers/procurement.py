from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc, update
from typing import List
from .. import models, schemas, database, auth

router = APIRouter(prefix="/api/procurement", tags=["procurement"])

@router.post("/restock", response_model=schemas.LogResponse)
async def restock_component(
    restock: schemas.RestockRequest,
    db: AsyncSession = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    # Fetch component with lock
    stmt = select(models.Component).where(models.Component.id == restock.component_id).with_for_update()
    result = await db.execute(stmt)
    comp = result.scalar_one_or_none()
    
    if not comp:
        raise HTTPException(status_code=404, detail="Component not found")
        
    previous_stock = comp.working_stock
    comp.working_stock += restock.quantity
    comp.procurement_count += 1
    new_stock = comp.working_stock
    
    # Log
    log = models.ProcurementLog(
        component_id=restock.component_id,
        quantity_added=restock.quantity,
        previous_stock=previous_stock,
        new_stock=new_stock
    )
    db.add(log)
    
    await db.commit()
    await db.refresh(log)
    
    # Return formatted response
    return {
        "id": log.id,
        "component_id": comp.id,
        "quantity_added": log.quantity_added,
        "previous_stock": log.previous_stock,
        "new_stock": log.new_stock,
        "procured_at": log.procured_at,
        "component_name": comp.name,
        "part_number": comp.part_number
    }

@router.get("/log", response_model=schemas.PaginatedResponse)
async def get_procurement_log(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=1000),
    db: AsyncSession = Depends(database.get_db)
):
    offset = (page - 1) * limit
    
    total_res = await db.execute(select(func.count(models.ProcurementLog.id)))
    total = total_res.scalar_one()

    stmt = (
        select(models.ProcurementLog, models.Component)
        .join(models.Component)
        .order_by(models.ProcurementLog.procured_at.desc())
        .offset(offset)
        .limit(limit)
    )
    result = await db.execute(stmt)
    logs = result.all()
    
    data = []
    for log, comp in logs:
        data.append({
            "id": log.id,
            "component_id": comp.id,
            "quantity_added": log.quantity_added,
            "previous_stock": log.previous_stock,
            "new_stock": log.new_stock,
            "procured_at": log.procured_at,
            "component_name": comp.name,
            "part_number": comp.part_number
        })
        
    return {
        "data": data,
        "meta": {"total": total, "page": page, "limit": limit, "pages": (total + limit - 1) // limit}
    }

@router.get("/scrap-log", response_model=schemas.PaginatedResponse)
async def get_scrap_log(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=1000),
    db: AsyncSession = Depends(database.get_db)
):
    offset = (page - 1) * limit
    
    total_res = await db.execute(select(func.count(models.ScrapLog.id)))
    total = total_res.scalar_one()

    stmt = (
        select(models.ScrapLog, models.Component)
        .join(models.Component)
        .order_by(models.ScrapLog.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    result = await db.execute(stmt)
    logs = result.all()
    
    data = []
    for log, comp in logs:
        data.append({
            "id": log.id,
            "component_id": comp.id,
            "quantity": log.quantity,
            "reason": log.reason,
            "created_at": log.created_at,
            "component_name": comp.name,
            "part_number": comp.part_number
        })

    return {
        "data": data,
        "meta": {"total": total, "page": page, "limit": limit, "pages": (total + limit - 1) // limit}
    }
