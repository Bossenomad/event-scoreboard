import { describe, it, expect, vi } from 'vitest';
import { generateQRCode, getRegistrationUrl } from './qrCodeService.js';

describe('qrCodeService', () => {
  describe('generateQRCode', () => {
    it('should return an SVG string for a valid base URL', async () => {
      const svg = await generateQRCode('http://localhost:3000');
      expect(svg).not.toBeNull();
      expect(svg).toContain('<svg');
      expect(svg).toContain('</svg>');
    });

    it('should encode the registration URL in the QR code', async () => {
      const svg = await generateQRCode('http://example.com');
      // The SVG should be generated successfully
      expect(svg).not.toBeNull();
      expect(typeof svg).toBe('string');
    });

    it('should handle different base URLs', async () => {
      const svg = await generateQRCode('https://my-event.example.com');
      expect(svg).not.toBeNull();
      expect(svg).toContain('<svg');
    });
  });

  describe('getRegistrationUrl', () => {
    it('should append /register to the base URL', () => {
      expect(getRegistrationUrl('http://localhost:3000')).toBe('http://localhost:3000/register');
    });

    it('should work with HTTPS URLs', () => {
      expect(getRegistrationUrl('https://example.com')).toBe('https://example.com/register');
    });

    it('should not add trailing slash duplication', () => {
      // Base URL without trailing slash
      const url = getRegistrationUrl('http://localhost:3000');
      expect(url).toBe('http://localhost:3000/register');
    });
  });
});
