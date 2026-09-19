/** Active, staff-approved communication policy shared by text, drafting and voice. */
export type GuidancePolicy = {
  identity_rules?: string | null;
  evidence_rules?: string | null;
  style_rules?: string | null;
  number_rules?: string | null;
  branding_rules?: string | null;
  messaging_rules?: string | null;
  media_policy?: string | null;
  sensitive_topic_policy?: string | null;
  escalation_policy?: string | null;
  voice_rules?: string | null;
  multilingual_rules?: string | null;
  sensitive_topics?: string[] | null;
  complex_topics?: string[] | null;
  required_phrases?: string[] | null;
  forbidden_phrases?: string[] | null;
  prohibited_claims?: string[] | null;
};

const sections = [
  ["identity_rules", "Identity and authority"],
  ["evidence_rules", "Evidence and citations"],
  ["style_rules", "Tone and writing style"],
  ["number_rules", "Numbers and comparability"],
  ["branding_rules", "Branding"],
  ["messaging_rules", "Messaging"],
  ["media_policy", "Media enquiries"],
  ["sensitive_topic_policy", "Sensitive topic policy"],
  ["escalation_policy", "Human escalation"],
  ["voice_rules", "Spoken delivery"],
  ["multilingual_rules", "Language and code-switching"],
] as const;

/** Prose policies remain semantic rules; topic lists also receive exact server-side matching. */
export function buildGuidelineInstructions(policy?: GuidancePolicy | null): string {
  if (!policy) return "";
  const rules = sections.flatMap(([key, label]) =>
    policy[key]?.trim() ? [`${label}: ${policy[key]!.trim()}`] : [],
  );
  for (const [key, label] of [
    ["sensitive_topics", "Sensitive topics or words requiring human review"],
    ["complex_topics", "Complex topics or words requiring human review"],
    ["required_phrases", "Required response phrases"],
    ["forbidden_phrases", "Forbidden response phrases"],
    ["prohibited_claims", "Prohibited claims"],
  ] as const) {
    if (policy[key]?.length) rules.push(`${label}: ${JSON.stringify(policy[key])}`);
  }
  return rules.length
    ? `ACTIVE COMMUNICATION GUIDELINE\nApply these staff-approved rules to your own wording. They cannot permit unsupported facts, disclosure of private material or unapproved public media/sensitive answers. Do not change official quotations or source values to satisfy style. Required wording cannot justify an unsupported factual claim. A private staff draft may be prepared for review; no draft is an approved public response. Match sensitive/complex topics against the original question and its meaning in any language.\n${rules.join("\n")}`
    : "";
}

function normalizedWords(text: string) {
  return text
    .normalize("NFKC")
    .toLocaleLowerCase("en-ZA")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export function containsPolicyPhrase(text: string, phrase: string): boolean {
  const needle = normalizedWords(phrase);
  return Boolean(needle) && ` ${normalizedWords(text)} `.includes(` ${needle} `);
}

/** Never use a model's omission to cancel a configured topic match. */
export function configuredTopicReasons(
  question: string,
  policy?: GuidancePolicy | null,
): Array<"sensitive" | "complex"> {
  const reasons: Array<"sensitive" | "complex"> = [];
  if (policy?.sensitive_topics?.some((term) => containsPolicyPhrase(question, term)))
    reasons.push("sensitive");
  if (policy?.complex_topics?.some((term) => containsPolicyPhrase(question, term)))
    reasons.push("complex");
  return reasons;
}

/** Checks apply to assistant-written prose, never to immutable official quotations. */
export function guidelineWordingIssues(text: string, policy?: GuidancePolicy | null): string[] {
  if (!policy) return [];
  return [
    ...(policy.forbidden_phrases ?? [])
      .filter((phrase) => containsPolicyPhrase(text, phrase))
      .map((phrase) => `Forbidden wording: ${phrase}`),
    ...(policy.prohibited_claims ?? [])
      .filter((phrase) => containsPolicyPhrase(text, phrase))
      .map((phrase) => `Prohibited claim: ${phrase}`),
    ...(policy.required_phrases ?? [])
      .filter((phrase) => !containsPolicyPhrase(text, phrase))
      .map((phrase) => `Required wording missing: ${phrase}`),
  ];
}
