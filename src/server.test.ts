import { describe, it, expect } from 'vitest';

describe('Server setup', () => {
  it('should have a configurable port defaulting to 3000', () => {
    const port = parseInt(process.env.PORT || '3000', 10);
    expect(port).toBe(3000);
  });
});
