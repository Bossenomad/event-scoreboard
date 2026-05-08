import { Router } from 'express';
import type { Request, Response } from 'express';
import type { ScoreboardService } from '../services/scoreboardService.js';
import { ValidationError, PlayerNotFoundError } from '../services/scoreboardService.js';

/**
 * Creates an Express router for score and scoreboard endpoints.
 *
 * Endpoints:
 *   POST /api/scores       — Record a score for a player
 *   GET  /api/scoreboard   — Get current prize pot and leaderboard
 *
 * The returned router should be mounted at '/api' so that both paths resolve correctly.
 *
 * @param service - The scoreboard service instance
 * @param broadcastFn - Optional callback to trigger WebSocket broadcast of updated state
 */
export function createScoresRouter(
  service: ScoreboardService,
  broadcastFn?: () => void
): Router {
  const router = Router();

  /**
   * POST /scores
   * Record a score for a player.
   * Returns 201 with score data on success.
   * Returns 400 on validation failure, 404 if player not found.
   */
  router.post('/scores', async (req: Request, res: Response) => {
    try {
      const { playerId, score } = req.body;

      const scoreRecord = await service.recordScore(playerId, score);

      // Look up the player name for the response
      const players = await service.getPlayers();
      const player = players.find((p) => p.id === playerId);
      const playerName = player?.displayName ?? '';

      if (broadcastFn) {
        broadcastFn();
      }

      res.status(201).json({
        id: scoreRecord.id,
        playerId: scoreRecord.playerId,
        playerName,
        score: scoreRecord.score,
        createdAt: scoreRecord.createdAt,
      });
    } catch (err) {
      if (err instanceof ValidationError) {
        res.status(400).json({
          error: 'Validation failed',
          fields: err.errors,
        });
        return;
      }
      if (err instanceof PlayerNotFoundError) {
        res.status(404).json({
          error: 'Player not found',
        });
        return;
      }
      throw err;
    }
  });

  router.post('/scores/intake', async (req: Request, res: Response) => {
    try {
      const { score } = req.body;
      const result = await service.intakeScore(score);
      if (broadcastFn) {
        broadcastFn();
      }
      res.status(200).json(result);
    } catch (err) {
      if (err instanceof ValidationError) {
        res.status(400).json({
          error: 'Validation failed',
          fields: err.errors,
        });
        return;
      }
      throw err;
    }
  });

  router.post('/scores/finalize', async (req: Request, res: Response) => {
    try {
      const { token, displayName, favouriteClub, phone, gdprConsent } = req.body;
      const result = await service.finalizeQualifiedScore({
        token,
        displayName,
        favouriteClub,
        phone,
        gdprConsent,
      });
      if (broadcastFn) {
        broadcastFn();
      }
      res.status(201).json(result);
    } catch (err) {
      if (err instanceof ValidationError) {
        res.status(400).json({
          error: 'Validation failed',
          fields: err.errors,
        });
        return;
      }
      throw err;
    }
  });

  /**
   * GET /scoreboard
   * Get current prize pot and leaderboard.
   * Returns 200 with { prizePot, leaderboard }.
   */
  router.get('/scoreboard', async (_req: Request, res: Response) => {
    const state = await service.getScoreboardState();
    res.status(200).json(state);
  });

  return router;
}
