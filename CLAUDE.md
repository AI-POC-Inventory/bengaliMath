# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Bengali Math** is an educational platform for teaching mathematics in Bengali. It's a full-stack application with three main components:

1. **UI** (`ui/`) - React 19 frontend with TypeScript and Vite
2. **Backend** (`server/`) - Node.js/Express API (currently uses SQLite, migration to Supabase in progress)
3. **Services** (`service/`) - Python services for PDF/Excel content extraction and Supabase database management

The project uses the Anthropic API for AI-powered tutoring and doubt resolution features.

## Quick Start

### Start the application (3 terminals):

```bash
# Terminal 1: UI (React dev server)
cd ui
npm run dev
# Runs on http://localhost:5173

# Terminal 2: Backend (Express API)
cd server
npm start
# Runs on http://localhost:3001 (or npm run dev:supabase for Supabase version)

# Terminal 3: Python services (optional, for content extraction)
cd service/db
python api.py
# Runs on http://localhost:5000
```

## Architecture

### Frontend (`ui/`)
- **Framework**: React 19 + TypeScript + Vite
- **State Management**: React Context API
- **API Integration**: Fetch to backend at `http://localhost:3001/api`
- **Key Components**: `UseCaseCards.tsx`, `WordProblemGenerator.tsx`, `AdminPanel.tsx`
- **Data Flow**: `src/data/curriculum.ts` contains curriculum structure; `src/api/client.ts` handles API calls

### Backend (`server/`)
- **Framework**: Express.js
- **Database**: SQLite (`database/bengali_curriculam.db`) or Supabase (migration underway)
- **Entry Points**: 
  - `index.js` - SQLite-based API
  - `index-supabase.js` - Supabase-based API (new)
- **Database Access**: 
  - SQLite: `better-sqlite3` with WAL mode
  - Supabase: `@supabase/supabase-js` client
- **API Routes**: Curriculum (read), preferences, sessions, doubts/AI responses, admin endpoints

### Python Services (`service/`)
- **`service/db/`** - Database API (Flask) for querying Supabase curriculum
  - `api.py` - Main Flask app with curriculum/preference/session endpoints
  - `curriculam_reader.py` - Data assembly and transformation
  - `supabase_client.py` - Supabase connection initialization
- **`service/content/`** - Content extraction and storage
  - `pdf_extractor.py`, `excel_extractor.py` - Extract content from files
  - Stores extracted content in Supabase via `db_supabase.py`

## Development Commands

### UI (`ui/`)
```bash
npm run dev          # Start Vite dev server with hot reload
npm run build        # TypeScript check + Vite production build
npm run lint         # Run ESLint
npm run preview      # Preview production build locally
```

### Backend (`server/`)
```bash
npm start            # Run Express server with SQLite
npm run dev          # Run with auto-reload (node --watch)
npm run start:supabase  # Run with Supabase backend
npm run dev:supabase    # Run with Supabase and auto-reload
```

### Python Services
```bash
cd service/db
python api.py                    # Start Flask API
python curriculam_reader.py      # Test data assembly
python -m pytest                 # Run tests (if available)
```

## Database

### SQLite (Current - `database/bengali_curriculam.db`)
- Tables: `classes`, `chapters`, `topics`, `questions`, `options`, `preferences`, `sessions`, `session_questions`, `doubts`
- Uses WAL mode for better concurrency
- Query with: `sqlite3 database/bengali_curriculam.db`

### Supabase (Migration in Progress)
- Tables mirrored from SQLite schema
- Credentials in `service/db/.env`: `SUPABASE_URL`, `SUPABASE_KEY`
- Backend can switch between SQLite and Supabase via `index.js` vs `index-supabase.js`
- Note: Python API (`service/db/api.py`) currently expects Supabase; verify env vars if connection fails

## Key Files & Conventions

### Frontend Type Definitions
- `ui/src/types.ts` - Core types: `ClassData`, `Chapter`, `Topic`, `Question`, `Session`
- Always import types with `import type { ... }` to avoid unused import errors

### API Client
- `ui/src/api/client.ts` - Centralized fetch wrapper
- Endpoints match backend routes: `/class/:id`, `/api/preferences`, `/api/sessions`, etc.

### Backend Routing
- Curriculum endpoints (read): `/class/:classId`, `/chapter`, `/topic`, `/questions`
- User data: `/api/preferences`, `/api/sessions`, `/api/doubts`
- Admin: `/api/admin/*`
- Returns JSON; uses CORS for local dev

### Environment Variables
- `ui/` - No env file needed for local dev (targets `http://localhost:3001`)
- `server/` - No env needed for SQLite mode; for Supabase, set PORT
- `service/db/` - `.env` file: `SUPABASE_URL`, `SUPABASE_KEY` (required for Python API)

## Testing & Building

### Type Checking
```bash
cd ui
npm run build  # Runs `tsc -b` for type errors
```

### Linting
```bash
cd ui
npm run lint
```

### Testing UI Locally
1. Start backend: `cd server && npm start`
2. Start UI: `cd ui && npm run dev`
3. Open http://localhost:5173
4. Check browser console and network tab for API issues

## Common Tasks

### Add a new curriculum endpoint
1. Backend: Add route in `server/index.js` or `server/index-supabase.js`
2. Frontend: Add function in `ui/src/api/client.ts`
3. Types: Update `ui/src/types.ts` if new data shapes
4. Component: Use new API via `client.ts` function

### Debug API issues
- Check backend is running: `curl http://localhost:3001/api/preferences`
- Check CORS: Verify `CORS_ORIGINS` env var in backend
- Check database: Verify SQLite file exists or Supabase credentials are valid
- Logs: Backend logs latency per request; check for slow Supabase queries

### Run TypeScript checks without building
```bash
cd ui
npx tsc --noEmit
```

## Important Notes

- **TypeScript strict mode**: Unused imports trigger errors; use `import type { X }` for type-only imports
- **Hot reload**: UI reloads instantly; backend requires restart for code changes
- **Production build**: UI output in `ui/dist/`; backend runs directly (no build step)
- **Supabase migration**: Some features use Supabase (chatbot, new endpoints); SQLite still used for curriculum if not Supabase mode
- **AI Features**: Require Anthropic API key set in preferences; key stored in database
- **Windows specifics**: Use PowerShell for commands; scripts provided (.bat files) as alternatives to .sh files
