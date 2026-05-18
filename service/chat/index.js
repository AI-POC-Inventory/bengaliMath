import app from './src/app.js';

const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
  console.log(`🚀 Chat service running on port ${PORT}`);
  console.log(`   Health check: http://localhost:${PORT}/health`);
});
