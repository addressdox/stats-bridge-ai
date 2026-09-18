import { expect, test } from "bun:test";
import { validateMediaIntake } from "../src/lib/statbridge/media-intake";
import { runVisitorTool } from "../src/lib/statbridge/tools.server";
const enquiry = { name: "Test Reporter", outlet: "Test Newsroom", contact: "reporter@example.invalid", question: "Please provide a statement about the published unemployment rate.", consent: true };

test("media action asks for missing identity and explicit consent without claiming a case", async () => {
  const reply = await runVisitorTool({ tool: "media", values: { question: enquiry.question, language: "en" } });
  expect(reply?.case_reference).toBe(null);
  expect(reply?.missing_fields).toEqual(["name", "outlet", "contact", "consent"]);
  expect(reply?.spoken).toContain("May we store");
});
test("all requester fields are required even after explicit consent", () => {
  for (const field of ["name", "outlet", "contact"] as const) {
    const result = validateMediaIntake({ ...enquiry, [field]: undefined });
    expect(result.ready).toBe(false);
    if (!result.ready) expect(result.reply.missing_fields).toContain(field);
  }
});
test("missing, false and string consent never become true", () => {
  for (const consent of [undefined, false, "true", "yes"]) {
    const result = validateMediaIntake({ ...enquiry, consent });
    expect(result.ready).toBe(false);
    if (!result.ready) expect(result.reply.case_reference).toBe(null);
  }
});
test("explicitly declined consent is respected rather than logging the request", () => {
  const result = validateMediaIntake({ ...enquiry, consent: false });
  expect(result.ready).toBe(false);
  if (!result.ready) expect(result.reply.spoken).toContain("have not logged");
});
test("legacy missing-detail placeholders do not satisfy intake", () => {
  const result = validateMediaIntake({ ...enquiry, outlet: "Not given", contact: "Not given" });
  expect(result.ready).toBe(false);
  if (!result.ready) expect(result.reply.missing_fields).toEqual(["outlet", "contact"]);
});
test("complete intake preserves actual details and explicit consent", () => {
  const result = validateMediaIntake({ ...enquiry, language: "zu", name: " Test Reporter " });
  expect(result.ready).toBe(true);
  if (result.ready) expect(result.data).toEqual({ ...enquiry, language: "zu", channel: "web" });
});
