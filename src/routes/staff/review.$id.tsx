import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, ArrowLeft, CheckCircle2, Loader2, Send, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

import { StaffShell } from "@/components/statbridge/StaffShell";
import { supabase } from "@/integrations/supabase/client";
import { suggestDraft, saveReviewedDraft } from "@/lib/staff/draft.functions";
import type { DraftEvidence } from "@/lib/statbridge/draft.contract";
import { useStaff } from "@/lib/staff/useStaff";
import { REVIEW_REASON_LABELS } from "@/lib/statbridge/contract";

const title = "Review workbench — Naledi staff";
const description =
  "Draft, approve and release a Stats SA communications response against verified evidence.";

export const Route = createFileRoute("/staff/review/$id")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: WorkbenchPage,
});

const FORMATS = [
  { value: "general_reply", label: "General reply" },
  { value: "faq_answer", label: "FAQ answer" },
  { value: "short_media_statement", label: "Short media statement" },
] as const;

type Format = (typeof FORMATS)[number]["value"];

function WorkbenchPage() {
  const { id } = Route.useParams();
  const { can, isLoading: staffLoading } = useStaff();
  const queryClient = useQueryClient();

  const [body, setBody] = useState("");
  const [format, setFormat] = useState<Format>("general_reply");
  const [instruction, setInstruction] = useState("");
  const [gaps, setGaps] = useState<string[]>([]);
  const [suggestedEvidence, setSuggestedEvidence] = useState<DraftEvidence[] | null>(null);
  const [notice, setNotice] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);
  const [loadedVersion, setLoadedVersion] = useState<number | null>(null);

  useEffect(() => {
    setBody("");
    setFormat("general_reply");
    setInstruction("");
    setGaps([]);
    setSuggestedEvidence(null);
    setLoadedVersion(null);
    setNotice(null);
  }, [id]);

  const caseQuery = useQuery({
    queryKey: ["case", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cases")
        .select(
          "id, reference, kind, status, question_text, review_reasons, deadline_at, received_at, released_at, requester_outlet, is_demo_seed, assigned_to",
        )
        .eq("id", id)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data;
    },
  });

  const draftsQuery = useQuery({
    queryKey: ["case-drafts", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("drafts")
        .select(
          "id, version_number, body, format, gaps, author_kind, instruction, fingerprint, created_at, guideline_id",
        )
        .eq("case_id", id)
        .order("version_number", { ascending: false });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const approvalQuery = useQuery({
    queryKey: ["case-approvals", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("approvals")
        .select(
          "id, draft_id, status, fingerprint, approved_at, void_reason, voided_at, source_version_ids",
        )
        .eq("case_id", id)
        .order("approved_at", { ascending: false });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const releaseQuery = useQuery({
    queryKey: ["case-release", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("releases")
        .select("id, released_at, released_body, channel, delivery_state")
        .eq("case_id", id)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data;
    },
  });

  const latest = draftsQuery.data?.[0] ?? null;
  const activeApproval = approvalQuery.data?.find((a) => a.status === "active") ?? null;

  const evidenceQuery = useQuery({
    queryKey: ["draft-evidence", latest?.id],
    enabled: Boolean(latest?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("evidence_links")
        .select("id, statement, source_version_id, passage_id, observation_id")
        .eq("owner_kind", "draft")
        .eq("owner_id", latest!.id);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const memoryQuery = useQuery({
    queryKey: ["similar-memory", caseQuery.data?.question_text],
    enabled: Boolean(caseQuery.data?.question_text),
    queryFn: async () => {
      const { data, error } = await supabase.rpc("search_memory", {
        _q: caseQuery.data!.question_text,
        _limit: 4,
      });
      if (error) throw new Error(error.message);
      return (data ?? []).filter((item) => item.reuse_status === "reusable");
    },
  });

  useEffect(() => {
    if (!latest) return;
    if (loadedVersion === latest.version_number) return;
    setSuggestedEvidence(null);
    setBody(latest.body);
    setFormat(latest.format as Format);
    setGaps(latest.gaps ?? []);
    setLoadedVersion(latest.version_number);
  }, [latest, loadedVersion]);

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["case", id] });
    queryClient.invalidateQueries({ queryKey: ["case-drafts", id] });
    queryClient.invalidateQueries({ queryKey: ["case-approvals", id] });
    queryClient.invalidateQueries({ queryKey: ["case-release", id] });
    queryClient.invalidateQueries({ queryKey: ["review-queue"] });
    queryClient.invalidateQueries({ queryKey: ["draft-evidence"] });
  }

  function act<T>(fn: () => Promise<T>, okText: string) {
    setNotice(null);
    return fn()
      .then(() => {
        setNotice({ tone: "ok", text: okText });
        refresh();
      })
      .catch((e: unknown) => {
        setNotice({
          tone: "bad",
          text: e instanceof Error ? e.message : "That could not be done.",
        });
      });
  }

  const startReview = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("start_review", { _case_id: id });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      setNotice({ tone: "ok", text: "This case is now assigned to you." });
      refresh();
    },
    onError: (e: Error) => setNotice({ tone: "bad", text: e.message }),
  });

  const askAssistant = useMutation({
    mutationFn: async () =>
      suggestDraft({
        data: { caseId: id, instruction, format, basedOn: body || null },
      }),
    onSuccess: (result) => {
      setBody(result.body);
      setGaps(result.gaps);
      setSuggestedEvidence(result.evidence);
      setNotice({
        tone: "ok",
        text: "Suggested wording and supporting references are ready. Save a version before approving it.",
      });
    },
    onError: (e: Error) => setNotice({ tone: "bad", text: e.message }),
  });

  const saveDraft = useMutation({
    mutationFn: async () => {
      await saveReviewedDraft({
        data: { caseId: id, body, format, gaps, evidence: suggestedEvidence },
      });
    },
    onSuccess: () => {
      setLoadedVersion(null);
      setNotice({ tone: "ok", text: "Saved as a new version. Any earlier approval is now void." });
      refresh();
    },
    onError: (e: Error) => setNotice({ tone: "bad", text: e.message }),
  });

  const pending = startReview.isPending || askAssistant.isPending || saveDraft.isPending;

  const dirty = latest
    ? body !== latest.body ||
      format !== latest.format ||
      JSON.stringify(gaps) !== JSON.stringify(latest.gaps ?? []) ||
      suggestedEvidence !== null
    : body.trim().length > 0;
  const closed = ["released", "rejected"].includes(caseQuery.data?.status ?? "");

  return (
    <StaffShell title="Review workbench">
      <Link
        to="/staff/review"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft aria-hidden className="size-4" />
        Back to the queue
      </Link>

      {(caseQuery.isPending || staffLoading) && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 aria-hidden className="size-4 animate-spin" />
          Loading this case…
        </p>
      )}

      {caseQuery.isError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          This case could not be loaded. Your account may not have permission to open it.
        </div>
      )}

      {caseQuery.isSuccess && !caseQuery.data && (
        <div className="surface-panel p-6 text-sm text-muted-foreground">
          No case with that reference exists.
        </div>
      )}

      {caseQuery.data && (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="min-w-0 space-y-5">
            <section className="surface-panel p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-sm font-semibold">{caseQuery.data.reference}</span>
                <span className="rounded bg-secondary px-2 py-0.5 text-[11px] font-semibold text-secondary-foreground">
                  {caseQuery.data.kind === "media" ? "Media" : "Public escalation"}
                </span>
                <span className="rounded bg-secondary px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                  {caseQuery.data.status}
                </span>
                {caseQuery.data.is_demo_seed && (
                  <span className="rounded bg-warn/15 px-2 py-0.5 text-[11px] font-semibold text-warn-foreground">
                    Demonstration
                  </span>
                )}
              </div>
              <p className="mt-3 whitespace-pre-wrap text-[15px] leading-relaxed">
                {caseQuery.data.question_text}
              </p>
              <p className="mt-3 text-xs text-muted-foreground">
                Received {new Date(caseQuery.data.received_at).toLocaleString("en-ZA")}
                {caseQuery.data.deadline_at
                  ? ` · deadline ${new Date(caseQuery.data.deadline_at).toLocaleString("en-ZA")}`
                  : " · no deadline given"}
                {caseQuery.data.review_reasons?.length
                  ? ` · ${caseQuery.data.review_reasons.map((r) => REVIEW_REASON_LABELS[r] ?? r).join(", ")}`
                  : ""}
              </p>
              {caseQuery.data.status === "draft_prepared" && can.review && (
                <button
                  onClick={() => startReview.mutate()}
                  disabled={pending}
                  className="mt-3 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
                >
                  Start review
                </button>
              )}
            </section>

            {notice && (
              <p
                role="status"
                className={`rounded-md border p-3 text-sm ${
                  notice.tone === "ok"
                    ? "border-accent/40 bg-accent/10 text-foreground"
                    : "border-destructive/40 bg-destructive/5 text-destructive"
                }`}
              >
                {notice.text}
              </p>
            )}

            {!can.review || closed ? (
              <div className="surface-panel p-4 text-sm text-muted-foreground">
                {closed
                  ? "This case is closed. Its saved versions and decision record remain available below."
                  : "Your account needs case-review permission to edit and approve a response."}
              </div>
            ) : (
              <section className="surface-panel p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-sm font-semibold">Working draft</h2>
                  <div className="flex items-center gap-2">
                    <label className="sr-only" htmlFor="format">
                      Format
                    </label>
                    <select
                      id="format"
                      value={format}
                      onChange={(e) => setFormat(e.target.value as Format)}
                      className="rounded-md border border-border bg-surface px-2 py-1 text-xs"
                    >
                      {FORMATS.map((f) => (
                        <option key={f.value} value={f.value}>
                          {f.label}
                        </option>
                      ))}
                    </select>
                    <span className="text-xs text-muted-foreground">
                      {latest ? `v${latest.version_number} loaded` : "No version yet"}
                    </span>
                  </div>
                </div>

                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={14}
                  aria-label="Draft response"
                  className="mt-3 w-full rounded-md border border-border bg-surface p-3 font-sans text-sm leading-relaxed"
                  placeholder="Write the response here, or ask for suggested wording below."
                />

                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <input
                    value={instruction}
                    onChange={(e) => setInstruction(e.target.value)}
                    placeholder="Instruction for a suggested redraft (optional)"
                    aria-label="Instruction for a suggested redraft"
                    className="min-w-0 flex-1 rounded-md border border-border bg-surface px-3 py-2 text-sm"
                  />
                  <button
                    onClick={() => askAssistant.mutate()}
                    disabled={pending}
                    className="inline-flex items-center justify-center gap-1.5 rounded-md border border-accent/40 px-3 py-2 text-sm font-medium text-accent disabled:opacity-60"
                  >
                    {askAssistant.isPending ? (
                      <Loader2 aria-hidden className="size-4 animate-spin" />
                    ) : (
                      <Sparkles aria-hidden className="size-4" />
                    )}
                    Suggest wording
                  </button>
                  <button
                    onClick={() => saveDraft.mutate()}
                    disabled={pending || !body.trim()}
                    className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
                  >
                    Save new version
                  </button>
                </div>

                {gaps.length > 0 && (
                  <div className="mt-4 rounded-md border border-warn/40 bg-warn-surface p-3">
                    <p className="text-xs font-semibold text-warn-foreground">
                      Still to be decided by a person
                    </p>
                    <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-foreground">
                      {gaps.map((g) => (
                        <li key={g} className="flex items-start justify-between gap-2">
                          <span>{g}</span>
                          <button
                            type="button"
                            className="shrink-0 text-xs font-medium underline"
                            onClick={() =>
                              setGaps((current) => current.filter((item) => item !== g))
                            }
                          >
                            Mark resolved
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {dirty && activeApproval && (
                  <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-warn-foreground">
                    <AlertTriangle aria-hidden className="size-3.5" />
                    Saving these edits voids the current approval.
                  </p>
                )}
              </section>
            )}

            {can.review && latest && !closed && (
              <DecisionPanel
                inReview={caseQuery.data.status === "in_review"}
                hasUnsavedChanges={dirty}
                hasGaps={Boolean(latest.gaps?.length)}
                caseId={id}
                draftId={latest.id}
                canRelease={can.release}
                hasActiveApproval={Boolean(activeApproval)}
                alreadyReleased={Boolean(releaseQuery.data)}
                onAction={act}
              />
            )}

            <section className="surface-panel p-4">
              <h2 className="text-sm font-semibold">Draft versions</h2>
              {draftsQuery.isPending && (
                <p className="mt-2 text-sm text-muted-foreground">Loading versions…</p>
              )}
              {draftsQuery.isSuccess && draftsQuery.data.length === 0 && (
                <p className="mt-2 text-sm text-muted-foreground">No version has been saved yet.</p>
              )}
              <ul className="mt-2 space-y-2">
                {(draftsQuery.data ?? []).map((d) => (
                  <li key={d.id} className="rounded-md border border-border p-3">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-semibold">v{d.version_number}</span>
                      <span className="text-muted-foreground">
                        {d.author_kind === "ai" ? "Assistant suggestion" : "Written by a person"}
                      </span>
                      <span className="text-muted-foreground">
                        {new Date(d.created_at).toLocaleString("en-ZA")}
                      </span>
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {d.fingerprint.slice(0, 12)}
                      </span>
                    </div>
                    <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{d.body}</p>
                    <button
                      onClick={async () => {
                        const savedEvidence = await supabase
                          .from("evidence_links")
                          .select("statement,source_version_id,passage_id,observation_id")
                          .eq("owner_kind", "draft")
                          .eq("owner_id", d.id);
                        if (savedEvidence.error) {
                          setNotice({
                            tone: "bad",
                            text: "The references for this version could not be loaded.",
                          });
                          return;
                        }
                        setBody(d.body);
                        setFormat(d.format as Format);
                        setGaps(d.gaps ?? []);
                        setSuggestedEvidence(
                          (savedEvidence.data ?? []).map((e) => ({
                            statement: e.statement ?? "",
                            sourceVersionId: e.source_version_id,
                            ...(e.passage_id ? { passageId: e.passage_id } : {}),
                            ...(e.observation_id ? { observationId: e.observation_id } : {}),
                          })),
                        );
                        setLoadedVersion(latest?.version_number ?? null);
                      }}
                      className="mt-2 text-xs font-medium text-accent underline underline-offset-2"
                    >
                      Load into the editor
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <aside className="space-y-4">
            <section className="surface-panel p-4">
              <h2 className="text-sm font-semibold">Approval</h2>
              {activeApproval ? (
                <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-accent">
                  <CheckCircle2 aria-hidden className="size-4" />
                  Approved {new Date(activeApproval.approved_at).toLocaleString("en-ZA")}
                </p>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">No active approval.</p>
              )}
              {(approvalQuery.data ?? [])
                .filter((a) => a.status !== "active")
                .map((a) => (
                  <p key={a.id} className="mt-1 text-xs text-muted-foreground">
                    Voided {a.voided_at ? new Date(a.voided_at).toLocaleString("en-ZA") : ""} —{" "}
                    {a.void_reason}
                  </p>
                ))}
            </section>

            <section className="surface-panel p-4">
              <h2 className="text-sm font-semibold">Release</h2>
              {releaseQuery.data ? (
                <>
                  <p className="mt-2 text-sm text-accent">
                    Released {new Date(releaseQuery.data.released_at).toLocaleString("en-ZA")}
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-xs text-muted-foreground">
                    {releaseQuery.data.released_body}
                  </p>
                </>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">
                  Nothing has been released for this case.
                </p>
              )}
            </section>

            <section className="surface-panel p-4">
              <h2 className="text-sm font-semibold">Evidence for the current version</h2>
              {(evidenceQuery.data ?? []).length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  No evidence has been attached to the saved version yet.
                </p>
              ) : (
                <ul className="mt-2 space-y-2 text-xs">
                  {(evidenceQuery.data ?? []).map((e) => (
                    <li key={e.id} className="rounded border border-border p-2">
                      <p className="text-foreground">{e.statement}</p>
                      <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                        {e.observation_id ? "figure" : "extract"} ·{" "}
                        {e.source_version_id.slice(0, 8)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="surface-panel p-4">
              <h2 className="text-sm font-semibold">Similar approved wording</h2>
              {(memoryQuery.data ?? []).length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  Nothing similar has been approved before.
                </p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {(memoryQuery.data ?? []).map((m) => (
                    <li key={m.memory_id} className="rounded border border-border p-2">
                      <p className="text-xs font-semibold">{m.title}</p>
                      <p className="mt-1 line-clamp-3 text-xs text-muted-foreground">{m.body}</p>
                      <button
                        onClick={() => setBody((b) => (b ? `${b}\n\n${m.body}` : m.body))}
                        className="mt-1 text-[11px] font-medium text-accent underline underline-offset-2"
                      >
                        Adapt this wording
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </aside>
        </div>
      )}
    </StaffShell>
  );
}

function DecisionPanel({
  caseId,
  draftId,
  hasUnsavedChanges,
  inReview,
  hasGaps,
  canRelease,
  hasActiveApproval,
  alreadyReleased,
  onAction,
}: {
  caseId: string;
  draftId: string;
  hasUnsavedChanges: boolean;
  inReview: boolean;
  hasGaps: boolean;
  canRelease: boolean;
  hasActiveApproval: boolean;
  alreadyReleased: boolean;
  onAction: <T>(fn: () => Promise<T>, okText: string) => Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function run(fn: () => Promise<unknown>, okText: string) {
    setBusy(true);
    await onAction(fn, okText);
    setBusy(false);
  }

  return (
    <section className="surface-panel p-4">
      <h2 className="text-sm font-semibold">Decision</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Approval applies to the exact saved version. Release is a separate step and is refused if
        the version changed or a supporting source was corrected or withdrawn.
      </p>

      {hasUnsavedChanges && (
        <p className="mt-2 text-xs text-warn-foreground">
          Save your edited wording, references and resolved gaps before approving or releasing.
        </p>
      )}
      {hasGaps && (
        <p className="mt-2 text-xs text-warn-foreground">
          Resolve the recorded gaps in the editor and save a new version before approval.
        </p>
      )}
      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Reason or instruction (needed for changes and rejection)"
        aria-label="Reason or instruction"
        className="mt-3 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
      />

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          disabled={busy || !inReview || !reason.trim()}
          onClick={() =>
            run(async () => {
              const { error } = await supabase.rpc("request_changes", {
                _case_id: caseId,
                _instruction: reason,
              });
              if (error) throw new Error(error.message);
            }, "Changes requested.")
          }
          className="rounded-md border border-border px-3 py-2 text-sm font-medium disabled:opacity-60"
        >
          Request changes
        </button>
        <button
          disabled={busy || !inReview || !reason.trim()}
          onClick={() =>
            run(async () => {
              const { error } = await supabase.rpc("reject_case", {
                _case_id: caseId,
                _reason: reason,
              });
              if (error) throw new Error(error.message);
            }, "Case rejected.")
          }
          className="rounded-md border border-destructive/40 px-3 py-2 text-sm font-medium text-destructive disabled:opacity-60"
        >
          Reject
        </button>
        <button
          disabled={busy || !inReview || hasUnsavedChanges || hasGaps || hasActiveApproval}
          onClick={() =>
            run(async () => {
              const { error } = await supabase.rpc("approve_draft", { _draft_id: draftId });
              if (error) throw new Error(error.message);
            }, "This exact version is approved.")
          }
          className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-foreground disabled:opacity-60"
        >
          Approve this version
        </button>
        <button
          disabled={
            busy ||
            hasUnsavedChanges ||
            hasGaps ||
            !canRelease ||
            !hasActiveApproval ||
            alreadyReleased
          }
          onClick={() =>
            run(async () => {
              const { error } = await supabase.rpc("release_draft", { _case_id: caseId });
              if (error) throw new Error(error.message);
            }, "Released. The requester can now see the wording on their private page.")
          }
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
        >
          <Send aria-hidden className="size-4" />
          Release
        </button>
      </div>

      {!canRelease && (
        <p className="mt-2 text-xs text-muted-foreground">
          Your account needs response-release permission. The server enforces this regardless of
          this page.
        </p>
      )}
    </section>
  );
}
