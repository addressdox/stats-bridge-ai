-- ===== desk settings (single row) =====
CREATE TABLE public.desk_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  desk_name text NOT NULL DEFAULT 'StatBridge — Statistics South Africa information desk',
  support_email text,
  officer_phone text,
  officer_phone_label text NOT NULL DEFAULT 'Stats SA communications desk',
  phone_handover_enabled boolean NOT NULL DEFAULT false,
  office_hours text NOT NULL DEFAULT 'Monday to Friday, 08:00–16:30',
  time_zone text NOT NULL DEFAULT 'Africa/Johannesburg',
  notify_email text,
  handover_response_minutes integer NOT NULL DEFAULT 5 CHECK (handover_response_minutes BETWEEN 1 AND 240),
  visitor_retention_days integer NOT NULL DEFAULT 365 CHECK (visitor_retention_days BETWEEN 30 AND 3650),
  voice_enabled boolean NOT NULL DEFAULT true,
  widget_enabled boolean NOT NULL DEFAULT true,
  public_api_enabled boolean NOT NULL DEFAULT true,
  crawler_enabled boolean NOT NULL DEFAULT true,
  media_auto_escalate boolean NOT NULL DEFAULT true,
  updated_by uuid REFERENCES public.profiles(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.desk_settings TO authenticated;
GRANT ALL ON public.desk_settings TO service_role;
ALTER TABLE public.desk_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read desk settings" ON public.desk_settings FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

INSERT INTO public.desk_settings (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

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
    support_email = COALESCE(NULLIF(_patch->>'support_email',''), support_email),
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

  PERFORM public.record_audit(actor, 'desk_settings_saved', 'desk_settings', NULL, NULL,
    before_row, to_jsonb(after_row), 'screen');

  RETURN after_row;
END;
$$;
REVOKE ALL ON FUNCTION public.save_desk_settings(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_desk_settings(jsonb) TO authenticated, service_role;

-- ===== handover: channel and telephone details =====
ALTER TABLE public.handoffs
  ADD COLUMN IF NOT EXISTS channel text NOT NULL DEFAULT 'chat',
  ADD COLUMN IF NOT EXISTS offered_phone text,
  ADD COLUMN IF NOT EXISTS caller_phone text,
  ADD COLUMN IF NOT EXISTS phone_connect_offered boolean NOT NULL DEFAULT false;

-- ===== staff invitations =====
CREATE TABLE public.staff_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  full_name text NOT NULL,
  role public.staff_role NOT NULL DEFAULT 'official',
  invited_by uuid REFERENCES public.profiles(id),
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.staff_invitations TO authenticated;
GRANT ALL ON public.staff_invitations TO service_role;
ALTER TABLE public.staff_invitations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read invitations" ON public.staff_invitations FOR SELECT TO authenticated
  USING (public.has_staff_role(auth.uid(), 'administrator'));