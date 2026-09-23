import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The Workers runtime rejects `redirect: 'error'` with a TypeError before any
 * request is sent, which silently broke every scheduled fetch (the TheMealDB
 * mirror, the Open Food Facts refresh) and the Spoonacular search on Cloudflare
 * while the unit tests, which stub fetch in Node, stayed green. Outbound Worker
 * fetches use `redirect: 'manual'` and treat a 3xx response as a failure.
 */
describe('outbound fetch options', () => {
  it('never asks the Workers runtime for redirect: error', () => {
    const dir = join(__dirname);
    const sources = readdirSync(dir).filter(name => name.endsWith('.ts') && !name.endsWith('.test.ts') && !name.endsWith('.d.ts'));
    expect(sources.length).toBeGreaterThan(5);
    for (const name of sources) {
      const text = readFileSync(join(dir, name), 'utf8');
      expect(text, `${name} uses redirect: 'error', which Cloudflare Workers reject`).not.toMatch(/redirect:\s*['"]error['"]/);
    }
  });
});
