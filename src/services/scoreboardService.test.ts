import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type Database from 'better-sqlite3';
import { getDatabase, closeDatabase } from '../db/database.js';
import {
  createScoreboardService,
  ValidationError,
  PlayerNotFoundError,
} from './scoreboardService.js';
import type { ScoreboardService } from './scoreboardService.js';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

function tempDbPath(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scoreboard-svc-test-'));
  return path.join(dir, 'test.db');
}

describe('scoreboardService', () => {
  let db: Database.Database;
  let dbPath: string;
  let service: ScoreboardService;

  beforeEach(() => {
    dbPath = tempDbPath();
    db = getDatabase(dbPath);
    service = createScoreboardService(db);
  });

  afterEach(() => {
    closeDatabase();
    if (dbPath && fs.existsSync(dbPath)) {
      const dir = path.dirname(dbPath);
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  // --- registerPlayer ---

  describe('registerPlayer', () => {
    it('should register a player with valid data and return response without email', () => {
      const result = service.registerPlayer({
        displayName: 'Alice',
        favouriteClub: 'Hawks',
        email: 'alice@example.com',
        emailConsent: true,
      });

      expect(result.id).toBeDefined();
      expect(result.displayName).toBe('Alice');
      expect(result.favouriteClub).toBe('Hawks');
      expect(result.createdAt).toBeDefined();
      // GDPR: email must NOT be in the response
      expect((result as Record<string, unknown>).email).toBeUndefined();
    });

    it('should register a player without email', () => {
      const result = service.registerPlayer({
        displayName: 'Bob',
        favouriteClub: 'Eagles',
      });

      expect(result.id).toBeDefined();
      expect(result.displayName).toBe('Bob');
      expect(result.favouriteClub).toBe('Eagles');
    });

    it('should trim displayName and favouriteClub', () => {
      const result = service.registerPlayer({
        displayName: '  Charlie  ',
        favouriteClub: '  Bears  ',
      });

      // The stored player should have trimmed values
      const players = service.getPlayers();
      const player = players.find((p) => p.id === result.id);
      expect(player!.displayName).toBe('Charlie');
      expect(player!.favouriteClub).toBe('Bears');
    });

    it('should throw ValidationError when displayName is empty', () => {
      expect(() =>
        service.registerPlayer({
          displayName: '',
          favouriteClub: 'Hawks',
        })
      ).toThrow(ValidationError);

      try {
        service.registerPlayer({ displayName: '', favouriteClub: 'Hawks' });
      } catch (e) {
        expect(e).toBeInstanceOf(ValidationError);
        expect((e as ValidationError).errors.displayName).toBeDefined();
      }
    });

    it('should throw ValidationError when favouriteClub is empty', () => {
      expect(() =>
        service.registerPlayer({
          displayName: 'Alice',
          favouriteClub: '',
        })
      ).toThrow(ValidationError);
    });

    it('should throw ValidationError when email provided without consent', () => {
      expect(() =>
        service.registerPlayer({
          displayName: 'Alice',
          favouriteClub: 'Hawks',
          email: 'alice@example.com',
          emailConsent: false,
        })
      ).toThrow(ValidationError);

      try {
        service.registerPlayer({
          displayName: 'Alice',
          favouriteClub: 'Hawks',
          email: 'alice@example.com',
          emailConsent: false,
        });
      } catch (e) {
        expect((e as ValidationError).errors.emailConsent).toBeDefined();
      }
    });

    it('should throw ValidationError for invalid email format', () => {
      expect(() =>
        service.registerPlayer({
          displayName: 'Alice',
          favouriteClub: 'Hawks',
          email: 'not-an-email',
          emailConsent: true,
        })
      ).toThrow(ValidationError);
    });
  });

  // --- getPlayers ---

  describe('getPlayers', () => {
    it('should return an empty array when no players exist', () => {
      expect(service.getPlayers()).toEqual([]);
    });

    it('should return all registered players', () => {
      service.registerPlayer({ displayName: 'Alice', favouriteClub: 'Hawks' });
      service.registerPlayer({ displayName: 'Bob', favouriteClub: 'Eagles' });

      const players = service.getPlayers();
      expect(players).toHaveLength(2);
      expect(players[0].displayName).toBe('Alice');
      expect(players[1].displayName).toBe('Bob');
    });
  });

  // --- recordScore ---

  describe('recordScore', () => {
    it('should record a score for an existing player', () => {
      const player = service.registerPlayer({
        displayName: 'Alice',
        favouriteClub: 'Hawks',
      });

      const score = service.recordScore(player.id, 150);

      expect(score.id).toBeDefined();
      expect(score.playerId).toBe(player.id);
      expect(score.score).toBe(150);
      expect(score.createdAt).toBeDefined();
    });

    it('should throw PlayerNotFoundError for non-existent player', () => {
      expect(() =>
        service.recordScore('00000000-0000-4000-8000-000000000000', 100)
      ).toThrow(PlayerNotFoundError);
    });

    it('should throw ValidationError for non-positive score', () => {
      const player = service.registerPlayer({
        displayName: 'Alice',
        favouriteClub: 'Hawks',
      });

      expect(() => service.recordScore(player.id, 0)).toThrow(ValidationError);
      expect(() => service.recordScore(player.id, -5)).toThrow(ValidationError);
    });

    it('should throw ValidationError for non-integer score', () => {
      const player = service.registerPlayer({
        displayName: 'Alice',
        favouriteClub: 'Hawks',
      });

      expect(() => service.recordScore(player.id, 3.5)).toThrow(ValidationError);
    });

    it('should throw ValidationError for invalid playerId format', () => {
      expect(() => service.recordScore('not-a-uuid', 100)).toThrow(ValidationError);
    });
  });

  // --- getScoreboardState ---

  describe('getScoreboardState', () => {
    it('should return zero prizePot and empty leaderboard when no scores exist', () => {
      const state = service.getScoreboardState();

      expect(state.prizePot).toBe(0);
      expect(state.leaderboard).toEqual([]);
    });

    it('should return correct prizePot and leaderboard', () => {
      const alice = service.registerPlayer({ displayName: 'Alice', favouriteClub: 'Hawks' });
      const bob = service.registerPlayer({ displayName: 'Bob', favouriteClub: 'Eagles' });

      service.recordScore(alice.id, 50);
      service.recordScore(alice.id, 90);
      service.recordScore(bob.id, 100);

      const state = service.getScoreboardState();

      // Prize pot = sum of all scores: 50 + 90 + 100 = 240
      expect(state.prizePot).toBe(240);

      // Leaderboard: top 5 by max score per player
      expect(state.leaderboard).toHaveLength(2);
      expect(state.leaderboard[0].displayName).toBe('Bob');
      expect(state.leaderboard[0].score).toBe(100);
      expect(state.leaderboard[1].displayName).toBe('Alice');
      expect(state.leaderboard[1].score).toBe(90);
    });

    it('should limit leaderboard to top 5', () => {
      const players = [];
      for (let i = 1; i <= 7; i++) {
        const p = service.registerPlayer({
          displayName: `Player${i}`,
          favouriteClub: `Club${i}`,
        });
        players.push(p);
        service.recordScore(p.id, i * 10);
      }

      const state = service.getScoreboardState();
      expect(state.leaderboard).toHaveLength(5);
      expect(state.leaderboard[0].score).toBe(70);
      expect(state.leaderboard[4].score).toBe(30);
    });
  });

  // --- deletePlayer ---

  describe('deletePlayer', () => {
    it('should delete an existing player and return true', () => {
      const player = service.registerPlayer({
        displayName: 'Alice',
        favouriteClub: 'Hawks',
      });

      const result = service.deletePlayer(player.id);
      expect(result).toBe(true);

      // Player should no longer appear in the list
      const players = service.getPlayers();
      expect(players.find((p) => p.id === player.id)).toBeUndefined();
    });

    it('should return false for non-existent player', () => {
      const result = service.deletePlayer('00000000-0000-4000-8000-000000000000');
      expect(result).toBe(false);
    });

    it('should cascade-delete scores when player is deleted', () => {
      const alice = service.registerPlayer({ displayName: 'Alice', favouriteClub: 'Hawks' });
      const bob = service.registerPlayer({ displayName: 'Bob', favouriteClub: 'Eagles' });

      service.recordScore(alice.id, 50);
      service.recordScore(alice.id, 80);
      service.recordScore(bob.id, 100);

      // Delete Alice — her scores should be removed from prize pot and leaderboard
      service.deletePlayer(alice.id);

      const state = service.getScoreboardState();
      expect(state.prizePot).toBe(100); // Only Bob's score remains
      expect(state.leaderboard).toHaveLength(1);
      expect(state.leaderboard[0].displayName).toBe('Bob');
    });
  });
});
