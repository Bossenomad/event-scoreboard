import QRCode from 'qrcode';

/**
 * Generates a QR code SVG string encoding the registration form URL.
 *
 * @param baseUrl - The base URL of the application (e.g. "http://localhost:3000")
 * @returns The QR code as an SVG string, or null if generation fails
 */
export async function generateQRCode(baseUrl: string): Promise<string | null> {
  const registrationUrl = `${baseUrl}/register`;
  try {
    const svg = await QRCode.toString(registrationUrl, { type: 'svg' });
    return svg;
  } catch (err) {
    console.error('Failed to generate QR code:', err);
    return null;
  }
}

/**
 * Returns the registration URL for the given base URL.
 * Used as a fallback when QR code generation fails.
 */
export function getRegistrationUrl(baseUrl: string): string {
  return `${baseUrl}/register`;
}
