-- ===== Value lists =====
CREATE TYPE public.staff_role AS ENUM ('official','administrator','manager');
CREATE TYPE public.source_type AS ENUM ('statistical_release','media_release','methodology','organisational_page','faq_page','other');
CREATE TYPE public.audience AS ENUM ('public','staff');
CREATE TYPE public.source_status AS ENUM ('pending','approved','rejected','superseded','withdrawn');
CREATE TYPE public.ingest_state AS ENUM ('waiting','done','failed');
CREATE TYPE public.approval_basis AS ENUM ('official','demonstration');
CREATE TYPE public.value_state AS ENUM ('reported','missing','suppressed','not_applicable');
CREATE TYPE public.guideline_status AS ENUM ('draft','active','retired');
CREATE TYPE public.channel AS ENUM ('web','widget','api');
CREATE TYPE public.answer_outcome AS ENUM ('answered','clarification','gap','escalated','error');
CREATE TYPE public.reading_level AS ENUM ('short','detailed');
CREATE TYPE public.review_reason AS ENUM ('media','sensitive','complex','interpretation','formal_approval','ambiguous','low_confidence','gap');
CREATE TYPE public.review_flag AS ENUM ('none','source_changed');
CREATE TYPE public.case_kind AS ENUM ('media','public_escalation');
CREATE TYPE public.case_status AS ENUM ('received','draft_prepared','in_review','changes_requested','approved','released','rejected');
CREATE TYPE public.draft_format AS ENUM ('general_reply','faq_answer','short_media_statement');
CREATE TYPE public.author_kind AS ENUM ('ai','official');
CREATE TYPE public.approval_status AS ENUM ('active','void');
CREATE TYPE public.void_reason AS ENUM ('edited','source_withdrawn','source_superseded','manual');
CREATE TYPE public.release_channel AS ENUM ('status_page','email');
CREATE TYPE public.delivery_state AS ENUM ('shown','queued','sent','failed');
CREATE TYPE public.memory_type AS ENUM ('media_response','press_release','official_statement','faq','other_messaging');
CREATE TYPE public.memory_origin AS ENUM ('imported','released_case');
CREATE TYPE public.reuse_status AS ENUM ('reusable','needs_review','historical_only','withdrawn');
CREATE TYPE public.evidence_owner AS ENUM ('answer','draft','memory_item');
CREATE TYPE public.audit_origin AS ENUM ('screen','api','system');

-- ===== profiles =====
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  full_name text NOT NULL,
  role public.staff_role NOT NULL,
  is_demo boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_staff(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = _uid AND p.is_active);
$$;

CREATE OR REPLACE FUNCTION public.has_staff_role(_uid uuid, _role public.staff_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = _uid AND p.is_active AND p.role = _role);
$$;

CREATE OR REPLACE FUNCTION public.staff_role_of(_uid uuid)
RETURNS public.staff_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.role FROM public.profiles p WHERE p.id = _uid AND p.is_active;
$$;

CREATE POLICY "staff read profiles" ON public.profiles FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

-- ===== sources =====
CREATE TABLE public.sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  source_type public.source_type NOT NULL,
  publisher text NOT NULL DEFAULT 'Statistics South Africa',
  audience public.audience NOT NULL DEFAULT 'public',
  topic text,
  canonical_url text,
  current_version_id uuid,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.sources TO authenticated;
GRANT ALL ON public.sources TO service_role;
ALTER TABLE public.sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read sources" ON public.sources FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "admin add sources" ON public.sources FOR INSERT TO authenticated WITH CHECK (public.has_staff_role(auth.uid(),'administrator'));
CREATE POLICY "admin edit sources" ON public.sources FOR UPDATE TO authenticated USING (public.has_staff_role(auth.uid(),'administrator'));

-- ===== source_versions =====
CREATE TABLE public.source_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL REFERENCES public.sources(id) ON DELETE CASCADE,
  version_label text NOT NULL,
  published_on date,
  reference_period text,
  file_path text,
  original_url text,
  file_fingerprint text,
  page_count integer,
  ingest_state public.ingest_state NOT NULL DEFAULT 'waiting',
  ingest_note text,
  status public.source_status NOT NULL DEFAULT 'pending',
  approval_basis public.approval_basis,
  approved_by uuid REFERENCES public.profiles(id),
  approved_at timestamptz,
  supersedes_version_id uuid REFERENCES public.source_versions(id),
  change_note text,
  withdrawn_by uuid REFERENCES public.profiles(id),
  withdrawn_at timestamptz,
  withdrawal_reason text,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT source_version_has_location CHECK (file_path IS NOT NULL OR original_url IS NOT NULL)
);
ALTER TABLE public.sources ADD CONSTRAINT sources_current_version_fk
  FOREIGN KEY (current_version_id) REFERENCES public.source_versions(id);
GRANT SELECT, INSERT, UPDATE ON public.source_versions TO authenticated;
GRANT ALL ON public.source_versions TO service_role;
ALTER TABLE public.source_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read source versions" ON public.source_versions FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "admin add source versions" ON public.source_versions FOR INSERT TO authenticated WITH CHECK (public.has_staff_role(auth.uid(),'administrator'));
CREATE POLICY "admin edit pending source versions" ON public.source_versions FOR UPDATE TO authenticated
  USING (public.has_staff_role(auth.uid(),'administrator') AND status = 'pending');

-- ===== passages =====
CREATE TABLE public.passages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_version_id uuid NOT NULL REFERENCES public.source_versions(id) ON DELETE CASCADE,
  position integer NOT NULL,
  page_number integer,
  section_label text,
  content text NOT NULL,
  search_text tsvector GENERATED ALWAYS AS (to_tsvector('english', content)) STORED,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.passages TO authenticated;
GRANT ALL ON public.passages TO service_role;
ALTER TABLE public.passages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read passages" ON public.passages FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE INDEX passages_search_idx ON public.passages USING gin (search_text);
CREATE INDEX passages_version_position_idx ON public.passages (source_version_id, position);

-- ===== observations =====
CREATE TABLE public.observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_version_id uuid NOT NULL REFERENCES public.source_versions(id) ON DELETE CASCADE,
  passage_id uuid REFERENCES public.passages(id) ON DELETE SET NULL,
  measure text NOT NULL,
  measure_key text NOT NULL,
  value numeric,
  value_state public.value_state NOT NULL,
  display_value text NOT NULL,
  unit text NOT NULL,
  population text,
  geography text NOT NULL,
  reference_period text NOT NULL,
  period_start date,
  period_end date,
  adjustment text,
  reported_change text,
  comparability_note text,
  page_number integer,
  table_label text,
  verified_by uuid REFERENCES public.profiles(id),
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT observation_value_matches_state CHECK (
    (value_state = 'reported' AND value IS NOT NULL) OR (value_state <> 'reported' AND value IS NULL)
  ),
  CONSTRAINT observation_unique_fact UNIQUE (source_version_id, measure_key, geography, reference_period, population)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.observations TO authenticated;
GRANT ALL ON public.observations TO service_role;
ALTER TABLE public.observations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read observations" ON public.observations FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "admin write observations" ON public.observations FOR INSERT TO authenticated
  WITH CHECK (public.has_staff_role(auth.uid(),'administrator')
    AND EXISTS (SELECT 1 FROM public.source_versions v WHERE v.id = source_version_id AND v.status = 'pending'));
CREATE POLICY "admin edit observations" ON public.observations FOR UPDATE TO authenticated
  USING (public.has_staff_role(auth.uid(),'administrator')
    AND EXISTS (SELECT 1 FROM public.source_versions v WHERE v.id = source_version_id AND v.status = 'pending'));
CREATE POLICY "admin delete observations" ON public.observations FOR DELETE TO authenticated
  USING (public.has_staff_role(auth.uid(),'administrator')
    AND EXISTS (SELECT 1 FROM public.source_versions v WHERE v.id = source_version_id AND v.status = 'pending'));
CREATE INDEX observations_lookup_idx ON public.observations (measure_key, geography, reference_period);

-- ===== guidelines =====
CREATE TABLE public.guidelines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_number integer NOT NULL UNIQUE,
  title text NOT NULL,
  terminology jsonb NOT NULL DEFAULT '[]'::jsonb,
  style_rules text,
  number_rules text,
  branding_rules text,
  messaging_rules text,
  status public.guideline_status NOT NULL DEFAULT 'draft',
  approval_basis public.approval_basis NOT NULL DEFAULT 'demonstration',
  activated_by uuid REFERENCES public.profiles(id),
  activated_at timestamptz,
  retired_at timestamptz,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.guidelines TO authenticated;
GRANT ALL ON public.guidelines TO service_role;
ALTER TABLE public.guidelines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read guidelines" ON public.guidelines FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "admin add guidelines" ON public.guidelines FOR INSERT TO authenticated WITH CHECK (public.has_staff_role(auth.uid(),'administrator'));
CREATE POLICY "admin edit draft guidelines" ON public.guidelines FOR UPDATE TO authenticated
  USING (public.has_staff_role(auth.uid(),'administrator') AND status = 'draft');
CREATE UNIQUE INDEX guidelines_one_active_idx ON public.guidelines ((status)) WHERE status = 'active';

-- ===== widget_sites =====
CREATE TABLE public.widget_sites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_key text NOT NULL UNIQUE,
  name text NOT NULL,
  allowed_origins text[] NOT NULL DEFAULT '{}',
  accent_colour text,
  position text,
  default_language text DEFAULT 'en',
  opening_text text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.widget_sites TO authenticated;
GRANT ALL ON public.widget_sites TO service_role;
ALTER TABLE public.widget_sites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin manager read widget sites" ON public.widget_sites FOR SELECT TO authenticated
  USING (public.has_staff_role(auth.uid(),'administrator') OR public.has_staff_role(auth.uid(),'manager'));
CREATE POLICY "admin write widget sites" ON public.widget_sites FOR INSERT TO authenticated WITH CHECK (public.has_staff_role(auth.uid(),'administrator'));
CREATE POLICY "admin edit widget sites" ON public.widget_sites FOR UPDATE TO authenticated USING (public.has_staff_role(auth.uid(),'administrator'));

-- ===== memory_items =====
CREATE TABLE public.memory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_type public.memory_type NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  search_text tsvector GENERATED ALWAYS AS (to_tsvector('english', title || ' ' || body)) STORED,
  topic text,
  audience public.audience NOT NULL DEFAULT 'public',
  communicated_on date NOT NULL,
  reference_period text,
  origin public.memory_origin NOT NULL,
  release_id uuid,
  original_url text,
  approval_basis public.approval_basis NOT NULL DEFAULT 'demonstration',
  reuse_status public.reuse_status NOT NULL DEFAULT 'reusable',
  review_flag_reason text,
  is_demo_seed boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.memory_items TO authenticated;
GRANT ALL ON public.memory_items TO service_role;
ALTER TABLE public.memory_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read memory" ON public.memory_items FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "staff import memory" ON public.memory_items FOR INSERT TO authenticated
  WITH CHECK ((public.has_staff_role(auth.uid(),'administrator') OR public.has_staff_role(auth.uid(),'official')) AND origin = 'imported');
CREATE INDEX memory_search_idx ON public.memory_items USING gin (search_text);

-- ===== cases =====
CREATE TABLE public.cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference text NOT NULL UNIQUE,
  kind public.case_kind NOT NULL,
  status public.case_status NOT NULL DEFAULT 'received',
  review_reasons public.review_reason[] NOT NULL,
  question_text text NOT NULL,
  origin_answer_id uuid,
  follow_up_of_case_id uuid REFERENCES public.cases(id),
  channel public.channel NOT NULL DEFAULT 'web',
  requester_name text,
  requester_outlet text,
  requester_contact text,
  contact_consent boolean NOT NULL DEFAULT false,
  notice_version text,
  deadline_at timestamptz,
  status_token_hash text NOT NULL,
  assigned_to uuid REFERENCES public.profiles(id),
  routing_corrected_by uuid REFERENCES public.profiles(id),
  routing_note text,
  closed_reason text,
  received_at timestamptz NOT NULL DEFAULT now(),
  first_draft_at timestamptz,
  approved_at timestamptz,
  released_at timestamptz,
  contact_erase_after date,
  is_demo_seed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT case_has_reason CHECK (array_length(review_reasons,1) >= 1)
);
GRANT SELECT ON public.cases TO authenticated;
GRANT ALL ON public.cases TO service_role;
ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "officials and managers read cases" ON public.cases FOR SELECT TO authenticated
  USING (public.has_staff_role(auth.uid(),'official') OR public.has_staff_role(auth.uid(),'manager'));
CREATE INDEX cases_status_deadline_idx ON public.cases (status, deadline_at);
CREATE INDEX cases_reference_idx ON public.cases (reference);

-- ===== answers =====
CREATE TABLE public.answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_ref text NOT NULL UNIQUE,
  api_version text NOT NULL DEFAULT 'v1',
  site_id uuid REFERENCES public.widget_sites(id),
  channel public.channel NOT NULL DEFAULT 'web',
  language text NOT NULL DEFAULT 'en',
  question_text text NOT NULL,
  parent_answer_id uuid REFERENCES public.answers(id),
  topic text,
  outcome public.answer_outcome NOT NULL,
  reading_level public.reading_level NOT NULL DEFAULT 'short',
  official_blocks jsonb NOT NULL DEFAULT '[]'::jsonb,
  ai_explanation text,
  caveats text[] NOT NULL DEFAULT '{}',
  follow_ups text[] NOT NULL DEFAULT '{}',
  clarification jsonb,
  gap_description text,
  review_reasons public.review_reason[] NOT NULL DEFAULT '{}',
  case_id uuid REFERENCES public.cases(id),
  guideline_id uuid REFERENCES public.guidelines(id),
  validation_result jsonb NOT NULL DEFAULT '{}'::jsonb,
  ai_provider text,
  ai_model text,
  prompt_version text,
  latency_ms integer,
  review_flag public.review_flag NOT NULL DEFAULT 'none',
  review_flag_reason text,
  is_demo_seed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.cases ADD CONSTRAINT cases_origin_answer_fk FOREIGN KEY (origin_answer_id) REFERENCES public.answers(id);
GRANT SELECT ON public.answers TO authenticated;
GRANT ALL ON public.answers TO service_role;
ALTER TABLE public.answers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read answers" ON public.answers FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE INDEX answers_public_ref_idx ON public.answers (public_ref);
CREATE INDEX answers_topic_time_idx ON public.answers (topic, created_at);

-- ===== drafts =====
CREATE TABLE public.drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  version_number integer NOT NULL,
  format public.draft_format NOT NULL DEFAULT 'general_reply',
  reading_level public.reading_level NOT NULL DEFAULT 'short',
  body text NOT NULL,
  parts jsonb NOT NULL DEFAULT '[]'::jsonb,
  gaps text[] NOT NULL DEFAULT '{}',
  guideline_id uuid NOT NULL REFERENCES public.guidelines(id),
  adapted_from_memory_item_id uuid REFERENCES public.memory_items(id),
  author_kind public.author_kind NOT NULL,
  author_id uuid REFERENCES public.profiles(id),
  instruction text,
  fingerprint text NOT NULL,
  ai_provider text,
  ai_model text,
  prompt_version text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT drafts_case_version_unique UNIQUE (case_id, version_number)
);
GRANT SELECT ON public.drafts TO authenticated;
GRANT ALL ON public.drafts TO service_role;
ALTER TABLE public.drafts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "officials and managers read drafts" ON public.drafts FOR SELECT TO authenticated
  USING (public.has_staff_role(auth.uid(),'official') OR public.has_staff_role(auth.uid(),'manager'));

-- ===== approvals =====
CREATE TABLE public.approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  draft_id uuid NOT NULL REFERENCES public.drafts(id),
  fingerprint text NOT NULL,
  source_version_ids uuid[] NOT NULL DEFAULT '{}',
  guideline_id uuid NOT NULL REFERENCES public.guidelines(id),
  approved_by uuid NOT NULL REFERENCES public.profiles(id),
  approved_at timestamptz NOT NULL DEFAULT now(),
  approval_basis public.approval_basis NOT NULL DEFAULT 'demonstration',
  status public.approval_status NOT NULL DEFAULT 'active',
  voided_at timestamptz,
  void_reason public.void_reason
);
GRANT SELECT ON public.approvals TO authenticated;
GRANT ALL ON public.approvals TO service_role;
ALTER TABLE public.approvals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "officials and managers read approvals" ON public.approvals FOR SELECT TO authenticated
  USING (public.has_staff_role(auth.uid(),'official') OR public.has_staff_role(auth.uid(),'manager'));
CREATE UNIQUE INDEX approvals_one_active_per_case ON public.approvals (case_id) WHERE status = 'active';

-- ===== releases =====
CREATE TABLE public.releases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  approval_id uuid NOT NULL REFERENCES public.approvals(id),
  draft_id uuid NOT NULL REFERENCES public.drafts(id),
  released_body text NOT NULL,
  released_references jsonb NOT NULL DEFAULT '[]'::jsonb,
  channel public.release_channel NOT NULL DEFAULT 'status_page',
  delivery_state public.delivery_state NOT NULL DEFAULT 'shown',
  released_by uuid NOT NULL REFERENCES public.profiles(id),
  released_at timestamptz NOT NULL DEFAULT now(),
  memory_item_id uuid REFERENCES public.memory_items(id),
  CONSTRAINT releases_one_per_approval_channel UNIQUE (approval_id, channel)
);
ALTER TABLE public.memory_items ADD CONSTRAINT memory_release_fk FOREIGN KEY (release_id) REFERENCES public.releases(id);
GRANT SELECT ON public.releases TO authenticated;
GRANT ALL ON public.releases TO service_role;
ALTER TABLE public.releases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read releases" ON public.releases FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

-- ===== evidence_links =====
CREATE TABLE public.evidence_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_kind public.evidence_owner NOT NULL,
  owner_id uuid NOT NULL,
  source_version_id uuid NOT NULL REFERENCES public.source_versions(id) ON DELETE CASCADE,
  passage_id uuid REFERENCES public.passages(id) ON DELETE SET NULL,
  observation_id uuid REFERENCES public.observations(id) ON DELETE SET NULL,
  statement text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.evidence_links TO authenticated;
GRANT ALL ON public.evidence_links TO service_role;
ALTER TABLE public.evidence_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read evidence" ON public.evidence_links FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE INDEX evidence_source_version_idx ON public.evidence_links (source_version_id);
CREATE INDEX evidence_owner_idx ON public.evidence_links (owner_kind, owner_id);

-- ===== audit_events =====
CREATE TABLE public.audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  actor_id uuid REFERENCES public.profiles(id),
  actor_role text,
  action text NOT NULL,
  entity_kind text NOT NULL,
  entity_id uuid,
  case_id uuid REFERENCES public.cases(id) ON DELETE SET NULL,
  from_state text,
  to_state text,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  origin public.audit_origin NOT NULL DEFAULT 'screen'
);
GRANT SELECT ON public.audit_events TO authenticated;
GRANT ALL ON public.audit_events TO service_role;
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read audit" ON public.audit_events FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE INDEX audit_case_time_idx ON public.audit_events (case_id, occurred_at);

-- ===== rate_counters =====
CREATE TABLE public.rate_counters (
  key_hash text NOT NULL,
  window_start timestamptz NOT NULL,
  count integer NOT NULL DEFAULT 0,
  PRIMARY KEY (key_hash, window_start)
);
GRANT ALL ON public.rate_counters TO service_role;
ALTER TABLE public.rate_counters ENABLE ROW LEVEL SECURITY;

-- ===== immutability guards =====
CREATE OR REPLACE FUNCTION public.block_change()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  RAISE EXCEPTION 'This record cannot be changed or removed';
END;
$$;

CREATE TRIGGER passages_immutable BEFORE UPDATE OR DELETE ON public.passages FOR EACH ROW EXECUTE FUNCTION public.block_change();
CREATE TRIGGER drafts_immutable BEFORE UPDATE OR DELETE ON public.drafts FOR EACH ROW EXECUTE FUNCTION public.block_change();
CREATE TRIGGER releases_immutable BEFORE UPDATE OR DELETE ON public.releases FOR EACH ROW EXECUTE FUNCTION public.block_change();
CREATE TRIGGER evidence_immutable BEFORE UPDATE OR DELETE ON public.evidence_links FOR EACH ROW EXECUTE FUNCTION public.block_change();
CREATE TRIGGER audit_immutable BEFORE UPDATE OR DELETE ON public.audit_events FOR EACH ROW EXECUTE FUNCTION public.block_change();

CREATE OR REPLACE FUNCTION public.guard_profile_role()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role AND current_setting('statbridge.role_change', true) IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION 'Roles are changed only by an administrator through set_role';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER profiles_role_guard BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.guard_profile_role();

-- ===== private source files =====
CREATE POLICY "admins read source files" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'sources' AND public.has_staff_role(auth.uid(),'administrator'));
CREATE POLICY "admins upload source files" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'sources' AND public.has_staff_role(auth.uid(),'administrator'));