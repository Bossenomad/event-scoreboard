import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Player, ScoreRecord } from '../types.js';

interface PendingTopScoreRow {
  token: string;
  scoreId: string;
  score: number;
  createdAt: string;
}

interface CsvState {
  players: Player[];
  scores: ScoreRecord[];
  pendingTopScores: PendingTopScoreRow[];
}

export interface DatabaseConnection {
  readState: () => Promise<CsvState>;
  writeState: (state: CsvState) => Promise<void>;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FILE_PATH = process.env.VERCEL
  ? '/tmp/scoreboard.json'
  : path.join(__dirname, '..', '..', 'data', 'scoreboard.json');

const EMPTY_STATE: CsvState = { players: [], scores: [], pendingTopScores: [] };

let database: DatabaseConnection | null = null;
let writeQueue: Promise<void> = Promise.resolve();

async function ensureFile(): Promise<void> {
  await fs.mkdir(path.dirname(FILE_PATH), { recursive: true });
  try {
    await fs.access(FILE_PATH);
  } catch {
    await fs.writeFile(FILE_PATH, JSON.stringify(EMPTY_STATE), 'utf8');
  }
}

async function readState(): Promise<CsvState> {
  await ensureFile();
  const raw = await fs.readFile(FILE_PATH, 'utf8');
  const parsed = JSON.parse(raw) as Partial<CsvState>;
  return {
    players: Array.isArray(parsed.players) ? parsed.players : [],
    scores: Array.isArray(parsed.scores) ? parsed.scores : [],
    pendingTopScores: Array.isArray(parsed.pendingTopScores) ? parsed.pendingTopScores : [],
  };
}

async function writeState(state: CsvState): Promise<void> {
  writeQueue = writeQueue.then(async () => {
    await ensureFile();
    await fs.writeFile(FILE_PATH, JSON.stringify(state), 'utf8');
  });
  await writeQueue;
}

export async function getDatabase(): Promise<DatabaseConnection> {
  if (!database) {
    database = { readState, writeState };
  }
  return database;
}

export async function closeDatabase(): Promise<void> {
  database = null;
}
