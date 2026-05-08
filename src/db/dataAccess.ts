import { v4 as uuidv4 } from 'uuid';
import type { DatabaseConnection } from './database.js';
import type { Player, ScoreRecord, LeaderboardEntry } from '../types.js';

export async function insertPlayer(
  db: DatabaseConnection,
  data: {
    displayName: string;
    favouriteClub: string;
    phone?: string;
    email?: string;
    emailConsent?: boolean;
    gdprConsent?: boolean;
  }
): Promise<Player> {
  const id = uuidv4();
  const result = await db.query(
    `INSERT INTO players (id, display_name, favourite_club, phone, email, email_consent, gdpr_consent)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, display_name, favourite_club, phone, email, email_consent, gdpr_consent, created_at`,
    [id, data.displayName, data.favouriteClub, data.phone ?? null, data.email ?? null, !!data.emailConsent, !!data.gdprConsent]
  );
  return mapRowToPlayer(result.rows[0]);
}

export async function getAllPlayers(db: DatabaseConnection): Promise<Player[]> {
  const result = await db.query(
    `SELECT id, display_name, favourite_club, phone, email, email_consent, gdpr_consent, created_at
     FROM players ORDER BY created_at ASC`
  );
  return result.rows.map(mapRowToPlayer);
}

export async function getPlayerById(db: DatabaseConnection, id: string): Promise<Player | undefined> {
  const result = await db.query(
    `SELECT id, display_name, favourite_club, phone, email, email_consent, gdpr_consent, created_at
     FROM players WHERE id = $1`,
    [id]
  );
  return result.rows[0] ? mapRowToPlayer(result.rows[0]) : undefined;
}

export async function deletePlayer(db: DatabaseConnection, id: string): Promise<boolean> {
  const deletedPlayer = await db.query('DELETE FROM players WHERE id = $1', [id]);
  return (deletedPlayer.rowCount ?? 0) > 0;
}

export async function purgeOldPlayerData(db: DatabaseConnection, retentionDays: number): Promise<number> {
  if (retentionDays <= 0) return 0;
  const result = await db.query(
    `DELETE FROM players
     WHERE created_at < (NOW() - ($1::text || ' days')::interval)`,
    [String(retentionDays)]
  );
  return result.rowCount ?? 0;
}

export async function updatePlayer(
  db: DatabaseConnection,
  id: string,
  data: { displayName: string; favouriteClub: string; phone?: string }
): Promise<Player | undefined> {
  const result = await db.query(
    `UPDATE players
     SET display_name = $1, favourite_club = $2, phone = $3
     WHERE id = $4
     RETURNING id, display_name, favourite_club, phone, email, email_consent, gdpr_consent, created_at`,
    [data.displayName, data.favouriteClub, data.phone ?? null, id]
  );
  return result.rows[0] ? mapRowToPlayer(result.rows[0]) : undefined;
}

export async function insertScore(
  db: DatabaseConnection,
  data: { playerId: string | null; score: number }
): Promise<ScoreRecord> {
  const id = uuidv4();
  const result = await db.query(
    `INSERT INTO scores (id, player_id, score)
     VALUES ($1, $2, $3)
     RETURNING id, player_id, score, created_at`,
    [id, data.playerId, data.score]
  );
  return mapRowToScore(result.rows[0]);
}

export async function attachScoreToPlayer(
  db: DatabaseConnection,
  scoreId: string,
  playerId: string
): Promise<ScoreRecord | undefined> {
  const result = await db.query(
    `UPDATE scores
     SET player_id = $1
     WHERE id = $2
     RETURNING id, player_id, score, created_at`,
    [playerId, scoreId]
  );
  return result.rows[0] ? mapRowToScore(result.rows[0]) : undefined;
}

export async function createPendingTopScore(
  db: DatabaseConnection,
  token: string,
  scoreId: string,
  score: number
): Promise<void> {
  await db.query(
    `INSERT INTO pending_top_scores (token, score_id, score)
     VALUES ($1, $2, $3)`,
    [token, scoreId, score]
  );
}

export async function consumePendingTopScore(
  db: DatabaseConnection,
  token: string
): Promise<{ token: string; scoreId: string; score: number; createdAt: string } | undefined> {
  const result = await db.query(
    `DELETE FROM pending_top_scores
     WHERE token = $1
     RETURNING token, score_id, score, created_at`,
    [token]
  );
  const row = result.rows[0];
  if (!row) return undefined;
  return {
    token: row.token,
    scoreId: row.score_id,
    score: Number(row.score),
    createdAt: toIso(row.created_at),
  };
}

export async function deleteExpiredPendingTopScores(db: DatabaseConnection, ttlMinutes: number): Promise<number> {
  const result = await db.query(
    `DELETE FROM pending_top_scores
     WHERE created_at < (NOW() - ($1::text || ' minutes')::interval)`,
    [String(ttlMinutes)]
  );
  return result.rowCount ?? 0;
}

export async function getLeaderboard(db: DatabaseConnection): Promise<LeaderboardEntry[]> {
  const result = await db.query(
    `WITH player_best AS (
       SELECT s.player_id, MAX(s.score) AS best_score
       FROM scores s
       WHERE s.player_id IS NOT NULL
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

  return result.rows.map((row, index) => ({
    rank: index + 1,
    playerId: row.player_id,
    displayName: row.display_name,
    favouriteClub: row.favourite_club,
    score: Number(row.score),
  }));
}

export async function getPrizePot(db: DatabaseConnection): Promise<number> {
  const result = await db.query('SELECT COALESCE(SUM(score), 0) AS prize_pot FROM scores');
  return Number(result.rows[0].prize_pot);
}

export async function getLatestResult(
  db: DatabaseConnection
): Promise<{ playerId: string | null; displayName: string; favouriteClub?: string; score: number; createdAt: string } | null> {
  const result = await db.query(
    `SELECT s.player_id, p.display_name, p.favourite_club, s.score, s.created_at
     FROM scores s
     LEFT JOIN players p ON p.id = s.player_id
     ORDER BY s.created_at DESC
     LIMIT 1`
  );

  const row = result.rows[0];
  if (!row) return null;

  if (!row.player_id) {
    return {
      playerId: null,
      displayName: 'Anonym',
      favouriteClub: '-',
      score: Number(row.score),
      createdAt: toIso(row.created_at),
    };
  }

  return {
    playerId: row.player_id,
    displayName: row.display_name ?? 'Okänd spelare',
    favouriteClub: row.favourite_club ?? '-',
    score: Number(row.score),
    createdAt: toIso(row.created_at),
  };
}

export async function getScoresExportRows(db: DatabaseConnection): Promise<
  Array<{ createdAt: string; displayName: string; favouriteClub: string; score: number; phone: string }>
> {
  const result = await db.query(
    `SELECT s.created_at, p.display_name, p.favourite_club, p.phone, s.score
     FROM scores s
     LEFT JOIN players p ON p.id = s.player_id
     ORDER BY s.created_at ASC`
  );
  return result.rows.map((row) => ({
    createdAt: toIso(row.created_at),
    displayName: row.display_name ?? 'Anonym',
    favouriteClub: row.favourite_club ?? '-',
    phone: row.phone ?? '-',
    score: Number(row.score),
  }));
}

function mapRowToPlayer(row: {
  id: string;
  display_name: string;
  favourite_club: string;
  phone: string | null;
  email: string | null;
  email_consent: boolean;
  gdpr_consent: boolean;
  created_at: string | Date;
}): Player {
  return {
    id: row.id,
    displayName: row.display_name,
    favouriteClub: row.favourite_club,
    phone: row.phone ?? undefined,
    email: row.email ?? undefined,
    emailConsent: !!row.email_consent,
    gdprConsent: !!row.gdpr_consent,
    createdAt: toIso(row.created_at),
  };
}

function mapRowToScore(row: { id: string; player_id: string | null; score: number; created_at: string | Date }): ScoreRecord {
  return {
    id: row.id,
    playerId: row.player_id ?? null,
    score: Number(row.score),
    createdAt: toIso(row.created_at),
  };
}

function toIso(value: string | Date): string {
  return new Date(value).toISOString();
}
