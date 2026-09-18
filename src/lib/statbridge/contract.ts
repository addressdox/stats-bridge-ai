/**
 * StatBridge public answer contract, version v1.
 *
 * This is the only shape the browser, the widget and API clients ever see.
 * The AI never produces these objects directly: it proposes evidence ids and
 * plain-language wording, and the server resolves, verifies and builds the
 * blocks below. Unknown block types must fail safely in the renderer.
 */
import { z } from "zod";

export const API_VERSION = "v1";

export const publicSourceReferenceSchema = z.object({
  sourceVersionId: z.string(),
  title: z.string(),
  publisher: z.string(),
  publishedOn: z.string().nullable(),
  referencePeriod: z.string().nullable(),
  versionLabel: z.string(),
  pageNumber: z.number().nullable(),
  sectionLabel: z.string().nullable(),
  url: z.string().nullable(),
});
export type PublicSourceReference = z.infer<typeof publicSourceReferenceSchema>;

const accessibleTableSchema = z.object({
  columns: z.array(z.string()),
  rows: z.array(z.record(z.string(), z.string())),
});
export type AccessibleTableData = z.infer<typeof accessibleTableSchema>;

const seriesSchema = z.object({
  name: z.string(),
  unit: z.string(),
  points: z.array(z.object({ label: z.string(), value: z.number(), displayValue: z.string() })),
});
export type VerifiedPublicSeries = z.infer<typeof seriesSchema>;

export const publicRenderBlockSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("official_quote"),
    text: z.string(),
    source: publicSourceReferenceSchema,
  }),
  z.object({
    type: z.literal("metric"),
    label: z.string(),
    displayValue: z.string(),
    unit: z.string(),
    geography: z.string(),
    referencePeriod: z.string(),
    population: z.string().nullable(),
    adjustment: z.string().nullable(),
    valueState: z.enum(["reported", "missing", "suppressed", "not_applicable"]),
    reportedChange: z.string().nullable(),
    comparabilityNote: z.string().nullable(),
    source: publicSourceReferenceSchema,
  }),
  z.object({
    type: z.literal("comparison_table"),
    title: z.string(),
    columns: z.array(z.string()),
    rows: z.array(z.record(z.string(), z.string())),
    sources: z.array(publicSourceReferenceSchema),
  }),
  z.object({
    type: z.literal("chart"),
    title: z.string(),
    chartType: z.enum(["bar", "line"]),
    series: z.array(seriesSchema),
    table: accessibleTableSchema,
    sources: z.array(publicSourceReferenceSchema),
  }),
  z.object({
    type: z.literal("document"),
    title: z.string(),
    publisher: z.string(),
    publishedOn: z.string().nullable(),
    referencePeriod: z.string().nullable(),
    pageNumber: z.number().nullable(),
    sectionLabel: z.string().nullable(),
    excerpt: z.string().nullable(),
    url: z.string().nullable(),
  }),
  z.object({
    type: z.literal("definition"),
    term: z.string(),
    officialText: z.string(),
    explanation: z.string(),
    source: publicSourceReferenceSchema,
  }),
  z.object({
    type: z.literal("caveat"),
    severity: z.enum(["information", "important"]),
    text: z.string(),
    source: publicSourceReferenceSchema.nullable(),
  }),
  z.object({
    type: z.literal("clarification"),
    question: z.string(),
    choices: z.array(z.object({ label: z.string(), value: z.string() })),
  }),
  z.object({
    type: z.literal("gap"),
    text: z.string(),
    suggestion: z.string().nullable(),
  }),
  z.object({
    type: z.literal("case_acknowledgement"),
    reference: z.string(),
    statusUrl: z.string(),
    message: z.string(),
  }),
  z.object({
    type: z.literal("follow_up_actions"),
    questions: z.array(z.string()).max(3),
  }),
  /** A published figure or map image carried by an approved publication. */
  z.object({
    type: z.literal("image"),
    title: z.string(),
    url: z.string(),
    alternativeText: z.string(),
    caption: z.string().nullable(),
    source: publicSourceReferenceSchema,
  }),
  /** A published video or briefing recording linked from an approved source. */
  z.object({
    type: z.literal("video"),
    title: z.string(),
    url: z.string(),
    /** Direct file playback is only offered for a media file we can play. */
    playback: z.enum(["file", "link"]),
    caption: z.string().nullable(),
    source: publicSourceReferenceSchema,
  }),
  /** Verified figures offered as downloadable data (CSV or Excel-readable). */
  z.object({
    type: z.literal("dataset"),
    title: z.string(),
    fileName: z.string(),
    columns: z.array(z.string()),
    rows: z.array(z.record(z.string(), z.string())),
    rowCount: z.number(),
    sources: z.array(publicSourceReferenceSchema),
  }),
]);
export type PublicRenderBlock = z.infer<typeof publicRenderBlockSchema>;

export const KNOWN_BLOCK_TYPES = [
  "official_quote",
  "metric",
  "comparison_table",
  "chart",
  "document",
  "definition",
  "caveat",
  "clarification",
  "gap",
  "case_acknowledgement",
  "follow_up_actions",
  "image",
  "video",
  "dataset",
] as const;

export const answerOutcomes = ["answered", "clarification", "gap", "escalated", "error"] as const;
export type AnswerOutcome = (typeof answerOutcomes)[number];

/** The single answer record every door returns. */
export const publicAnswerSchema = z.object({
  apiVersion: z.literal(API_VERSION),
  answerRef: z.string(),
  question: z.string(),
  outcome: z.enum(answerOutcomes),
  readingLevel: z.enum(["short", "detailed"]),
  /** Official Stats SA material. Verified, never written by the model. */
  officialBlocks: z.array(publicRenderBlockSchema),
  /** Plain-language wording produced by the assistant. Always labelled. */
  aiExplanation: z.string().nullable(),
  caveats: z.array(z.string()),
  followUps: z.array(z.string()).max(3),
  references: z.array(publicSourceReferenceSchema),
  clarification: z
    .object({ question: z.string(), choices: z.array(z.object({ label: z.string(), value: z.string() })) })
    .nullable(),
  gapDescription: z.string().nullable(),
  caseReference: z.string().nullable(),
  statusToken: z.string().nullable(),
  reviewReasons: z.array(z.string()),
  provider: z.object({ name: z.string(), model: z.string() }).nullable(),
  createdAt: z.string(),
});
export type PublicAnswer = z.infer<typeof publicAnswerSchema>;

export const askRequestSchema = z.object({
  question: z.string().trim().min(3, "Please type a question.").max(1000),
  readingLevel: z.enum(["short", "detailed"]).default("short"),
  language: z.string().default("en"),
  channel: z.enum(["web", "widget", "api"]).default("web"),
  siteKey: z.string().nullish(),
  parentAnswerRef: z.string().nullish(),
  conversationId: z.string().uuid().nullish(),
  browserToken: z.string().trim().min(8).max(80).nullish(),
});
export type AskRequest = z.infer<typeof askRequestSchema>;

export const escalateRequestSchema = z.object({
  answerRef: z.string().nullish(),
  question: z.string().trim().min(3).max(1000),
  contact: z.string().trim().max(200).nullish(),
  consent: z.boolean().default(false),
  channel: z.enum(["web", "widget", "api"]).default("web"),
});

export const mediaQueryRequestSchema = z.object({
  name: z.string().trim().min(2, "Please give your name.").max(120),
  outlet: z.string().trim().min(2, "Please give your media outlet.").max(160),
  contact: z.string().trim().min(5, "Please give an email address or phone number.").max(200),
  deadline: z.string().nullish(),
  question: z.string().trim().min(10, "Please describe your request.").max(4000),
  consent: z.literal(true, { errorMap: () => ({ message: "Consent is required." }) }),
  channel: z.enum(["web", "widget", "api"]).default("web"),
});
export type MediaQueryRequest = z.infer<typeof mediaQueryRequestSchema>;

export const caseStatusRequestSchema = z.object({
  reference: z.string().trim().min(3).max(40),
  token: z.string().trim().min(10).max(200),
});

export const caseStatusSchema = z.object({
  reference: z.string(),
  status: z.enum(["received", "draft_prepared", "in_review", "changes_requested", "approved", "released", "rejected"]),
  statusLabel: z.string(),
  receivedAt: z.string(),
  deadlineAt: z.string().nullable(),
  releasedAt: z.string().nullable(),
  releasedBody: z.string().nullable(),
  releasedReferences: z.array(
    z.object({
      title: z.string(),
      publisher: z.string(),
      published_on: z.string().nullable(),
      reference_period: z.string().nullable(),
      url: z.string().nullable(),
      version_label: z.string(),
    }),
  ),
  closedReason: z.string().nullable(),
});
export type CaseStatus = z.infer<typeof caseStatusSchema>;

export const CASE_STATUS_LABELS: Record<CaseStatus["status"], string> = {
  received: "Received",
  draft_prepared: "A reply is being prepared",
  in_review: "With a communications official for review",
  changes_requested: "With a communications official for review",
  approved: "Approved, awaiting release",
  released: "Released",
  rejected: "Closed without a reply",
};

export const REVIEW_REASON_LABELS: Record<string, string> = {
  media: "Media request",
  sensitive: "Sensitive subject",
  complex: "Complex request",
  interpretation: "Asks for interpretation",
  formal_approval: "Asks for an official position",
  ambiguous: "Unclear request",
  low_confidence: "Low confidence in the evidence",
  gap: "Not covered by approved sources",
};
