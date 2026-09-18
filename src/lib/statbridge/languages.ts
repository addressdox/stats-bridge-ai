/** Shared language identifiers. Sign language is visual, never a speech voice. */
export const SOUTH_AFRICAN_LANGUAGES = [
  { code: "en", name: "English", locale: "en-ZA", spoken: true },
  { code: "af", name: "Afrikaans", locale: "af-ZA", spoken: true },
  { code: "zu", name: "isiZulu", locale: "zu-ZA", spoken: true },
  { code: "xh", name: "isiXhosa", locale: "xh-ZA", spoken: true },
  { code: "nso", name: "Sepedi", locale: "nso-ZA", spoken: true },
  { code: "st", name: "Sesotho", locale: "st-ZA", spoken: true },
  { code: "tn", name: "Setswana", locale: "tn-ZA", spoken: true },
  { code: "ss", name: "siSwati", locale: "ss-ZA", spoken: true },
  { code: "ve", name: "Tshivenda", locale: "ve-ZA", spoken: true },
  { code: "ts", name: "Xitsonga", locale: "ts-ZA", spoken: true },
  { code: "nr", name: "isiNdebele", locale: "nr-ZA", spoken: true },
  { code: "sfs", name: "South African Sign Language", locale: "sfs-ZA", spoken: false },
] as const;

export type SouthAfricanLanguage = (typeof SOUTH_AFRICAN_LANGUAGES)[number]["code"];

const aliases: Record<string, SouthAfricanLanguage> = {
  eng: "en",
  afr: "af",
  zul: "zu",
  xho: "xh",
  sot: "st",
  tsn: "tn",
  ssw: "ss",
  ven: "ve",
  tso: "ts",
  nbl: "nr",
  pedi: "nso",
  sepedi: "nso",
  "northern sotho": "nso",
  sesotho: "st",
  "southern sotho": "st",
  tswana: "tn",
  swati: "ss",
  swazi: "ss",
  venda: "ve",
  tsonga: "ts",
  xitsonga: "ts",
  zulu: "zu",
  xhosa: "xh",
  ndebele: "nr",
  "southern ndebele": "nr",
  sasl: "sfs",
};

export function normalizeLanguage(value?: string | null): SouthAfricanLanguage | "auto" {
  const key = (value ?? "").trim().toLowerCase().replace(/_/g, "-");
  if (!key || key === "auto") return "auto";
  const match = SOUTH_AFRICAN_LANGUAGES.find(
    (l) => l.code === key || l.locale.toLowerCase() === key || l.name.toLowerCase() === key,
  );
  return match?.code ?? aliases[key] ?? aliases[key.split("-")[0]!] ?? "auto";
}

export function officialLanguageName(value?: string | null): string {
  const code = normalizeLanguage(value);
  return (
    SOUTH_AFRICAN_LANGUAGES.find((l) => l.code === code)?.name ?? "the language used by the person"
  );
}

export function languageInstruction(value?: string | null): string {
  const code = normalizeLanguage(value);
  if (code === "sfs")
    return "South African Sign Language requires visual signing; do not pretend that text or audio is SASL. Offer the written conversation and human assistance.";
  return `Write all user-facing explanation, clarification, gap messages and follow-up questions in ${officialLanguageName(code)}. Follow the user's language and natural code-switching; do not default back to English because the evidence is English. Preserve quoted source text, publication titles, evidence identifiers, dates and numeric values exactly; distinguish translated explanation from original official wording. Do not translate JSON field names or enum values.`;
}
