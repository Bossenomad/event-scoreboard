import express from 'express';
import { createPlayersRouter } from '../src/routes/players.js';
import { createScoresRouter } from '../src/routes/scores.js';
import { createQRCodeRouter } from '../src/routes/qrcode.js';
import { createScoreboardService } from '../src/services/scoreboardService.js';
import { getDatabase } from '../src/db/database.js';
import { generateQRCode, getRegistrationUrl } from '../src/services/qrCodeService.js';

const app = express();
app.use(express.json());

let initialized = false;

async function ensureInitialized() {
  if (initialized) {
    return;
  }

  const db = await getDatabase();
  const service = createScoreboardService(db);

  app.use('/api/players', createPlayersRouter(service));
  app.use('/api', createScoresRouter(service));

  const baseUrl =
    process.env.BASE_URL ||
    (process.env.VERCEL_URL
      ? process.env.VERCEL_URL.startsWith('http')
        ? process.env.VERCEL_URL
        : `https://${process.env.VERCEL_URL}`
      : undefined);

  const resolvedBaseUrl = baseUrl || 'http://localhost:3000';
  const registrationUrl = getRegistrationUrl(resolvedBaseUrl);
  const qrCodeSvg = await generateQRCode(resolvedBaseUrl);

  app.use('/api/qrcode', createQRCodeRouter(qrCodeSvg, registrationUrl));
  initialized = true;
}

export default async function handler(req: express.Request, res: express.Response) {
  await ensureInitialized();
  return app(req, res);
}
