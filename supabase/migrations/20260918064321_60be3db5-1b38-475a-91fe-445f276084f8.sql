CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

CREATE TYPE public.conversation_channel AS ENUM ('chat','voice','widget','api');
CREATE TYPE public.conversation_state AS ENUM ('active','ended','handed_off','abandoned');
CREATE TYPE public.turn_author AS ENUM ('visitor','assistant','official','system');
CREATE TYPE public.handoff_state AS ENUM ('waiting','accepted','declined','transferred','closed');
CREATE TYPE public.handoff_reason AS ENUM ('visitor_request','media','sensitive','unsupported','low_confidence','complaint','other');
CREATE TYPE public.urgency_level AS ENUM ('low','normal','high','urgent');
CREATE TYPE public.sentiment_label AS ENUM ('positive','neutral','negative','frustrated');
CREATE TYPE public.embedding_owner AS ENUM ('passage','observation','memory_item');

-- ===== visitors =====
CREATE TABLE public.visitors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text,
  email text,
  phone text,
  address text,
  organisation text,
  preferred_language text NOT NULL DEFAULT 'en',
  consent_given boolean NOT NULL DEFAULT false,
  consent_at timestamptz,
  notes text,
  is_demo boolean NOT NULL DEFAULT false,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  conversation_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.visitors TO authenticated;
GRANT ALL ON public.visitors TO service_role;
ALTER TABLE public.visitors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read visitors" ON public.visitors FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE INDEX visitors_email_idx ON public.visitors (lower(email)) WHERE email IS NOT NULL;
CREATE INDEX visitors_phone_idx ON public.visitors (phone) WHERE phone IS NOT NULL;
CREATE INDEX visitors_last_seen_idx ON public.visitors (last_seen_at DESC);

-- ===== visitor_identifiers =====
CREATE TABLE public.visitor_identifiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id uuid NOT NULL REFERENCES public.visitors(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('browser_token','email','phone')),
  value text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (kind, value)
);
GRANT SELECT ON public.visitor_identifiers TO authenticated;
GRANT ALL ON public.visitor_identifiers TO service_role;
ALTER TABLE public.visitor_identifiers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read visitor identifiers" ON public.visitor_identifiers FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE INDEX visitor_identifiers_visitor_idx ON public.visitor_identifiers (visitor_id);

-- ===== conversations =====
CREATE TABLE public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id uuid REFERENCES public.visitors(id) ON DELETE SET NULL,
  channel public.conversation_channel NOT NULL DEFAULT 'chat',
  state public.conversation_state NOT NULL DEFAULT 'active',
  language text NOT NULL DEFAULT 'en',
  device text,
  page_url text,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  duration_seconds integer,
  turn_count integer NOT NULL DEFAULT 0,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.conversations TO authenticated;
GRANT ALL ON public.conversations TO service_role;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read conversations" ON public.conversations FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE INDEX conversations_visitor_idx ON public.conversations (visitor_id);
CREATE INDEX conversations_started_idx ON public.conversations (started_at DESC);
CREATE INDEX conversations_state_idx ON public.conversations (state);

-- ===== conversation_turns =====
CREATE TABLE public.conversation_turns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  author public.turn_author NOT NULL,
  author_profile_id uuid REFERENCES public.profiles(id),
  body text NOT NULL,
  answer_id uuid REFERENCES public.answers(id) ON DELETE SET NULL,
  outcome public.answer_outcome,
  tools_used text[] NOT NULL DEFAULT '{}',
  spoken boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.conversation_turns TO authenticated;
GRANT ALL ON public.conversation_turns TO service_role;
ALTER TABLE public.conversation_turns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read conversation turns" ON public.conversation_turns FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE INDEX conversation_turns_conv_idx ON public.conversation_turns (conversation_id, created_at);

-- ===== conversation_analysis =====
CREATE TABLE public.conversation_analysis (
  conversation_id uuid PRIMARY KEY REFERENCES public.conversations(id) ON DELETE CASCADE,
  summary text NOT NULL,
  topic text,
  sentiment public.sentiment_label NOT NULL DEFAULT 'neutral',
  urgency public.urgency_level NOT NULL DEFAULT 'normal',
  resolved boolean NOT NULL DEFAULT false,
  unmet_need text,
  key_points text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.conversation_analysis TO authenticated;
GRANT ALL ON public.conversation_analysis TO service_role;
ALTER TABLE public.conversation_analysis ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read conversation analysis" ON public.conversation_analysis FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

-- ===== handoffs =====
CREATE TABLE public.handoffs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  visitor_id uuid REFERENCES public.visitors(id) ON DELETE SET NULL,
  case_id uuid REFERENCES public.cases(id) ON DELETE SET NULL,
  state public.handoff_state NOT NULL DEFAULT 'waiting',
  reason public.handoff_reason NOT NULL DEFAULT 'visitor_request',
  urgency public.urgency_level NOT NULL DEFAULT 'normal',
  topic text,
  summary text NOT NULL,
  requested_at timestamptz NOT NULL DEFAULT now(),
  accepted_by uuid REFERENCES public.profiles(id),
  accepted_at timestamptz,
  declined_by uuid REFERENCES public.profiles(id),
  declined_at timestamptz,
  decline_reason text,
  transferred_to uuid REFERENCES public.profiles(id),
  transferred_at timestamptz,
  closed_at timestamptz,
  is_demo boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.handoffs TO authenticated;
GRANT ALL ON public.handoffs TO service_role;
ALTER TABLE public.handoffs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read handoffs" ON public.handoffs FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "staff update handoffs" ON public.handoffs FOR UPDATE TO authenticated USING (public.is_staff(auth.uid()));
CREATE INDEX handoffs_state_idx ON public.handoffs (state, requested_at DESC);
CREATE INDEX handoffs_conversation_idx ON public.handoffs (conversation_id);

-- ===== handoff_events =====
CREATE TABLE public.handoff_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  handoff_id uuid NOT NULL REFERENCES public.handoffs(id) ON DELETE CASCADE,
  actor_profile_id uuid REFERENCES public.profiles(id),
  action text NOT NULL,
  detail text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.handoff_events TO authenticated;
GRANT ALL ON public.handoff_events TO service_role;
ALTER TABLE public.handoff_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read handoff events" ON public.handoff_events FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "staff add handoff events" ON public.handoff_events FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));
CREATE INDEX handoff_events_handoff_idx ON public.handoff_events (handoff_id, created_at);

-- ===== kb_embeddings =====
CREATE TABLE public.kb_embeddings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_kind public.embedding_owner NOT NULL,
  owner_id uuid NOT NULL,
  source_version_id uuid REFERENCES public.source_versions(id) ON DELETE CASCADE,
  content text NOT NULL,
  embedding extensions.vector(1536) NOT NULL,
  model text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_kind, owner_id)
);
GRANT SELECT ON public.kb_embeddings TO authenticated;
GRANT ALL ON public.kb_embeddings TO service_role;
ALTER TABLE public.kb_embeddings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read embeddings" ON public.kb_embeddings FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE INDEX kb_embeddings_vector_idx ON public.kb_embeddings USING hnsw (embedding extensions.vector_cosine_ops);
CREATE INDEX kb_embeddings_version_idx ON public.kb_embeddings (source_version_id);

-- ===== timestamps =====
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER visitors_touch BEFORE UPDATE ON public.visitors FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER conversations_touch BEFORE UPDATE ON public.conversations FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER handoffs_touch BEFORE UPDATE ON public.handoffs FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ===== meaning-based search over approved publications only =====
CREATE OR REPLACE FUNCTION public.search_knowledge_semantic(
  _embedding extensions.vector(1536),
  _limit integer DEFAULT 12
)
RETURNS TABLE (
  owner_kind public.embedding_owner,
  owner_id uuid,
  source_version_id uuid,
  content text,
  similarity double precision
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, extensions AS $$
  SELECT e.owner_kind,
         e.owner_id,
         e.source_version_id,
         e.content,
         1 - (e.embedding <=> _embedding) AS similarity
  FROM public.kb_embeddings e
  JOIN public.source_versions sv ON sv.id = e.source_version_id
  WHERE sv.status = 'approved'
  ORDER BY e.embedding <=> _embedding
  LIMIT GREATEST(1, LEAST(_limit, 50));
$$;
GRANT EXECUTE ON FUNCTION public.search_knowledge_semantic(extensions.vector, integer) TO authenticated, service_role;