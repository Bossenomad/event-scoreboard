import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';

const DEFAULT_DB_PATH = process.env.VERCEL ? '/tmp/scoreboard.db' : './data/scoreboard.db';

let db: Database.Database | null = null;

/**
 * Initializes the SQLite database, creating the data directory and file if missing.
 * Enables foreign keys and creates the schema (players, scores tables and index).
 */
function createDatabase(dbPath: string): Database.Database {
  // Ensure the directory exists
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const database = new Database(dbPath);

  // Enable foreign key enforcement
  database.pragma('foreign_keys = ON');

  // Create tables and index
  database.exec(`
    CREATE TABLE IF NOT EXISTS players (
      id TEXT PRIMARY KEY,
      display_name TEXT NOT NULL,
      favourite_club TEXT NOT NULL,
      email TEXT,
      email_consent INTEGER DEFAULT 0,
      gdpr_consent INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS scores (
      id TEXT PRIMARY KEY,
      player_id TEXT NOT NULL,
      score INTEGER NOT NULL CHECK (score > 0),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_scores_player_id ON scores(player_id);
  `);

  const playerColumns = database
    .prepare(`PRAGMA table_info(players)`)
    .all() as Array<{ name: string }>;
  const hasGdprConsent = playerColumns.some((column) => column.name === 'gdpr_consent');
  if (!hasGdprConsent) {
    database.exec(`ALTER TABLE players ADD COLUMN gdpr_consent INTEGER DEFAULT 0`);
  }

  return database;
}

/**
 * Returns the singleton database instance, creating it if necessary.
 * @param dbPath - Path to the SQLite database file (default: ./data/scoreboard.db)
 */
export function getDatabase(dbPath?: string): Database.Database {
  if (!db) {
    db = createDatabase(dbPath ?? DEFAULT_DB_PATH);
  }
  return db;
}

/**
 * Closes the database connection and resets the singleton.
 * Useful for testing and graceful shutdown.
 */
export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}
