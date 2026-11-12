import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { inventoryRoutes, recoveryEnvironment } from './test-recovery-artifact.mjs';
const sha = 'a'.repeat(40);

test('recovery server receives only synthetic settings and cannot inherit provider credentials', () => {
  const parent = { CI: 'true', APP_ENV: 'ci', PATH: 'synthetic-bin', GOOGLE_GENERATIVE_AI_API_KEY: 'synthetic-private-value', SUPABASE_SERVICE_ROLE_KEY: 'synthetic-admin-value', VERCEL_TOKEN: 'synthetic-hosting-value', RELEASE_COHORT_SECRET: 'synthetic-private-cohort', APP_FRONTDOOR_MODE: 'operator' };
  const child = recoveryEnvironment(parent, sha, 'paused');
  assert.equal(child.APP_RELEASE_MODE, 'paused');
  assert.equal(child.VERCEL_GIT_COMMIT_SHA, sha);
  for (const name of ['GOOGLE_GENERATIVE_AI_API_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'VERCEL_TOKEN', 'RELEASE_COHORT_SECRET', 'APP_FRONTDOOR_MODE']) assert.equal(Object.hasOwn(child, name), false);
  for (const changed of [{ ...parent, CI: undefined }, { ...parent, APP_ENV: 'production' }, { ...parent, VERCEL: '1' }]) assert.throws(() => recoveryEnvironment(changed, sha, 'paused'), /RECOVERY_CI_CONTEXT_REQUIRED/);
  assert.throws(() => recoveryEnvironment(parent, 'short', 'paused'));
  assert.throws(() => recoveryEnvironment(parent, sha, 'unexpected'));
});

test('route inventory covers declarations, delegated exports and dynamic IDs without executing route code', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'istory-recovery-inventory-'));
  const routes = { 'stories/[storyId]': 'export async function GET() {}; export const DELETE = () => {}', 'auth/link': 'export { completeLink as POST } from "./synthetic"' };
  for (const [relative, source] of Object.entries(routes)) { const directory = path.join(root, relative); fs.mkdirSync(directory, { recursive: true }); fs.writeFileSync(path.join(directory, 'route.ts'), source); }
  const inventory = inventoryRoutes(root);
  assert.deepEqual(inventory.map(r => r.methods), [['HEAD', 'OPTIONS', 'POST'], ['DELETE', 'GET', 'HEAD', 'OPTIONS']]);
  assert.equal(inventory[1].path, '/api/stories/11111111-1111-4111-8111-111111111111');
  fs.writeFileSync(path.join(root, 'auth/link/route.ts'), 'export * from "./unknown"');
  assert.throws(() => inventoryRoutes(root), /RECOVERY_ROUTE_EXPORTS_UNKNOWN/);
});
