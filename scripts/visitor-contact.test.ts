import { expect, test } from "bun:test";
import { validateVisitorContact } from "../src/lib/statbridge/visitor-contact";
import { runVisitorTool } from "../src/lib/statbridge/tools.server";
import { readConversationVisitor } from "../src/lib/statbridge/visitor-contact.server";

const details = {
  full_name: "AddressDox Demonstration Caller",
  email: "voice-test@example.invalid",
  consent: true,
};

test("contact handler asks for name, contact and permission without saving invented details", async () => {
  const result = await runVisitorTool({
    tool: "contact",
    spoken: true,
    values: { language: "en" },
  });
  expect(result?.saved).toBe(false);
  expect(result?.missing_fields).toEqual(["full_name", "consent", "contact"]);
  expect(result?.spoken).toContain("May we store");
});

test("contact handler never treats absent, false or string permission as consent", async () => {
  for (const consent of [undefined, false, "true", "yes"]) {
    const result = await runVisitorTool({
      tool: "contact",
      spoken: true,
      values: { ...details, consent, language: "en" },
    });
    expect(result?.saved).toBe(false);
    expect(result?.missing_fields).toContain("consent");
  }
});

test("real name and at least one valid contact method are required", () => {
  for (const override of [
    { full_name: "Caller" },
    { full_name: "Not given" },
    { email: "Unknown" },
    { email: "not-an-email" },
    { email: undefined, phone: "callback" },
  ])
    expect(validateVisitorContact({ ...details, ...override }).ready).toBe(false);
  for (const override of [{}, { email: undefined, phone: "+27 (11) 555 0100" }])
    expect(validateVisitorContact({ ...details, ...override }).ready).toBe(true);
});

test("valid spoken details preserve the caller's name and explicit consent", () => {
  const result = validateVisitorContact({ ...details, full_name: ` ${details.full_name} ` });
  expect(result.ready).toBe(true);
  if (result.ready)
    expect(result.contact).toMatchObject({
      fullName: details.full_name,
      email: details.email,
      consent: true,
    });
});

test("placeholder call identifiers are rejected before database access", async () => {
  const db = {
    from: () => {
      throw new Error("A placeholder must never be queried");
    },
  };
  for (const context of [
    { conversationId: null, browserToken: "test-browser-token" },
    { conversationId: "none", browserToken: "test-browser-token" },
    { conversationId: crypto.randomUUID(), browserToken: "voice-agent-anonymous" },
    { conversationId: crypto.randomUUID(), browserToken: "none" },
  ])
    expect(await readConversationVisitor(db as never, context)).toBe(null);
});

test("a browser token cannot attach contact or handoff to another visitor's call", async () => {
  let visitorRead = false;
  const db = {
    from(table: string) {
      if (table === "visitors") visitorRead = true;
      const query = {
        select: () => query,
        eq: () => query,
        maybeSingle: async () => ({
          data: { visitor_id: table === "conversations" ? "someone-else" : "caller" },
        }),
      };
      return query;
    },
  };
  expect(
    await readConversationVisitor(db as never, {
      conversationId: crypto.randomUUID(),
      browserToken: "actual-browser-token",
    }),
  ).toBe(null);
  expect(visitorRead).toBe(false);
});

test("human handler with no genuine call never claims a handoff was created", async () => {
  const result = await runVisitorTool({
    tool: "human",
    spoken: true,
    values: { language: "en", summary: "Please connect me to an official" },
  });
  expect(result?.handoff_id).toBe(null);
  expect(result?.spoken).not.toContain("have logged");
});
