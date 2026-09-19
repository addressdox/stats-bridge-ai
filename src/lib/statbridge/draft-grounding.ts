/** A broad database search is a candidate finder, not proof of relevance. */
const generic = new Set("a an the and or of in on for to by from with about at is are was were be been what which how when where who please provide give tell me us you your i we want need know information data statistics statistical statistic official published publication latest recent current south africa african national rate rates number numbers total percentage percent year years quarter quarterly annual report request response media prepare answer enquiry question figure figures".split(" "));

function words(text: string) {
  return text.toLowerCase()
    .replace(/consumer price index|\bcpi\b/g, "inflation")
    .replace(/gross domestic product|\bgdp\b/g, "economic output")
    .replace(/\b(deaths?|died|dying|fatalities|mortality)\b/g, "mortality")
    .replace(/\b(jobless|unemployed|unemployment)\b/g, "unemployment")
    .replace(/\b(births?|fertility)\b/g, "fertility")
    .match(/[\p{L}]+/gu) ?? [];
}

export function hasDraftTopicOverlap(question: string, candidate: string): boolean {
  const terms = words(question).filter((term) => term.length > 2 && !generic.has(term));
  if (!terms.length) return false;
  const document = new Set(words(candidate));
  return terms.some((term) => document.has(term));
}

/** Reject a made-up value even if the model names a real source identifier. */
export function unsupportedDraftNumbers(body: string, citedEvidence: string): string[] {
  const numbers = (text: string) => text.replace(/\b\d{1,3}(?:[ \u00a0\u202f]\d{3})+\b/g, (value) => value.replace(/[ \u00a0\u202f]/g, "")).match(/\d+(?:[,.]\d+)*/g)?.map((value) => value.replace(/,/g, "")) ?? [];
  const supported = new Set(numbers(citedEvidence));
  return [...new Set(numbers(body).filter((value) => !supported.has(value)))];
}

export const INSUFFICIENT_DRAFT_INFORMATION = "I do not have sufficient information in the approved knowledge base to answer this request. A communications official will review the request and identify the relevant source material.";
