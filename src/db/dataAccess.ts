import type Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import type { Player, ScoreRecord, LeaderboardEntry } from '../types.js';

// --- Player operations ---

export function insertPlayer(
  db: Database.Database,
  data: {
    displayName: string;
    favouriteClub: string;
    email?: string;
    emailConsent?: boolean;
    gdprConsent?: boolean;
  }
): Player {
  const id = uuidv4();
  const stmt = db.prepare(`
    INSERT INTO players (id, display_name, favourite_club, email, email_consent, gdpr_consent, created_at)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
  `);
  stmt.run(
    id,
    data.displayName,
    data.favouriteClub,
    data.email ?? null,
    data.emailConsent ? 1 : 0,
    data.gdprConsent ? 1 : 0
  );

  return getPlayerById(db, id)!;
}

export function getAllPlayers(db: Database.Database): Player[] {
  const rows = db.prepare('SELECT * FROM players ORDER BY created_at ASC').all() as Array<{
    id: string;
    display_name: string;
    favourite_club: string;
    email: string | null;
    email_consent: number;
    gdpr_consent: number;
    created_at: string;
  }>;

  return rows.map(mapRowToPlayer);
}

export function getPlayerById(db: Database.Database, id: string): Player | undefined {
  const row = db.prepare('SELECT * FROM players WHERE id = ?').get(id) as
    | {
        id: string;
        display_name: string;
        favourite_club: string;
        email: string | null;
        email_consent: number;
        gdpr_consent: number;
        created_at: string;
      }
    | undefined;

  return row ? mapRowToPlayer(row) : undefined;
}

export function deletePlayer(db: Database.Database, id: string): boolean {
  const result = db.prepare('DELETE FROM players WHERE id = ?').run(id);
  return result.changes > 0;
}

export function updatePlayer(
  db: Database.Database,
  id: string,
  data: { displayName: string; favouriteClub: string }
): Player | undefined {
  const result = db
    .prepare(
      `
      UPDATE players
      SET display_name = ?, favourite_club = ?
      WHERE id = ?
    `
    )
    .run(data.displayName, data.favouriteClub, id);

  if (result.changes === 0) {
    return undefined;
  }

  return getPlayerById(db, id);
}

// --- Score operations ---

export function insertScore(
  db: Database.Database,
  data: { playerId: string; score: number }
): ScoreRecord {
  const id = uuidv4();
  const stmt = db.prepare(`
    INSERT INTO scores (id, player_id, score, created_at)
    VALUES (?, ?, ?, datetime('now'))
  `);
  stmt.run(id, data.playerId, data.score);

  const row = db.prepare('SELECT * FROM scores WHERE id = ?').get(id) as {
    id: string;
    player_id: string;
    score: number;
    created_at: string;
  };

  return {
    id: row.id,
    playerId: row.player_id,
    score: row.score,
    createdAt: row.created_at,
  };
}

export function getScoresByPlayerId(db: Database.Database, playerId: string): ScoreRecord[] {
  const rows = db
    .prepare('SELECT * FROM scores WHERE player_id = ? ORDER BY created_at ASC')
    .all(playerId) as Array<{
    id: string;
    player_id: string;
    score: number;
    created_at: string;
  }>;

  return rows.map((row) => ({
    id: row.id,
    playerId: row.player_id,
    score: row.score,
    createdAt: row.created_at,
  }));
}

// --- Leaderboard and prize pot ---

export function getLeaderboard(db: Database.Database): LeaderboardEntry[] {
  const rows = db
    .prepare(
      `SELECT
        p.id AS player_id,
        p.display_name,
        p.favourite_club,
        MAX(s.score) AS score,
        (
          SELECT MIN(s2.created_at)
          FROM scores s2
          WHERE s2.player_id = p.id
            AND s2.score = MAX(s.score)
        ) AS first_reached_at
      FROM scores s
      JOIN players p ON s.player_id = p.id
      GROUP BY p.id
      ORDER BY score DESC, first_reached_at ASC
      LIMIT 5`
    )
    .all() as Array<{
    player_id: string;
    display_name: string;
    favourite_club: string;
    score: number;
    first_reached_at: string;
  }>;

  return rows.map((row, index) => ({
    rank: index + 1,
    playerId: row.player_id,
    displayName: row.display_name,
    favouriteClub: row.favourite_club,
    score: row.score,
  }));
}

export function getPrizePot(db: Database.Database): number {
  const row = db.prepare('SELECT COALESCE(SUM(score), 0) AS prize_pot FROM scores').get() as {
    prize_pot: number;
  };
  return row.prize_pot;
}

export function getLatestResult(
  db: Database.Database
): { playerId: string; displayName: string; score: number; createdAt: string } | null {
  const row = db
    .prepare(
      `SELECT
        s.player_id,
        p.display_name,
        s.score,
        s.created_at
      FROM scores s
      JOIN players p ON p.id = s.player_id
      ORDER BY s.created_at DESC
      LIMIT 1`
    )
    .get() as
    | {
        player_id: string;
        display_name: string;
        score: number;
        created_at: string;
      }
    | undefined;

  if (!row) {
    return null;
  }

  return {
    playerId: row.player_id,
    displayName: row.display_name,
    score: row.score,
    createdAt: row.created_at,
  };
}

export function getScoresExportRows(db: Database.Database): Array<{
  createdAt: string;
  displayName: string;
  favouriteClub: string;
  score: number;
}> {
  return db
    .prepare(
      `SELECT
        s.created_at AS createdAt,
        p.display_name AS displayName,
        p.favourite_club AS favouriteClub,
        s.score AS score
      FROM scores s
      JOIN players p ON p.id = s.player_id
      ORDER BY s.created_at ASC`
    )
    .all() as Array<{
    createdAt: string;
    displayName: string;
    favouriteClub: string;
    score: number;
  }>;
}

// --- Helpers ---

function mapRowToPlayer(row: {
  id: string;
  display_name: string;
  favourite_club: string;
  email: string | null;
  email_consent: number;
  gdpr_consent: number;
  created_at: string;
}): Player {
  const player: Player = {
    id: row.id,
    displayName: row.display_name,
    favouriteClub: row.favourite_club,
    emailConsent: row.email_consent === 1,
    gdprConsent: row.gdpr_consent === 1,
    createdAt: row.created_at,
  };
  if (row.email) {
    player.email = row.email;
  }
  return player;
}
