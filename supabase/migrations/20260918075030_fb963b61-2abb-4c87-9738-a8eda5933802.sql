CREATE OR REPLACE FUNCTION public.save_desk_settings(_patch jsonb)
RETURNS public.desk_settings
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  actor uuid;
  before_row jsonb;
  after_row public.desk_settings;
BEGIN
  actor := public.require_role('administrator');
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
    updated_by = actor,
    updated_at = now()
  WHERE id
  RETURNING * INTO after_row;

  PERFORM public.write_audit(
    actor, 'desk_settings_saved', 'desk_settings', NULL, NULL,
    left(before_row::text, 2000), left(to_jsonb(after_row)::text, 2000),
    jsonb_build_object('fields', (SELECT jsonb_agg(k) FROM jsonb_object_keys(_patch) AS k)),
    'screen'::public.audit_origin
  );

  RETURN after_row;
END;
$$;
REVOKE ALL ON FUNCTION public.save_desk_settings(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_desk_settings(jsonb) TO authenticated, service_role;