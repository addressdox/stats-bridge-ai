import { expect, test } from "bun:test";
import { handleLiveVoiceTool } from "../src/routes/api/voice/tool";
import {
  functionDeclarations,
  LIVE_VOICE_TOOL_ACTIONS,
} from "../src/lib/statbridge/live-voice-tools";
import { runVisitorTool } from "../src/lib/statbridge/tools.server";
import type { PublicAnswer } from "../src/lib/statbridge/contract";

const conversationId = "68e34740-2110-457f-9e64-7b5e45b4a348";
const browserToken = "actual-browser-token";
const request = (body: unknown) =>
  new Request("http://localhost/api/voice/tool", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
const payload = {
  conversationId,
  browserToken,
  name: "answer_question",
  args: { question: "Lithini izinga?", language: "zu" },
};

test("live tool boundary refuses unknown/malformed calls before ownership lookup or execution", async () => {
  let checked = 0,
    ran = 0;
  const deps = {
    ownsConversation: async () => {
      checked++;
      return true;
    },
    runTool: async () => {
      ran++;
      return {};
    },
  };
  for (const body of [
    null,
    { ...payload, name: "release_case" },
    { ...payload, conversationId: "none" },
    { ...payload, args: null },
  ])
    expect((await handleLiveVoiceTool(request(body), deps)).status).toBe(400);
  expect(checked).toBe(0);
  expect(ran).toBe(0);
});

test("every declared tool requires owned conversation before its action runs", async () => {
  let ran = 0;
  for (const name of Object.keys(LIVE_VOICE_TOOL_ACTIONS)) {
    const response = await handleLiveVoiceTool(request({ ...payload, name }), {
      ownsConversation: async (id, token) => {
        expect(id).toBe(conversationId);
        expect(token).toBe(browserToken);
        return false;
      },
      runTool: async () => {
        ran++;
        return {};
      },
    });
    expect(response.status).toBe(403);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  }
  expect(ran).toBe(0);
});

test("model arguments cannot override verified session, action, channel or prior answer", async () => {
  let passed: Record<string, unknown> | null = null;
  const result = { spoken: "A checked response", answer_ref: "ANS-demo" };
  const response = await handleLiveVoiceTool(
    request({
      ...payload,
      args: {
        ...payload.args,
        conversationId: "other",
        conversation_id: "other",
        browserToken: "other",
        browser_token: "other",
        tool: "media",
        channel: "api",
        spoken: false,
        parentAnswerRef: "ANS-stolen",
        parent_answer_ref: "ANS-stolen",
      },
    }),
    {
      ownsConversation: async () => true,
      runTool: async (input) => {
        passed = input;
        return result;
      },
    },
  );
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ result });
  expect(passed).toEqual({
    tool: "answer",
    conversationId,
    browserToken,
    channel: "web",
    spoken: true,
    values: payload.args,
  });
});

test("journalist name remains legitimate media data", async () => {
  let passed: Record<string, unknown> = {};
  await handleLiveVoiceTool(
    request({
      ...payload,
      name: "log_media_enquiry",
      args: { name: "Demo Reporter", consent: true },
    }),
    {
      ownsConversation: async () => true,
      runTool: async (input) => {
        passed = input.values;
        return { case_reference: "DEMO" };
      },
    },
  );
  expect(passed).toEqual({ name: "Demo Reporter", consent: true });
});

test("upstream failure text and credentials never escape the tool boundary", async () => {
  const response = await handleLiveVoiceTool(request(payload), {
    ownsConversation: async () => true,
    runTool: async () => {
      throw new Error("PRIVATE_API_KEY provider stack and private draft");
    },
  });
  expect(response.status).toBe(502);
  expect(await response.text()).not.toContain("PRIVATE");
});

test("declarations include all eleven spoken codes, explicit consent and no model session authority", () => {
  expect(functionDeclarations.map((tool) => tool.name)).toEqual(
    Object.keys(LIVE_VOICE_TOOL_ACTIONS),
  );
  for (const tool of functionDeclarations) {
    expect(tool.parameters.properties.language.enum).toEqual([
      "auto",
      "en",
      "af",
      "zu",
      "xh",
      "nso",
      "st",
      "tn",
      "ss",
      "ve",
      "ts",
      "nr",
    ]);
    expect(tool.parameters.properties).not.toHaveProperty("conversation_id");
    expect(tool.parameters.properties).not.toHaveProperty("browser_token");
  }
  for (const name of ["save_contact", "log_media_enquiry"]) {
    const tool = functionDeclarations.find((item) => item.name === name)!;
    expect(tool.parameters.required).toContain("consent");
    expect(tool.parameters.properties.consent).not.toHaveProperty("default");
  }
});

const answer: PublicAnswer = {
  apiVersion: "v1",
  answerRef: "ANS-current",
  question: "And the previous quarter?",
  language: "en",
  outcome: "answered",
  readingLevel: "short",
  aiExplanation: null,
  officialBlocks: [
    {
      type: "definition",
      term: "Unemployment",
      officialText: "The official published definition.",
    } as never,
  ],
  caveats: [],
  followUps: [],
  references: [],
  clarification: null,
  gapDescription: null,
  caseReference: null,
  statusToken: null,
  reviewReasons: [],
  provider: null,
  createdAt: "2026-09-18",
};

function database(owned = true, priorPublic = true) {
  const reads: Array<{ table: string; operation: string; key?: string; value?: unknown }> = [];
  const writes: Array<{ table: string; value: Record<string, unknown> }> = [];
  const db = {
    from(table: string) {
      const query: Record<string, unknown> = {
        select(value: unknown) {
          reads.push({ table, operation: "select", value });
          return query;
        },
        eq(key: string, value: unknown) {
          reads.push({ table, operation: "eq", key, value });
          return query;
        },
        in(key: string, value: unknown) {
          reads.push({ table, operation: "in", key, value });
          return query;
        },
        is(key: string, value: unknown) {
          reads.push({ table, operation: "is", key, value });
          return query;
        },
        not() {
          return query;
        },
        order() {
          return query;
        },
        limit() {
          return query;
        },
        insert(value: Record<string, unknown>) {
          writes.push({ table, value });
          return query;
        },
        update(value: Record<string, unknown>) {
          writes.push({ table, value });
          return query;
        },
        async maybeSingle() {
          const data =
            table === "visitor_identifiers"
              ? { visitor_id: "caller" }
              : table === "conversations"
                ? { visitor_id: owned ? "caller" : "other" }
                : table === "visitors"
                  ? { id: "caller", full_name: "Demo", consent_given: true }
                  : table === "conversation_turns"
                    ? { answer_id: "prior" }
                    : table === "answers" && priorPublic
                      ? { public_ref: "ANS-owned-previous" }
                      : null;
          return { data, error: null };
        },
        async single() {
          return { data: { id: table === "answers" ? "current-answer" : "new-turn" }, error: null };
        },
        then(resolve: (value: unknown) => unknown) {
          return Promise.resolve({ data: null, error: null, count: 2 }).then(resolve);
        },
      };
      return query;
    },
  };
  return { db: db as never, reads, writes };
}

test("voice follow-up reuses only this owned conversation's prior public question and speaks official blocks", async () => {
  const { db, reads, writes } = database();
  let input: Record<string, unknown> = {};
  const result = await runVisitorTool(
    {
      tool: "answer",
      conversationId,
      browserToken,
      spoken: true,
      values: {
        question: "And the previous quarter?",
        language: "en",
        parentAnswerRef: "ANS-model-override",
      },
    },
    {
      getAdminClient: async () => db,
      runAsk: async (next) => {
        input = next;
        return answer;
      },
    },
  );
  expect(input.parentAnswerRef).toBe("ANS-owned-previous");
  expect(input.question).toBe("And the previous quarter?");
  expect(result?.spoken).toBe("The official published definition.");
  expect(
    writes.some(
      (write) =>
        write.table === "conversation_turns" &&
        write.value.author === "assistant" &&
        write.value.body === result?.spoken,
    ),
  ).toBe(true);
  expect(reads).toContainEqual({ table: "answers", operation: "is", key: "case_id", value: null });
  expect(reads).toContainEqual({
    table: "answers",
    operation: "eq",
    key: "review_flag",
    value: "none",
  });
});

test("legacy answer tool cannot read or overwrite another visitor's conversation context", async () => {
  const { db, reads, writes } = database(false);
  let parent: unknown = "not-called";
  await runVisitorTool(
    { tool: "answer", conversationId, browserToken, values: { question: "And before?" } },
    {
      getAdminClient: async () => db,
      runAsk: async (next) => {
        parent = next.parentAnswerRef;
        return answer;
      },
    },
  );
  expect(parent).toBe(null);
  expect(reads.some((read) => read.table === "conversation_turns")).toBe(false);
  expect(writes).toEqual([]);
});

test("a previous reviewed/private case is not reused as public voice context", async () => {
  const { db } = database(true, false);
  let parent: unknown = "not-called";
  await runVisitorTool(
    { tool: "answer", conversationId, browserToken, values: { question: "And before?" } },
    {
      getAdminClient: async () => db,
      runAsk: async (next) => {
        parent = next.parentAnswerRef;
        return answer;
      },
    },
  );
  expect(parent).toBe(null);
});

test("escalated voice answer speaks and records acknowledgement only", async () => {
  const { db, writes } = database();
  const result = await runVisitorTool(
    {
      tool: "answer",
      conversationId,
      browserToken,
      values: { question: "Please issue an official statement" },
    },
    {
      getAdminClient: async () => db,
      runAsk: async () => ({
        ...answer,
        outcome: "escalated",
        aiExplanation: "PRIVATE DRAFT",
        officialBlocks: [
          {
            type: "case_acknowledgement",
            reference: "DEMO",
            statusUrl: "/case",
            message: "Your request awaits review.",
          },
        ],
      }),
    },
  );
  expect(result?.spoken).toBe("Your request awaits review.");
  expect(JSON.stringify(writes)).not.toContain("PRIVATE DRAFT");
});
