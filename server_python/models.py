from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime, CheckConstraint, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .database import Base
import datetime

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(100), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(50), nullable=False, default="admin")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Component(Base):
    __tablename__ = "components"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    part_number = Column(String(100), unique=True, nullable=False)
    working_stock = Column(Integer, nullable=False, default=0)
    scrap_stock = Column(Integer, nullable=False, default=0)
    monthly_requirement = Column(Integer, nullable=False, default=0)
    low_stock_count = Column(Integer, nullable=False, default=0)
    procurement_count = Column(Integer, nullable=False, default=0)
    source_file = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Constraints
    __table_args__ = (
        CheckConstraint('working_stock >= 0', name='check_working_stock'),
        CheckConstraint('scrap_stock >= 0', name='check_scrap_stock'),
    )

class PCB(Base):
    __tablename__ = "pcbs"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), unique=True, nullable=False)
    preorder_type = Column(String(20), nullable=True)
    preorder_quantity = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    components = relationship("PCBComponent", back_populates="pcb", cascade="all, delete-orphan")

class PCBComponent(Base):
    __tablename__ = "pcb_components"

    id = Column(Integer, primary_key=True, index=True)
    pcb_id = Column(Integer, ForeignKey("pcbs.id", ondelete="CASCADE"), nullable=False)
    component_id = Column(Integer, ForeignKey("components.id", ondelete="CASCADE"), nullable=False)
    quantity_per_pcb = Column(Integer, nullable=False, default=1)

    pcb = relationship("PCB", back_populates="components")
    component = relationship("Component")

    __table_args__ = (
        UniqueConstraint('pcb_id', 'component_id', name='unique_pcb_component'),
        CheckConstraint('quantity_per_pcb > 0', name='check_qty_per_pcb'),
    )

class ProcurementLog(Base):
    __tablename__ = "procurement_log"

    id = Column(Integer, primary_key=True, index=True)
    component_id = Column(Integer, ForeignKey("components.id", ondelete="CASCADE"), nullable=False)
    quantity_added = Column(Integer, nullable=False)
    previous_stock = Column(Integer, nullable=False)
    new_stock = Column(Integer, nullable=False)
    procured_at = Column(DateTime(timezone=True), server_default=func.now())

    component = relationship("Component")

class BuildLog(Base):
    __tablename__ = "build_log"

    id = Column(Integer, primary_key=True, index=True)
    pcb_id = Column(Integer, ForeignKey("pcbs.id", ondelete="CASCADE"), nullable=False)
    quantity_built = Column(Integer, nullable=False, default=1)
    built_at = Column(DateTime(timezone=True), server_default=func.now())

    pcb = relationship("PCB")

class ScrapLog(Base):
    __tablename__ = "scrap_log"

    id = Column(Integer, primary_key=True, index=True)
    component_id = Column(Integer, ForeignKey("components.id", ondelete="CASCADE"), nullable=False)
    quantity = Column(Integer, nullable=False)
    reason = Column(String(500), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    component = relationship("Component")
