import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

test('audio privacy operation preserves data and enforces real PostgreSQL roles', async t => {
  const db = new PGlite();
  const sql = fs.readFileSync(new URL('../ops/release/storage-audio-privacy.sql', import.meta.url), 'utf8');
  async function asRole(role, statement) {
    await db.exec(`SET ROLE ${role}`); // Test-owned role names only.
    try { return await db.query(statement); }
    finally { await db.exec('RESET ROLE'); }
  }
  try {
    await db.exec(`
      CREATE ROLE anon;
      CREATE ROLE authenticated;
      CREATE ROLE service_role BYPASSRLS;
      CREATE SCHEMA storage;
      CREATE TABLE storage.buckets(id text PRIMARY KEY, public boolean NOT NULL);
      CREATE TABLE storage.objects(id integer PRIMARY KEY, bucket_id text NOT NULL, name text NOT NULL, owner_id text);
      ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
      GRANT USAGE ON SCHEMA storage TO anon,authenticated,service_role;
      GRANT ALL ON storage.objects TO anon,authenticated,service_role;
      INSERT INTO storage.buckets VALUES('story-audio',true),('avatars',true);
      INSERT INTO storage.objects VALUES(1,'story-audio','synthetic-owner/legacy.webm','synthetic-owner');
      CREATE POLICY existing_upload ON storage.objects FOR INSERT TO authenticated WITH CHECK(true);
      CREATE POLICY existing_update ON storage.objects FOR UPDATE TO authenticated USING(owner_id='synthetic-owner') WITH CHECK(owner_id='synthetic-owner');
      CREATE POLICY existing_read ON storage.objects FOR SELECT TO authenticated USING(owner_id='synthetic-owner');
    `);
    await t.test('reproduces the original direct-upload bypass', async () => {
      await asRole('authenticated', "INSERT INTO storage.objects VALUES(2,'story-audio','synthetic-owner/direct.webm','synthetic-owner')");
    });
    const before = await db.query('SELECT * FROM storage.objects ORDER BY id');
    await db.exec(sql);
    await t.test('makes only audio private and preserves every object and owner', async () => {
      assert.deepEqual((await db.query('SELECT * FROM storage.objects ORDER BY id')).rows, before.rows);
      assert.deepEqual((await db.query('SELECT * FROM storage.buckets ORDER BY id')).rows, [{id:'avatars',public:true},{id:'story-audio',public:false}]);
    });
    await t.test('denies browser audio insert despite the permissive upload policy', async () => {
      await assert.rejects(asRole('authenticated', "INSERT INTO storage.objects VALUES(3,'story-audio','synthetic-owner/new.webm','synthetic-owner')"), /row-level security/);
    });
    await t.test('blocks overwrite and moving an existing object into audio', async () => {
      assert.equal((await asRole('authenticated', "UPDATE storage.objects SET name='overwrite.webm' WHERE id=1 RETURNING id")).rows.length, 0);
      await asRole('authenticated', "INSERT INTO storage.objects VALUES(4,'avatars','synthetic-owner/avatar.png','synthetic-owner')");
      await assert.rejects(asRole('authenticated', "UPDATE storage.objects SET bucket_id='story-audio' WHERE id=4"), /row-level security/);
    });
    await t.test('preserves author reads and server-managed uploads', async () => {
      assert.equal((await asRole('authenticated', 'SELECT id FROM storage.objects WHERE id=1')).rows.length, 1);
      await asRole('service_role', "INSERT INTO storage.objects VALUES(5,'story-audio','synthetic-owner/server.webm','synthetic-owner')");
    });
    await t.test('an additional permissive anonymous policy cannot bypass the restrictions', async () => {
      await db.exec('CREATE POLICY simulated_future_upload ON storage.objects FOR INSERT TO anon WITH CHECK(true)');
      await assert.rejects(asRole('anon', "INSERT INTO storage.objects VALUES(6,'story-audio','anonymous.webm',NULL)"), /row-level security/);
    });
    await t.test('a conflicting policy rolls back the entire rerun', async () => {
      await db.exec("UPDATE storage.buckets SET public=true WHERE id='story-audio'");
      await assert.rejects(db.exec(sql), /already exists/);
      await db.exec('ROLLBACK');
      assert.equal((await db.query("SELECT public FROM storage.buckets WHERE id='story-audio'")).rows[0].public, true);
    });
  } finally { await db.close(); }
});
