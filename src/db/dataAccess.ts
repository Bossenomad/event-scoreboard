import type { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import type { Player, ScoreRecord, LeaderboardEntry } from '../types.js';

export async function insertPlayer(
  db: Pool,
  data: {
    displayName: string;
    favouriteClub: string;
    email?: string;
    emailConsent?: boolean;
    gdprConsent?: boolean;
  }
): Promise<Player> {
  const id = uuidv4();
  await db.query(
    `INSERT INTO players (id, display_name, favourite_club, email, email_consent, gdpr_consent)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      id,
      data.displayName,
      data.favouriteClub,
      data.email ?? null,
      !!data.emailConsent,
      !!data.gdprConsent,
    ]
  );
  return (await getPlayerById(db, id))!;
}

export async function getAllPlayers(db: Pool): Promise<Player[]> {
  const result = await db.query(
    `SELECT id, display_name, favourite_club, email, email_consent, gdpr_consent, created_at
     FROM players ORDER BY created_at ASC`
  );
  return result.rows.map(mapRowToPlayer);
}

export async function getPlayerById(db: Pool, id: string): Promise<Player | undefined> {
  const result = await db.query(
    `SELECT id, display_name, favourite_club, email, email_consent, gdpr_consent, created_at
     FROM players WHERE id = $1`,
    [id]
  );
  const row = result.rows[0];
  return row ? mapRowToPlayer(row) : undefined;
}

export async function deletePlayer(db: Pool, id: string): Promise<boolean> {
  const result = await db.query('DELETE FROM players WHERE id = $1', [id]);
  return (result.rowCount ?? 0) > 0;
}

export async function updatePlayer(
  db: Pool,
  id: string,
  data: { displayName: string; favouriteClub: string }
): Promise<Player | undefined> {
  const result = await db.query(
    `UPDATE players SET display_name = $1, favourite_club = $2 WHERE id = $3`,
    [data.displayName, data.favouriteClub, id]
  );
  if ((result.rowCount ?? 0) === 0) {
    return undefined;
  }
  return getPlayerById(db, id);
}

export async function insertScore(
  db: Pool,
  data: { playerId: string; score: number }
): Promise<ScoreRecord> {
  const id = uuidv4();
  const result = await db.query(
    `INSERT INTO scores (id, player_id, score)
     VALUES ($1, $2, $3)
     RETURNING id, player_id, score, created_at`,
    [id, data.playerId, data.score]
  );
  const row = result.rows[0];
  return {
    id: row.id,
    playerId: row.player_id,
    score: Number(row.score),
    createdAt: toIso(row.created_at),
  };
}

export async function getScoresByPlayerId(db: Pool, playerId: string): Promise<ScoreRecord[]> {
  const result = await db.query(
    `SELECT id, player_id, score, created_at
     FROM scores WHERE player_id = $1
     ORDER BY created_at ASC`,
    [playerId]
  );
  return result.rows.map((row: { id: string; player_id: string; score: number; created_at: string }) => ({
    id: row.id,
    playerId: row.player_id,
    score: Number(row.score),
    createdAt: toIso(row.created_at),
  }));
}

export async function getLeaderboard(db: Pool): Promise<LeaderboardEntry[]> {
  const result = await db.query(
    `WITH player_best AS (
       SELECT s.player_id, MAX(s.score) AS best_score
       FROM scores s
       GROUP BY s.player_id
     ),
     first_reached AS (
       SELECT pb.player_id, pb.best_score, MIN(s.created_at) AS first_reached_at
       FROM player_best pb
       JOIN scores s ON s.player_id = pb.player_id AND s.score = pb.best_score
       GROUP BY pb.player_id, pb.best_score
     )
     SELECT
       p.id AS player_id,
       p.display_name,
       p.favourite_club,
       fr.best_score AS score,
       fr.first_reached_at
     FROM first_reached fr
     JOIN players p ON p.id = fr.player_id
     ORDER BY fr.best_score DESC, fr.first_reached_at ASC
     LIMIT 5`
  );

  return result.rows.map((row: { player_id: string; display_name: string; favourite_club: string; score: number }, index: number) => ({
    rank: index + 1,
    playerId: row.player_id,
    displayName: row.display_name,
    favouriteClub: row.favourite_club,
    score: Number(row.score),
  }));
}

export async function getPrizePot(db: Pool): Promise<number> {
  const result = await db.query('SELECT COALESCE(SUM(score), 0) AS prize_pot FROM scores');
  return Number(result.rows[0].prize_pot);
}

export async function getLatestResult(
  db: Pool
): Promise<{ playerId: string; displayName: string; score: number; createdAt: string } | null> {
  const result = await db.query(
    `SELECT s.player_id, p.display_name, s.score, s.created_at
     FROM scores s
     JOIN players p ON p.id = s.player_id
     ORDER BY s.created_at DESC
     LIMIT 1`
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    playerId: row.player_id,
    displayName: row.display_name,
    score: Number(row.score),
    createdAt: toIso(row.created_at),
  };
}

export async function getScoresExportRows(db: Pool): Promise<
  Array<{ createdAt: string; displayName: string; favouriteClub: string; score: number }>
> {
  const result = await db.query(
    `SELECT s.created_at, p.display_name, p.favourite_club, s.score
     FROM scores s
     JOIN players p ON p.id = s.player_id
     ORDER BY s.created_at ASC`
  );
  return result.rows.map((row: { created_at: string; display_name: string; favourite_club: string; score: number }) => ({
    createdAt: toIso(row.created_at),
    displayName: row.display_name,
    favouriteClub: row.favourite_club,
    score: Number(row.score),
  }));
}

function mapRowToPlayer(row: {
  id: string;
  display_name: string;
  favourite_club: string;
  email: string | null;
  email_consent: boolean;
  gdpr_consent: boolean;
  created_at: string | Date;
}): Player {
  const player: Player = {
    id: row.id,
    displayName: row.display_name,
    favouriteClub: row.favourite_club,
    emailConsent: !!row.email_consent,
    gdprConsent: !!row.gdpr_consent,
    createdAt: toIso(row.created_at),
  };
  if (row.email) {
    player.email = row.email;
  }
  return player;
}

function toIso(value: string | Date): string {
  return new Date(value).toISOString();
}
