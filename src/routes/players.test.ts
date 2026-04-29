import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import Database from 'better-sqlite3';
import { createScoreboardService } from '../services/scoreboardService.js';
import { createPlayersRouter } from './players.js';

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
  app.use('/api/players', createPlayersRouter(service, broadcastFn));

  return { app, db, service };
}

describe('POST /api/players', () => {
  let app: express.Express;
  let db: Database.Database;

  beforeEach(() => {
    const testApp = createTestApp();
    app = testApp.app;
    db = testApp.db;
  });

  afterEach(() => {
    db.close();
  });

  it('should register a player and return 201 with player data', async () => {
    const res = await request(app)
      .post('/api/players')
      .send({
        displayName: 'Alice',
        favouriteClub: 'Manchester United',
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.displayName).toBe('Alice');
    expect(res.body.favouriteClub).toBe('Manchester United');
    expect(res.body).toHaveProperty('createdAt');
    // Email should not be in the response
    expect(res.body).not.toHaveProperty('email');
  });

  it('should register a player with email and consent', async () => {
    const res = await request(app)
      .post('/api/players')
      .send({
        displayName: 'Bob',
        favouriteClub: 'Chelsea',
        email: 'bob@example.com',
        emailConsent: true,
      });

    expect(res.status).toBe(201);
    expect(res.body.displayName).toBe('Bob');
    expect(res.body.favouriteClub).toBe('Chelsea');
    // Email should not be exposed in the response
    expect(res.body).not.toHaveProperty('email');
  });

  it('should return 400 when displayName is missing', async () => {
    const res = await request(app)
      .post('/api/players')
      .send({
        favouriteClub: 'Arsenal',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
    expect(res.body.fields).toHaveProperty('displayName');
  });

  it('should return 400 when favouriteClub is missing', async () => {
    const res = await request(app)
      .post('/api/players')
      .send({
        displayName: 'Charlie',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
    expect(res.body.fields).toHaveProperty('favouriteClub');
  });

  it('should return 400 when both required fields are missing', async () => {
    const res = await request(app)
      .post('/api/players')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
    expect(res.body.fields).toHaveProperty('displayName');
    expect(res.body.fields).toHaveProperty('favouriteClub');
  });

  it('should return 400 when email is provided without consent', async () => {
    const res = await request(app)
      .post('/api/players')
      .send({
        displayName: 'Dave',
        favouriteClub: 'Liverpool',
        email: 'dave@example.com',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
    expect(res.body.fields).toHaveProperty('emailConsent');
  });

  it('should return 400 when email format is invalid', async () => {
    const res = await request(app)
      .post('/api/players')
      .send({
        displayName: 'Eve',
        favouriteClub: 'Tottenham',
        email: 'not-an-email',
        emailConsent: true,
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
    expect(res.body.fields).toHaveProperty('email');
  });

  it('should trim displayName and favouriteClub', async () => {
    const res = await request(app)
      .post('/api/players')
      .send({
        displayName: '  Alice  ',
        favouriteClub: '  Manchester United  ',
      });

    expect(res.status).toBe(201);
    expect(res.body.displayName).toBe('Alice');
    expect(res.body.favouriteClub).toBe('Manchester United');
  });
});

describe('GET /api/players', () => {
  let app: express.Express;
  let db: Database.Database;

  beforeEach(() => {
    const testApp = createTestApp();
    app = testApp.app;
    db = testApp.db;
  });

  afterEach(() => {
    db.close();
  });

  it('should return empty players array when no players registered', async () => {
    const res = await request(app).get('/api/players');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ players: [] });
  });

  it('should return all registered players', async () => {
    // Register two players
    await request(app)
      .post('/api/players')
      .send({ displayName: 'Alice', favouriteClub: 'Manchester United' });
    await request(app)
      .post('/api/players')
      .send({ displayName: 'Bob', favouriteClub: 'Chelsea' });

    const res = await request(app).get('/api/players');

    expect(res.status).toBe(200);
    expect(res.body.players).toHaveLength(2);
    expect(res.body.players[0].displayName).toBe('Alice');
    expect(res.body.players[1].displayName).toBe('Bob');
  });

  it('should not include email in player list response', async () => {
    await request(app)
      .post('/api/players')
      .send({
        displayName: 'Alice',
        favouriteClub: 'Manchester United',
        email: 'alice@example.com',
        emailConsent: true,
      });

    const res = await request(app).get('/api/players');

    expect(res.status).toBe(200);
    expect(res.body.players).toHaveLength(1);
    expect(res.body.players[0]).not.toHaveProperty('email');
    expect(res.body.players[0]).not.toHaveProperty('emailConsent');
  });

  it('should include id, displayName, favouriteClub, and createdAt for each player', async () => {
    await request(app)
      .post('/api/players')
      .send({ displayName: 'Alice', favouriteClub: 'Manchester United' });

    const res = await request(app).get('/api/players');

    expect(res.status).toBe(200);
    const player = res.body.players[0];
    expect(player).toHaveProperty('id');
    expect(player).toHaveProperty('displayName');
    expect(player).toHaveProperty('favouriteClub');
    expect(player).toHaveProperty('createdAt');
  });
});


describe('DELETE /api/players/:id', () => {
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

  it('should delete a player and return 204', async () => {
    // Register a player first
    const createRes = await request(app)
      .post('/api/players')
      .send({ displayName: 'Alice', favouriteClub: 'Manchester United' });

    const playerId = createRes.body.id;

    const res = await request(app).delete(`/api/players/${playerId}`);

    expect(res.status).toBe(204);
    expect(res.body).toEqual({});

    // Verify player is gone
    const listRes = await request(app).get('/api/players');
    expect(listRes.body.players).toHaveLength(0);
  });

  it('should return 404 when deleting a non-existent player', async () => {
    const res = await request(app).delete('/api/players/00000000-0000-0000-0000-000000000000');

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Player not found');
  });

  it('should call broadcastFn on successful deletion', async () => {
    const broadcastFn = vi.fn();
    const testApp = createTestApp(broadcastFn);

    const createRes = await request(testApp.app)
      .post('/api/players')
      .send({ displayName: 'Bob', favouriteClub: 'Chelsea' });

    const playerId = createRes.body.id;

    await request(testApp.app).delete(`/api/players/${playerId}`);

    expect(broadcastFn).toHaveBeenCalledOnce();
    testApp.db.close();
  });

  it('should not call broadcastFn when player not found', async () => {
    const broadcastFn = vi.fn();
    const testApp = createTestApp(broadcastFn);

    await request(testApp.app).delete('/api/players/00000000-0000-0000-0000-000000000000');

    expect(broadcastFn).not.toHaveBeenCalled();
    testApp.db.close();
  });

  it('should cascade-delete associated scores when player is deleted', async () => {
    const createRes = await request(app)
      .post('/api/players')
      .send({ displayName: 'Charlie', favouriteClub: 'Arsenal' });

    const playerId = createRes.body.id;

    // Add a score for the player directly via service
    service.recordScore(playerId, 100);

    // Verify score is in the scoreboard
    const stateBeforeDelete = service.getScoreboardState();
    expect(stateBeforeDelete.prizePot).toBe(100);

    // Delete the player
    const res = await request(app).delete(`/api/players/${playerId}`);
    expect(res.status).toBe(204);

    // Verify scores are also gone
    const stateAfterDelete = service.getScoreboardState();
    expect(stateAfterDelete.prizePot).toBe(0);
    expect(stateAfterDelete.leaderboard).toHaveLength(0);
  });
});
