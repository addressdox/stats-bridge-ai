CREATE POLICY "knowledge staff read private files"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'knowledge-files' AND public.has_permission(auth.uid(), 'sources.view'));

CREATE POLICY "knowledge staff upload private files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'knowledge-files' AND public.has_permission(auth.uid(), 'sources.upload') AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "knowledge staff replace own private files"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'knowledge-files' AND owner_id = auth.uid()::text AND public.has_permission(auth.uid(), 'sources.upload'))
WITH CHECK (bucket_id = 'knowledge-files' AND owner_id = auth.uid()::text AND public.has_permission(auth.uid(), 'sources.upload'));

ALTER TABLE public.staff_invitations
  ADD COLUMN IF NOT EXISTS role_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS revoked_at timestamptz,
  ADD COLUMN IF NOT EXISTS accepted_by uuid REFERENCES public.profiles(id),
  ADD CONSTRAINT staff_invitations_status_valid CHECK (status IN ('pending','accepted','expired','revoked'));

GRANT SELECT, INSERT, UPDATE ON public.staff_invitations TO authenticated;
GRANT ALL ON public.staff_invitations TO service_role;

DROP POLICY IF EXISTS "admin read staff invitations" ON public.staff_invitations;
DROP POLICY IF EXISTS "admin insert staff invitations" ON public.staff_invitations;
DROP POLICY IF EXISTS "admin update staff invitations" ON public.staff_invitations;
CREATE POLICY "role managers read staff invitations" ON public.staff_invitations FOR SELECT TO authenticated USING (public.has_permission(auth.uid(),'staff.view'));
CREATE POLICY "role managers add staff invitations" ON public.staff_invitations FOR INSERT TO authenticated WITH CHECK (public.has_permission(auth.uid(),'staff.manage') AND invited_by=auth.uid());
CREATE POLICY "role managers update staff invitations" ON public.staff_invitations FOR UPDATE TO authenticated USING (public.has_permission(auth.uid(),'staff.manage'));

CREATE INDEX IF NOT EXISTS staff_invitations_status_idx ON public.staff_invitations(status, created_at DESC);