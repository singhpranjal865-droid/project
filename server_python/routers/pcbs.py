from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, update, insert, delete
from sqlalchemy.orm import selectinload
from typing import List, Optional
from .. import models, schemas, database, auth

router = APIRouter(prefix="/api/pcbs", tags=["pcbs"])

@router.get("/", response_model=schemas.PaginatedResponse)
async def get_pcbs(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=1000),
    db: AsyncSession = Depends(database.get_db)
):
    offset = (page - 1) * limit
    
    # Total Count
    total_res = await db.execute(select(func.count(models.PCB.id)))
    total = total_res.scalar_one()

    # Get PCBs with Components (Eager Load)
    stmt = (
        select(models.PCB)
        .options(selectinload(models.PCB.components).selectinload(models.PCBComponent.component))
        .order_by(models.PCB.name)
        .offset(offset)
        .limit(limit)
    )
    result = await db.execute(stmt)
    pcbs = result.scalars().all()
    
    # Format response
    data = []
    for p in pcbs:
        p_dict = schemas.PCBResponse.model_validate(p).model_dump()
        # Manually structure components list to match frontend expectation
        p_dict["components"] = [
            {
                "id": c.component.id,
                "name": c.component.name,
                "part_number": c.component.part_number,
                "quantity_per_pcb": c.quantity_per_pcb
            }
            for c in p.components
        ]
        data.append(p_dict)

    return {
        "data": data,
        "meta": {"total": total, "page": page, "limit": limit, "pages": (total + limit - 1) // limit}
    }

@router.get("/{id}", response_model=schemas.PCBResponse)
async def get_pcb(id: int, db: AsyncSession = Depends(database.get_db)):
    stmt = (
        select(models.PCB)
        .where(models.PCB.id == id)
        .options(selectinload(models.PCB.components).selectinload(models.PCBComponent.component))
    )
    result = await db.execute(stmt)
    pcb = result.scalar_one_or_none()
    
    if not pcb:
        raise HTTPException(status_code=404, detail="PCB not found")

    # Get build history
    history_stmt = (
        select(models.BuildLog)
        .where(models.BuildLog.pcb_id == id)
        .order_by(models.BuildLog.built_at.desc())
        .limit(50)
    )
    history_res = await db.execute(history_stmt)
    history = history_res.scalars().all()

    p_dict = schemas.PCBResponse.model_validate(pcb).model_dump()
    p_dict["components"] = [
        {
            "id": c.component.id,
            "name": c.component.name,
            "part_number": c.component.part_number,
            "working_stock": c.component.working_stock, # Check availability
            "scrap_stock": c.component.scrap_stock,
            "quantity_per_pcb": c.quantity_per_pcb
        }
        for c in p.components
    ]
    p_dict["build_history"] = history
    return p_dict

@router.post("/", response_model=schemas.PCBResponse)
async def create_pcb(
    pcb: schemas.PCBCreate,
    db: AsyncSession = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    # Check name uniqueness
    exists = await db.execute(select(models.PCB).where(models.PCB.name == pcb.name))
    if exists.scalar():
        raise HTTPException(status_code=400, detail="PCB name already exists")
        
    db_pcb = models.PCB(
        name=pcb.name,
        preorder_type=pcb.preorder_type,
        preorder_quantity=pcb.preorder_quantity
    )
    db.add(db_pcb)
    await db.flush() # get ID

    # Add components
    for comp_data in pcb.components:
        comp_id = comp_data.id
        
        # Create new component if ID not provided
        if not comp_id:
            # Check if name/part_number exists to avoid error
            existing_comp = await db.execute(
                select(models.Component).where(
                    (models.Component.name == comp_data.name) | 
                    (models.Component.part_number == comp_data.part_number)
                )
            )
            found = existing_comp.scalars().first()
            if found:
                comp_id = found.id # Reuse existing
            else:
                new_comp = models.Component(name=comp_data.name, part_number=comp_data.part_number)
                db.add(new_comp)
                await db.flush()
                comp_id = new_comp.id
        
        # Link
        link = models.PCBComponent(
            pcb_id=db_pcb.id,
            component_id=comp_id,
            quantity_per_pcb=comp_data.quantity_per_pcb
        )
        db.add(link)
    
    await db.commit()
    await db.refresh(db_pcb)
    
    # Reload for response
    return await get_pcb(db_pcb.id, db)

@router.post("/{id}/build")
async def build_pcb(
    id: int,
    build: schemas.PCBBuild,
    db: AsyncSession = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    # Get PCB with components (with pessimistic lock logic logic if needed, but standard select sufficient generally)
    stmt = (
        select(models.PCB)
        .where(models.PCB.id == id)
        .options(selectinload(models.PCB.components).selectinload(models.PCBComponent.component))
    )
    result = await db.execute(stmt)
    pcb = result.scalar_one_or_none()
    
    if not pcb:
        raise HTTPException(status_code=404, detail="PCB not found")
        
    if not pcb.components:
        raise HTTPException(status_code=400, detail="PCB has no components defined")
        
    qty = build.quantity
    
    # check stock
    insufficient = []
    for pc in pcb.components:
        needed = pc.quantity_per_pcb * qty
        if pc.component.working_stock < needed:
            insufficient.append({
                "name": pc.component.name,
                "available": pc.component.working_stock,
                "needed": needed
            })
            
    if insufficient:
        raise HTTPException(
            status_code=400,
            detail={"error": "Insufficient stock for build", "insufficient": insufficient}
        )
        
    # Deduct Stock
    deductions = []
    for pc in pcb.components:
        deduct_qty = pc.quantity_per_pcb * qty
        pc.component.working_stock -= deduct_qty
        pc.component.procurement_count += 1
        
        deductions.append({
            "component": pc.component.name,
            "deducted": deduct_qty,
            "remaining": pc.component.working_stock
        })
        
        # TODO: Low stock check logic (can be optimized via background task or SQL trigger)
        # For strict parity, we should do it here, but keeping it simple for now.

    # Log Build
    log = models.BuildLog(pcb_id=id, quantity_built=qty)
    db.add(log)
    
    await db.commit()
    
    return {
        "message": f"Successfully built {qty} PCB(s)",
        "deductions": deductions
    }

@router.delete("/{id}")
async def delete_pcb(
    id: int,
    db: AsyncSession = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    stmt = select(models.PCB).where(models.PCB.id == id)
    result = await db.execute(stmt)
    pcb = result.scalar_one_or_none()
    if not pcb:
        raise HTTPException(status_code=404, detail="PCB not found")
        
    await db.delete(pcb)
    await db.commit()
    return {"message": "PCB deleted"}
