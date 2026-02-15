from pydantic import BaseModel, Field, conint, constr
from typing import List, Optional
from datetime import datetime

# --- Shared ---
class PaginationMeta(BaseModel):
    total: int
    page: int
    limit: int
    pages: int

class PaginatedResponse(BaseModel):
    data: List[dict]
    meta: PaginationMeta

# --- Auth ---
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None
    role: str = "admin"

class UserLogin(BaseModel):
    username: str
    password: str

class UserResponse(BaseModel):
    id: int
    username: str
    role: str
    created_at: datetime
    class Config:
        from_attributes = True

# --- Components ---
class ComponentBase(BaseModel):
    name: str = Field(..., min_length=3, max_length=100)
    part_number: str = Field(..., min_length=3, max_length=50)
    working_stock: int = Field(default=0, ge=0)
    scrap_stock: int = Field(default=0, ge=0)
    monthly_requirement: int = Field(default=0, ge=0)

class ComponentCreate(ComponentBase):
    pass

class ComponentUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=3, max_length=100)
    part_number: Optional[str] = Field(None, min_length=3, max_length=50)
    working_stock: Optional[int] = Field(None, ge=0)
    scrap_stock: Optional[int] = Field(None, ge=0)
    monthly_requirement: Optional[int] = Field(None, ge=0)

class ComponentResponse(ComponentBase):
    id: int
    low_stock_count: int
    procurement_count: int
    # Computed fields (optional depending on query)
    total_requirement: int = 0
    pcb_count: int = 0
    low_stock: bool = False
    
    class Config:
        from_attributes = True

# --- Procurement ---
class RestockRequest(BaseModel):
    component_id: int
    quantity: int = Field(..., gt=0)

class ScrapRequest(BaseModel):
    quantity: int = Field(..., gt=0)
    reason: Optional[str] = Field(None, max_length=500)

class LogResponse(BaseModel):
    id: int
    component_id: int
    quantity_added: Optional[int] = None
    quantity: Optional[int] = None # For scrap log
    previous_stock: Optional[int] = None
    new_stock: Optional[int] = None
    reason: Optional[str] = None
    procured_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    component_name: str
    part_number: str

# --- PCBs ---
class PCBComponentBase(BaseModel):
    id: Optional[int] = None
    name: Optional[str] = None
    part_number: Optional[str] = None
    quantity_per_pcb: int = Field(..., gt=0)

class PCBCreate(BaseModel):
    name: str = Field(..., min_length=3, max_length=100)
    preorder_type: Optional[str] = None
    preorder_quantity: int = Field(default=0, ge=0)
    components: List[PCBComponentBase] = []

class PCBBuild(BaseModel):
    quantity: int = Field(default=1, gt=0)

class PCBResponse(BaseModel):
    id: int
    name: str
    preorder_type: Optional[str]
    preorder_quantity: int
    created_at: datetime
    # populated separately
    components: List[dict] = []
    build_history: List[dict] = []

    class Config:
        from_attributes = True
