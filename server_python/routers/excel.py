from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from .. import models, database, auth
import pandas as pd
import io
from fastapi.responses import StreamingResponse

router = APIRouter(prefix="/api/excel", tags=["excel"])

@router.get("/export/components")
async def export_components(db: AsyncSession = Depends(database.get_db)):
    result = await db.execute(select(models.Component))
    components = result.scalars().all()
    
    data = []
    for c in components:
        data.append({
            "Name": c.name,
            "Part Number": c.part_number,
            "Working Stock": c.working_stock,
            "Scrap Stock": c.scrap_stock,
            "Monthly Req": c.monthly_requirement
        })
        
    df = pd.DataFrame(data)
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, sheet_name='Components')
    output.seek(0)
    
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=components.xlsx"}
    )

@router.post("/upload/components")
async def upload_components(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="Only Excel files allowed")
        
    content = await file.read()
    try:
        df = pd.read_excel(io.BytesIO(content))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid Excel file: {str(e)}")
        
    # Expected columns validation
    required = ['Name', 'Part Number', 'Working Stock']
    if not all(col in df.columns for col in required):
        raise HTTPException(status_code=400, detail=f"Missing columns. Required: {required}")
        
    processed = 0
    errors = []
    
    for _, row in df.iterrows():
        try:
            name = str(row['Name']).strip()
            part = str(row['Part Number']).strip()
            stock = int(row['Working Stock']) if pd.notna(row['Working Stock']) else 0
            
            if not name or not part: 
                continue

            # Check existing
            stmt = select(models.Component).where(models.Component.part_number == part)
            res = await db.execute(stmt)
            existing = res.scalar_one_or_none()
            
            if existing:
                existing.working_stock = stock
                existing.name = name # update name if changed
            else:
                new_comp = models.Component(
                    name=name,
                    part_number=part,
                    working_stock=stock
                )
                db.add(new_comp)
            processed += 1
        except Exception as e:
            errors.append(f"Row {name}: {str(e)}")
            
    await db.commit()
    
    return {
        "message": f"Processed {processed} components",
        "errors": errors
    }
