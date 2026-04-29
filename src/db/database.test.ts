import { describe, it, expect, afterEach } from 'vitest';
import { getDatabase, closeDatabase } from './database.js';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

function tempDbPath(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scoreboard-test-'));
  return path.join(dir, 'test.db');
}

describe('database initialization', () => {
  let dbPath: string;

  afterEach(() => {
    closeDatabase();
    // Clean up temp files
    if (dbPath && fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
      const dir = path.dirname(dbPath);
      if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    }
  });

  it('should create the database file and directory if missing', () => {
    dbPath = tempDbPath();
    const dir = path.dirname(dbPath);
    // Directory was created by mkdtempSync, remove it to test auto-creation
    fs.rmSync(dir, { recursive: true, force: true });

    const db = getDatabase(dbPath);
    expect(db).toBeDefined();
    expect(fs.existsSync(dbPath)).toBe(true);
  });

  it('should create the players table', () => {
    dbPath = tempDbPath();
    const db = getDatabase(dbPath);

    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='players'")
      .all();
    expect(tables).toHaveLength(1);
  });

  it('should create the scores table', () => {
    dbPath = tempDbPath();
    const db = getDatabase(dbPath);

    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='scores'")
      .all();
    expect(tables).toHaveLength(1);
  });

  it('should create the idx_scores_player_id index', () => {
    dbPath = tempDbPath();
    const db = getDatabase(dbPath);

    const indexes = db
      .prepare("SELECT name FROM sqlite_master WHERE type='index' AND name='idx_scores_player_id'")
      .all();
    expect(indexes).toHaveLength(1);
  });

  it('should enable foreign keys', () => {
    dbPath = tempDbPath();
    const db = getDatabase(dbPath);

    const result = db.pragma('foreign_keys') as { foreign_keys: number }[];
    expect(result[0]).toEqual({ foreign_keys: 1 });
  });

  it('should enforce ON DELETE CASCADE for scores when a player is deleted', () => {
    dbPath = tempDbPath();
    const db = getDatabase(dbPath);

    // Insert a player and a score
    db.prepare(
      "INSERT INTO players (id, display_name, favourite_club, created_at) VALUES (?, ?, ?, datetime('now'))"
    ).run('p1', 'Alice', 'Hawks');

    db.prepare(
      "INSERT INTO scores (id, player_id, score, created_at) VALUES (?, ?, ?, datetime('now'))"
    ).run('s1', 'p1', 100);

    // Verify score exists
    const scoresBefore = db.prepare('SELECT * FROM scores WHERE player_id = ?').all('p1');
    expect(scoresBefore).toHaveLength(1);

    // Delete the player
    db.prepare('DELETE FROM players WHERE id = ?').run('p1');

    // Verify score was cascade-deleted
    const scoresAfter = db.prepare('SELECT * FROM scores WHERE player_id = ?').all('p1');
    expect(scoresAfter).toHaveLength(0);
  });

  it('should enforce CHECK constraint on score > 0', () => {
    dbPath = tempDbPath();
    const db = getDatabase(dbPath);

    db.prepare(
      "INSERT INTO players (id, display_name, favourite_club, created_at) VALUES (?, ?, ?, datetime('now'))"
    ).run('p1', 'Alice', 'Hawks');

    expect(() => {
      db.prepare(
        "INSERT INTO scores (id, player_id, score, created_at) VALUES (?, ?, ?, datetime('now'))"
      ).run('s1', 'p1', 0);
    }).toThrow();
  });

  it('should return the same instance on subsequent calls', () => {
    dbPath = tempDbPath();
    const db1 = getDatabase(dbPath);
    const db2 = getDatabase(dbPath);
    expect(db1).toBe(db2);
  });
});
