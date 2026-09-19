-- Add explicit staff-managed review triggers without changing existing prose policies.
ALTER TABLE public.guidelines
  ADD COLUMN IF NOT EXISTS sensitive_topics text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS complex_topics text[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.guidelines.sensitive_topics IS
  'Staff-approved sensitive topics/phrases, matched against original and translated enquiries. Additive human-review triggers.';
COMMENT ON COLUMN public.guidelines.complex_topics IS
  'Staff-approved complex topics/phrases, matched against original and translated enquiries. Additive human-review triggers.';
