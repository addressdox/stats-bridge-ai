import { mediaQueryRequestSchema, type MediaQueryRequest } from "./contract";

type MediaIntakeResult =
  | { ready: true; data: MediaQueryRequest }
  | { ready: false; reply: { spoken: string; missing_fields: string[]; case_reference: null } };

/** A voice/tool call must meet the same intake requirements as the media form. */
export function validateMediaIntake(values: Record<string, unknown>): MediaIntakeResult {
  const parsed = mediaQueryRequestSchema.safeParse(values);
  const missing = parsed.success
    ? []
    : [...new Set(parsed.error.issues.map((issue) => String(issue.path[0])))];
  for (const field of ["name", "outlet", "contact"] as const) {
    const value = values[field];
    if (
      typeof value === "string" &&
      /^(?:not given|unknown|not provided|n\/a)$/i.test(value.trim()) &&
      !missing.includes(field)
    )
      missing.push(field);
  }
  if (parsed.success && missing.length === 0) return { ready: true, data: parsed.data };
  if (values["consent"] === false)
    return {
      ready: false,
      reply: {
        spoken:
          "I have not logged the media enquiry because permission to store your contact details was not given. You can continue using public information without submitting a media enquiry.",
        missing_fields: missing,
        case_reference: null,
      },
    };
  const labels: Record<string, string> = {
    name: "your name",
    outlet: "your media outlet",
    contact: "a valid email address for the official response",
    question: "the details of your media enquiry",
    language: "your preferred language",
    deadline: "your deadline",
    channel: "the submission channel",
  };
  const details = missing
    .filter((field) => field !== "consent")
    .map((field) => labels[field] ?? field);
  const requests = [
    details.length ? `Please give ${details.join(", ")}.` : "",
    missing.includes("consent")
      ? "May we store your name, outlet and contact details to process this media enquiry and let an official respond?"
      : "",
  ].filter(Boolean);
  return {
    ready: false,
    reply: { spoken: requests.join(" "), missing_fields: missing, case_reference: null },
  };
}
