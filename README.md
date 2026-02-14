# 🔧 PCB Inventory Management System

A full-stack web application for managing PCB components, inventory tracking, procurement, and analytics.

## 📋 Features

- **Component Inventory** — Track parts with working stock, scrap stock, and part numbers
- **PCB Management** — Define PCBs, link components, simulate builds
- **Excel Integration** — Import/export component data from `.xlsx`, `.xls`, `.xlsm` files
- **Scrap Tracking** — Log damaged components with categorized reasons
- **Analytics Dashboard** — Real-time charts for stock distribution, usage trends, and low-stock alerts
- **Procurement Logs** — Restock components and track procurement history
- **Authentication** — JWT-based login for protected operations

---

## 🚀 Quick Start

### Prerequisites

| Tool | Version | Download |
|------|---------|----------|
| **Node.js** | v18 or higher | [nodejs.org](https://nodejs.org/) |
| **PostgreSQL** | v14 or higher | [postgresql.org](https://www.postgresql.org/download/) |

### Step 1 — Clone the Repository

```bash
git clone https://github.com/singhpranjal865-droid/project.git
cd project
```

### Step 2 — Create the Database

Open a terminal and run:

```bash
# Connect to PostgreSQL
psql -U postgres

# Create the database
CREATE DATABASE pcb_inventory;

# Exit
\q
```

> **Note:** If you use a different PostgreSQL username or password, update the `.env` file in the next step.

### Step 3 — Configure Environment Variables

```bash
# Navigate to server directory
cd server

# Copy the example environment file
cp .env.example .env
```

Edit `server/.env` with your database credentials:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=pcb_inventory
DB_USER=postgres
DB_PASSWORD=your_postgres_password
PORT=5000
JWT_SECRET=your_secret_key_here
```

### Step 4 — Install Dependencies & Run

#### Option A: One-Click Start (Recommended)

- **Windows** — Double-click `start.bat`
- **Linux/Mac** — Run `chmod +x start.sh && ./start.sh`

This will install dependencies for both client and server, start both servers, and open the browser automatically.

#### Option B: Manual Start

**Terminal 1 — Backend:**
```bash
cd server
npm install
npm run dev
```

**Terminal 2 — Frontend:**
```bash
cd client
npm install
npm run dev
```

### Step 5 — Open the App

| Service | URL |
|---------|-----|
| **Frontend** | [http://localhost:3000](http://localhost:3000) |
| **Backend API** | [http://localhost:5000/api](http://localhost:5000/api) |

> The database tables are created automatically on first server startup. A default admin user is also seeded.

---

## 🔐 Default Login

| Username | Password |
|----------|----------|
| `admin` | `admin123` |

---

## 📂 Project Structure

```
project/
├── client/                  # React frontend (Vite)
│   ├── src/
│   │   ├── components/      # Reusable UI components
│   │   ├── pages/           # Route pages
│   │   ├── context/         # Auth context
│   │   ├── api.js           # Axios API configuration
│   │   ├── App.jsx          # Router setup
│   │   └── index.css        # Global styles
│   ├── vite.config.js       # Vite config (port 3000, proxy to :5000)
│   └── package.json
│
├── server/                  # Express backend
│   ├── src/
│   │   ├── routes/          # API route handlers
│   │   ├── middleware/       # JWT auth middleware
│   │   ├── db.js            # PostgreSQL connection pool
│   │   └── index.js         # Express app entry point
│   ├── db/
│   │   ├── schema.sql       # Database schema
│   │   └── seed.sql         # Default admin user
│   ├── uploads/             # Excel file uploads
│   ├── .env.example         # Environment variable template
│   └── package.json
│
├── start.bat                # Windows one-click launcher
├── start.sh                 # Linux/Mac one-click launcher
└── README.md
```

---

## 📊 Data Management

### Excel Import Flow
1. Navigate to **Excel Files** page
2. Click **Upload Excel** to upload a `.xlsx`, `.xls`, or `.xlsm` file
3. Preview the file content to verify headers
4. Click **Process** to import data into the component inventory

### Building a PCB
1. Create a PCB in the **PCBs** page
2. Associate components with quantities
3. Click **Build** to deduct components from stock — low-stock alerts trigger automatically

### Scrap Logging
- Move components to scrap from the **Components** page
- View scrap history and analytics in the **Procurement** and **Analytics** sections

---

## 🛠️ API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/auth/login` | Login and get JWT token |
| `GET` | `/api/components` | List all components |
| `POST` | `/api/components` | Create a component |
| `PUT` | `/api/components/:id` | Update a component |
| `DELETE` | `/api/components/:id` | Delete a component |
| `GET` | `/api/components/:id/analytics` | Get component analytics |
| `GET` | `/api/pcbs` | List all PCBs |
| `POST` | `/api/pcbs` | Create a PCB with components |
| `POST` | `/api/pcbs/:id/build` | Build a PCB (deducts stock) |
| `POST` | `/api/procurement/restock` | Restock a component |
| `GET` | `/api/analytics/overview` | Dashboard analytics data |
| `POST` | `/api/excel/upload` | Upload an Excel file |
| `POST` | `/api/excel/process/:filename` | Import Excel data to inventory |
| `GET` | `/api/excel/export` | Export inventory report as Excel |

---

## ❓ Troubleshooting

| Issue | Solution |
|-------|----------|
| `ECONNREFUSED` on port 5432 | Make sure PostgreSQL is running |
| `database "pcb_inventory" does not exist` | Create it: `CREATE DATABASE pcb_inventory;` in psql |
| `EADDRINUSE` port 5000 or 3000 | Kill the process using that port or change it in `.env` / `vite.config.js` |
| Login not working | Use default credentials: `admin` / `admin123` |
