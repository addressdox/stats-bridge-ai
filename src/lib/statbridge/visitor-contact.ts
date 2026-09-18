import { z } from "zod";
import type { ContactDetails } from "./visitors.server";

const suppliedText = (value: unknown) =>
  typeof value === "string" &&
  !/^(?:caller|unknown|none|not given|not provided|n\/a)$/i.test(value.trim())
    ? value.trim()
    : "";

const contactSchema = z
  .object({
    full_name: z.string().min(1).max(120),
    email: z.string().email().max(200).optional(),
    phone: z
      .string()
      .min(6)
      .max(40)
      .regex(/^[+\d\s().-]+$/)
      .refine((value) => value.replace(/\D/g, "").length >= 6)
      .optional(),
    organisation: z.string().max(200).optional(),
    address: z.string().max(400).optional(),
    consent: z.literal(true),
  })
  .refine((value) => Boolean(value.email || value.phone), { path: ["contact"] });

/** Contact storage needs the caller's actual details and an explicit spoken yes. */
export function validateVisitorContact(
  values: Record<string, unknown>,
):
  | { ready: true; contact: ContactDetails }
  | { ready: false; reply: { spoken: string; saved: false; missing_fields: string[] } } {
  const parsed = contactSchema.safeParse({
    full_name: suppliedText(values["full_name"]),
    email: suppliedText(values["email"]) || undefined,
    phone: suppliedText(values["phone"]) || undefined,
    organisation: suppliedText(values["organisation"]) || undefined,
    address: suppliedText(values["address"]) || undefined,
    consent: values["consent"],
  });
  if (parsed.success)
    return {
      ready: true,
      contact: {
        fullName: parsed.data.full_name,
        email: parsed.data.email,
        phone: parsed.data.phone,
        organisation: parsed.data.organisation,
        address: parsed.data.address,
        consent: true,
      },
    };
  const missing = [...new Set(parsed.error.issues.map((issue) => String(issue.path[0])))];
  if (
    !suppliedText(values["email"]) &&
    !suppliedText(values["phone"]) &&
    !missing.includes("contact")
  )
    missing.push("contact");
  if (values["consent"] === false)
    return {
      ready: false,
      reply: {
        spoken:
          "I have not saved your details because you did not give permission. You can still ask for public information without providing them.",
        saved: false,
        missing_fields: missing,
      },
    };
  const labels: Record<string, string> = {
    full_name: "your name",
    email: "a valid email address",
    phone: "a valid phone number",
    contact: "an email address or phone number",
    organisation: "your organisation",
    address: "your address",
  };
  const details = missing
    .filter((field) => field !== "consent")
    .map((field) => labels[field] ?? field);
  return {
    ready: false,
    reply: {
      spoken: [
        details.length ? `Please tell me ${details.join(", ")}.` : "",
        missing.includes("consent")
          ? "May we store your name and contact details so the Stats SA desk can follow up on your request?"
          : "",
      ]
        .filter(Boolean)
        .join(" "),
      saved: false,
      missing_fields: missing,
    },
  };
}
