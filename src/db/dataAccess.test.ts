import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type Database from 'better-sqlite3';
import { getDatabase, closeDatabase } from './database.js';
import {
  insertPlayer,
  getAllPlayers,
  getPlayerById,
  deletePlayer,
  insertScore,
  getScoresByPlayerId,
  getLeaderboard,
  getPrizePot,
} from './dataAccess.js';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

function tempDbPath(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scoreboard-da-test-'));
  return path.join(dir, 'test.db');
}

describe('data access layer', () => {
  let db: Database.Database;
  let dbPath: string;

  beforeEach(() => {
    dbPath = tempDbPath();
    db = getDatabase(dbPath);
  });

  afterEach(() => {
    closeDatabase();
    if (dbPath && fs.existsSync(dbPath)) {
      const dir = path.dirname(dbPath);
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  // --- Player operations ---

  describe('insertPlayer', () => {
    it('should insert a player and return the record', () => {
      const player = insertPlayer(db, {
        displayName: 'Alice',
        favouriteClub: 'Hawks',
      });

      expect(player.id).toBeDefined();
      expect(player.displayName).toBe('Alice');
      expect(player.favouriteClub).toBe('Hawks');
      expect(player.emailConsent).toBe(false);
      expect(player.email).toBeUndefined();
      expect(player.createdAt).toBeDefined();
    });

    it('should insert a player with email and consent', () => {
      const player = insertPlayer(db, {
        displayName: 'Bob',
        favouriteClub: 'Eagles',
        email: 'bob@example.com',
        emailConsent: true,
      });

      expect(player.email).toBe('bob@example.com');
      expect(player.emailConsent).toBe(true);
    });
  });

  describe('getAllPlayers', () => {
    it('should return an empty array when no players exist', () => {
      expect(getAllPlayers(db)).toEqual([]);
    });

    it('should return all inserted players', () => {
      insertPlayer(db, { displayName: 'Alice', favouriteClub: 'Hawks' });
      insertPlayer(db, { displayName: 'Bob', favouriteClub: 'Eagles' });

      const players = getAllPlayers(db);
      expect(players).toHaveLength(2);
      expect(players[0].displayName).toBe('Alice');
      expect(players[1].displayName).toBe('Bob');
    });
  });

  describe('getPlayerById', () => {
    it('should return undefined for a non-existent player', () => {
      expect(getPlayerById(db, 'non-existent-id')).toBeUndefined();
    });

    it('should return the correct player by id', () => {
      const inserted = insertPlayer(db, { displayName: 'Alice', favouriteClub: 'Hawks' });
      const found = getPlayerById(db, inserted.id);

      expect(found).toBeDefined();
      expect(found!.id).toBe(inserted.id);
      expect(found!.displayName).toBe('Alice');
    });
  });

  describe('deletePlayer', () => {
    it('should return false when deleting a non-existent player', () => {
      expect(deletePlayer(db, 'non-existent-id')).toBe(false);
    });

    it('should delete an existing player and return true', () => {
      const player = insertPlayer(db, { displayName: 'Alice', favouriteClub: 'Hawks' });
      expect(deletePlayer(db, player.id)).toBe(true);
      expect(getPlayerById(db, player.id)).toBeUndefined();
    });

    it('should cascade-delete associated scores', () => {
      const player = insertPlayer(db, { displayName: 'Alice', favouriteClub: 'Hawks' });
      insertScore(db, { playerId: player.id, score: 50 });
      insertScore(db, { playerId: player.id, score: 75 });

      deletePlayer(db, player.id);

      expect(getScoresByPlayerId(db, player.id)).toEqual([]);
      expect(getPrizePot(db)).toBe(0);
    });
  });

  // --- Score operations ---

  describe('insertScore', () => {
    it('should insert a score and return the record', () => {
      const player = insertPlayer(db, { displayName: 'Alice', favouriteClub: 'Hawks' });
      const score = insertScore(db, { playerId: player.id, score: 100 });

      expect(score.id).toBeDefined();
      expect(score.playerId).toBe(player.id);
      expect(score.score).toBe(100);
      expect(score.createdAt).toBeDefined();
    });

    it('should reject a score with value 0', () => {
      const player = insertPlayer(db, { displayName: 'Alice', favouriteClub: 'Hawks' });
      expect(() => insertScore(db, { playerId: player.id, score: 0 })).toThrow();
    });

    it('should reject a negative score', () => {
      const player = insertPlayer(db, { displayName: 'Alice', favouriteClub: 'Hawks' });
      expect(() => insertScore(db, { playerId: player.id, score: -5 })).toThrow();
    });
  });

  describe('getScoresByPlayerId', () => {
    it('should return an empty array when no scores exist', () => {
      const player = insertPlayer(db, { displayName: 'Alice', favouriteClub: 'Hawks' });
      expect(getScoresByPlayerId(db, player.id)).toEqual([]);
    });

    it('should return all scores for a player', () => {
      const player = insertPlayer(db, { displayName: 'Alice', favouriteClub: 'Hawks' });
      insertScore(db, { playerId: player.id, score: 50 });
      insertScore(db, { playerId: player.id, score: 75 });

      const scores = getScoresByPlayerId(db, player.id);
      expect(scores).toHaveLength(2);
      expect(scores[0].score).toBe(50);
      expect(scores[1].score).toBe(75);
    });
  });

  // --- Leaderboard ---

  describe('getLeaderboard', () => {
    it('should return an empty array when no scores exist', () => {
      expect(getLeaderboard(db)).toEqual([]);
    });

    it('should return players ranked by their max score descending', () => {
      const alice = insertPlayer(db, { displayName: 'Alice', favouriteClub: 'Hawks' });
      const bob = insertPlayer(db, { displayName: 'Bob', favouriteClub: 'Eagles' });

      insertScore(db, { playerId: alice.id, score: 50 });
      insertScore(db, { playerId: alice.id, score: 90 }); // Alice max = 90
      insertScore(db, { playerId: bob.id, score: 100 }); // Bob max = 100

      const leaderboard = getLeaderboard(db);
      expect(leaderboard).toHaveLength(2);
      expect(leaderboard[0].rank).toBe(1);
      expect(leaderboard[0].displayName).toBe('Bob');
      expect(leaderboard[0].score).toBe(100);
      expect(leaderboard[1].rank).toBe(2);
      expect(leaderboard[1].displayName).toBe('Alice');
      expect(leaderboard[1].score).toBe(90);
    });

    it('should limit results to top 5', () => {
      const players = [];
      for (let i = 1; i <= 7; i++) {
        const p = insertPlayer(db, { displayName: `Player${i}`, favouriteClub: `Club${i}` });
        players.push(p);
        insertScore(db, { playerId: p.id, score: i * 10 });
      }

      const leaderboard = getLeaderboard(db);
      expect(leaderboard).toHaveLength(5);
      // Top 5 should be players 7, 6, 5, 4, 3 (scores 70, 60, 50, 40, 30)
      expect(leaderboard[0].score).toBe(70);
      expect(leaderboard[4].score).toBe(30);
    });

    it('should use max score per player, not sum', () => {
      const alice = insertPlayer(db, { displayName: 'Alice', favouriteClub: 'Hawks' });
      insertScore(db, { playerId: alice.id, score: 10 });
      insertScore(db, { playerId: alice.id, score: 80 });
      insertScore(db, { playerId: alice.id, score: 30 });

      const leaderboard = getLeaderboard(db);
      expect(leaderboard).toHaveLength(1);
      expect(leaderboard[0].score).toBe(80);
    });

    it('should include playerId, displayName, and favouriteClub', () => {
      const alice = insertPlayer(db, { displayName: 'Alice', favouriteClub: 'Hawks' });
      insertScore(db, { playerId: alice.id, score: 50 });

      const leaderboard = getLeaderboard(db);
      expect(leaderboard[0]).toEqual({
        rank: 1,
        playerId: alice.id,
        displayName: 'Alice',
        favouriteClub: 'Hawks',
        score: 50,
      });
    });
  });

  // --- Prize pot ---

  describe('getPrizePot', () => {
    it('should return 0 when no scores exist', () => {
      expect(getPrizePot(db)).toBe(0);
    });

    it('should return the sum of all scores', () => {
      const alice = insertPlayer(db, { displayName: 'Alice', favouriteClub: 'Hawks' });
      const bob = insertPlayer(db, { displayName: 'Bob', favouriteClub: 'Eagles' });

      insertScore(db, { playerId: alice.id, score: 50 });
      insertScore(db, { playerId: alice.id, score: 30 });
      insertScore(db, { playerId: bob.id, score: 100 });

      expect(getPrizePot(db)).toBe(180);
    });

    it('should update after player deletion (cascade)', () => {
      const alice = insertPlayer(db, { displayName: 'Alice', favouriteClub: 'Hawks' });
      const bob = insertPlayer(db, { displayName: 'Bob', favouriteClub: 'Eagles' });

      insertScore(db, { playerId: alice.id, score: 50 });
      insertScore(db, { playerId: bob.id, score: 100 });

      deletePlayer(db, alice.id);
      expect(getPrizePot(db)).toBe(100);
    });
  });
});
