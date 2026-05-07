import { Router } from 'express';
import type { Request, Response } from 'express';
import type { ScoreboardService } from '../services/scoreboardService.js';
import { ValidationError, PlayerNotFoundError } from '../services/scoreboardService.js';

/**
 * Creates an Express router for player-related endpoints.
 * @param service - The scoreboard service instance
 * @param broadcastFn - Optional callback to trigger WebSocket broadcast of updated state
 */
export function createPlayersRouter(
  service: ScoreboardService,
  broadcastFn?: () => void
): Router {
  const router = Router();

  /**
   * POST /api/players
   * Register a new player.
   * Returns 201 with player data (excluding email) on success.
   * Returns 400 with field errors on validation failure.
   */
  router.post('/', async (req: Request, res: Response) => {
    try {
      const { displayName, favouriteClub, email, emailConsent, gdprConsent } = req.body;

      const player = await service.registerPlayer({
        displayName,
        favouriteClub,
        email,
        emailConsent,
        gdprConsent,
      });

      res.status(201).json(player);
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
   * GET /api/players
   * List all registered players (used by Staff Interface).
   * Returns 200 with { players: [...] }.
   */
  router.get('/', async (_req: Request, res: Response) => {
    const players = await service.getPlayers();

    // Exclude email from response for GDPR compliance
    const sanitizedPlayers = players.map(({ id, displayName, favouriteClub, createdAt }) => ({
      id,
      displayName,
      favouriteClub,
      createdAt,
    }));

    res.status(200).json({ players: sanitizedPlayers });
  });

  /**
   * DELETE /api/players/:id
   * Delete a player and all associated data (GDPR data deletion).
   * Returns 204 on success, 404 if player not found.
   */
  router.delete('/:id', async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const deleted = await service.deletePlayer(id);

    if (deleted) {
      if (broadcastFn) {
        broadcastFn();
      }
      res.status(204).send();
    } else {
      res.status(404).json({ error: 'Player not found' });
    }
  });

  router.put('/:id', async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const { displayName, favouriteClub } = req.body;

      const player = await service.updatePlayer(id, {
        displayName,
        favouriteClub,
      });

      if (broadcastFn) {
        broadcastFn();
      }

      res.status(200).json(player);
    } catch (err) {
      if (err instanceof ValidationError) {
        res.status(400).json({
          error: 'Validation failed',
          fields: err.errors,
        });
        return;
      }
      if (err instanceof PlayerNotFoundError) {
        res.status(404).json({ error: 'Player not found' });
        return;
      }
      throw err;
    }
  });

  router.get('/export/csv', async (_req: Request, res: Response) => {
    const csv = await service.getScoresCsv();
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="hockey-scoreboard-export-${new Date().toISOString().slice(0, 10)}.csv"`
    );
    res.status(200).send(csv);
  });

  return router;
}
