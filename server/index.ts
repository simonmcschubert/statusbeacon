import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes (to be implemented)
app.get('/api/status', (req, res) => {
  res.json({ message: 'Status API - Coming soon' });
});

app.get('/api/monitors', (req, res) => {
  res.json({ message: 'Monitors API - Coming soon' });
});

app.get('/api/incidents', (req, res) => {
  res.json({ message: 'Incidents API - Coming soon' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Status Page server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
});
