import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'node:http';
import type { ScoreboardService } from './scoreboardService.js';

/**
 * Sets up a WebSocket server attached to the given HTTP server.
 *
 * - Attaches on path `/ws`
 * - Sends current scoreboard state to each new client on connection
 * - Returns a broadcast function that sends updated state to all connected clients
 *
 * @param server - The HTTP server to attach to
 * @param service - The scoreboard service for fetching current state
 * @returns A broadcast function that pushes current state to all connected clients
 */
export function setupWebSocket(
  server: Server,
  service: ScoreboardService
): () => void {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws: WebSocket) => {
    try {
      const state = service.getScoreboardState();
      const message = JSON.stringify({ type: 'state', data: state });
      ws.send(message);
    } catch (err) {
      console.error('WebSocket: error sending initial state', err);
    }

    ws.on('error', (err) => {
      console.error('WebSocket: client connection error', err);
    });
  });

  wss.on('error', (err) => {
    console.error('WebSocket: server error', err);
  });

  /** Broadcast current scoreboard state to all connected clients. */
  function broadcast(): void {
    try {
      const state = service.getScoreboardState();
      const message = JSON.stringify({ type: 'state', data: state });

      for (const client of wss.clients) {
        if (client.readyState === WebSocket.OPEN) {
          try {
            client.send(message);
          } catch (err) {
            console.error('WebSocket: error sending to client', err);
          }
        }
      }
    } catch (err) {
      console.error('WebSocket: error during broadcast', err);
    }
  }

  return broadcast;
}
