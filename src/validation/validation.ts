import type { ValidationResult } from '../types.js';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validatePlayerRegistration(data: unknown): ValidationResult {
  const errors: Record<string, string> = {};

  if (data === null || data === undefined || typeof data !== 'object') {
    return {
      valid: false,
      errors: {
        displayName: 'Namn krävs',
        favouriteClub: 'Favoritlag krävs',
        gdprConsent: 'Du måste godkänna GDPR-hantering',
      },
    };
  }

  const { displayName, favouriteClub, email, emailConsent, gdprConsent } = data as Record<
    string,
    unknown
  >;

  // Validate displayName: required, 1–50 chars, trimmed
  if (displayName === undefined || displayName === null || typeof displayName !== 'string') {
    errors.displayName = 'Namn krävs';
  } else {
    const trimmed = displayName.trim();
    if (trimmed.length === 0) {
      errors.displayName = 'Namn krävs';
    } else if (trimmed.split(/\s+/).length < 2) {
      errors.displayName = 'Ange förnamn och efternamn';
    } else if (trimmed.length > 50) {
      errors.displayName = 'Namn får vara max 50 tecken';
    }
  }

  // Validate favouriteClub: required, 1–100 chars, trimmed
  if (favouriteClub === undefined || favouriteClub === null || typeof favouriteClub !== 'string') {
    errors.favouriteClub = 'Favoritlag krävs';
  } else {
    const trimmed = favouriteClub.trim();
    if (trimmed.length === 0) {
      errors.favouriteClub = 'Favoritlag krävs';
    } else if (trimmed.length > 100) {
      errors.favouriteClub = 'Favoritlag får vara max 100 tecken';
    }
  }

  // Validate email: optional; if provided, must match email regex
  const hasEmail =
    email !== undefined && email !== null && typeof email === 'string' && email.trim().length > 0;

  if (hasEmail) {
    const trimmedEmail = (email as string).trim();
    if (!EMAIL_REGEX.test(trimmedEmail)) {
      errors.email = 'Ogiltig e-postadress';
    }
  }

  // Validate emailConsent: required and must be true if email is provided
  if (hasEmail) {
    if (emailConsent !== true) {
      errors.emailConsent = 'Samtycke krävs när e-post anges';
    }
  }

  if (gdprConsent !== true) {
    errors.gdprConsent = 'Du måste godkänna GDPR-hantering';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

export function validateScoreEntry(data: unknown): ValidationResult {
  const errors: Record<string, string> = {};

  if (data === null || data === undefined || typeof data !== 'object') {
    return {
      valid: false,
      errors: {
        playerId: 'Player ID is required',
        score: 'Score is required',
      },
    };
  }

  const { playerId, score } = data as Record<string, unknown>;

  // Validate playerId: required, valid UUID v4 format
  if (playerId === undefined || playerId === null || typeof playerId !== 'string') {
    errors.playerId = 'Player ID is required';
  } else {
    const trimmed = playerId.trim();
    if (trimmed.length === 0) {
      errors.playerId = 'Player ID is required';
    } else if (!UUID_V4_REGEX.test(trimmed)) {
      errors.playerId = 'Player ID must be a valid UUID';
    }
  }

  // Validate score: required, positive integer (> 0)
  if (score === undefined || score === null) {
    errors.score = 'Score is required';
  } else if (typeof score !== 'number' || isNaN(score)) {
    errors.score = 'Score must be a positive integer';
  } else if (!Number.isInteger(score)) {
    errors.score = 'Score must be a positive integer';
  } else if (score <= 0) {
    errors.score = 'Score must be a positive integer';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}
