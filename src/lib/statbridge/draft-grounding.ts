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

/** Compare values without changing their precision or the source's printed wording. */
function normalizedNumber(token: string): string {
  let integer = token;
  let fraction = "";
  if (token.includes(",") && token.includes(".")) {
    // Both 1,234.56 and 1.234,56 have an unambiguous final decimal separator.
    const decimal = token.lastIndexOf(",") > token.lastIndexOf(".") ? "," : ".";
    const grouping = decimal === "," ? "." : ",";
    const position = token.lastIndexOf(decimal);
    const whole = token.slice(0, position);
    fraction = token.slice(position + 1);
    const groups = whole.split(grouping);
    if (!/^\d+$/.test(fraction) || !/^\d{1,3}$/.test(groups[0]!) ||
      groups.slice(1).some((group) => !/^\d{3}$/.test(group))) return token;
    integer = groups.join("");
  } else if (/^\d+,\d{1,2}$/.test(token)) {
    // Stats SA publishes rates such as 2,12; removing that comma would turn
    // the value into 212 and falsely reject a correctly worded 2.12 answer.
    [integer, fraction] = token.split(",") as [string, string];
  } else if (/^\d{1,3}(?:,\d{3})+$/.test(token)) {
    integer = token.replace(/,/g, "");
  } else if (/^\d+\.\d+$/.test(token)) {
    [integer, fraction] = token.split(".") as [string, string];
  } else if (/^\d{1,3}(?:\.\d{3}){2,}$/.test(token)) {
    integer = token.replace(/\./g, "");
  } else if (!/^\d+$/.test(token)) {
    // Do not reinterpret malformed or otherwise ambiguous punctuation.
    return token;
  }
  integer = integer.replace(/^0+(?=\d)/, "");
  fraction = fraction.replace(/0+$/, "");
  return fraction ? `${integer}.${fraction}` : integer;
}

/** Reject a made-up value even if the model names a real source identifier. */
export function unsupportedDraftNumbers(body: string, citedEvidence: string): string[] {
  const numbers = (text: string) => text.replace(/\b\d{1,3}(?:[ \u00a0\u202f]\d{3})+\b/g, (value) => value.replace(/[ \u00a0\u202f]/g, "")).match(/\d+(?:[,.]\d+)*/g)?.map(normalizedNumber) ?? [];
  const supported = new Set(numbers(citedEvidence));
  return [...new Set(numbers(body).filter((value) => !supported.has(value)))];
}

export const INSUFFICIENT_DRAFT_INFORMATION = "I do not have sufficient information in the approved knowledge base to answer this request. A communications official will review the request and identify the relevant source material.";
