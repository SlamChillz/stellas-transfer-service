/**
 * Integration tests for GET /docs (error reference page).
 */
import request from 'supertest';
import { app } from '../../src/app';
import { ERROR_CODES } from '../../src/types/errors';

describe('GET /docs (integration)', () => {
  it('returns 200 with HTML error reference page', async () => {
    const res = await request(app).get('/docs').expect(200);

    expect(res.headers['content-type']).toMatch(/text\/html/);
    expect(res.text).toContain('Error reference');
    expect(res.text).toContain('Stellas Transfer API');
  });

  it('includes all error codes in the document', async () => {
    const res = await request(app).get('/docs').expect(200);

    for (const code of Object.values(ERROR_CODES)) {
      expect(res.text).toContain(code);
      expect(res.text).toContain(`id="${code}"`);
    }
  });
});
