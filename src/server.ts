import express from 'express';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DatabaseConnection } from './db/database.js';
import { getDatabase } from './db/database.js';
import { createScoreboardService } from './services/scoreboardService.js';
import { createPlayersRouter } from './routes/players.js';
import { createScoresRouter } from './routes/scores.js';
import { createBlazeRouter } from './routes/blaze.js';
import { setupWebSocket } from './services/websocketServer.js';
import { generateQRCode, getRegistrationUrl } from './services/qrCodeService.js';
import { createQRCodeRouter } from './routes/qrcode.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

// JSON body parsing middleware
app.use(express.json());

// CORS for API endpoints (needed for file:// testing and cross-origin clients)
app.use('/api', (req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  next();
});

// Serve static files from public/ directory
const publicDir = path.join(__dirname, '..', 'public');
app.use(express.static(publicDir));

// Serve registration form at /register
app.use('/register', express.static(path.join(publicDir, 'register')));

// Serve staff interface at /staff
app.use('/staff', express.static(path.join(publicDir, 'staff')));

// Serve TV display at /tv
app.use('/tv', express.static(path.join(publicDir, 'tv')));
app.use('/reg', express.static(path.join(publicDir, 'reg')));
app.use('/blaze', express.static(path.join(publicDir, 'blaze')));

// Root route -> TV display
app.get('/', (_req, res) => {
  res.redirect('/tv');
});

// QR code configuration
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;
const registrationUrl = getRegistrationUrl(BASE_URL);

export function createApp() {
  return app;
}

const server = http.createServer(app);
let db: DatabaseConnection;

// Generate QR code at startup and mount the route
async function startServer() {
  db = await getDatabase();
  const service = createScoreboardService(db);

  let broadcastFn: () => void = () => {};
  const setBroadcastFn = (fn: () => void): void => {
    broadcastFn = fn;
  };

  app.use('/api/players', createPlayersRouter(service, () => broadcastFn()));
  app.use('/api', createScoresRouter(service, () => broadcastFn()));
  app.use('/api', createBlazeRouter());

  const broadcast = setupWebSocket(server, service);
  setBroadcastFn(broadcast);

  const qrCodeSvg = await generateQRCode(BASE_URL);
  app.use('/api/qrcode', createQRCodeRouter(qrCodeSvg, registrationUrl));

  server.listen(PORT, () => {
    console.log(`Event Scoreboard server running on port ${PORT}`);
    console.log(`Registration URL: ${registrationUrl}`);
  });
}

startServer();

export { app, server, db };
export default app;
