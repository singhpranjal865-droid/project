# PCB Inventory System (Python Backend)

This is the **High-Performance Python Backend** for the PCB Inventory System.
It uses **FastAPI**, **SQLAlchemy (Async)**, and **Pandas** for maximum efficiency and data accuracy.

## Features
- **FastAPI**: Modern, high-performance async framework.
- **Data Validation**: Strict schemas using Pydantic.
- **Efficient Analytics**: Complex data aggregation using Pandas (replacing slow SQL subqueries).
- **Excel Processing**: Robust file handling with `pandas` + `openpyxl`.
- **Async Database**: Non-blocking PostgreSQL queries with `asyncpg`.

## Setup

1.  **Prerequisites**: Python 3.10+, PostgreSQL running.
2.  **Environment**: Copy `../server/.env` to `.env` in this directory (done automatically by start script).

## Running

Double-click `start_python_backend.bat` in the project root.

Or manually:
```bash
pip install -r requirements.txt
python -m uvicorn server_python.main:app --reload --port 8000
```

## API Documentation
Once running, visit: http://localhost:8000/docs
