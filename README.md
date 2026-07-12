# Bengali Math (বাংলা গণিত)

An interactive educational platform for learning mathematics in Bengali, featuring AI-powered tutoring and comprehensive curriculum coverage.

## 🚀 Project Overview

Bengali Math is a full-stack application with:
- **Web Application** - React-based UI for desktop/mobile browsers
- **Android Mobile App** - Native Android app for Google Play Store
- **Backend API** - Node.js/Express server with SQLite/Supabase
- **Python Services** - Content extraction and AI question generation

## 📱 Available Platforms

### Web Application
Access through any modern web browser at `http://localhost:5173` (development) or your deployed URL.

### Android Mobile App
Download from Google Play Store (coming soon) or build from source.

**[→ Mobile App Setup Guide](apps/mobile/README.md)**  
**[→ Google Play Deployment Guide](apps/mobile/DEPLOYMENT_GUIDE.md)**

## 🎯 Features

- **Comprehensive Curriculum**: Classes 5-10 with all major math topics
- **Interactive Practice**: Instant feedback on practice questions
- **AI Tutor**: Ask doubts in Bengali, get step-by-step explanations (powered by Claude AI)
- **Word Problem Generator**: Create custom word problems based on real scenarios
- **Progress Tracking**: View your practice history and performance
- **Dark Mode**: Comfortable learning experience day or night
- **Bengali Interface**: Complete support for Bengali language

## 🛠️ Tech Stack

### Frontend
- React 19 + TypeScript
- Vite (build tool)
- React Context (state management)

### Backend
- Node.js + Express
- SQLite / Supabase (PostgreSQL)
- Anthropic Claude API (AI features)

### Mobile
- Capacitor 8 (web-to-native wrapper)
- Android SDK

### Services
- Python + Flask (content API)
- PDF/Excel extraction tools
- AI question generator

## 📦 Project Structure

```
bengaliMath/
├── ui/                    # React frontend
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── api/          # API client
│   │   └── types.ts      # TypeScript types
│   └── dist/             # Production build
│
├── server/               # Node.js backend
│   ├── index.js          # SQLite version
│   └── index-supabase.js # Supabase version
│
├── service/              # Python services
│   ├── db/              # Database API
│   │   └── api.py       # Flask server
│   └── content/         # Content management
│       └── question_generator.py  # AI question generation
│
├── apps/                 # Mobile apps
│   └── mobile/          # Android app (Capacitor)
│       ├── android/     # Native Android project
│       ├── README.md    # Mobile setup guide
│       └── DEPLOYMENT_GUIDE.md  # Play Store deployment
│
└── database/            # SQLite database
    └── bengali_curriculam.db
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Python 3.8+
- Android Studio (for mobile app)
- Anthropic API key (for AI features)

### Web Application

**1. Start the Backend**
```bash
cd server
npm install
npm start
# Runs on http://localhost:3001
```

**2. Start the Frontend**
```bash
cd ui
npm install
npm run dev
# Runs on http://localhost:5173
```

**3. Open in Browser**
Visit `http://localhost:5173`

### Android Mobile App

**1. Build the Web App**
```bash
cd ui
npm run build
```

**2. Setup and Run Mobile App**
```bash
cd apps/mobile
npm install
npm run sync        # Sync web assets with Android
npm run open        # Open in Android Studio
```

**3. Run on Device/Emulator**
- Click the Run button in Android Studio
- Or use: `npm run run`

**For detailed setup and deployment**, see:
- [Mobile App Setup](apps/mobile/README.md)
- [Google Play Deployment](apps/mobile/DEPLOYMENT_GUIDE.md)

## 🔧 Development

### Frontend Development
```bash
cd ui
npm run dev          # Start dev server with hot reload
npm run build        # Production build
npm run lint         # Run ESLint
```

### Backend Development
```bash
cd server
npm start            # Start with SQLite
npm run dev          # Auto-reload mode
npm run start:supabase  # Use Supabase backend
```

### Python Services
```bash
# Database API
cd service/db
python api.py

# Question Generator
cd service/content
python question_generator.py --mode full
```

### Mobile Development
```bash
cd apps/mobile
npm run sync         # Rebuild UI and sync with Android
npm run open         # Open in Android Studio
npm run run          # Build and run on device
```

## 🌐 Environment Configuration

### Web App (`ui/.env`)
```env
VITE_API_BASE_URL=http://localhost:3001/api
```

### Mobile App
For mobile, update `ui/.env` with your computer's IP or production URL:
```env
# Local network development
VITE_API_BASE_URL=http://192.168.1.100:3001/api

# Production
VITE_API_BASE_URL=https://your-backend-url.com/api
```

Then rebuild: `cd apps/mobile && npm run sync`

### Python Services (`service/db/.env`)
```env
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key
```

## 📊 Database

### SQLite (Current)
- Location: `database/bengali_curriculam.db`
- Tables: classes, chapters, topics, questions, options, preferences, sessions, doubts

### Supabase (Migration in progress)
- Cloud PostgreSQL database
- Same schema as SQLite
- Configure in `service/db/.env`

## 🤖 AI Features

### AI Tutor (Doubt Resolution)
- Ask questions in Bengali
- Get step-by-step explanations
- Powered by Anthropic Claude API

### AI Question Generator
- Generate questions for entire curriculum
- Customizable difficulty and quantity
- See [Question Generator README](service/content/QUESTION_GENERATOR_README.md)

**Setup**: Add your Anthropic API key in app preferences or `service/db/.env`

## 📱 Mobile App Distribution

### Google Play Store

1. **Build Release**: Follow [Deployment Guide](apps/mobile/DEPLOYMENT_GUIDE.md)
2. **Create Play Console Account**: $25 one-time fee
3. **Upload AAB**: Android App Bundle to Play Console
4. **Review**: Google reviews in 1-3 days
5. **Publish**: App goes live!

### Alternative Distribution

- **Direct APK**: Share APK file directly (requires "Unknown sources" enabled)
- **Internal Testing**: Distribute to testers via Play Console
- **Closed Beta**: Invite-only testing group

## 🧪 Testing

### Web App
```bash
cd ui
npm run build        # TypeScript type checking
npm run lint         # ESLint
```

### Mobile App
```bash
cd apps/mobile
npm run sync         # Ensure web assets are synced
# Then test in Android Studio or on device
```

## 📖 Documentation

- [CLAUDE.md](CLAUDE.md) - Project overview for AI assistance
- [Mobile App Setup](apps/mobile/README.md) - Detailed mobile setup
- [Play Store Deployment](apps/mobile/DEPLOYMENT_GUIDE.md) - Publishing guide
- [Question Generator](service/content/QUESTION_GENERATOR_README.md) - AI question generation

## 🤝 Contributing

This is a personal educational project. For issues or suggestions:
- Email: sendtosutap@gmail.com
- GitHub Issues: [Create an issue](https://github.com/AI-POC-Inventory/bengaliMath/issues)

## 📄 License

[Your License Here - e.g., MIT, GPL, etc.]

## 🙏 Acknowledgments

- [Anthropic Claude API](https://www.anthropic.com/) - AI-powered features
- [Capacitor](https://capacitorjs.com/) - Web-to-native app framework
- [React](https://react.dev/) - UI framework
- [Vite](https://vitejs.dev/) - Build tool

---

**Made with ❤️ for Bengali-speaking math learners**
