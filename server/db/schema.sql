-- PCB Inventory Management System - PostgreSQL Schema

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'admin',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS components (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    part_number VARCHAR(100) UNIQUE NOT NULL,
    working_stock INTEGER NOT NULL DEFAULT 0 CHECK (working_stock >= 0),
    scrap_stock INTEGER NOT NULL DEFAULT 0 CHECK (scrap_stock >= 0),
    monthly_requirement INTEGER NOT NULL DEFAULT 0,
    low_stock_count INTEGER NOT NULL DEFAULT 0,
    procurement_count INTEGER NOT NULL DEFAULT 0,
    source_file VARCHAR(255) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pcbs (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    preorder_type VARCHAR(20) CHECK (preorder_type IN ('daily', 'weekly', 'monthly', NULL)),
    preorder_quantity INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pcb_components (
    id SERIAL PRIMARY KEY,
    pcb_id INTEGER NOT NULL REFERENCES pcbs(id) ON DELETE CASCADE,
    component_id INTEGER NOT NULL REFERENCES components(id) ON DELETE CASCADE,
    quantity_per_pcb INTEGER NOT NULL DEFAULT 1 CHECK (quantity_per_pcb > 0),
    UNIQUE(pcb_id, component_id)
);

CREATE TABLE IF NOT EXISTS procurement_log (
    id SERIAL PRIMARY KEY,
    component_id INTEGER NOT NULL REFERENCES components(id) ON DELETE CASCADE,
    quantity_added INTEGER NOT NULL,
    previous_stock INTEGER NOT NULL,
    new_stock INTEGER NOT NULL,
    procured_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS build_log (
    id SERIAL PRIMARY KEY,
    pcb_id INTEGER NOT NULL REFERENCES pcbs(id) ON DELETE CASCADE,
    quantity_built INTEGER NOT NULL DEFAULT 1,
    built_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS scrap_log (
    id SERIAL PRIMARY KEY,
    component_id INTEGER NOT NULL REFERENCES components(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL,
    reason VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_pcb_components_pcb ON pcb_components(pcb_id);
CREATE INDEX IF NOT EXISTS idx_pcb_components_component ON pcb_components(component_id);
CREATE INDEX IF NOT EXISTS idx_procurement_log_component ON procurement_log(component_id);
CREATE INDEX IF NOT EXISTS idx_build_log_pcb ON build_log(pcb_id);
CREATE INDEX IF NOT EXISTS idx_scrap_log_component ON scrap_log(component_id);
