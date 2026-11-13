import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildIdentity, changedBuildFiles, inventoryRoutes, recoveryEnvironment } from './test-recovery-artifact.mjs';
import { NextRequest } from 'next/server.js';
const sha = 'a'.repeat(40);

function buildFixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'istory-build-identity-'));
  t.after(() => {
    assert.equal(path.dirname(directory), path.resolve(os.tmpdir()));
    assert.ok(path.basename(directory).startsWith('istory-build-identity-'));
    fs.rmSync(directory, { recursive: true, force: true });
  });
  for (const name of ['server', 'static']) fs.mkdirSync(path.join(directory, '.next', name), { recursive: true });
  for (const name of ['BUILD_ID', 'build-manifest.json', 'app-build-manifest.json', 'required-server-files.json', 'routes-manifest.json', 'prerender-manifest.json']) {
    fs.writeFileSync(path.join(directory, '.next', name), 'synthetic fixture');
  }
  return directory;
}

test('build identity detects executable changes, added runtime files and removals without exposing contents', async t => {
  const directory = buildFixture(t);
  const executable = path.join(directory, '.next/server/page.js');
  const removed = path.join(directory, '.next/static/old.js');
  fs.writeFileSync(executable, 'first synthetic executable'); fs.writeFileSync(removed, 'old synthetic static');
  const before = await buildIdentity(directory);
  assert.deepEqual(changedBuildFiles(before, await buildIdentity(directory)), []);
  fs.writeFileSync(executable, 'second synthetic executable'); fs.unlinkSync(removed);
  fs.writeFileSync(path.join(directory, '.next/server/generated.meta'), 'synthetic generated metadata');
  const after = await buildIdentity(directory);
  assert.notEqual(before.sha256, after.sha256);
  const changes = changedBuildFiles(before, after);
  assert.deepEqual(changes.map(({ path, change }) => [path, change]), [
    ['.next/server/generated.meta', 'added'], ['.next/server/page.js', 'modified'], ['.next/static/old.js', 'removed'],
  ]);
  assert.ok(!JSON.stringify(changes).includes('synthetic executable'));
});

test('build identity refuses directory links instead of following them', async t => {
  const directory = buildFixture(t);
  fs.symlinkSync(path.join(directory, '.next/static'), path.join(directory, '.next/server/linked'), process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(buildIdentity(directory), /RECOVERY_BUILD_SYMLINK/);
});

test('operator loopback origin matches the installed NextRequest canonical origin', () => {
  assert.equal(new NextRequest('http://127.0.0.1:3002/api/release/access').nextUrl.origin, 'http://localhost:3002');
  assert.equal(new NextRequest('http://localhost:3002/api/release/access').nextUrl.origin, 'http://localhost:3002');
});

test('recovery server receives only synthetic settings and cannot inherit provider credentials', () => {
  const parent = { CI: 'true', APP_ENV: 'ci', PATH: 'synthetic-bin', GOOGLE_GENERATIVE_AI_API_KEY: 'synthetic-private-value', SUPABASE_SERVICE_ROLE_KEY: 'synthetic-admin-value', VERCEL_TOKEN: 'synthetic-hosting-value', RELEASE_COHORT_SECRET: 'synthetic-private-cohort', APP_FRONTDOOR_MODE: 'operator' };
  const child = recoveryEnvironment(parent, sha, 'paused');
  const releaseParent = { ...parent, DATA_API_RELEASE_KEY: 'synthetic-private-release-key', DATA_API_RELEASE_EPOCH: 'synthetic-private-epoch', PAYMENT_CALLBACK_MODE: 'retain', PAYMENT_CALLBACK_REPLAY_ENABLED: 'true' };
  const isolated = recoveryEnvironment(releaseParent, sha, 'paused');
  for (const name of ['DATA_API_RELEASE_KEY','DATA_API_RELEASE_EPOCH','PAYMENT_CALLBACK_MODE','PAYMENT_CALLBACK_REPLAY_ENABLED']) assert.equal(Object.hasOwn(isolated,name),false);
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
