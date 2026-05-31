-- Allow managers to SELECT storage objects (needed for upsert verification)

CREATE POLICY "announcements_managers_select"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'announcements' AND public.can_manage_content());
