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

const DRIVE_FILE_ID = process.env.GOOGLE_DRIVE_FILE_ID;
const SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

if (!DRIVE_FILE_ID || !SERVICE_ACCOUNT_EMAIL || !PRIVATE_KEY) {
  throw new Error(
    'Missing Google Drive env vars: GOOGLE_DRIVE_FILE_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY'
  );
}

const auth = new google.auth.JWT({
  email: SERVICE_ACCOUNT_EMAIL,
  key: PRIVATE_KEY,
  scopes: ['https://www.googleapis.com/auth/drive'],
});

const drive = google.drive({ version: 'v3', auth });

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
  const escaped = value.replace(/"/g, '""');
  return `"${escaped}"`;
}

function csvUnescape(value: string): string {
  let out = value;
  if (out.startsWith('"') && out.endsWith('"')) {
    out = out.slice(1, -1);
  }
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

function serializeState(state: CsvState): string {
  const lines: string[] = [HEADER];
  for (const p of state.players) {
    lines.push(
      [
        'player',
        p.id,
        p.displayName,
        p.favouriteClub,
        p.phone ?? '',
        p.email ?? '',
        String(!!p.emailConsent),
        String(!!p.gdprConsent),
        '',
        '',
        '',
        '',
        p.createdAt,
      ].map(csvEscape).join(',')
    );
  }
  for (const s of state.scores) {
    lines.push(
      [
        'score',
        s.id,
        '',
        '',
        '',
        '',
        '',
        '',
        s.playerId ?? '',
        String(s.score),
        '',
        '',
        s.createdAt,
      ].map(csvEscape).join(',')
    );
  }
  for (const t of state.pendingTopScores) {
    lines.push(
      [
        'pending',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        String(t.score),
        t.token,
        t.scoreId,
        t.createdAt,
      ].map(csvEscape).join(',')
    );
  }
  return lines.join('\n');
}

function parseState(csv: string): CsvState {
  const lines = csv.split(/\r?\n/).filter((line) => line.trim().length > 0);
  const state: CsvState = { players: [], scores: [], pendingTopScores: [] };
  if (lines.length <= 1) return state;

  for (let i = 1; i < lines.length; i++) {
    const row = parseCsvLine(lines[i] || '');
    const [
      recordType,
      id,
      displayName,
      favouriteClub,
      phone,
      email,
      emailConsent,
      gdprConsent,
      playerId,
      score,
      token,
      scoreId,
      createdAt,
    ] = row;

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
    }
    if (recordType === 'score' && id) {
      state.scores.push({
        id,
        playerId: playerId || null,
        score: Number(score || 0),
        createdAt: createdAt || new Date().toISOString(),
      });
    }
    if (recordType === 'pending' && token && scoreId) {
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

async function fetchCsv(): Promise<string> {
  const response = await drive.files.get(
    { fileId: DRIVE_FILE_ID, alt: 'media' },
    { responseType: 'text' as never }
  );
  const data = response.data;
  if (typeof data === 'string') return data;
  return String(data || HEADER);
}

async function uploadCsv(csv: string): Promise<void> {
  await drive.files.update({
    fileId: DRIVE_FILE_ID,
    media: {
      mimeType: 'text/csv',
      body: csv,
    },
  });
}

async function readState(): Promise<CsvState> {
  const csv = await fetchCsv();
  return parseState(csv);
}

async function writeState(state: CsvState): Promise<void> {
  const csv = serializeState(state);
  writeQueue = writeQueue.then(async () => {
    await uploadCsv(csv);
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
