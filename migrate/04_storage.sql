-- StatBridge migration, step 4: private file stores and their access rules.
-- Run against the NEW Supabase database after 01_schema.sql.

insert into storage.buckets (id, name, public)
values ('sources','sources',false), ('knowledge-files','knowledge-files',false)
on conflict (id) do nothing;

drop policy if exists "admins read source files" on storage.objects;
create policy "admins read source files" on storage.objects
  for select to authenticated
  using (bucket_id = 'sources' and public.has_staff_role(auth.uid(), 'administrator'::public.staff_role));

drop policy if exists "admins upload source files" on storage.objects;
create policy "admins upload source files" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'sources' and public.has_staff_role(auth.uid(), 'administrator'::public.staff_role));

drop policy if exists "knowledge staff read private files" on storage.objects;
create policy "knowledge staff read private files" on storage.objects
  for select to authenticated
  using (bucket_id = 'knowledge-files' and public.has_permission(auth.uid(), 'sources.view'));

drop policy if exists "knowledge staff upload private files" on storage.objects;
create policy "knowledge staff upload private files" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'knowledge-files'
    and public.has_permission(auth.uid(), 'sources.upload')
    and (storage.foldername(name))[1] = (auth.uid())::text);

drop policy if exists "knowledge staff replace own private files" on storage.objects;
create policy "knowledge staff replace own private files" on storage.objects
  for update to authenticated
  using (bucket_id = 'knowledge-files' and owner_id = (auth.uid())::text
    and public.has_permission(auth.uid(), 'sources.upload'))
  with check (bucket_id = 'knowledge-files' and owner_id = (auth.uid())::text
    and public.has_permission(auth.uid(), 'sources.upload'));
