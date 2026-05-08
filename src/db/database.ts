import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { google } from 'googleapis';
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

const EMPTY_STATE: CsvState = { players: [], scores: [], pendingTopScores: [] };
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DRIVE_FILE_ID = process.env.GOOGLE_DRIVE_FILE_ID;
const SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
const GOOGLE_READY = !!(DRIVE_FILE_ID && SERVICE_ACCOUNT_EMAIL && PRIVATE_KEY);

const FILE_PATH = process.env.VERCEL
  ? '/tmp/scoreboard-fallback.json'
  : path.join(__dirname, '..', '..', 'data', 'scoreboard-fallback.json');

const HEADER = [
  'recordType',
  'id',
  'displayName',
  'favouriteClub',
  'phone',
  'email',
  'emailConsent',
  'gdprConsent',
  'playerId',
  'score',
  'token',
  'scoreId',
  'createdAt',
].join(',');

let database: DatabaseConnection | null = null;
let writeQueue: Promise<void> = Promise.resolve();

function csvEscape(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function csvUnescape(value: string): string {
  let out = value;
  if (out.startsWith('"') && out.endsWith('"')) out = out.slice(1, -1);
  return out.replace(/""/g, '"');
}

function parseCsvLine(line: string): string[] {
  const parts: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === ',' && !inQuotes) {
      parts.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  parts.push(current);
  return parts.map(csvUnescape);
}

function parseState(csv: string): CsvState {
  const lines = csv.split(/\r?\n/).filter((line) => line.trim());
  const state: CsvState = { players: [], scores: [], pendingTopScores: [] };
  if (lines.length <= 1) return state;
  for (let i = 1; i < lines.length; i++) {
    const row = parseCsvLine(lines[i] || '');
    const [recordType, id, displayName, favouriteClub, phone, email, emailConsent, gdprConsent, playerId, score, token, scoreId, createdAt] = row;
    if (recordType === 'player' && id) {
      state.players.push({
        id,
        displayName: displayName || '',
        favouriteClub: favouriteClub || '',
        phone: phone || undefined,
        email: email || undefined,
        emailConsent: emailConsent === 'true',
        gdprConsent: gdprConsent === 'true',
        createdAt: createdAt || new Date().toISOString(),
      });
    } else if (recordType === 'score' && id) {
      state.scores.push({
        id,
        playerId: playerId || null,
        score: Number(score || 0),
        createdAt: createdAt || new Date().toISOString(),
      });
    } else if (recordType === 'pending' && token && scoreId) {
      state.pendingTopScores.push({
        token,
        scoreId,
        score: Number(score || 0),
        createdAt: createdAt || new Date().toISOString(),
      });
    }
  }
  return state;
}

function serializeState(state: CsvState): string {
  const lines = [HEADER];
  for (const p of state.players) {
    lines.push(
      ['player', p.id, p.displayName, p.favouriteClub, p.phone ?? '', p.email ?? '', String(!!p.emailConsent), String(!!p.gdprConsent), '', '', '', '', p.createdAt]
        .map((v) => csvEscape(v))
        .join(',')
    );
  }
  for (const s of state.scores) {
    lines.push(
      ['score', s.id, '', '', '', '', '', '', s.playerId ?? '', String(s.score), '', '', s.createdAt]
        .map((v) => csvEscape(v))
        .join(',')
    );
  }
  for (const t of state.pendingTopScores) {
    lines.push(
      ['pending', '', '', '', '', '', '', '', '', String(t.score), t.token, t.scoreId, t.createdAt]
        .map((v) => csvEscape(v))
        .join(',')
    );
  }
  return lines.join('\n');
}

function createFileDatabase(): DatabaseConnection {
  async function ensureFile() {
    await fs.mkdir(path.dirname(FILE_PATH), { recursive: true });
    try {
      await fs.access(FILE_PATH);
    } catch {
      await fs.writeFile(FILE_PATH, JSON.stringify(EMPTY_STATE), 'utf8');
    }
  }
  return {
    readState: async () => {
      await ensureFile();
      const raw = await fs.readFile(FILE_PATH, 'utf8');
      const parsed = JSON.parse(raw) as Partial<CsvState>;
      return {
        players: Array.isArray(parsed.players) ? parsed.players : [],
        scores: Array.isArray(parsed.scores) ? parsed.scores : [],
        pendingTopScores: Array.isArray(parsed.pendingTopScores) ? parsed.pendingTopScores : [],
      };
    },
    writeState: async (state) => {
      writeQueue = writeQueue.then(async () => {
        await ensureFile();
        await fs.writeFile(FILE_PATH, JSON.stringify(state), 'utf8');
      });
      await writeQueue;
    },
  };
}

function createGoogleDriveDatabase(): DatabaseConnection {
  const auth = new google.auth.JWT({
    email: SERVICE_ACCOUNT_EMAIL,
    key: PRIVATE_KEY,
    scopes: ['https://www.googleapis.com/auth/drive'],
  });
  const drive = google.drive({ version: 'v3', auth });

  async function fetchCsv(): Promise<string> {
    const response = await drive.files.get(
      { fileId: DRIVE_FILE_ID!, alt: 'media' },
      { responseType: 'text' as never }
    );
    return typeof response.data === 'string' ? response.data : String(response.data || HEADER);
  }

  async function uploadCsv(csv: string): Promise<void> {
    await drive.files.update({
      fileId: DRIVE_FILE_ID!,
      media: { mimeType: 'text/csv', body: csv },
    });
  }

  return {
    readState: async () => parseState(await fetchCsv()),
    writeState: async (state) => {
      writeQueue = writeQueue.then(async () => uploadCsv(serializeState(state)));
      await writeQueue;
    },
  };
}

export async function getDatabase(): Promise<DatabaseConnection> {
  if (!database) {
    database = GOOGLE_READY ? createGoogleDriveDatabase() : createFileDatabase();
  }
  return database;
}

export async function closeDatabase(): Promise<void> {
  database = null;
}
