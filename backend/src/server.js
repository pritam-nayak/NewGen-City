require('dotenv').config();

const fs = require('node:fs/promises');
const path = require('node:path');
const cors = require('cors');
const express = require('express');
const db = require('./db/connection');
const complaintsRouter = require('./routes/complaints');
const departmentsRouter = require('./routes/departments');
const authRouter = require('./routes/auth');
const { verifyOperationsAccess } = require('./middleware/operationsAuth');
const { startSlaCron } = require('./jobs/slaCron');
const { getCityConditions } = require('./agents/cityConditionsAgent');
const { buildCityServiceAgents } = require('./agents/cityServiceAgents');
const { rateLimit } = require('express-rate-limit');

const app = express();
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}
const frontendOrigin = process.env.FRONTEND_ORIGIN || 'http://localhost:5173';
const allowedOrigins = new Set([frontendOrigin]);
if (process.env.NODE_ENV !== 'production') {
  allowedOrigins.add('http://localhost:5173');
  allowedOrigins.add('http://127.0.0.1:5173');
}
app.use(cors({
  origin(origin, callback) {
    callback(null, !origin || allowedOrigins.has(origin));
  },
}));
app.use(express.json({ limit: '1mb' }));

app.get('/health', async (_req, res, next) => {
  try {
    await db.query('SELECT 1');
    res.json({ status: 'ok' });
  } catch (error) {
    next(error);
  }
});

app.get('/auth/verify', verifyOperationsAccess, (_req, res) => {
  res.json({ authorized: true });
});
app.use('/auth', authRouter);

app.get('/overview', async (_req, res, next) => {
  try {
    const Complaint = require('./models/Complaint');
    res.json(await Complaint.getOverview());
  } catch (error) {
    next(error);
  }
});

app.get('/city/conditions', rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
}), async (req, res, next) => {
  try {
    const Complaint = require('./models/Complaint');
    const conditions = await getCityConditions({
      forceRefresh: req.query.refresh === 'true',
    });
    const reports = await Complaint.getActiveCategoryCounts();
    res.set('Cache-Control', 'public, max-age=300');
    res.json({
      ...conditions,
      reports,
      agents: buildCityServiceAgents(reports, conditions),
    });
  } catch (error) {
    next(error);
  }
});

app.use('/complaints', complaintsRouter);
app.use('/departments', departmentsRouter);

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: 'An unexpected server error occurred.' });
});

async function start() {
  const schemaPath = path.resolve(__dirname, '../../database/schema.sql');
  const schema = await fs.readFile(schemaPath, 'utf8');
  await db.query(schema);
  startSlaCron();
  const port = Number(process.env.PORT) || 4000;
  app.listen(port, () => console.info(`NewGen City API listening on ${port}`));
}

start().catch((error) => {
  console.error('Could not start NewGen City API:', error);
  process.exitCode = 1;
});
