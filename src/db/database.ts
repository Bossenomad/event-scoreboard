import { Pool } from 'pg';

export type DatabaseConnection = Pool;

const CONNECTION_STRING = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;

if (!CONNECTION_STRING) {
  throw new Error('Missing SUPABASE_DB_URL (or DATABASE_URL) environment variable.');
}

let pool: Pool | null = null;
let initPromise: Promise<void> | null = null;

function createPool(): Pool {
  return new Pool({
    connectionString: CONNECTION_STRING,
    ssl: { rejectUnauthorized: false },
  });
}

async function initializeSchema(db: Pool): Promise<void> {
  await db.query(`
    CREATE TABLE IF NOT EXISTS players (
      id TEXT PRIMARY KEY,
      display_name TEXT NOT NULL,
      favourite_club TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      email_consent BOOLEAN NOT NULL DEFAULT FALSE,
      gdpr_consent BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS scores (
      id TEXT PRIMARY KEY,
      player_id TEXT REFERENCES players(id) ON DELETE SET NULL,
      score INTEGER NOT NULL CHECK (score > 0),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS pending_top_scores (
      token TEXT PRIMARY KEY,
      score_id TEXT NOT NULL REFERENCES scores(id) ON DELETE CASCADE,
      score INTEGER NOT NULL CHECK (score > 0),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_scores_player_id ON scores(player_id);
    CREATE INDEX IF NOT EXISTS idx_players_created_at ON players(created_at);
    CREATE INDEX IF NOT EXISTS idx_pending_top_scores_created_at ON pending_top_scores(created_at);
  `);
}

export async function getDatabase(): Promise<Pool> {
  if (!pool) {
    pool = createPool();
  }
  if (!initPromise) {
    initPromise = initializeSchema(pool);
  }
  await initPromise;
  return pool;
}

export async function closeDatabase(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    initPromise = null;
  }
}
