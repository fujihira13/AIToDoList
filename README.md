# AIToDoList

A FastAPI + vanilla JS implementation of the Eisenhower matrix board described in `要件定義書.md`.

## Features (v1 mock)

- File based persistence (`app/data/*.json`) for tasks and staff
- Drag & drop between quadrants with instant API updates
- Modal form for creating, editing, and deleting tasks
- Staff roster with avatars under `app/static/avatars`
- JSON API (FastAPI) for `/api/tasks` and `/api/staff`

## Getting started

```powershell
# create virtualenv if needed
python -m venv .venv

# activate (PowerShell)
.\.venv\Scripts\activate

# install deps
pip install -r requirements.txt

# run dev server
uvicorn app.main:app --reload
```

Visit `http://127.0.0.1:8000/` in Chrome. The UI fetches data from the API and saves to the JSON files, so you can tweak tasks/staff there if needed.

## Project layout

- `app/main.py` – FastAPI app + template context
- `app/repository.py` – tiny JSON repository for tasks/staff
- `app/schemas.py` – Pydantic models for validation
- `app/templates/index.html` – board UI markup
- `app/static/style.css` / `app/static/app.js` – styling + UI logic
- `app/data/tasks.json` / `staff.json` – mock data used by the repo
- `要件定義書.md` – Japanese requirements document
