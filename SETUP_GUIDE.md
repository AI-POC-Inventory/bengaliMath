# Bengali Math - Local SQLite Setup Guide

## Prerequisites
- Python 3.7+ installed
- pip (Python package manager)

## Quick Start

### Option 1: Automated Setup (Bash)
```bash
bash setup.sh
```

### Option 2: Manual Setup

#### 1. Install Python Dependencies
```bash
cd service/db
pip install -r requirements.txt
pip install python-dotenv anthropic
```

#### 2. (Optional) Configure Database Path
If you want to use a custom database location:
```bash
cd service/db
cp .env.example .env
# Edit .env and set DB_PATH to your desired location
```

By default, the database is stored at: `database/bengali_curriculam.db`

#### 3. Start the Flask API Server
```bash
cd service/db
python api.py
```

The server will:
- Start on `http://localhost:3002`
- Automatically create the database if it doesn't exist
- Initialize the required tables (preferences, sessions, session_questions, doubts)
- Enable WAL mode for better concurrent access

## Database Configuration

### Default Setup
- **Database Path**: `database/bengali_curriculam.db` (relative to project root)
- **Journal Mode**: WAL (Write-Ahead Logging)
- **Foreign Keys**: Enabled
- **CORS**: Enabled for `http://localhost:5173` (UI dev server)

### Custom Database Path
Set the `DB_PATH` environment variable:
```bash
# Linux/Mac
export DB_PATH=/path/to/custom/database.db

# Windows CMD
set DB_PATH=C:\path\to\custom\database.db

# Windows PowerShell
$env:DB_PATH="C:\path\to\custom\database.db"
```

## Database Schema

The database includes these tables:

1. **preferences** - User preferences (class_id, theme, api_key)
2. **sessions** - Practice session records
3. **session_questions** - Questions attempted in each session
4. **doubts** - Student doubts/questions with AI responses

## API Endpoints

### Curriculum
- `GET /class/<class_id>` - Get class data
- `GET /chapter?classId=<id>&chapterId=<id>` - Get chapter
- `GET /topic?classId=<id>&topicId=<id>` - Get topic
- `GET /questions?classId=<id>&chapterId=<id>&topicId=<id>&difficulty=<level>` - Get questions

### Preferences
- `GET /api/preferences` - Get user preferences
- `PUT /api/preferences` - Update preference

### Sessions
- `GET /api/sessions?classId=<id>` - Get sessions
- `POST /api/sessions` - Save session
- `DELETE /api/sessions/<id>` - Delete session

### Doubts
- `GET /api/doubts?classId=<id>` - Get doubts
- `POST /api/doubts` - Save doubt
- `DELETE /api/doubts/<id>` - Delete doubt
- `POST /api/doubts/ask` - Ask AI (streaming)

## Troubleshooting

### Database is locked
If you see "database is locked" errors:
- Close any other connections to the database
- WAL mode should prevent most locking issues
- Check file permissions on the database file

### Permission denied on database file
```bash
# Give write permissions
chmod 666 database/bengali_curriculam.db
```

### Import errors
Make sure all dependencies are installed:
```bash
cd service/db
pip install flask flask-cors python-dotenv anthropic
```

### Port already in use
If port 3002 is already in use, modify the last line in `api.py`:
```python
app.run(debug=True, port=3003)  # Change to any available port
```

## Verifying Setup

After starting the server, test it:
```bash
# Test basic endpoint
curl http://localhost:3002/api/preferences

# Should return something like:
# {"classId":null,"theme":"light","apiKey":""}
```

## Next Steps

1. Start the UI development server (in another terminal):
```bash
cd ui
npm install
npm run dev
```

2. Access the application at `http://localhost:5173`

3. Configure your Anthropic API key in the UI settings for AI-powered doubt resolution
