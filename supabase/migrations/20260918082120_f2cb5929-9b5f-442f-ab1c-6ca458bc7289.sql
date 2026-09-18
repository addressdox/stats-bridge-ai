CREATE TABLE public.roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE CHECK (key ~ '^[a-z][a-z0-9_]{2,63}$'),
  name text NOT NULL UNIQUE,
  description text NOT NULL DEFAULT '',
  is_system boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.roles TO authenticated;
GRANT ALL ON public.roles TO service_role;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.permissions (
  key text PRIMARY KEY CHECK (key ~ '^[a-z][a-z0-9_.]{2,95}$'),
  group_name text NOT NULL,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.permissions TO authenticated;
GRANT ALL ON public.permissions TO service_role;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.role_permissions (
  role_id uuid NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  permission_key text NOT NULL REFERENCES public.permissions(key) ON DELETE CASCADE,
  granted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (role_id, permission_key)
);
GRANT SELECT, INSERT, DELETE ON public.role_permissions TO authenticated;
GRANT ALL ON public.role_permissions TO service_role;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role_id uuid NOT NULL REFERENCES public.roles(id) ON DELETE RESTRICT,
  granted_by uuid REFERENCES public.profiles(id),
  granted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role_id)
);
GRANT SELECT, INSERT, DELETE ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE INDEX user_roles_user_idx ON public.user_roles(user_id);

CREATE OR REPLACE FUNCTION public.has_permission(_uid uuid, _permission text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    JOIN public.user_roles ur ON ur.user_id = p.id
    JOIN public.roles r ON r.id = ur.role_id AND r.is_active
    JOIN public.role_permissions rp ON rp.role_id = r.id
    WHERE p.id = _uid
      AND p.is_active
      AND rp.permission_key = _permission
  );
$$;
REVOKE ALL ON FUNCTION public.has_permission(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_permission(uuid, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.is_super_admin(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    JOIN public.profiles p ON p.id = ur.user_id
    WHERE ur.user_id = _uid AND r.key = 'super_administrator' AND r.is_active AND p.is_active
  );
$$;
REVOKE ALL ON FUNCTION public.is_super_admin(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated, service_role;

CREATE POLICY "staff read roles" ON public.roles FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "super admins add roles" ON public.roles FOR INSERT TO authenticated WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "super admins edit roles" ON public.roles FOR UPDATE TO authenticated USING (public.is_super_admin(auth.uid()));
CREATE POLICY "staff read permissions" ON public.permissions FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "staff read role permissions" ON public.role_permissions FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "super admins add role permissions" ON public.role_permissions FOR INSERT TO authenticated WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "super admins remove role permissions" ON public.role_permissions FOR DELETE TO authenticated USING (public.is_super_admin(auth.uid()));
CREATE POLICY "staff read own or super admin read user roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_super_admin(auth.uid()));
CREATE POLICY "super admins add user roles" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "super admins remove user roles" ON public.user_roles FOR DELETE TO authenticated USING (public.is_super_admin(auth.uid()));

INSERT INTO public.permissions(key, group_name, name, description) VALUES
('dashboard.view','Operations','View dashboard','View staff command centre'),
('cases.review','Operations','Review cases','Review and route public and media cases'),
('cases.release','Operations','Release responses','Approve and release official responses'),
('handoffs.manage','Operations','Manage handovers','Accept, transfer and close human handovers'),
('conversations.view','Operations','View conversations','Read conversation records'),
('visitors.view','Operations','View people','Read consented visitor records'),
('sources.view','Knowledge','View sources','Read the knowledge library'),
('sources.upload','Knowledge','Upload sources','Add files and official web sources'),
('sources.verify','Knowledge','Verify figures','Review extracts and verify observations'),
('sources.approve','Knowledge','Approve sources','Approve, reject, supersede and withdraw source versions'),
('crawler.manage','Knowledge','Manage crawler','Run and monitor official-source crawling'),
('vectors.manage','Knowledge','Manage vector index','Index and rebuild approved-source vectors'),
('guidelines.view','Governance','View guidelines','Read communication rules'),
('guidelines.author','Governance','Author guidelines','Create and edit guideline drafts'),
('guidelines.activate','Governance','Activate guidelines','Activate and retire guideline versions'),
('memory.manage','Governance','Manage communication memory','Import and govern reusable communications'),
('insights.view','Intelligence','View insights','View operational and knowledge intelligence'),
('insights.export','Intelligence','Export insights','Export decision reports'),
('audit.view','Governance','View audit record','Read the immutable decision record'),
('settings.manage','Administration','Manage desk settings','Change service configuration'),
('staff.view','Administration','View staff','View staff accounts and access'),
('staff.manage','Administration','Manage staff','Invite, suspend and restore staff'),
('roles.manage','Administration','Manage roles','Create roles and assign permissions')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.roles(key,name,description,is_system) VALUES
('super_administrator','Super Administrator','Full platform, identity and governance control',true),
('knowledge_administrator','Knowledge Administrator','Sources, ingestion, verification, vectors and guidelines',true),
('communications_manager','Communications Manager','Operations, review, approval and release',true),
('communications_official','Communications Official','Cases, conversations and handovers',true),
('media_officer','Media Officer','Media cases, conversations and handovers',true),
('insights_analyst','Insights Analyst','Decision intelligence and reporting',true),
('read_only_auditor','Read-only Auditor','Read-only governance and audit access',true)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.role_permissions(role_id, permission_key)
SELECT r.id, p.key FROM public.roles r CROSS JOIN public.permissions p
WHERE r.key='super_administrator'
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions(role_id, permission_key)
SELECT r.id, p.key FROM public.roles r JOIN public.permissions p ON p.key = ANY(ARRAY[
'dashboard.view','sources.view','sources.upload','sources.verify','sources.approve','crawler.manage','vectors.manage',
'guidelines.view','guidelines.author','guidelines.activate','memory.manage','insights.view','audit.view'
]) WHERE r.key='knowledge_administrator' ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions(role_id, permission_key)
SELECT r.id, p.key FROM public.roles r JOIN public.permissions p ON p.key = ANY(ARRAY[
'dashboard.view','cases.review','cases.release','handoffs.manage','conversations.view','visitors.view','sources.view',
'guidelines.view','memory.manage','insights.view','insights.export','audit.view','staff.view'
]) WHERE r.key='communications_manager' ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions(role_id, permission_key)
SELECT r.id, p.key FROM public.roles r JOIN public.permissions p ON p.key = ANY(ARRAY[
'dashboard.view','cases.review','handoffs.manage','conversations.view','visitors.view','sources.view','guidelines.view'
]) WHERE r.key IN ('communications_official','media_officer') ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions(role_id, permission_key)
SELECT r.id, p.key FROM public.roles r JOIN public.permissions p ON p.key = ANY(ARRAY[
'dashboard.view','insights.view','insights.export','sources.view','audit.view'
]) WHERE r.key='insights_analyst' ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions(role_id, permission_key)
SELECT r.id, p.key FROM public.roles r JOIN public.permissions p ON p.key = ANY(ARRAY[
'dashboard.view','sources.view','guidelines.view','insights.view','audit.view'
]) WHERE r.key='read_only_auditor' ON CONFLICT DO NOTHING;

INSERT INTO public.user_roles(user_id, role_id)
SELECT p.id, r.id
FROM public.profiles p
JOIN public.roles r ON r.key = CASE p.role::text
  WHEN 'administrator' THEN 'super_administrator'
  WHEN 'manager' THEN 'communications_manager'
  ELSE 'communications_official'
END
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.require_permission(_permission text)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL OR NOT public.has_permission(uid, _permission) THEN
    RAISE EXCEPTION 'Not allowed: this action needs %', _permission;
  END IF;
  RETURN uid;
END;
$$;
REVOKE ALL ON FUNCTION public.require_permission(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.require_permission(text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.set_user_roles(_target uuid, _role_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE actor uuid := public.require_permission('roles.manage'); super_role uuid; target_is_super boolean; new_is_super boolean;
BEGIN
  IF _target = actor THEN RAISE EXCEPTION 'You cannot change your own roles'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id=_target) THEN RAISE EXCEPTION 'No such staff account'; END IF;
  IF EXISTS (SELECT 1 FROM unnest(_role_ids) x WHERE NOT EXISTS (SELECT 1 FROM public.roles r WHERE r.id=x AND r.is_active)) THEN
    RAISE EXCEPTION 'One or more roles are invalid or inactive';
  END IF;
  SELECT id INTO super_role FROM public.roles WHERE key='super_administrator';
  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_target AND role_id=super_role) INTO target_is_super;
  SELECT super_role = ANY(COALESCE(_role_ids,'{}'::uuid[])) INTO new_is_super;
  IF target_is_super AND NOT new_is_super AND
     (SELECT count(DISTINCT ur.user_id) FROM public.user_roles ur JOIN public.profiles p ON p.id=ur.user_id WHERE ur.role_id=super_role AND p.is_active) <= 1 THEN
    RAISE EXCEPTION 'The final active Super Administrator cannot be removed';
  END IF;
  DELETE FROM public.user_roles WHERE user_id=_target;
  INSERT INTO public.user_roles(user_id, role_id, granted_by)
  SELECT _target, x, actor FROM unnest(COALESCE(_role_ids,'{}'::uuid[])) x;
  PERFORM public.write_audit(actor,'staff_roles_changed','profile',_target,NULL,NULL,NULL,jsonb_build_object('role_ids',_role_ids),'screen');
END;
$$;
REVOKE ALL ON FUNCTION public.set_user_roles(uuid, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_user_roles(uuid, uuid[]) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.set_staff_active(_target uuid, _active boolean, _reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE actor uuid := public.require_permission('staff.manage'); super_role uuid;
BEGIN
  IF _target = actor THEN RAISE EXCEPTION 'You cannot change your own account status'; END IF;
  IF _reason IS NULL OR length(trim(_reason)) < 3 THEN RAISE EXCEPTION 'A reason is required'; END IF;
  SELECT id INTO super_role FROM public.roles WHERE key='super_administrator';
  IF NOT _active AND EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_target AND role_id=super_role) AND
     (SELECT count(DISTINCT ur.user_id) FROM public.user_roles ur JOIN public.profiles p ON p.id=ur.user_id WHERE ur.role_id=super_role AND p.is_active) <= 1 THEN
    RAISE EXCEPTION 'The final active Super Administrator cannot be suspended';
  END IF;
  UPDATE public.profiles SET is_active=_active WHERE id=_target;
  IF NOT FOUND THEN RAISE EXCEPTION 'No such staff account'; END IF;
  PERFORM public.write_audit(actor,CASE WHEN _active THEN 'staff_reactivated' ELSE 'staff_suspended' END,'profile',_target,NULL,NULL,NULL,jsonb_build_object('reason',_reason),'screen');
END;
$$;
REVOKE ALL ON FUNCTION public.set_staff_active(uuid, boolean, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_staff_active(uuid, boolean, text) TO authenticated, service_role;

CREATE TYPE public.ingestion_job_kind AS ENUM ('file','url','crawler');
CREATE TYPE public.ingestion_job_state AS ENUM ('uploaded','discovered','extracting','extracted','needs_metadata','needs_verification','ready_for_approval','approved','failed','superseded');

CREATE TABLE public.knowledge_ingestion_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_version_id uuid REFERENCES public.source_versions(id) ON DELETE CASCADE,
  kind public.ingestion_job_kind NOT NULL,
  state public.ingestion_job_state NOT NULL,
  file_name text,
  mime_type text,
  file_size bigint CHECK (file_size IS NULL OR file_size >= 0),
  source_url text,
  storage_path text,
  checksum text,
  progress integer NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  error_message text,
  detected_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES public.profiles(id),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.knowledge_ingestion_jobs TO authenticated;
GRANT ALL ON public.knowledge_ingestion_jobs TO service_role;
ALTER TABLE public.knowledge_ingestion_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "knowledge staff read ingestion jobs" ON public.knowledge_ingestion_jobs FOR SELECT TO authenticated USING (public.has_permission(auth.uid(),'sources.view'));
CREATE POLICY "knowledge staff add ingestion jobs" ON public.knowledge_ingestion_jobs FOR INSERT TO authenticated WITH CHECK (public.has_permission(auth.uid(),'sources.upload') AND created_by=auth.uid());
CREATE POLICY "knowledge staff update ingestion jobs" ON public.knowledge_ingestion_jobs FOR UPDATE TO authenticated USING (public.has_permission(auth.uid(),'sources.upload'));
CREATE INDEX knowledge_ingestion_jobs_state_idx ON public.knowledge_ingestion_jobs(state, created_at DESC);
CREATE TRIGGER knowledge_ingestion_jobs_touch BEFORE UPDATE ON public.knowledge_ingestion_jobs FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.knowledge_ingestion_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.knowledge_ingestion_jobs(id) ON DELETE CASCADE,
  state public.ingestion_job_state NOT NULL,
  message text NOT NULL,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor_id uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.knowledge_ingestion_events TO authenticated;
GRANT ALL ON public.knowledge_ingestion_events TO service_role;
ALTER TABLE public.knowledge_ingestion_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "knowledge staff read ingestion events" ON public.knowledge_ingestion_events FOR SELECT TO authenticated USING (public.has_permission(auth.uid(),'sources.view'));
CREATE POLICY "knowledge staff add ingestion events" ON public.knowledge_ingestion_events FOR INSERT TO authenticated WITH CHECK (public.has_permission(auth.uid(),'sources.upload'));
CREATE INDEX knowledge_ingestion_events_job_idx ON public.knowledge_ingestion_events(job_id, created_at);

CREATE TABLE public.insight_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  window_start timestamptz NOT NULL,
  window_end timestamptz NOT NULL,
  metrics jsonb NOT NULL,
  generated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (window_end > window_start)
);
GRANT SELECT ON public.insight_snapshots TO authenticated;
GRANT ALL ON public.insight_snapshots TO service_role;
ALTER TABLE public.insight_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "analysts read insight snapshots" ON public.insight_snapshots FOR SELECT TO authenticated USING (public.has_permission(auth.uid(),'insights.view'));
CREATE INDEX insight_snapshots_window_idx ON public.insight_snapshots(window_end DESC);

CREATE TYPE public.alert_severity AS ENUM ('information','warning','critical');
CREATE TYPE public.alert_state AS ENUM ('open','acknowledged','resolved');
CREATE TABLE public.insight_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_key text NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  severity public.alert_severity NOT NULL,
  state public.alert_state NOT NULL DEFAULT 'open',
  metric_name text,
  metric_value numeric,
  threshold_value numeric,
  related_entity_kind text,
  related_entity_id uuid,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  acknowledged_by uuid REFERENCES public.profiles(id),
  acknowledged_at timestamptz,
  resolved_by uuid REFERENCES public.profiles(id),
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.insight_alerts TO authenticated;
GRANT ALL ON public.insight_alerts TO service_role;
ALTER TABLE public.insight_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "analysts read insight alerts" ON public.insight_alerts FOR SELECT TO authenticated USING (public.has_permission(auth.uid(),'insights.view'));
CREATE POLICY "analysts update insight alerts" ON public.insight_alerts FOR UPDATE TO authenticated USING (public.has_permission(auth.uid(),'insights.view'));
CREATE INDEX insight_alerts_state_idx ON public.insight_alerts(state, severity, created_at DESC);
CREATE TRIGGER insight_alerts_touch BEFORE UPDATE ON public.insight_alerts FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.guidelines
  ADD COLUMN identity_rules text,
  ADD COLUMN evidence_rules text,
  ADD COLUMN prohibited_claims text[] NOT NULL DEFAULT '{}',
  ADD COLUMN required_phrases text[] NOT NULL DEFAULT '{}',
  ADD COLUMN forbidden_phrases text[] NOT NULL DEFAULT '{}',
  ADD COLUMN media_policy text,
  ADD COLUMN sensitive_topic_policy text,
  ADD COLUMN escalation_policy text,
  ADD COLUMN voice_rules text,
  ADD COLUMN multilingual_rules text,
  ADD COLUMN channel_rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN example_responses jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN change_summary text;

CREATE OR REPLACE FUNCTION public.staff_dashboard_summary(_since timestamptz, _include_demo boolean DEFAULT false)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE WHEN public.has_permission(auth.uid(),'dashboard.view') THEN jsonb_build_object(
    'generated_at', now(),
    'live_conversations', (SELECT count(*) FROM conversations WHERE state='active' AND (_include_demo OR NOT is_demo)),
    'waiting_handoffs', (SELECT count(*) FROM handoffs WHERE state='waiting' AND (_include_demo OR NOT is_demo)),
    'conversations', (SELECT count(*) FROM conversations WHERE started_at >= _since AND (_include_demo OR NOT is_demo)),
    'resolved', (SELECT count(*) FROM conversation_analysis ca JOIN conversations c ON c.id=ca.conversation_id WHERE ca.created_at >= _since AND ca.resolved AND (_include_demo OR NOT c.is_demo)),
    'average_seconds', (SELECT round(avg(duration_seconds)) FROM conversations WHERE started_at >= _since AND duration_seconds >= 0 AND (_include_demo OR NOT is_demo)),
    'open_cases', (SELECT count(*) FROM cases WHERE status IN ('received','draft_prepared','in_review','changes_requested') AND (_include_demo OR NOT is_demo_seed)),
    'overdue_cases', (SELECT count(*) FROM cases WHERE deadline_at < now() AND status IN ('received','draft_prepared','in_review','changes_requested') AND (_include_demo OR NOT is_demo_seed)),
    'coverage_gaps', (SELECT count(*) FROM answers WHERE outcome='gap' AND created_at >= _since AND (_include_demo OR NOT is_demo_seed)),
    'visitors', (SELECT count(*) FROM visitors WHERE _include_demo OR NOT is_demo),
    'pending_sources', (SELECT count(*) FROM source_versions WHERE status='pending'),
    'failed_ingestions', (SELECT count(*) FROM knowledge_ingestion_jobs WHERE state='failed'),
    'stale_sources', (SELECT count(*) FROM sources s JOIN source_versions v ON v.id=s.current_version_id WHERE v.published_on < current_date - 365),
    'passages', (SELECT count(*) FROM passages),
    'verified_observations', (SELECT count(*) FROM observations WHERE verified_at IS NOT NULL),
    'embeddings', (SELECT count(*) FROM kb_embeddings)
  ) ELSE NULL END;
$$;
REVOKE ALL ON FUNCTION public.staff_dashboard_summary(timestamptz, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_dashboard_summary(timestamptz, boolean) TO authenticated, service_role;

REVOKE ALL ON public.review_queue, public.insight_topics, public.insight_gaps, public.insight_turnaround, public.decision_record FROM anon;
REVOKE ALL ON public.review_queue, public.insight_topics, public.insight_gaps, public.insight_turnaround, public.decision_record FROM authenticated;

CREATE OR REPLACE FUNCTION public.staff_review_queue()
RETURNS SETOF public.review_queue
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path=public
AS $$ SELECT * FROM public.review_queue WHERE public.has_permission(auth.uid(),'cases.review'); $$;
REVOKE ALL ON FUNCTION public.staff_review_queue() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_review_queue() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.staff_insight_topics()
RETURNS SETOF public.insight_topics
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path=public
AS $$ SELECT * FROM public.insight_topics WHERE public.has_permission(auth.uid(),'insights.view'); $$;
REVOKE ALL ON FUNCTION public.staff_insight_topics() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_insight_topics() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.staff_insight_turnaround()
RETURNS SETOF public.insight_turnaround
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path=public
AS $$ SELECT * FROM public.insight_turnaround WHERE public.has_permission(auth.uid(),'insights.view') AND (hours_to_release IS NULL OR hours_to_release >= 0); $$;
REVOKE ALL ON FUNCTION public.staff_insight_turnaround() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_insight_turnaround() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.staff_insight_gaps()
RETURNS TABLE(topic text, gap_count bigint, most_recent timestamptz, includes_demo_seed boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path=public
AS $$
  SELECT g.topic, g.gap_count, g.most_recent, g.includes_demo_seed
  FROM public.insight_gaps g
  WHERE public.has_permission(auth.uid(),'insights.view');
$$;
REVOKE ALL ON FUNCTION public.staff_insight_gaps() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_insight_gaps() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.staff_decision_record(_from timestamptz DEFAULT NULL, _to timestamptz DEFAULT NULL, _limit integer DEFAULT 50, _offset integer DEFAULT 0)
RETURNS SETOF public.decision_record
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path=public
AS $$
  SELECT d.* FROM public.decision_record d
  WHERE public.has_permission(auth.uid(),'audit.view')
    AND (_from IS NULL OR d.released_at >= _from)
    AND (_to IS NULL OR d.released_at < _to)
  ORDER BY d.released_at DESC
  LIMIT greatest(1,least(_limit,100)) OFFSET greatest(0,_offset);
$$;
REVOKE ALL ON FUNCTION public.staff_decision_record(timestamptz,timestamptz,integer,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_decision_record(timestamptz,timestamptz,integer,integer) TO authenticated, service_role;

CREATE TRIGGER roles_touch BEFORE UPDATE ON public.roles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();