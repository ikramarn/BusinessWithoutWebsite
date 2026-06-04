require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const searchRouter = require('./routes/search');

const app = express();
const PORT = process.env.PORT || 5000;

// Security middleware
app.use(helmet());
app.use(morgan('dev'));
app.use(express.json());

// CORS - allow React dev server and configured production origin
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(o => o.trim())
  : ['http://localhost:3000', 'http://localhost:5173'];

app.use(cors({
  origin: allowedOrigins,
  methods: ['GET', 'POST'],
}));

// Rate limiting - prevent API abuse
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please wait 15 minutes before trying again.' },
});
app.use('/api/', limiter);

// Routes
app.use('/api', searchRouter);

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// 404 handler
app.use((req, res) => res.status(404).json({ error: 'Route not found' }));

// Global error handler
app.use((err, req, res, next) => {
  console.error('[ERROR]', err.message);
  res.status(500).json({ error: 'Internal server error', detail: err.message });
});

app.listen(PORT, () => {
  console.log(`\n🚀 BusinessWithoutWebsite API running on http://localhost:${PORT}`);
  console.log(`   Google Places: ${process.env.GOOGLE_PLACES_API_KEY ? '✅ configured' : '⚠️  not set (OSM only)'}`);
  console.log(`   Companies House: ${process.env.COMPANIES_HOUSE_API_KEY ? '✅ configured' : '⚠️  not set'}`);
  console.log(`   Bing Search: ${process.env.BING_SEARCH_API_KEY ? '✅ configured' : '⚠️  not set (skipping web search check)'}\n`);
});

module.exports = app;
