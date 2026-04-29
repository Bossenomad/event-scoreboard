import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createQRCodeRouter } from './qrcode.js';

describe('GET /api/qrcode', () => {
  it('should return SVG when QR code is available', async () => {
    const app = express();
    const fakeSvg = '<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>';
    app.use('/api/qrcode', createQRCodeRouter(fakeSvg, 'http://localhost:3000/register'));

    const res = await request(app)
      .get('/api/qrcode')
      .buffer(true)
      .parse((res, cb) => {
        let data = '';
        res.setEncoding('utf8');
        res.on('data', (chunk: string) => { data += chunk; });
        res.on('end', () => cb(null, data));
      });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('image/svg+xml');
    expect(res.body).toBe(fakeSvg);
  });

  it('should return plain text registration URL when QR code is null', async () => {
    const app = express();
    const registrationUrl = 'http://localhost:3000/register';
    app.use('/api/qrcode', createQRCodeRouter(null, registrationUrl));

    const res = await request(app).get('/api/qrcode');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/plain');
    expect(res.text).toBe(registrationUrl);
  });
});
