-- Separate reviewed production operation; NOT part of migrations 020-023.
-- Requires scoped approval, fresh recovery evidence and playback verification.
-- Invoke only through the target-bound Supabase project CLI/provider interface.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '15s';

DO $preconditions$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'story-audio') THEN
    RAISE EXCEPTION 'AUDIO_BUCKET_REQUIRED';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE oid = 'storage.objects'::regclass AND relrowsecurity)
    OR EXISTS (SELECT 1 FROM pg_roles WHERE rolname IN ('anon','authenticated') AND (rolsuper OR rolbypassrls))
    OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role' AND rolbypassrls) THEN
    RAISE EXCEPTION 'AUDIO_STORAGE_RLS_REQUIRED';
  END IF;
END;
$preconditions$;

-- Existing author playback already issues signed URLs. Retain every object.
UPDATE storage.buckets SET public = false WHERE id = 'story-audio';

-- Restrictive policies compose with existing permissive policies using AND.
-- Browser uploads/overwrites must use the authenticated, quota-limited app API.
-- Other buckets and existing owner SELECT/DELETE policies retain their behavior.
CREATE POLICY istory_audio_insert_via_server
  ON storage.objects AS RESTRICTIVE FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id <> 'story-audio');
CREATE POLICY istory_audio_update_via_server
  ON storage.objects AS RESTRICTIVE FOR UPDATE TO anon, authenticated
  USING (bucket_id <> 'story-audio') WITH CHECK (bucket_id <> 'story-audio');

COMMIT;
