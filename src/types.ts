export interface Player {
  id: string;
  displayName: string;
  favouriteClub: string;
  email?: string;
  emailConsent: boolean;
  createdAt: string;
}

export interface PlayerRegistration {
  displayName: string;
  favouriteClub: string;
  email?: string;
  emailConsent?: boolean;
}

export interface ScoreRecord {
  id: string;
  playerId: string;
  score: number;
  createdAt: string;
}

export interface LeaderboardEntry {
  rank: number;
  playerId: string;
  displayName: string;
  favouriteClub: string;
  score: number;
}

export interface ScoreboardState {
  prizePot: number;
  leaderboard: LeaderboardEntry[];
}

export interface ValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}
