import type { Pool } from 'pg';
import type {
  Player,
  PlayerRegistration,
  ScoreRecord,
  ScoreboardState,
  ValidationResult,
} from '../types.js';
import { validatePlayerRegistration, validateScoreEntry } from '../validation/validation.js';
import {
  insertPlayer,
  getAllPlayers,
  getPlayerById,
  deletePlayer as dbDeletePlayer,
  updatePlayer as dbUpdatePlayer,
  insertScore,
  getLeaderboard,
  getPrizePot,
  getLatestResult,
  getScoresExportRows,
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
  emailConsent: boolean;
  createdAt: string;
}

function toPlayerResponse(player: Player): PlayerResponse {
  return {
    id: player.id,
    displayName: player.displayName,
    favouriteClub: player.favouriteClub,
    emailConsent: player.emailConsent,
    createdAt: player.createdAt,
  };
}

export function createScoreboardService(db: Pool) {
  return {
    async registerPlayer(data: PlayerRegistration): Promise<PlayerResponse> {
      const validation: ValidationResult = validatePlayerRegistration(data);
      if (!validation.valid) {
        throw new ValidationError(validation.errors);
      }

      const player = await insertPlayer(db, {
        displayName: data.displayName.trim(),
        favouriteClub: data.favouriteClub.trim(),
        email: data.email?.trim() || undefined,
        emailConsent: data.emailConsent,
        gdprConsent: data.gdprConsent,
      });

      return toPlayerResponse(player);
    },

    async getPlayers(): Promise<Player[]> {
      return getAllPlayers(db);
    },

    async recordScore(playerId: string, score: number): Promise<ScoreRecord> {
      const validation: ValidationResult = validateScoreEntry({ playerId, score });
      if (!validation.valid) {
        throw new ValidationError(validation.errors);
      }

      const player = await getPlayerById(db, playerId);
      if (!player) {
        throw new PlayerNotFoundError(playerId);
      }

      return insertScore(db, { playerId, score });
    },

    async getScoreboardState(): Promise<ScoreboardState> {
      const [prizePot, leaderboard, latestResult] = await Promise.all([
        getPrizePot(db),
        getLeaderboard(db),
        getLatestResult(db),
      ]);
      return { prizePot, leaderboard, latestResult };
    },

    async updatePlayer(id: string, data: PlayerRegistration): Promise<PlayerResponse> {
      const validation: ValidationResult = validatePlayerRegistration({
        ...data,
        gdprConsent: true,
      });
      if (!validation.valid) {
        throw new ValidationError(validation.errors);
      }

      const updated = await dbUpdatePlayer(db, id, {
        displayName: data.displayName.trim(),
        favouriteClub: data.favouriteClub.trim(),
      });

      if (!updated) {
        throw new PlayerNotFoundError(id);
      }

      return toPlayerResponse(updated);
    },

    async deletePlayer(id: string): Promise<boolean> {
      return dbDeletePlayer(db, id);
    },

    async getScoresCsv(): Promise<string> {
      const rows = await getScoresExportRows(db);
      const header = 'tid,namn,favoritlag,poang';
      const escapedRows = rows.map((row) =>
        [
          escapeCsvValue(row.createdAt),
          escapeCsvValue(row.displayName),
          escapeCsvValue(row.favouriteClub),
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
