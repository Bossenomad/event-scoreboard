import { Router } from 'express';
import type { Request, Response } from 'express';

/**
 * Creates an Express router for the QR code endpoint.
 *
 * @param qrCodeSvg - The pre-generated QR code SVG string, or null if generation failed
 * @param registrationUrl - The registration URL (used as plain text fallback)
 */
export function createQRCodeRouter(
  qrCodeSvg: string | null,
  registrationUrl: string
): Router {
  const router = Router();

  /**
   * GET /api/qrcode
   * Returns the QR code as an SVG image.
   * Falls back to plain text registration URL if QR generation failed.
   */
  router.get('/', (_req: Request, res: Response) => {
    if (qrCodeSvg) {
      res.setHeader('Content-Type', 'image/svg+xml');
      res.status(200).send(qrCodeSvg);
    } else {
      res.setHeader('Content-Type', 'text/plain');
      res.status(200).send(registrationUrl);
    }
  });

  return router;
}
