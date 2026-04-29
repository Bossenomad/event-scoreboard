import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import Database from 'better-sqlite3';
import { createScoreboardService } from '../services/scoreboardService.js';
import { createScoresRouter } from './scores.js';

function createTestApp(broadcastFn?: () => void) {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  db.exec(`
    CREATE TABLE IF NOT EXISTS players (
      id TEXT PRIMARY KEY,
      display_name TEXT NOT NULL,
      favourite_club TEXT NOT NULL,
      email TEXT,
      email_consent INTEGER DEFAULT 0,
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

  const service = createScoreboardService(db);
  const app = express();
  app.use(express.json());
  app.use('/api', createScoresRouter(service, broadcastFn));

  return { app, db, service };
}

/** Helper to register a player directly via the service */
function registerPlayer(service: ReturnType<typeof createScoreboardService>, name = 'Alice', club = 'Manchester United') {
  return service.registerPlayer({ displayName: name, favouriteClub: club });
}

describe('POST /api/scores', () => {
  let app: express.Express;
  let db: Database.Database;
  let service: ReturnType<typeof createScoreboardService>;

  beforeEach(() => {
    const testApp = createTestApp();
    app = testApp.app;
    db = testApp.db;
    service = testApp.service;
  });

  afterEach(() => {
    db.close();
  });

  it('should record a score and return 201 with score data', async () => {
    const player = registerPlayer(service);

    const res = await request(app)
      .post('/api/scores')
      .send({ playerId: player.id, score: 42 });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.playerId).toBe(player.id);
    expect(res.body.playerName).toBe('Alice');
    expect(res.body.score).toBe(42);
    expect(res.body).toHaveProperty('createdAt');
  });

  it('should call broadcastFn on successful score entry', async () => {
    const broadcastFn = vi.fn();
    const testApp = createTestApp(broadcastFn);
    const player = registerPlayer(testApp.service);

    await request(testApp.app)
      .post('/api/scores')
      .send({ playerId: player.id, score: 10 });

    expect(broadcastFn).toHaveBeenCalledOnce();
    testApp.db.close();
  });

  it('should not call broadcastFn when no broadcastFn is provided', async () => {
    // Default test app has no broadcastFn — just verify no error
    const player = registerPlayer(service);

    const res = await request(app)
      .post('/api/scores')
      .send({ playerId: player.id, score: 10 });

    expect(res.status).toBe(201);
  });

  it('should return 400 when playerId is missing', async () => {
    const res = await request(app)
      .post('/api/scores')
      .send({ score: 42 });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
    expect(res.body.fields).toHaveProperty('playerId');
  });

  it('should return 400 when score is missing', async () => {
    const player = registerPlayer(service);

    const res = await request(app)
      .post('/api/scores')
      .send({ playerId: player.id });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
    expect(res.body.fields).toHaveProperty('score');
  });

  it('should return 400 when score is zero', async () => {
    const player = registerPlayer(service);

    const res = await request(app)
      .post('/api/scores')
      .send({ playerId: player.id, score: 0 });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
    expect(res.body.fields).toHaveProperty('score');
  });

  it('should return 400 when score is negative', async () => {
    const player = registerPlayer(service);

    const res = await request(app)
      .post('/api/scores')
      .send({ playerId: player.id, score: -5 });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
    expect(res.body.fields).toHaveProperty('score');
  });

  it('should return 400 when playerId is not a valid UUID', async () => {
    const res = await request(app)
      .post('/api/scores')
      .send({ playerId: 'not-a-uuid', score: 10 });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
    expect(res.body.fields).toHaveProperty('playerId');
  });

  it('should return 404 when player does not exist', async () => {
    // Use a valid UUID v4 format that doesn't correspond to any player
    const res = await request(app)
      .post('/api/scores')
      .send({ playerId: 'a0000000-0000-4000-a000-000000000000', score: 10 });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Player not found');
  });

  it('should not call broadcastFn on validation failure', async () => {
    const broadcastFn = vi.fn();
    const testApp = createTestApp(broadcastFn);

    await request(testApp.app)
      .post('/api/scores')
      .send({ score: -1 });

    expect(broadcastFn).not.toHaveBeenCalled();
    testApp.db.close();
  });

  it('should not call broadcastFn when player not found', async () => {
    const broadcastFn = vi.fn();
    const testApp = createTestApp(broadcastFn);

    await request(testApp.app)
      .post('/api/scores')
      .send({ playerId: 'a0000000-0000-4000-a000-000000000000', score: 10 });

    expect(broadcastFn).not.toHaveBeenCalled();
    testApp.db.close();
  });
});

describe('GET /api/scoreboard', () => {
  let app: express.Express;
  let db: Database.Database;
  let service: ReturnType<typeof createScoreboardService>;

  beforeEach(() => {
    const testApp = createTestApp();
    app = testApp.app;
    db = testApp.db;
    service = testApp.service;
  });

  afterEach(() => {
    db.close();
  });

  it('should return empty scoreboard when no scores exist', async () => {
    const res = await request(app).get('/api/scoreboard');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      prizePot: 0,
      leaderboard: [],
    });
  });

  it('should return correct prizePot and leaderboard after scores', async () => {
    const alice = registerPlayer(service, 'Alice', 'Manchester United');
    const bob = registerPlayer(service, 'Bob', 'Chelsea');

    service.recordScore(alice.id, 50);
    service.recordScore(bob.id, 30);
    service.recordScore(alice.id, 20);

    const res = await request(app).get('/api/scoreboard');

    expect(res.status).toBe(200);
    // Prize pot = 50 + 30 + 20 = 100
    expect(res.body.prizePot).toBe(100);
    // Leaderboard: Alice (max 50), Bob (max 30)
    expect(res.body.leaderboard).toHaveLength(2);
    expect(res.body.leaderboard[0].displayName).toBe('Alice');
    expect(res.body.leaderboard[0].score).toBe(50);
    expect(res.body.leaderboard[0].rank).toBe(1);
    expect(res.body.leaderboard[1].displayName).toBe('Bob');
    expect(res.body.leaderboard[1].score).toBe(30);
    expect(res.body.leaderboard[1].rank).toBe(2);
  });

  it('should include playerId, displayName, favouriteClub, and score in leaderboard entries', async () => {
    const player = registerPlayer(service, 'Alice', 'Arsenal');
    service.recordScore(player.id, 75);

    const res = await request(app).get('/api/scoreboard');

    expect(res.status).toBe(200);
    const entry = res.body.leaderboard[0];
    expect(entry).toHaveProperty('rank');
    expect(entry).toHaveProperty('playerId');
    expect(entry).toHaveProperty('displayName');
    expect(entry).toHaveProperty('favouriteClub');
    expect(entry).toHaveProperty('score');
    expect(entry.favouriteClub).toBe('Arsenal');
  });

  it('should limit leaderboard to top 5 players', async () => {
    // Register 6 players with scores
    for (let i = 1; i <= 6; i++) {
      const player = registerPlayer(service, `Player${i}`, `Club${i}`);
      service.recordScore(player.id, i * 10);
    }

    const res = await request(app).get('/api/scoreboard');

    expect(res.status).toBe(200);
    expect(res.body.leaderboard).toHaveLength(5);
    // Top scorer should be first
    expect(res.body.leaderboard[0].score).toBe(60);
    expect(res.body.leaderboard[4].score).toBe(20);
  });
});
