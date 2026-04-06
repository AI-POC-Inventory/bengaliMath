# Bengali Math - Local Environment Running

## ✅ Services Currently Running

### 1. Backend API Server (Node.js + Express)
- **Status**: ✅ Running
- **URL**: http://localhost:3001
- **Technology**: Node.js, Express, better-sqlite3
- **Database**: `database/bengali_curriculam.db`
- **Log File**: Running in background

**Test the API:**
```bash
curl http://localhost:3001/api/preferences
# Should return: {"classId":7,"theme":"light","apiKey":""}
```

### 2. Frontend UI (React + Vite)
- **Status**: ✅ Running
- **URL**: http://localhost:5173
- **Technology**: React 19, TypeScript, Vite
- **Connected to**: Backend API at http://localhost:3001

**Access the application:**
Open your browser to: **http://localhost:5173**

---

## 🎯 Quick Commands

### Start All Services
```bash
# Terminal 1 - Backend
cd server
npm start

# Terminal 2 - UI
cd ui
npm run dev
```

### Stop Services
```bash
# Find and kill backend (port 3001)
netstat -ano | grep ":3001"
taskkill //F //PID <PID>

# Find and kill UI (port 5173)
netstat -ano | grep ":5173"
taskkill //F //PID <PID>
```

### Check Service Status
```bash
# Check if backend is running
curl http://localhost:3001/api/preferences

# Check if UI is running
curl http://localhost:5173
```

---

## 📊 API Endpoints Available

### Curriculum (Read-only)
- `GET /class/:classId` - Get class data
- `GET /chapter?classId=&chapterId=` - Get chapter info
- `GET /topic?classId=&topicId=` - Get topic info
- `GET /questions?classId=&chapterId=&topicId=&difficulty=` - Get questions

### User Preferences
- `GET /api/preferences` - Get user preferences
- `PUT /api/preferences` - Update preference
  ```json
  { "key": "class_id", "value": "7" }
  ```

### Practice Sessions
- `GET /api/sessions?classId=` - List sessions
- `POST /api/sessions` - Save session results
- `DELETE /api/sessions/:id` - Delete session

### Doubts/Questions
- `GET /api/doubts?classId=` - List doubts
- `POST /api/doubts` - Save doubt
- `POST /api/doubts/ask` - Ask AI (requires API key)
- `DELETE /api/doubts/:id` - Delete doubt

### Admin Panel
- `GET /api/admin/classes` - Manage classes
- `GET /api/admin/chapters` - Manage chapters
- `GET /api/admin/topics` - Manage topics
- `GET /api/admin/questions` - Manage questions

---

## 🗄️ Database Information

**Location**: `database/bengali_curriculam.db`
**Type**: SQLite 3
**Mode**: WAL (Write-Ahead Logging)

**Tables**:
- `classes` - Class definitions
- `chapters` - Chapter data
- `topics` - Topic data
- `questions` - Question bank
- `options` - MCQ options
- `preferences` - User preferences (class_id, theme, api_key)
- `sessions` - Practice session history
- `session_questions` - Questions attempted per session
- `doubts` - Saved doubts with AI responses

**View Database**:
```bash
sqlite3 database/bengali_curriculam.db
.tables
.schema preferences
SELECT * FROM preferences;
```

---

## 🔧 Configuration

### Set Anthropic API Key (for AI tutor)
1. Open the UI: http://localhost:5173
2. Go to Settings
3. Enter your Anthropic API key
4. The key is stored in the `preferences` table

**Or set via API**:
```bash
curl -X PUT http://localhost:3001/api/preferences \
  -H "Content-Type: application/json" \
  -d '{"key": "api_key", "value": "sk-ant-..."}'
```

---

## 🐛 Troubleshooting

### Port Already in Use
If you see "EADDRINUSE" errors:
```bash
# Backend (port 3001)
netstat -ano | grep ":3001"
taskkill //F //PID <PID>

# UI (port 5173)
netstat -ano | grep ":5173"
taskkill //F //PID <PID>
```

### Database Locked
- Check no other processes are accessing the database
- WAL mode should prevent most locking issues
- Close any SQLite browser tools

### UI Not Connecting to Backend
- Verify backend is running: `curl http://localhost:3001/api/preferences`
- Check `ui/src/api/client.ts` has correct URL: `http://localhost:3001/api`
- Check CORS is enabled (it is by default)

---

## 📝 Development Notes

### Hot Reload
- **UI**: Vite provides instant hot reload for React components
- **Backend**: Restart required for changes (or use `npm run dev` for auto-reload)

### Build for Production
```bash
# UI
cd ui
npm run build
# Output in: ui/dist/

# Backend
# No build needed - Node.js runs directly
```

---

## 🎉 Current Session Status

- ✅ Backend running on http://localhost:3001
- ✅ Frontend running on http://localhost:5173
- ✅ Database initialized with WAL mode
- ✅ CORS enabled for local development
- ✅ Ready for development!

**Access your app**: http://localhost:5173
