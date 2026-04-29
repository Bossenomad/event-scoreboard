import type Database from 'better-sqlite3';
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
  insertScore,
  getLeaderboard,
  getPrizePot,
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

/** Response type for registerPlayer — excludes email for GDPR compliance */
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

export function createScoreboardService(db: Database.Database) {
  return {
    registerPlayer(data: PlayerRegistration): PlayerResponse {
      const validation: ValidationResult = validatePlayerRegistration(data);
      if (!validation.valid) {
        throw new ValidationError(validation.errors);
      }

      const player = insertPlayer(db, {
        displayName: data.displayName.trim(),
        favouriteClub: data.favouriteClub.trim(),
        email: data.email?.trim() || undefined,
        emailConsent: data.emailConsent,
      });

      return toPlayerResponse(player);
    },

    getPlayers(): Player[] {
      return getAllPlayers(db);
    },

    recordScore(playerId: string, score: number): ScoreRecord {
      const validation: ValidationResult = validateScoreEntry({ playerId, score });
      if (!validation.valid) {
        throw new ValidationError(validation.errors);
      }

      const player = getPlayerById(db, playerId);
      if (!player) {
        throw new PlayerNotFoundError(playerId);
      }

      return insertScore(db, { playerId, score });
    },

    getScoreboardState(): ScoreboardState {
      return {
        prizePot: getPrizePot(db),
        leaderboard: getLeaderboard(db),
      };
    },

    deletePlayer(id: string): boolean {
      return dbDeletePlayer(db, id);
    },
  };
}

export type ScoreboardService = ReturnType<typeof createScoreboardService>;
