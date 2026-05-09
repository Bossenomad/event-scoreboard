import { Router } from 'express';
import type { Request, Response } from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

type BlazeEntry = {
  score: number;
  createdAt: string;
};

type BlazeState = {
  entries: BlazeEntry[];
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const STATE_PATH = process.env.BLAZE_STATE_PATH || path.join(__dirname, '..', '..', 'data', 'blaze-scoreboard.json');

async function readState(): Promise<BlazeState> {
  try {
    const raw = await fs.readFile(STATE_PATH, 'utf8');
    const parsed = JSON.parse(raw) as BlazeState;
    if (!parsed || !Array.isArray(parsed.entries)) {
      return { entries: [] };
    }
    return { entries: parsed.entries.filter((e) => Number.isInteger(e.score) && e.score > 0 && typeof e.createdAt === 'string') };
  } catch {
    return { entries: [] };
  }
}

async function writeState(state: BlazeState): Promise<void> {
  const dir = path.dirname(STATE_PATH);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(STATE_PATH, JSON.stringify(state, null, 2), 'utf8');
}

function buildScoreboard(state: BlazeState) {
  const prizePot = state.entries.reduce((sum, e) => sum + e.score, 0);
  const sorted = [...state.entries].sort((a, b) => (b.score - a.score) || a.createdAt.localeCompare(b.createdAt));
  const leaderboard = sorted.slice(0, 5).map((entry, idx) => ({
    rank: idx + 1,
    playerId: `blaze-${idx + 1}`,
    displayName: `Spelare ${idx + 1}`,
    favouriteClub: '-',
    score: entry.score,
  }));

  return { prizePot, leaderboard };
}

export function createBlazeRouter(): Router {
  const router = Router();

  router.post('/blaze/intake', async (req: Request, res: Response) => {
    const score = Number(req.body?.score);
    if (!Number.isInteger(score) || score <= 0 || score > 100) {
      res.status(400).json({
        error: 'Validation failed',
        fields: { score: 'Poäng måste vara ett heltal mellan 1 och 100' },
      });
      return;
    }

    const state = await readState();
    state.entries.push({ score, createdAt: new Date().toISOString() });
    await writeState(state);
    res.status(200).json({ ok: true });
  });

  router.get('/blaze/scoreboard', async (_req: Request, res: Response) => {
    const state = await readState();
    res.status(200).json(buildScoreboard(state));
  });

  return router;
}

