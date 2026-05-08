import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Player, ScoreRecord } from '../types.js';

export interface DatabaseState {
  players: Player[];
  scores: ScoreRecord[];
}

export interface LocalDatabase {
  readState: () => Promise<DatabaseState>;
  writeState: (state: DatabaseState) => Promise<void>;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_PATH = process.env.VERCEL
  ? '/tmp/scoreboard.json'
  : path.join(__dirname, '..', '..', 'data', 'scoreboard.json');

let database: LocalDatabase | null = null;
let queue: Promise<void> = Promise.resolve();

const EMPTY_STATE: DatabaseState = {
  players: [],
  scores: [],
};

async function ensureFile(): Promise<void> {
  await fs.mkdir(path.dirname(DATA_PATH), { recursive: true });
  try {
    await fs.access(DATA_PATH);
  } catch {
    await fs.writeFile(DATA_PATH, JSON.stringify(EMPTY_STATE, null, 2), 'utf8');
  }
}

async function readStateFromDisk(): Promise<DatabaseState> {
  await ensureFile();
  const raw = await fs.readFile(DATA_PATH, 'utf8');
  const parsed = JSON.parse(raw) as Partial<DatabaseState>;
  return {
    players: Array.isArray(parsed.players) ? parsed.players : [],
    scores: Array.isArray(parsed.scores) ? parsed.scores : [],
  };
}

async function writeStateToDisk(state: DatabaseState): Promise<void> {
  await ensureFile();
  await fs.writeFile(DATA_PATH, JSON.stringify(state, null, 2), 'utf8');
}

export async function getDatabase(): Promise<LocalDatabase> {
  if (!database) {
    database = {
      readState: async () => readStateFromDisk(),
      writeState: async (state) => {
        queue = queue.then(() => writeStateToDisk(state));
        await queue;
      },
    };
  }
  return database;
}

export async function closeDatabase(): Promise<void> {
  database = null;
}
