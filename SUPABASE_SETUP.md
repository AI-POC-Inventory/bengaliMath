# 🚀 Supabase Migration & Bengali Chatbot Setup Guide

This guide will help you migrate your Bengali Math application to Supabase and set up the new Bengali chatbot assistant feature.

## Prerequisites

- A Supabase account (free tier is sufficient)
- Node.js installed
- Your existing Bengali Math project

## Step 1: Create Supabase Project

1. Go to [https://supabase.com](https://supabase.com) and sign in
2. Click "New Project"
3. Fill in:
   - **Project Name**: `bengali-math` (or your preferred name)
   - **Database Password**: Choose a strong password (save it securely!)
   - **Region**: Choose closest to your users (e.g., Mumbai for India)
4. Click "Create new project" and wait 1-2 minutes for provisioning

## Step 2: Run Database Migrations

### Option A: Using Supabase Dashboard (Recommended)

1. In your Supabase project, go to **SQL Editor** (left sidebar)
2. Copy and paste the contents of `database/supabase/001_initial_schema.sql`
3. Click **Run** to execute the migration
4. Repeat for `database/supabase/002_seed_data.sql`
5. You should see "Success" messages for both

### Option B: Using Supabase CLI

```bash
# Install Supabase CLI
npm install -g supabase

# Login
supabase login

# Link to your project
supabase link --project-ref your-project-ref

# Run migrations
supabase db push database/supabase/001_initial_schema.sql
supabase db push database/supabase/002_seed_data.sql
```

## Step 3: Get Supabase Credentials

1. In Supabase Dashboard, go to **Settings** > **API**
2. Copy these values:
   - **Project URL** (looks like: `https://xxxxx.supabase.co`)
   - **anon/public key** (starts with `eyJ...`)

## Step 4: Configure Server

1. Navigate to the `server` directory:
   ```bash
   cd server
   ```

2. Install new dependencies:
   ```bash
   npm install
   ```

3. Create `.env` file from example:
   ```bash
   cp .env.example .env
   ```

4. Edit `.env` file and add your Supabase credentials:
   ```env
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_ANON_KEY=your_anon_key_here
   PORT=3001
   ```

## Step 5: Start the Server

Start the server with Supabase:

```bash
npm run dev:supabase
```

You should see:
```
✅ Connected to Supabase
✨ Bengali Math API server (Supabase) → http://localhost:3001
```

## Step 6: Configure Anthropic API Key

The chatbot requires an Anthropic API key to function:

1. Get your API key from [https://console.anthropic.com/](https://console.anthropic.com/)
2. In the Bengali Math UI, go to the **Chat Assistant** section (💬 চ্যাট সহায়ক)
3. You'll be prompted to enter your API key
4. Enter your key (starts with `sk-ant-...`) and click Save

The key is securely stored in Supabase and shared across all AI features.

## Step 7: Test the Chatbot

1. Open the Bengali Math application
2. Click on **💬 চ্যাট সহায়ক** in the sidebar
3. Try these features:
   - Click "নতুন কথোপকথন" to start a new chat
   - Use quick action buttons for common questions
   - Type a math question in Bengali
   - View conversation history in the left sidebar

## Features of the Bengali Chatbot

### 🎯 Key Features

- **Persistent Conversations**: All chats are saved and can be resumed later
- **Context Awareness**: The chatbot remembers previous messages in the conversation
- **Quick Actions**: Pre-built question templates for common tasks:
  - হোমওয়ার্ক সাহায্য (Homework help)
  - ধারণা ব্যাখ্যা (Concept explanation)
  - চর্চার প্রশ্ন (Practice questions)
  - পরীক্ষার প্রস্তুতি (Exam preparation)
- **Streaming Responses**: Real-time AI responses as they're generated
- **Multi-Conversation Management**: Organize multiple chat threads
- **Class-Specific**: Tailored to the student's current class (5-10)

### 💬 How to Use

1. **Start a Conversation**: Click "নতুন কথোপকথন"
2. **Ask Questions**: Type naturally in Bengali about any math topic
3. **Get Help**: The AI assistant will:
   - Explain concepts in simple Bengali
   - Solve problems step-by-step
   - Provide practice questions
   - Offer encouragement and learning tips
4. **Continue Later**: All conversations are saved automatically
5. **Delete Chats**: Click 🗑️ to remove conversations you don't need

### 📊 Database Tables Created

The chatbot uses three main tables:

1. **chat_conversations**: Stores conversation metadata
   - Tracks title, class, user, timestamps
   - Soft-delete with archive flag

2. **chat_messages**: Stores individual messages
   - Links to conversations
   - Tracks role (user/assistant), content, tokens

3. **chat_quick_actions**: Pre-configured question templates
   - Class-specific suggestions
   - Categorized by homework, concepts, practice, exam

## Troubleshooting

### Connection Errors

If you see "Failed to fetch conversations":
- Check your `.env` file has correct Supabase credentials
- Verify Supabase project is running (check dashboard)
- Ensure server is started with `npm run dev:supabase`

### API Key Issues

If AI responses fail:
- Verify your Anthropic API key is valid
- Check you have credits/quota remaining
- Try re-entering the key in the UI

### CORS Errors

If you see CORS errors in browser console:
- Supabase RLS (Row Level Security) may be blocking requests
- Go to Supabase Dashboard > Authentication > Policies
- Add permissive policies for development (tighten for production)

### Migration Errors

If migrations fail:
- Ensure you're running them in order (001 before 002)
- Check SQL syntax matches PostgreSQL (not SQLite)
- Look at error messages in Supabase Dashboard > Logs

## Next Steps

### Optional Enhancements

1. **Enable RLS (Row Level Security)**:
   - Protect user data with Supabase policies
   - Ensure users only see their own conversations

2. **Add Authentication**:
   - Integrate Supabase Auth
   - Link conversations to authenticated users

3. **Analytics**:
   - Track most common questions
   - Monitor token usage
   - Analyze student engagement

4. **Advanced Features**:
   - Voice input for questions
   - Image upload for problem images
   - Export conversations as PDF

## Migration from SQLite (Optional)

If you have existing data in SQLite:

1. Export your SQLite data:
   ```bash
   sqlite3 database/bengali_curriculam.db .dump > data_dump.sql
   ```

2. Convert SQLite syntax to PostgreSQL:
   - Change `INTEGER PRIMARY KEY AUTOINCREMENT` to `SERIAL PRIMARY KEY`
   - Update date/time formats
   - Fix any SQLite-specific syntax

3. Import to Supabase via SQL Editor

## Support

For issues or questions:
- Check Supabase documentation: [https://supabase.com/docs](https://supabase.com/docs)
- Anthropic API docs: [https://docs.anthropic.com](https://docs.anthropic.com)
- Create an issue in your project repository

---

## Quick Reference

### Start Development Server
```bash
cd server
npm run dev:supabase
```

### Start Frontend
```bash
cd ui
npm run dev
```

### Environment Variables
```env
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJxxx...
PORT=3001
```

### Default URLs
- Backend API: `http://localhost:3001`
- Frontend: `http://localhost:5173` (or as shown by Vite)
- Supabase Dashboard: `https://app.supabase.com`

---

Happy coding! 🎉 যশস্বী হোন! (Be successful!)
