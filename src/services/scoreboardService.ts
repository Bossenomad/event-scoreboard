import type { DatabaseConnection } from '../db/database.js';
import type { Player, PlayerRegistration, ScoreRecord, ScoreboardState } from '../types.js';
import {
  insertPlayer,
  getAllPlayers,
  getPlayerById,
  deletePlayer as dbDeletePlayer,
  updatePlayer as dbUpdatePlayer,
  insertScore,
  attachScoreToPlayer,
  getLeaderboard,
  getPrizePot,
  getLatestResult,
  getScoresExportRows,
  purgeOldPlayerData,
  consumePendingTopScore,
  deleteExpiredPendingTopScores,
} from '../db/dataAccess.js';

export class ValidationError extends Error {
  public readonly errors: Record<string, string>;

  constructor(errors: Record<string, string>) {
    super('Validation failed');
    this.name = 'ValidationError';
    this.errors = errors;
  }
}

export class PlayerNotFoundError extends Error {
  constructor(playerId: string) {
    super(`Player not found: ${playerId}`);
    this.name = 'PlayerNotFoundError';
  }
}

export interface PlayerResponse {
  id: string;
  displayName: string;
  favouriteClub: string;
  phone?: string;
  emailConsent: boolean;
  createdAt: string;
}

function toPlayerResponse(player: Player): PlayerResponse {
  return {
    id: player.id,
    displayName: player.displayName,
    favouriteClub: player.favouriteClub,
    phone: player.phone,
    emailConsent: player.emailConsent,
    createdAt: player.createdAt,
  };
}

function validateBasicPlayerInput(data: { displayName?: string; favouriteClub?: string; phone?: string }) {
  const errors: Record<string, string> = {};
  if (!data.displayName || !data.displayName.trim()) {
    errors.displayName = 'Namn krävs';
  }
  if (!data.favouriteClub || !data.favouriteClub.trim()) {
    errors.favouriteClub = 'Favoritförening krävs';
  }
  if (!data.phone || !data.phone.trim()) {
    errors.phone = 'Telefonnummer krävs';
  }
  if (Object.keys(errors).length > 0) {
    throw new ValidationError(errors);
  }
}

export function createScoreboardService(db: DatabaseConnection) {
  const retentionDays = Math.max(parseInt(process.env.GDPR_RETENTION_DAYS || '30', 10) || 30, 1);
  const pendingTokenTtlMinutes = Math.max(parseInt(process.env.PENDING_TOP_TOKEN_TTL_MINUTES || '30', 10) || 30, 1);

  async function applyRetention(): Promise<void> {
    await Promise.all([
      purgeOldPlayerData(db, retentionDays),
      deleteExpiredPendingTopScores(db, pendingTokenTtlMinutes),
    ]);
  }

  return {
    async registerPlayer(data: PlayerRegistration): Promise<PlayerResponse> {
      await applyRetention();
      validateBasicPlayerInput(data);
      const player = await insertPlayer(db, {
        displayName: data.displayName.trim(),
        favouriteClub: data.favouriteClub.trim(),
        phone: data.phone?.trim(),
        email: data.email?.trim() || undefined,
        emailConsent: data.emailConsent,
        gdprConsent: data.gdprConsent,
      });
      return toPlayerResponse(player);
    },

    async getPlayers(): Promise<Player[]> {
      await applyRetention();
      return getAllPlayers(db);
    },

    async recordScore(playerId: string, score: number): Promise<ScoreRecord> {
      await applyRetention();
      if (!playerId || !Number.isInteger(score) || score <= 0) {
        throw new ValidationError({
          ...(playerId ? {} : { playerId: 'Spelare krävs' }),
          ...(!Number.isInteger(score) || score <= 0 ? { score: 'Poäng måste vara ett positivt heltal' } : {}),
        });
      }
      const player = await getPlayerById(db, playerId);
      if (!player) {
        throw new PlayerNotFoundError(playerId);
      }
      return insertScore(db, { playerId, score });
    },

    async intakeScore(score: number): Promise<{ qualifies: boolean; token?: string; thresholdScore: number | null }> {
      await applyRetention();
      if (!Number.isInteger(score) || score <= 0 || score > 100) {
        throw new ValidationError({ score: 'Poäng måste vara ett heltal mellan 1 och 100' });
      }
      await insertScore(db, { playerId: null, score });
      return { qualifies: false, thresholdScore: null };
    },

    async finalizeQualifiedScore(data: {
      token: string;
      displayName: string;
      favouriteClub: string;
      phone: string;
      gdprConsent?: boolean;
    }): Promise<{ player: PlayerResponse; score: ScoreRecord }> {
      await applyRetention();
      const pending = await consumePendingTopScore(db, data.token);
      if (!pending) {
        throw new ValidationError({ token: 'Registreringen har gått ut. Registrera score igen.' });
      }

      validateBasicPlayerInput(data);
      if (!data.gdprConsent) {
        throw new ValidationError({ gdprConsent: 'Samtycke krävs för att spara topp 5-spelare.' });
      }

      const player = await insertPlayer(db, {
        displayName: data.displayName.trim(),
        favouriteClub: data.favouriteClub.trim(),
        phone: data.phone.trim(),
        gdprConsent: true,
      });
      const score = await attachScoreToPlayer(db, pending.scoreId, player.id);
      if (!score) {
        throw new ValidationError({ token: 'Poängraden kunde inte hittas. Registrera score igen.' });
      }
      return { player: toPlayerResponse(player), score };
    },

    async getScoreboardState(): Promise<ScoreboardState> {
      await applyRetention();
      const [prizePot, leaderboard, latestResult] = await Promise.all([
        getPrizePot(db),
        getLeaderboard(db),
        getLatestResult(db),
      ]);
      return { prizePot, leaderboard, latestResult };
    },

    async updatePlayer(id: string, data: PlayerRegistration): Promise<PlayerResponse> {
      await applyRetention();
      validateBasicPlayerInput(data);
      const updated = await dbUpdatePlayer(db, id, {
        displayName: data.displayName.trim(),
        favouriteClub: data.favouriteClub.trim(),
        phone: data.phone?.trim(),
      });
      if (!updated) {
        throw new PlayerNotFoundError(id);
      }
      return toPlayerResponse(updated);
    },

    async deletePlayer(id: string): Promise<boolean> {
      await applyRetention();
      return dbDeletePlayer(db, id);
    },

    async getScoresCsv(): Promise<string> {
      const rows = await getScoresExportRows(db);
      const header = 'tid,namn,favoritforening,telefon,poang';
      const escapedRows = rows.map((row) =>
        [
          escapeCsvValue(row.createdAt),
          escapeCsvValue(row.displayName),
          escapeCsvValue(row.favouriteClub),
          escapeCsvValue(row.phone),
          escapeCsvValue(String(row.score)),
        ].join(',')
      );
      return [header, ...escapedRows].join('\n');
    },
  };
}

function escapeCsvValue(value: string): string {
  const escaped = value.replace(/"/g, '""');
  return `"${escaped}"`;
}

export type ScoreboardService = ReturnType<typeof createScoreboardService>;
