import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import http from 'node:http';
import express from 'express';
import WebSocket from 'ws';
import { setupWebSocket } from './websocketServer.js';
import type { ScoreboardService } from './scoreboardService.js';
import type { ScoreboardState } from '../types.js';

function createMockService(state: ScoreboardState): ScoreboardService {
  return {
    registerPlayer: vi.fn() as any,
    getPlayers: vi.fn() as any,
    recordScore: vi.fn() as any,
    deletePlayer: vi.fn() as any,
    getScoreboardState: vi.fn().mockReturnValue(state),
  } as unknown as ScoreboardService;
}

function waitForMessage(ws: WebSocket): Promise<string> {
  return new Promise((resolve, reject) => {
    ws.on('message', (data) => resolve(data.toString()));
    ws.on('error', reject);
    setTimeout(() => reject(new Error('Timed out waiting for message')), 3000);
  });
}

function waitForOpen(ws: WebSocket): Promise<void> {
  return new Promise((resolve, reject) => {
    if (ws.readyState === WebSocket.OPEN) {
      resolve();
      return;
    }
    ws.on('open', () => resolve());
    ws.on('error', reject);
    setTimeout(() => reject(new Error('Timed out waiting for open')), 3000);
  });
}

describe('WebSocket Server', () => {
  let server: http.Server;
  let port: number;
  let clients: WebSocket[];

  beforeEach(async () => {
    const app = express();
    server = http.createServer(app);
    clients = [];

    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        const addr = server.address();
        port = typeof addr === 'object' && addr ? addr.port : 0;
        resolve();
      });
    });
  });

  afterEach(async () => {
    // Close all clients
    for (const client of clients) {
      if (client.readyState === WebSocket.OPEN || client.readyState === WebSocket.CONNECTING) {
        client.close();
      }
    }
    // Close server
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  function connectClient(): WebSocket {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    clients.push(ws);
    return ws;
  }

  it('sends current scoreboard state on new connection', async () => {
    const state: ScoreboardState = {
      prizePot: 500,
      leaderboard: [
        { rank: 1, playerId: 'p1', displayName: 'Alice', favouriteClub: 'Hawks', score: 300 },
        { rank: 2, playerId: 'p2', displayName: 'Bob', favouriteClub: 'Eagles', score: 200 },
      ],
    };
    const service = createMockService(state);
    setupWebSocket(server, service);

    const ws = connectClient();
    const msg = await waitForMessage(ws);
    const parsed = JSON.parse(msg);

    expect(parsed).toEqual({ type: 'state', data: state });
    expect(service.getScoreboardState).toHaveBeenCalled();
  });

  it('broadcast sends updated state to all connected clients', async () => {
    const state: ScoreboardState = {
      prizePot: 100,
      leaderboard: [],
    };
    const service = createMockService(state);
    const broadcast = setupWebSocket(server, service);

    // Connect two clients and wait for initial messages
    const ws1 = connectClient();
    await waitForMessage(ws1);

    const ws2 = connectClient();
    await waitForMessage(ws2);

    // Update the state the service returns
    const updatedState: ScoreboardState = {
      prizePot: 250,
      leaderboard: [
        { rank: 1, playerId: 'p1', displayName: 'Charlie', favouriteClub: 'Lions', score: 250 },
      ],
    };
    (service.getScoreboardState as ReturnType<typeof vi.fn>).mockReturnValue(updatedState);

    // Set up message listeners before broadcasting
    const msg1Promise = waitForMessage(ws1);
    const msg2Promise = waitForMessage(ws2);

    broadcast();

    const [msg1, msg2] = await Promise.all([msg1Promise, msg2Promise]);

    expect(JSON.parse(msg1)).toEqual({ type: 'state', data: updatedState });
    expect(JSON.parse(msg2)).toEqual({ type: 'state', data: updatedState });
  });

  it('broadcast does not fail when no clients are connected', () => {
    const state: ScoreboardState = { prizePot: 0, leaderboard: [] };
    const service = createMockService(state);
    const broadcast = setupWebSocket(server, service);

    // Should not throw
    expect(() => broadcast()).not.toThrow();
  });

  it('handles service error during initial state gracefully', async () => {
    const service = createMockService({ prizePot: 0, leaderboard: [] });
    (service.getScoreboardState as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error('DB error');
    });

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    setupWebSocket(server, service);

    const ws = connectClient();
    await waitForOpen(ws);

    // Give time for the error handler to run
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(consoleSpy).toHaveBeenCalledWith(
      'WebSocket: error sending initial state',
      expect.any(Error)
    );
    consoleSpy.mockRestore();
  });

  it('handles service error during broadcast gracefully', () => {
    const service = createMockService({ prizePot: 0, leaderboard: [] });
    const broadcast = setupWebSocket(server, service);

    (service.getScoreboardState as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error('DB error');
    });

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Should not throw
    expect(() => broadcast()).not.toThrow();
    expect(consoleSpy).toHaveBeenCalledWith(
      'WebSocket: error during broadcast',
      expect.any(Error)
    );
    consoleSpy.mockRestore();
  });
});
