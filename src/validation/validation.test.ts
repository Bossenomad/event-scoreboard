import { describe, it, expect } from 'vitest';
import { validatePlayerRegistration, validateScoreEntry } from './validation.js';

describe('validatePlayerRegistration', () => {
  describe('displayName validation', () => {
    it('should reject empty displayName', () => {
      const result = validatePlayerRegistration({
        displayName: '',
        favouriteClub: 'Hawks',
      });
      expect(result.valid).toBe(false);
      expect(result.errors.displayName).toBeDefined();
    });

    it('should reject whitespace-only displayName', () => {
      const result = validatePlayerRegistration({
        displayName: '   ',
        favouriteClub: 'Hawks',
      });
      expect(result.valid).toBe(false);
      expect(result.errors.displayName).toBeDefined();
    });

    it('should reject displayName exceeding 50 characters', () => {
      const result = validatePlayerRegistration({
        displayName: 'A'.repeat(51),
        favouriteClub: 'Hawks',
      });
      expect(result.valid).toBe(false);
      expect(result.errors.displayName).toBeDefined();
    });

    it('should accept displayName at exactly 50 characters', () => {
      const result = validatePlayerRegistration({
        displayName: 'A'.repeat(50),
        favouriteClub: 'Hawks',
      });
      expect(result.valid).toBe(true);
      expect(result.errors.displayName).toBeUndefined();
    });

    it('should reject missing displayName field', () => {
      const result = validatePlayerRegistration({
        favouriteClub: 'Hawks',
      });
      expect(result.valid).toBe(false);
      expect(result.errors.displayName).toBeDefined();
    });
  });

  describe('favouriteClub validation', () => {
    it('should reject empty favouriteClub', () => {
      const result = validatePlayerRegistration({
        displayName: 'Alice',
        favouriteClub: '',
      });
      expect(result.valid).toBe(false);
      expect(result.errors.favouriteClub).toBeDefined();
    });

    it('should reject whitespace-only favouriteClub', () => {
      const result = validatePlayerRegistration({
        displayName: 'Alice',
        favouriteClub: '   ',
      });
      expect(result.valid).toBe(false);
      expect(result.errors.favouriteClub).toBeDefined();
    });

    it('should reject favouriteClub exceeding 100 characters', () => {
      const result = validatePlayerRegistration({
        displayName: 'Alice',
        favouriteClub: 'C'.repeat(101),
      });
      expect(result.valid).toBe(false);
      expect(result.errors.favouriteClub).toBeDefined();
    });

    it('should accept favouriteClub at exactly 100 characters', () => {
      const result = validatePlayerRegistration({
        displayName: 'Alice',
        favouriteClub: 'C'.repeat(100),
      });
      expect(result.valid).toBe(true);
      expect(result.errors.favouriteClub).toBeUndefined();
    });

    it('should reject missing favouriteClub field', () => {
      const result = validatePlayerRegistration({
        displayName: 'Alice',
      });
      expect(result.valid).toBe(false);
      expect(result.errors.favouriteClub).toBeDefined();
    });
  });

  describe('valid registration without email', () => {
    it('should accept valid registration without email', () => {
      const result = validatePlayerRegistration({
        displayName: 'Alice',
        favouriteClub: 'Hawks',
      });
      expect(result.valid).toBe(true);
      expect(Object.keys(result.errors)).toHaveLength(0);
    });

    it('should accept valid registration with empty email string', () => {
      const result = validatePlayerRegistration({
        displayName: 'Alice',
        favouriteClub: 'Hawks',
        email: '',
      });
      expect(result.valid).toBe(true);
      expect(Object.keys(result.errors)).toHaveLength(0);
    });
  });

  describe('valid registration with email and consent', () => {
    it('should accept valid registration with email and consent', () => {
      const result = validatePlayerRegistration({
        displayName: 'Alice',
        favouriteClub: 'Hawks',
        email: 'alice@example.com',
        emailConsent: true,
      });
      expect(result.valid).toBe(true);
      expect(Object.keys(result.errors)).toHaveLength(0);
    });
  });

  describe('email without consent', () => {
    it('should reject email without consent (consent false)', () => {
      const result = validatePlayerRegistration({
        displayName: 'Alice',
        favouriteClub: 'Hawks',
        email: 'alice@example.com',
        emailConsent: false,
      });
      expect(result.valid).toBe(false);
      expect(result.errors.emailConsent).toBeDefined();
    });

    it('should reject email without consent (consent undefined)', () => {
      const result = validatePlayerRegistration({
        displayName: 'Alice',
        favouriteClub: 'Hawks',
        email: 'alice@example.com',
      });
      expect(result.valid).toBe(false);
      expect(result.errors.emailConsent).toBeDefined();
    });
  });

  describe('email format validation', () => {
    it('should reject invalid email format (no @)', () => {
      const result = validatePlayerRegistration({
        displayName: 'Alice',
        favouriteClub: 'Hawks',
        email: 'notanemail',
        emailConsent: true,
      });
      expect(result.valid).toBe(false);
      expect(result.errors.email).toBeDefined();
    });

    it('should reject invalid email format (no domain)', () => {
      const result = validatePlayerRegistration({
        displayName: 'Alice',
        favouriteClub: 'Hawks',
        email: 'alice@',
        emailConsent: true,
      });
      expect(result.valid).toBe(false);
      expect(result.errors.email).toBeDefined();
    });

    it('should reject invalid email format (no TLD)', () => {
      const result = validatePlayerRegistration({
        displayName: 'Alice',
        favouriteClub: 'Hawks',
        email: 'alice@example',
        emailConsent: true,
      });
      expect(result.valid).toBe(false);
      expect(result.errors.email).toBeDefined();
    });

    it('should accept valid email format', () => {
      const result = validatePlayerRegistration({
        displayName: 'Alice',
        favouriteClub: 'Hawks',
        email: 'alice@example.com',
        emailConsent: true,
      });
      expect(result.valid).toBe(true);
      expect(result.errors.email).toBeUndefined();
    });

    it('should accept valid email with subdomain', () => {
      const result = validatePlayerRegistration({
        displayName: 'Alice',
        favouriteClub: 'Hawks',
        email: 'alice@mail.example.com',
        emailConsent: true,
      });
      expect(result.valid).toBe(true);
      expect(result.errors.email).toBeUndefined();
    });
  });

  describe('multiple validation errors', () => {
    it('should return multiple errors when multiple fields are invalid', () => {
      const result = validatePlayerRegistration({
        displayName: '',
        favouriteClub: '',
        email: 'invalid-email',
        emailConsent: false,
      });
      expect(result.valid).toBe(false);
      expect(result.errors.displayName).toBeDefined();
      expect(result.errors.favouriteClub).toBeDefined();
      expect(result.errors.email).toBeDefined();
      expect(result.errors.emailConsent).toBeDefined();
    });

    it('should return errors for all missing fields when data is null', () => {
      const result = validatePlayerRegistration(null);
      expect(result.valid).toBe(false);
      expect(result.errors.displayName).toBeDefined();
      expect(result.errors.favouriteClub).toBeDefined();
    });

    it('should return errors for all missing fields when data is undefined', () => {
      const result = validatePlayerRegistration(undefined);
      expect(result.valid).toBe(false);
      expect(result.errors.displayName).toBeDefined();
      expect(result.errors.favouriteClub).toBeDefined();
    });
  });
});

describe('validateScoreEntry', () => {
  const validUUID = '550e8400-e29b-41d4-a716-446655440000';

  describe('playerId validation', () => {
    it('should reject missing playerId', () => {
      const result = validateScoreEntry({ score: 10 });
      expect(result.valid).toBe(false);
      expect(result.errors.playerId).toBeDefined();
    });

    it('should reject invalid UUID format', () => {
      const result = validateScoreEntry({ playerId: 'not-a-uuid', score: 10 });
      expect(result.valid).toBe(false);
      expect(result.errors.playerId).toBeDefined();
    });

    it('should accept valid UUID format', () => {
      const result = validateScoreEntry({ playerId: validUUID, score: 10 });
      expect(result.valid).toBe(true);
      expect(result.errors.playerId).toBeUndefined();
    });
  });

  describe('score validation', () => {
    it('should reject missing score', () => {
      const result = validateScoreEntry({ playerId: validUUID });
      expect(result.valid).toBe(false);
      expect(result.errors.score).toBeDefined();
    });

    it('should reject score of 0', () => {
      const result = validateScoreEntry({ playerId: validUUID, score: 0 });
      expect(result.valid).toBe(false);
      expect(result.errors.score).toBeDefined();
    });

    it('should reject negative score', () => {
      const result = validateScoreEntry({ playerId: validUUID, score: -5 });
      expect(result.valid).toBe(false);
      expect(result.errors.score).toBeDefined();
    });

    it('should reject non-integer score', () => {
      const result = validateScoreEntry({ playerId: validUUID, score: 3.5 });
      expect(result.valid).toBe(false);
      expect(result.errors.score).toBeDefined();
    });

    it('should accept valid positive integer score', () => {
      const result = validateScoreEntry({ playerId: validUUID, score: 42 });
      expect(result.valid).toBe(true);
      expect(result.errors.score).toBeUndefined();
    });
  });

  describe('multiple errors', () => {
    it('should return errors for both fields when both are invalid', () => {
      const result = validateScoreEntry({ playerId: 'bad', score: -1 });
      expect(result.valid).toBe(false);
      expect(result.errors.playerId).toBeDefined();
      expect(result.errors.score).toBeDefined();
    });
  });

  describe('null/undefined input', () => {
    it('should return errors for both fields when input is null', () => {
      const result = validateScoreEntry(null);
      expect(result.valid).toBe(false);
      expect(result.errors.playerId).toBeDefined();
      expect(result.errors.score).toBeDefined();
    });

    it('should return errors for both fields when input is undefined', () => {
      const result = validateScoreEntry(undefined);
      expect(result.valid).toBe(false);
      expect(result.errors.playerId).toBeDefined();
      expect(result.errors.score).toBeDefined();
    });
  });
});
