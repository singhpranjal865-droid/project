from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from .. import models, database, auth
import pandas as pd
from datetime import datetime, timedelta

router = APIRouter(prefix="/api/analytics", tags=["analytics"])

@router.get("/overview")
async def get_analytics_overview(
    db: AsyncSession = Depends(database.get_db),
    # current_user: models.User = Depends(auth.get_current_active_user) # Optional: Public dashboard
):
    # Fetch all data needed for analysis into efficient DataFrames
    # 1. Components
    comp_stmt = select(models.Component)
    comp_res = await db.execute(comp_stmt)
    df_comps = pd.DataFrame([vars(c) for c in comp_res.scalars().all()])
    
    # 2. PCB Components (for requirements)
    pcb_comp_stmt = select(models.PCBComponent)
    pcb_comp_res = await db.execute(pcb_comp_stmt)
    df_pcb_comps = pd.DataFrame([vars(c) for c in pcb_comp_res.scalars().all()])
    
    # 3. PCBs (for preorder qty)
    pcb_stmt = select(models.PCB)
    pcb_res = await db.execute(pcb_stmt)
    df_pcbs = pd.DataFrame([vars(p) for p in pcb_res.scalars().all()])
    
    # 4. Build Log (for trends)
    build_stmt = select(models.BuildLog).order_by(models.BuildLog.built_at.desc())
    build_res = await db.execute(build_stmt)
    df_builds = pd.DataFrame([vars(b) for b in build_res.scalars().all()])

    # 5. Scrap Log
    scrap_stmt = select(models.ScrapLog)
    scrap_res = await db.execute(scrap_stmt)
    df_scrap = pd.DataFrame([vars(s) for s in scrap_res.scalars().all()])
    
    # --- Processing with Pandas ---
    
    # Helper: Pre-process DataFrames (drop internal SA state key)
    for df in [df_comps, df_pcb_comps, df_pcbs, df_builds, df_scrap]:
        if '_sa_instance_state' in df.columns:
            df.drop(columns=['_sa_instance_state'], inplace=True)
            
    # A. Summary Counts
    total_components = len(df_comps)
    total_pcbs = len(df_pcbs)
    total_builds = df_builds['quantity_built'].sum() if not df_builds.empty else 0
    total_working = df_comps['working_stock'].sum() if not df_comps.empty else 0
    total_scrap = df_comps['scrap_stock'].sum() if not df_comps.empty else 0

    # B. Calculate Requirements & Low Stock
    # Merge PCB Comps with PCBs to get preorder quantity
    if not df_pcb_comps.empty and not df_pcbs.empty:
        df_reqs = df_pcb_comps.merge(df_pcbs, left_on='pcb_id', right_on='id', suffixes=('_comp', '_pcb'))
        # Calculate requirement per row: qty_per_pcb * max(preorder_qty, 1)
        df_reqs['req_qty'] = df_reqs['quantity_per_pcb'] * df_reqs['preorder_quantity'].apply(lambda x: max(x, 1))
        # Group by component_id
        total_req_per_comp = df_reqs.groupby('component_id')['req_qty'].sum().reset_index()
        total_req_per_comp.rename(columns={'req_qty': 'total_requirement'}, inplace=True)
        
        # Merge back to components
        df_comps = df_comps.merge(total_req_per_comp, left_on='id', right_on='component_id', how='left')
        df_comps['total_requirement'] = df_comps['total_requirement'].fillna(0)
    else:
        df_comps['total_requirement'] = 0

    # Low Stock Logic
    low_stock_mask = (df_comps['total_requirement'] > 0) & (df_comps['working_stock'] < 0.2 * df_comps['total_requirement'])
    low_stock_count = low_stock_mask.sum()
    low_stock_items = df_comps[low_stock_mask].sort_values('working_stock')[['id', 'name', 'part_number', 'working_stock', 'total_requirement']].head(10).to_dict('records')

    # C. Most/Least Used
    if not df_pcb_comps.empty:
        usage_counts = df_pcb_comps.groupby('component_id')['pcb_id'].nunique().reset_index(name='usage_count')
        df_usage = df_comps.merge(usage_counts, left_on='id', right_on='component_id', how='left').fillna(0)
        most_used = df_usage.sort_values('usage_count', ascending=False).head(10)[['id', 'name', 'part_number', 'usage_count']].to_dict('records')
        least_used = df_usage.sort_values('usage_count', ascending=True).head(10)[['id', 'name', 'part_number', 'usage_count']].to_dict('records')
    else:
        most_used = []
        least_used = []

    # D. Recent Builds
    if not df_builds.empty and not df_pcbs.empty:
        df_recent = df_builds.merge(df_pcbs, left_on='pcb_id', right_on='id')
        recent_builds = df_recent.head(10)[['id_x', 'name', 'quantity_built', 'built_at']].rename(columns={'id_x': 'id', 'name': 'pcb_name'}).to_dict('records')
    else:
        recent_builds = []

    # E. Consumption Trend (Last 30 days)
    if not df_builds.empty:
        # Filter last 30 days
        cutoff = datetime.now() - timedelta(days=30)
        # Convert built_at to datetime if it's not (SQLAlchemy usually returns datetime objects)
        df_builds['built_at'] = pd.to_datetime(df_builds['built_at'])
        # Remove timezone info for comparison if needed, or ensure cutoff is aware. 
        # For simplicity, we assume naive or compatible.
        
        # Group by Date
        df_trend = df_builds[df_builds['built_at'] >= cutoff.replace(tzinfo=df_builds['built_at'].dt.tz)].copy()
        if not df_trend.empty:
            df_trend['date'] = df_trend['built_at'].dt.date
            consumption_trend = df_trend.groupby('date')['quantity_built'].sum().reset_index().to_dict('records')
        else:
            consumption_trend = []
    else:
        consumption_trend = []
        
    # F. Stock Distribution
    stock_distribution = df_comps.sort_values('working_stock', ascending=False).head(15)[['name', 'working_stock', 'scrap_stock']].to_dict('records')

    return {
        "summary": {
            "total_components": int(total_components),
            "total_pcbs": int(total_pcbs),
            "total_builds": int(total_builds),
            "total_working_stock": int(total_working),
            "total_scrap_stock": int(total_scrap),
            "low_stock_count": int(low_stock_count)
        },
        "low_stock_components": low_stock_items,
        "most_used_components": most_used,
        "least_used_components": least_used,
        "most_low_stock": [], # TODO: Implement if needed, similar to logic above
        "most_procured": [], # TODO: need procurement logs df
        "recent_builds": recent_builds,
        "stock_distribution": stock_distribution,
        "consumption_trend": consumption_trend,
        "most_scrapped": [], # TODO: need scrap logs aggregated
        "scrap_reasons": []
    }
