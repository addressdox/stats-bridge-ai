import { createFileRoute } from "@tanstack/react-router";

import { SiteFooter, SiteHeader } from "@/components/statbridge/SiteChrome";

const title = "Developers — Naledi API and widget";
const description =
  "Documented v1 API and embeddable widget for Naledi. The same checked answer record is returned to the web app, the widget and API clients.";

export const Route = createFileRoute("/developers")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DevelopersPage,
});

function Code({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-lg border border-border bg-primary p-4 text-xs leading-relaxed text-primary-foreground">
      <code>{children}</code>
    </pre>
  );
}

function Endpoint({
  method,
  path,
  summary,
  body,
  returns,
}: {
  method: string;
  path: string;
  summary: string;
  body: string;
  returns: string;
}) {
  return (
    <div className="surface-panel p-4">
      <p className="flex flex-wrap items-center gap-2">
        <span className="rounded bg-accent px-2 py-0.5 text-xs font-bold text-accent-foreground">{method}</span>
        <code className="font-mono text-sm font-semibold">{path}</code>
      </p>
      <p className="mt-2 text-sm text-muted-foreground">{summary}</p>
      <dl className="mt-3 grid gap-2 text-xs">
        <div>
          <dt className="font-semibold">Request body</dt>
          <dd className="mt-1 font-mono text-muted-foreground">{body}</dd>
        </div>
        <div>
          <dt className="font-semibold">Returns</dt>
          <dd className="mt-1 font-mono text-muted-foreground">{returns}</dd>
        </div>
      </dl>
    </div>
  );
}

function DevelopersPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12">
        <h1 className="text-3xl font-semibold tracking-tight">Developers</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
          Naledi exposes one checked answer record. The web app, the embeddable widget and any API client all
          receive the same shape, with official evidence and the AI-written explanation kept in separate fields so you
          can present them differently.
        </p>

        <section className="mt-10">
          <h2 className="text-xl font-semibold tracking-tight">Endpoints</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Base path <code className="font-mono">/api/public/v1</code>. Version is also returned in every body as{" "}
            <code className="font-mono">apiVersion</code>.
          </p>
          <div className="mt-4 space-y-3">
            <Endpoint
              method="POST"
              path="/api/public/v1/ask"
              summary="Ask a question. Returns a referenced answer, a clarifying question, an honest gap, or an escalation with a case reference."
              body="{ question, readingLevel?, language?, siteKey? }"
              returns="Answer"
            />
            <Endpoint
              method="POST"
              path="/api/public/v1/escalate"
              summary="Send a question to a communications official."
              body="{ question, contact?, consent? }"
              returns="Answer with caseReference and statusToken"
            />
            <Endpoint
              method="POST"
              path="/api/public/v1/media-query"
              summary="Log a media enquiry. Always returns an acknowledgement only."
              body="{ name, outlet, contact, deadline?, question, consent: true }"
              returns="Answer with caseReference and statusToken"
            />
            <Endpoint
              method="POST"
              path="/api/public/v1/case-status"
              summary="Read a private case status. A wrong token and a case that does not exist return the same 404."
              body="{ reference, token }"
              returns="CaseStatus"
            />
            <Endpoint
              method="GET"
              path="/api/public/v1/openapi"
              summary="The machine-readable contract for everything on this page."
              body="—"
              returns="OpenAPI 3.1 document"
            />
          </div>
        </section>

        <section className="mt-10">
          <h2 className="text-xl font-semibold tracking-tight">Answer shape</h2>
          <div className="mt-3">
            <Code>{`{
  "apiVersion": "v1",
  "answerRef": "ANS-…",
  "question": "…",
  "outcome": "answered" | "clarification" | "gap" | "escalated",
  "officialBlocks": [ /* verified evidence, server-built */ ],
  "aiExplanation": "plain-language wording, or null",
  "caveats": ["…"],
  "followUps": ["…"],
  "references": [{ "title": "…", "publisher": "…", "pageNumber": 3, … }],
  "clarification": { "question": "…", "choices": [ … ] } | null,
  "gapDescription": "…" | null,
  "caseReference": "SB-2026-0001" | null,
  "statusToken": "…" | null
}`}</Code>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            Block types are a closed list: <code className="font-mono text-xs">official_quote</code>,{" "}
            <code className="font-mono text-xs">metric</code>, <code className="font-mono text-xs">comparison_table</code>
            , <code className="font-mono text-xs">chart</code>, <code className="font-mono text-xs">document</code>,{" "}
            <code className="font-mono text-xs">definition</code>, <code className="font-mono text-xs">caveat</code>,{" "}
            <code className="font-mono text-xs">clarification</code>, <code className="font-mono text-xs">gap</code>,{" "}
            <code className="font-mono text-xs">case_acknowledgement</code>,{" "}
            <code className="font-mono text-xs">follow_up_actions</code>. Ignore any type you do not recognise rather
            than failing.
          </p>
        </section>

        <section className="mt-10">
          <h2 className="text-xl font-semibold tracking-tight">Sample client</h2>
          <div className="mt-3">
            <Code>{`const response = await fetch("/api/public/v1/ask", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ question: "What is the latest unemployment rate?" }),
});

if (response.status === 429) throw new Error("Rate limited — retry after a pause");
const answer = await response.json();

if (answer.outcome === "escalated") {
  console.log("Case reference:", answer.caseReference);
} else if (answer.outcome === "gap") {
  console.log("Not covered:", answer.gapDescription);
} else {
  console.log(answer.aiExplanation);
  for (const block of answer.officialBlocks) {
    if (block.type === "metric") console.log(block.label, block.displayValue, block.unit);
  }
}`}</Code>
          </div>
        </section>

        <section className="mt-10">
          <h2 className="text-xl font-semibold tracking-tight">Errors and limits</h2>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li>
              <code className="font-mono text-xs">400</code> — the body failed validation. The message names the field.
            </li>
            <li>
              <code className="font-mono text-xs">404</code> — case status only. Returned for both a wrong token and a
              case that does not exist, deliberately.
            </li>
            <li>
              <code className="font-mono text-xs">429</code> — rate limited. 20 questions per ten minutes per caller.
              Wait and retry.
            </li>
            <li>
              <code className="font-mono text-xs">502 / 503</code> — the assistant was unavailable. Safe to retry once
              after a pause.
            </li>
          </ul>
        </section>

        <section className="mt-10">
          <h2 className="text-xl font-semibold tracking-tight">Widget</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Drop one script tag onto any page. It adds a button, opens Naledi in an isolated iframe and leaks no
            React or styles into the host page. The panel opens at live-chat size, can be made full screen, and can hand the
            visitor over to the full site. See it running on the{" "}
            <a href="/widget-demo" className="text-accent underline underline-offset-2">widget demonstration page</a>.
          </p>
          <div className="mt-3">
            <Code>{`<script
  src="https://YOUR-NALEDI-HOST/widget.js"
  data-statbridge
  data-position="right"
  data-label="Ask about official statistics"
  async
></script>`}</Code>
          </div>
        </section>

        <section className="mt-10 rounded-lg border border-warn/40 bg-warn-surface p-4 text-sm text-warn-foreground">
          <p className="font-semibold">Honest disclosure</p>
          <p className="mt-2 leading-relaxed">
            This is a demonstration build. Content in it is loaded for demonstration and is not an official Statistics
            South Africa endorsement. No privacy certification is claimed.
          </p>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
