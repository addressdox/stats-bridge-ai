-- 1. permission-or-legacy-role helper
CREATE OR REPLACE FUNCTION public.require_access(_permission text, _role public.staff_role DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not allowed: sign in first'; END IF;
  IF public.has_permission(uid, _permission) THEN RETURN uid; END IF;
  IF _role IS NOT NULL AND public.has_staff_role(uid, _role) THEN RETURN uid; END IF;
  RAISE EXCEPTION 'Not allowed: this action needs %', _permission;
END; $$;
REVOKE ALL ON FUNCTION public.require_access(text, public.staff_role) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.require_access(text, public.staff_role) TO service_role;

-- 2. new permissions
INSERT INTO public.permissions (key, group_name, name, description) VALUES
 ('insights.manage','Intelligence','Manage alerts','Acknowledge and resolve decision alerts and capture snapshots'),
 ('widgets.manage','Administration','Manage widget sites','Register and configure websites allowed to embed the assistant')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_key)
SELECT r.id, p.key FROM public.roles r CROSS JOIN (VALUES ('insights.manage'),('widgets.manage')) AS p(key)
WHERE r.key IN ('super_administrator','desk_administrator','knowledge_administrator')
ON CONFLICT DO NOTHING;

-- 3. legacy lifecycle functions now accept the granular permission
CREATE OR REPLACE FUNCTION public.approve_source(_version_id uuid, _basis approval_basis DEFAULT 'demonstration'::approval_basis)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE uid uuid := public.require_access('sources.approve','administrator'); v record; superseded uuid;
BEGIN
  SELECT * INTO v FROM public.source_versions WHERE id = _version_id FOR UPDATE;
  IF v IS NULL THEN RAISE EXCEPTION 'No such source version'; END IF;
  IF v.status <> 'pending' THEN RAISE EXCEPTION 'Only a pending version can be approved'; END IF;
  IF v.ingest_state <> 'done' THEN RAISE EXCEPTION 'The text of this version has not been loaded yet'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.passages WHERE source_version_id = _version_id) THEN
    RAISE EXCEPTION 'This version has no passages to search';
  END IF;
  IF EXISTS (SELECT 1 FROM public.observations WHERE source_version_id = _version_id AND verified_at IS NULL) THEN
    RAISE EXCEPTION 'Every recorded figure must be checked by a person before approval';
  END IF;
  UPDATE public.source_versions SET status='approved', approved_by=uid, approved_at=now(), approval_basis=_basis WHERE id = _version_id;
  UPDATE public.sources SET current_version_id = _version_id WHERE id = v.source_id;
  superseded := v.supersedes_version_id;
  IF superseded IS NOT NULL THEN
    UPDATE public.source_versions SET status='superseded' WHERE id = superseded AND status='approved';
    PERFORM public.flag_source_change(superseded, 'source_superseded', uid);
  END IF;
  PERFORM public.write_audit(uid,'source_approved','source_version',_version_id,NULL,'pending','approved',
    jsonb_build_object('basis',_basis,'supersedes',superseded),'screen');
END; $$;

CREATE OR REPLACE FUNCTION public.reject_source(_version_id uuid, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE uid uuid := public.require_access('sources.approve','administrator'); st public.source_status;
BEGIN
  SELECT status INTO st FROM public.source_versions WHERE id=_version_id FOR UPDATE;
  IF st IS NULL THEN RAISE EXCEPTION 'No such source version'; END IF;
  IF st <> 'pending' THEN RAISE EXCEPTION 'Only a pending version can be rejected'; END IF;
  UPDATE public.source_versions SET status='rejected', ingest_note=_reason WHERE id=_version_id;
  PERFORM public.write_audit(uid,'source_rejected','source_version',_version_id,NULL,'pending','rejected',
    jsonb_build_object('reason',_reason),'screen');
END; $$;

CREATE OR REPLACE FUNCTION public.withdraw_source(_version_id uuid, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE uid uuid := public.require_access('sources.approve','administrator'); v record;
BEGIN
  IF _reason IS NULL OR length(trim(_reason)) = 0 THEN RAISE EXCEPTION 'A reason is required to withdraw a source'; END IF;
  SELECT * INTO v FROM public.source_versions WHERE id=_version_id FOR UPDATE;
  IF v IS NULL THEN RAISE EXCEPTION 'No such source version'; END IF;
  IF v.status <> 'approved' THEN RAISE EXCEPTION 'Only an approved version can be withdrawn'; END IF;
  UPDATE public.source_versions SET status='withdrawn', withdrawn_by=uid, withdrawn_at=now(), withdrawal_reason=_reason WHERE id=_version_id;
  UPDATE public.sources SET current_version_id = NULL WHERE current_version_id = _version_id;
  PERFORM public.flag_source_change(_version_id, 'source_withdrawn', uid);
  PERFORM public.write_audit(uid,'source_withdrawn','source_version',_version_id,NULL,'approved','withdrawn',
    jsonb_build_object('reason',_reason),'screen');
END; $$;

CREATE OR REPLACE FUNCTION public.activate_guidelines(_guideline_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE uid uuid := public.require_access('guidelines.activate','administrator'); st public.guideline_status; prev uuid;
BEGIN
  SELECT status INTO st FROM public.guidelines WHERE id=_guideline_id FOR UPDATE;
  IF st IS NULL THEN RAISE EXCEPTION 'No such guideline version'; END IF;
  IF st <> 'draft' THEN RAISE EXCEPTION 'Only a draft version can be activated'; END IF;
  SELECT id INTO prev FROM public.guidelines WHERE status='active';
  IF prev IS NOT NULL THEN UPDATE public.guidelines SET status='retired', retired_at=now() WHERE id=prev; END IF;
  UPDATE public.guidelines SET status='active', activated_by=uid, activated_at=now() WHERE id=_guideline_id;
  PERFORM public.write_audit(uid,'guidelines_activated','guideline',_guideline_id,NULL,'draft','active',
    jsonb_build_object('retired',prev),'screen');
END; $$;

CREATE OR REPLACE FUNCTION public.set_role(_target uuid, _role staff_role)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE uid uuid := public.require_access('roles.manage','administrator'); old text;
BEGIN
  IF _target = uid THEN RAISE EXCEPTION 'You cannot change your own role'; END IF;
  SELECT role::text INTO old FROM public.profiles WHERE id = _target;
  IF old IS NULL THEN RAISE EXCEPTION 'No such staff account'; END IF;
  PERFORM set_config('statbridge.role_change','on',true);
  UPDATE public.profiles SET role = _role WHERE id = _target;
  PERFORM set_config('statbridge.role_change','off',true);
  PERFORM public.write_audit(uid,'role_changed','profile',_target,NULL,old,_role::text,'{}'::jsonb,'screen');
END; $$;

-- desk settings: permission or legacy administrator
CREATE OR REPLACE FUNCTION public.save_desk_settings(_patch jsonb)
RETURNS desk_settings LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE actor uuid; before_row jsonb; after_row public.desk_settings;
BEGIN
  actor := public.require_access('settings.manage','administrator');
  SELECT to_jsonb(d) INTO before_row FROM public.desk_settings d WHERE d.id;
  UPDATE public.desk_settings SET
    desk_name = COALESCE(_patch->>'desk_name', desk_name),
    support_email = CASE WHEN _patch ? 'support_email' THEN NULLIF(_patch->>'support_email','') ELSE support_email END,
    officer_phone = CASE WHEN _patch ? 'officer_phone' THEN NULLIF(_patch->>'officer_phone','') ELSE officer_phone END,
    officer_phone_label = COALESCE(NULLIF(_patch->>'officer_phone_label',''), officer_phone_label),
    phone_handover_enabled = COALESCE((_patch->>'phone_handover_enabled')::boolean, phone_handover_enabled),
    office_hours = COALESCE(NULLIF(_patch->>'office_hours',''), office_hours),
    time_zone = COALESCE(NULLIF(_patch->>'time_zone',''), time_zone),
    notify_email = CASE WHEN _patch ? 'notify_email' THEN NULLIF(_patch->>'notify_email','') ELSE notify_email END,
    handover_response_minutes = COALESCE((_patch->>'handover_response_minutes')::integer, handover_response_minutes),
    visitor_retention_days = COALESCE((_patch->>'visitor_retention_days')::integer, visitor_retention_days),
    voice_enabled = COALESCE((_patch->>'voice_enabled')::boolean, voice_enabled),
    widget_enabled = COALESCE((_patch->>'widget_enabled')::boolean, widget_enabled),
    public_api_enabled = COALESCE((_patch->>'public_api_enabled')::boolean, public_api_enabled),
    crawler_enabled = COALESCE((_patch->>'crawler_enabled')::boolean, crawler_enabled),
    media_auto_escalate = COALESCE((_patch->>'media_auto_escalate')::boolean, media_auto_escalate),
    updated_by = actor, updated_at = now()
  WHERE id RETURNING * INTO after_row;
  PERFORM public.write_audit(actor,'desk_settings_saved','desk_settings',NULL,NULL,
    left(before_row::text,2000), left(to_jsonb(after_row)::text,2000),
    jsonb_build_object('fields',(SELECT jsonb_agg(k) FROM jsonb_object_keys(_patch) AS k)),'screen'::public.audit_origin);
  RETURN after_row;
END; $$;

-- 4. bulk verification of extracted figures
CREATE OR REPLACE FUNCTION public.verify_observations(_ids uuid[])
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE actor uuid := public.require_access('sources.verify','administrator'); n integer;
BEGIN
  UPDATE public.observations SET verified_by = actor, verified_at = now()
   WHERE id = ANY(_ids) AND verified_at IS NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  PERFORM public.write_audit(actor,'figures_verified','observation',NULL,NULL,NULL,NULL,
    jsonb_build_object('count',n,'ids',_ids),'screen');
  RETURN n;
END; $$;
REVOKE ALL ON FUNCTION public.verify_observations(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.verify_observations(uuid[]) TO authenticated, service_role;

-- 5. insight history and alert lifecycle
CREATE OR REPLACE FUNCTION public.capture_insight_snapshot(_window_hours integer DEFAULT 24)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE ws timestamptz := now() - make_interval(hours => greatest(1, _window_hours)); id uuid; m jsonb;
BEGIN
  SELECT jsonb_build_object(
    'questions', (SELECT count(*) FROM answers WHERE created_at >= ws AND NOT is_demo_seed),
    'answered', (SELECT count(*) FROM answers WHERE created_at >= ws AND outcome='answered' AND NOT is_demo_seed),
    'gaps', (SELECT count(*) FROM answers WHERE created_at >= ws AND outcome='gap' AND NOT is_demo_seed),
    'escalated', (SELECT count(*) FROM answers WHERE created_at >= ws AND outcome='escalated' AND NOT is_demo_seed),
    'clarifications', (SELECT count(*) FROM answers WHERE created_at >= ws AND outcome='clarification' AND NOT is_demo_seed),
    'conversations', (SELECT count(*) FROM conversations WHERE started_at >= ws AND NOT is_demo),
    'handoffs', (SELECT count(*) FROM handoffs WHERE requested_at >= ws AND NOT is_demo),
    'cases_opened', (SELECT count(*) FROM cases WHERE received_at >= ws AND NOT is_demo_seed),
    'cases_released', (SELECT count(*) FROM cases WHERE released_at >= ws AND NOT is_demo_seed),
    'median_latency_ms', (SELECT round(percentile_cont(0.5) WITHIN GROUP (ORDER BY latency_ms)) FROM answers WHERE created_at >= ws AND latency_ms IS NOT NULL),
    'approved_versions', (SELECT count(*) FROM source_versions WHERE status='approved'),
    'pending_versions', (SELECT count(*) FROM source_versions WHERE status='pending'),
    'unverified_figures', (SELECT count(*) FROM observations WHERE verified_at IS NULL),
    'embeddings', (SELECT count(*) FROM kb_embeddings)
  ) INTO m;
  INSERT INTO public.insight_snapshots (window_start, window_end, metrics)
  VALUES (ws, now(), m) RETURNING public.insight_snapshots.id INTO id;
  RETURN id;
END; $$;
REVOKE ALL ON FUNCTION public.capture_insight_snapshot(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.capture_insight_snapshot(integer) TO service_role;

CREATE OR REPLACE FUNCTION public.staff_insight_history(_limit integer DEFAULT 60)
RETURNS SETOF public.insight_snapshots LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT * FROM public.insight_snapshots
   WHERE public.has_permission(auth.uid(),'insights.view')
   ORDER BY window_end DESC LIMIT greatest(1, least(_limit, 365));
$$;
REVOKE ALL ON FUNCTION public.staff_insight_history(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_insight_history(integer) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.set_alert_state(_alert_id uuid, _state public.alert_state, _note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE actor uuid := public.require_access('insights.manage','administrator');
BEGIN
  UPDATE public.insight_alerts SET
    state = _state,
    acknowledged_by = CASE WHEN _state='acknowledged' THEN actor ELSE acknowledged_by END,
    acknowledged_at = CASE WHEN _state='acknowledged' THEN now() ELSE acknowledged_at END,
    resolved_by = CASE WHEN _state='resolved' THEN actor ELSE resolved_by END,
    resolved_at = CASE WHEN _state='resolved' THEN now() ELSE resolved_at END
  WHERE id = _alert_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'No such alert'; END IF;
  PERFORM public.write_audit(actor,'alert_'||_state::text,'insight_alert',_alert_id,NULL,NULL,_state::text,
    jsonb_build_object('note',_note),'screen');
END; $$;
REVOKE ALL ON FUNCTION public.set_alert_state(uuid, public.alert_state, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_alert_state(uuid, public.alert_state, text) TO authenticated, service_role;

-- 6. internal routines are no longer directly callable by signed-in accounts
REVOKE EXECUTE ON FUNCTION public.write_audit(uuid,text,text,uuid,uuid,text,text,jsonb,public.audit_origin) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.flag_source_change(uuid, public.void_reason, uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.erase_contacts() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.bump_rate_counter(text, timestamptz, integer) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.next_case_reference() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.open_case(public.case_kind,text,public.review_reason[],text,public.channel,uuid,text,text,text,boolean,timestamptz,text,boolean) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.search_passages(text,integer) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.search_observations(text,integer) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.search_passages_by_id(uuid[]) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.search_observations_by_id(uuid[]) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.search_knowledge_semantic(extensions.vector,integer) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.approve_source(uuid, public.approval_basis) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reject_source(uuid, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.withdraw_source(uuid, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.require_role(public.staff_role) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.require_permission(text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_role(uuid, public.staff_role) FROM anon, authenticated;