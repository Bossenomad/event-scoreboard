export interface Player {
  id: string;
  displayName: string;
  favouriteClub: string;
  phone?: string;
  email?: string;
  emailConsent: boolean;
  gdprConsent: boolean;
  createdAt: string;
}

export interface PlayerRegistration {
  displayName: string;
  favouriteClub: string;
  phone?: string;
  email?: string;
  emailConsent?: boolean;
  gdprConsent?: boolean;
}

export interface ScoreRecord {
  id: string;
  playerId: string | null;
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
  latestResult: {
    playerId: string | null;
    displayName: string;
    favouriteClub?: string;
    score: number;
    createdAt: string;
  } | null;
}

export interface ValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}
