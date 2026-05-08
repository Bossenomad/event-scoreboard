import { v4 as uuidv4 } from 'uuid';
import type { DatabaseConnection } from './database.js';
import type { Player, ScoreRecord, LeaderboardEntry } from '../types.js';

export async function insertPlayer(
  db: DatabaseConnection,
  data: {
    displayName: string;
    favouriteClub: string;
    phone?: string;
    email?: string;
    emailConsent?: boolean;
    gdprConsent?: boolean;
  }
): Promise<Player> {
  const state = await db.readState();
  const player: Player = {
    id: uuidv4(),
    displayName: data.displayName,
    favouriteClub: data.favouriteClub,
    phone: data.phone,
    email: data.email,
    emailConsent: !!data.emailConsent,
    gdprConsent: !!data.gdprConsent,
    createdAt: new Date().toISOString(),
  };
  state.players.push(player);
  await db.writeState(state);
  return player;
}

export async function getAllPlayers(db: DatabaseConnection): Promise<Player[]> {
  const state = await db.readState();
  return [...state.players].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function getPlayerById(db: DatabaseConnection, id: string): Promise<Player | undefined> {
  const state = await db.readState();
  return state.players.find((p) => p.id === id);
}

export async function deletePlayer(db: DatabaseConnection, id: string): Promise<boolean> {
  const state = await db.readState();
  const exists = state.players.some((p) => p.id === id);
  if (!exists) return false;
  state.players = state.players.filter((p) => p.id !== id);
  state.scores = state.scores.map((s) => (s.playerId === id ? { ...s, playerId: null } : s));
  await db.writeState(state);
  return true;
}

export async function purgeOldPlayerData(db: DatabaseConnection, retentionDays: number): Promise<number> {
  if (retentionDays <= 0) return 0;
  const state = await db.readState();
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  const oldIds = state.players
    .filter((p) => new Date(p.createdAt).getTime() < cutoff)
    .map((p) => p.id);
  if (oldIds.length === 0) return 0;
  const idSet = new Set(oldIds);
  state.players = state.players.filter((p) => !idSet.has(p.id));
  state.scores = state.scores.map((s) => (s.playerId && idSet.has(s.playerId) ? { ...s, playerId: null } : s));
  await db.writeState(state);
  return oldIds.length;
}

export async function updatePlayer(
  db: DatabaseConnection,
  id: string,
  data: { displayName: string; favouriteClub: string; phone?: string }
): Promise<Player | undefined> {
  const state = await db.readState();
  const player = state.players.find((p) => p.id === id);
  if (!player) return undefined;
  player.displayName = data.displayName;
  player.favouriteClub = data.favouriteClub;
  player.phone = data.phone;
  await db.writeState(state);
  return player;
}

export async function insertScore(
  db: DatabaseConnection,
  data: { playerId: string | null; score: number }
): Promise<ScoreRecord> {
  const state = await db.readState();
  const score: ScoreRecord = {
    id: uuidv4(),
    playerId: data.playerId,
    score: data.score,
    createdAt: new Date().toISOString(),
  };
  state.scores.push(score);
  await db.writeState(state);
  return score;
}

export async function attachScoreToPlayer(
  db: DatabaseConnection,
  scoreId: string,
  playerId: string
): Promise<ScoreRecord | undefined> {
  const state = await db.readState();
  const score = state.scores.find((s) => s.id === scoreId);
  if (!score) return undefined;
  score.playerId = playerId;
  await db.writeState(state);
  return score;
}

export async function createPendingTopScore(
  db: DatabaseConnection,
  token: string,
  scoreId: string,
  score: number
): Promise<void> {
  const state = await db.readState();
  state.pendingTopScores.push({
    token,
    scoreId,
    score,
    createdAt: new Date().toISOString(),
  });
  await db.writeState(state);
}

export async function consumePendingTopScore(
  db: DatabaseConnection,
  token: string
): Promise<{ token: string; scoreId: string; score: number; createdAt: string } | undefined> {
  const state = await db.readState();
  const idx = state.pendingTopScores.findIndex((p) => p.token === token);
  if (idx === -1) return undefined;
  const [row] = state.pendingTopScores.splice(idx, 1);
  await db.writeState(state);
  return row;
}

export async function deleteExpiredPendingTopScores(db: DatabaseConnection, ttlMinutes: number): Promise<number> {
  const state = await db.readState();
  const cutoff = Date.now() - ttlMinutes * 60 * 1000;
  const before = state.pendingTopScores.length;
  state.pendingTopScores = state.pendingTopScores.filter(
    (p) => new Date(p.createdAt).getTime() >= cutoff
  );
  const deleted = before - state.pendingTopScores.length;
  if (deleted > 0) {
    await db.writeState(state);
  }
  return deleted;
}

export async function getLeaderboard(db: DatabaseConnection): Promise<LeaderboardEntry[]> {
  const state = await db.readState();
  const bestByPlayer = new Map<string, { score: number; firstReachedAt: string }>();
  for (const s of state.scores) {
    if (!s.playerId) continue;
    const cur = bestByPlayer.get(s.playerId);
    if (!cur || s.score > cur.score || (s.score === cur.score && s.createdAt < cur.firstReachedAt)) {
      bestByPlayer.set(s.playerId, { score: s.score, firstReachedAt: s.createdAt });
    }
  }
  const ranked = [...bestByPlayer.entries()]
    .map(([playerId, best]) => {
      const p = state.players.find((x) => x.id === playerId);
      if (!p) return null;
      return {
        playerId,
        displayName: p.displayName,
        favouriteClub: p.favouriteClub,
        score: best.score,
        firstReachedAt: best.firstReachedAt,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .sort((a, b) => (b.score - a.score) || a.firstReachedAt.localeCompare(b.firstReachedAt))
    .slice(0, 5);

  return ranked.map((r, i) => ({
    rank: i + 1,
    playerId: r.playerId,
    displayName: r.displayName,
    favouriteClub: r.favouriteClub,
    score: r.score,
  }));
}

export async function getPrizePot(db: DatabaseConnection): Promise<number> {
  const state = await db.readState();
  return state.scores.reduce((sum, s) => sum + s.score, 0);
}

export async function getLatestResult(
  db: DatabaseConnection
): Promise<{ playerId: string | null; displayName: string; favouriteClub?: string; score: number; createdAt: string } | null> {
  const state = await db.readState();
  if (state.scores.length === 0) return null;
  const latest = [...state.scores].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  if (!latest) return null;
  if (!latest.playerId) {
    return { playerId: null, displayName: 'Anonym', favouriteClub: '-', score: latest.score, createdAt: latest.createdAt };
  }
  const p = state.players.find((x) => x.id === latest.playerId);
  return {
    playerId: latest.playerId,
    displayName: p?.displayName ?? 'Okänd spelare',
    favouriteClub: p?.favouriteClub ?? '-',
    score: latest.score,
    createdAt: latest.createdAt,
  };
}

export async function getScoresExportRows(db: DatabaseConnection): Promise<
  Array<{ createdAt: string; displayName: string; favouriteClub: string; score: number; phone: string }>
> {
  const state = await db.readState();
  return [...state.scores]
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((s) => {
      const p = s.playerId ? state.players.find((x) => x.id === s.playerId) : undefined;
      return {
        createdAt: s.createdAt,
        displayName: p?.displayName ?? 'Anonym',
        favouriteClub: p?.favouriteClub ?? '-',
        phone: p?.phone ?? '-',
        score: s.score,
      };
    });
}
