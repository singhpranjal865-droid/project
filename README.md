# PCB Inventory Management System

A full-stack application for managing PCB components, inventory, and procurement.

## Project Structure

- `client/`: React application (Vite) for the user interface.
- `server/`: Express/Node.js backend with PostgreSQL database.

## Features

- **Component Inventory**: Manage parts, stock levels, and technical specifications.
- **PCB Management**: Track PCB assemblies and their component requirements.
- **Excel Integration**: Import/Export component data from Excel files.
- **Scrap Tracking**: Log and visualize component scrap data with reasons.
- **Analytics Dashboard**: Real-time stats, stock distribution, and consumption trends.
- **Procurement Logs**: Track restock history and low-stock alerts.

## Setup Instructions

### Prerequisites

- Node.js (v18+)
- PostgreSQL

### Database Setup

1. Create a PostgreSQL database named `pcb_inventory`.
2. Run the schema script: `server/db/schema.sql`.
3. (Optional) Run the seed script: `server/db/seed.sql`.

### Backend Configuration

1. Go to `server/` directory.
2. Install dependencies: `npm install`.
3. Create a `.env` file with your database credentials (see `server/src/db.js` for expected variables).
4. Run the server: `npm run dev`.

### Frontend Configuration

1. Go to `client/` directory.
2. Install dependencies: `npm install`.
3. Run the development server: `npm run dev`.

## Data Management

### Excel Import Flow
1. Upload file in the **Excel Files** section.
2. Preview content to verify headers.
3. Click **Process** to commit data to the inventory (Linked by `source_file` for easy cleanup/tracking).

### Scrap Logging
- Any scrap action is logged in `scrap_log`.
- Visualize trends and reasons in the **Analytics** dashboard.
- View history in the **Procurement** section under the Scrap tab.
