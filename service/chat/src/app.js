import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import time from 'perf_hooks';
import conversationsRouter from './routes/conversations.js';
import messagesRouter from './routes/messages.js';
import quickActionsRouter from './routes/quickActions.js';
import audioRouter from './routes/audio.js';

dotenv.config();

const app = express();

// CORS setup
const rawOrigins = process.env.CORS_ORIGINS || 'http://localhost:5173';
const allowedOrigins = rawOrigins.split(',').map(o => o.trim()).filter(Boolean);

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));

// Middleware
app.use(express.json({ limit: '2mb' }));

// Request timing logger
app.use((req, res, next) => {
  req._startTime = time.performance.now();
  next();
});

app.use((req, res, next) => {
  const originalEnd = res.end;
  res.end = function (...args) {
    const elapsed = time.performance.now() - req._startTime;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} ${res.statusCode} ${elapsed.toFixed(0)}ms`);
    originalEnd.call(this, ...args);
  };
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Routes
app.use('/conversations', conversationsRouter);
app.use('/conversations', messagesRouter);
app.use('/quick-actions', quickActionsRouter);
app.use('/audio', audioRouter);

// Error handling
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

export default app;
