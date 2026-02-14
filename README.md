# PCB Component Inventory Management System

A full-stack web application for managing electronic components used in PCB (Printed Circuit Board) assemblies. Track inventory, build PCBs with automatic stock deduction, monitor low-stock alerts, and analyze component usage — all with a modern dark-themed dashboard.

## Features

- **PCB Management**: Define PCBs with component mappings and preorder schedules (daily/weekly/monthly)
- **Component Inventory**: Full CRUD with working stock and scrap tracking
- **PCB Build**: Build PCBs with automatic stock deduction and negative-inventory safeguards
- **Low-Stock Alerts**: Automatic alerts when stock falls below 20% of requirement
- **Procurement**: Restock components with full audit trail
- **Scrap Tracking**: Move damaged components to scrap with reason logging
- **Analytics Dashboard**: Pie charts, bar graphs, line charts for consumption trends
- **Per-Component Analytics**: Detailed usage, procurement, and scrap history per component
- **Excel Import/Export**: Full inventory export with styled sheets; import from Excel files
- **JWT Authentication**: Admin-only popup modal for protected actions (no separate login page)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Node.js, Express.js |
| Database | PostgreSQL (pg client) |
| Auth | JWT (jsonwebtoken), bcryptjs |
| File Upload | Multer |
| Excel | exceljs, xlsx |
| Frontend | React.js (Vite) |
| Charts | Chart.js, react-chartjs-2 |
| Routing | react-router-dom |
| HTTP Client | axios |

## Prerequisites

- **Node.js** (v18 or later) — [Download](https://nodejs.org/)
- **PostgreSQL** (v14 or later) — [Download](https://www.postgresql.org/download/)

## Setup Instructions

### 1. Create the PostgreSQL Database

```bash
# Connect to PostgreSQL
psql -U postgres

# Create the database
CREATE DATABASE pcb_inventory;

# Exit
\q
```

### 2. Configure Environment Variables

Edit `server/.env` if your PostgreSQL credentials differ from the defaults:

```env
PORT=5000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=pcb_inventory
DB_USER=postgres
DB_PASSWORD=postgres
JWT_SECRET=pcb_inventory_jwt_secret_key_2024
```

### 3. Install Backend Dependencies

```bash
cd server
npm install
```

### 4. Start the Backend Server

```bash
cd server
npm run dev
```

The server auto-initializes the database schema and seeds the default admin user on startup.

### 5. Install Frontend Dependencies

```bash
cd client
npm install
```

### 6. Start the Frontend Dev Server

```bash
cd client
npm run dev
```

### 7. Open the Application

Navigate to **http://localhost:3000** in your browser.

## Default Credentials

| Username | Password | Role |
|----------|----------|------|
| admin | admin123 | Admin |

## Usage Guide

### Adding a PCB
1. Go to **PCBs** page → Click **+ Add PCB**
2. Enter PCB name, optional preorder type/quantity
3. Add components (select existing or create new — new components auto-added to inventory)
4. Click **Create PCB**

### Building a PCB (Stock Deduction)
1. Navigate to a PCB's detail page
2. Enter build quantity → Click **Build**
3. All component stocks are deducted automatically
4. Insufficient stock is rejected (no negative inventory)

### Restocking (Procurement)
1. Go to **Procurement** page
2. Select component, enter quantity → Click **Restock**
3. All restocking actions are logged with before/after stock values

### Excel Import/Export
- **Export**: Components page → Click **Export Excel** (downloads .xlsx with styled sheets)
- **Import**: Components page → Click **Import Excel** → Upload .xlsx file
- Import intelligently maps column names to component fields

### Analytics
- **Dashboard**: Overview with pie charts (working vs scrap) and bar graphs
- **Analytics page**: All KPIs — most used, least used, most low-stock, most procured components
- **Per-component**: Click 📊 icon on any component for detailed analytics

## Project Structure

```
pcb-inventory/
├── server/
│   ├── db/
│   │   ├── schema.sql          # PostgreSQL DDL
│   │   └── seed.sql            # Default admin user
│   ├── src/
│   │   ├── index.js            # Express entry point
│   │   ├── db.js               # PostgreSQL connection pool
│   │   ├── middleware/auth.js   # JWT middleware
│   │   └── routes/
│   │       ├── auth.js         # Login, /me
│   │       ├── components.js   # Component CRUD + scrap
│   │       ├── pcbs.js         # PCB CRUD + build
│   │       ├── procurement.js  # Restock + logs
│   │       ├── analytics.js    # Aggregated stats
│   │       └── excel.js        # Import/export
│   ├── .env
│   └── package.json
├── client/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── api.js
│   │   ├── index.css
│   │   ├── context/AuthContext.jsx
│   │   ├── components/
│   │   │   ├── Navbar.jsx
│   │   │   ├── AuthModal.jsx
│   │   │   ├── ProtectedAction.jsx
│   │   │   └── StatsCard.jsx
│   │   └── pages/
│   │       ├── Dashboard.jsx
│   │       ├── Components.jsx
│   │       ├── PCBs.jsx
│   │       ├── PCBDetail.jsx
│   │       ├── Procurement.jsx
│   │       ├── Analytics.jsx
│   │       └── ComponentAnalytics.jsx
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
└── README.md
```

## API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | /api/auth/login | No | Login, get JWT token |
| GET | /api/auth/me | Yes | Get current user |
| GET | /api/components | No | List all components |
| POST | /api/components | Yes | Create component |
| PUT | /api/components/:id | Yes | Update component |
| DELETE | /api/components/:id | Yes | Delete component |
| POST | /api/components/:id/scrap | Yes | Move to scrap |
| GET | /api/components/:id/analytics | No | Component analytics |
| GET | /api/pcbs | No | List all PCBs |
| POST | /api/pcbs | Yes | Create PCB |
| PUT | /api/pcbs/:id | Yes | Update PCB |
| DELETE | /api/pcbs/:id | Yes | Delete PCB |
| POST | /api/pcbs/:id/build | Yes | Build PCB (deduct stock) |
| POST | /api/procurement/restock | Yes | Restock component |
| GET | /api/procurement/log | No | Procurement history |
| GET | /api/procurement/scrap-log | No | Scrap history |
| GET | /api/analytics/overview | No | Analytics dashboard data |
| GET | /api/excel/export | No | Export to Excel |
| POST | /api/excel/import | Yes | Import from Excel |
