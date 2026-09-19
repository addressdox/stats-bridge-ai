import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, ScrollText, Plus, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  CollectionPagination,
  CollectionToolbar,
  collectionSelectClass,
} from "@/components/statbridge/collection-controls";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Empty, Loading, Panel, Pill } from "@/components/statbridge/desk-ui";
import { StaffShell } from "@/components/statbridge/StaffShell";
import { Button } from "@/components/ui/button";
import {
  activateGuideline,
  createGuideline,
  listGuidelines,
  type GuidelineDraft,
} from "@/lib/statbridge/governance.functions";
import { useStaff } from "@/lib/staff/useStaff";
export const Route = createFileRoute("/staff/knowledge/guidelines")({
  head: () => ({
    meta: [{ title: "Guidelines — Naledi governance" }, { name: "robots", content: "noindex" }],
  }),
  component: GuidelinesPage,
});
const initial: GuidelineDraft = {
  title: "",
  changeSummary: "",
  identityRules:
    "Naledi is the public information officer for Statistics South Africa on the Naledi platform. Be accurate, neutral, respectful and locally grounded.",
  evidenceRules:
    "Answer factual questions only from approved source versions and cite the publication. Never infer a figure or hide uncertainty.",
  styleRules:
    "Use concise South African English, plain language and complete sentences. Lead with the direct answer.",
  numberRules:
    "Preserve reported precision, units, geography and reference period. Never compare incompatible series.",
  brandingRules:
    "Use Statistics South Africa and Stats SA consistently. Do not imply ministerial or executive endorsement.",
  messagingRules: "Separate verified facts from context. State limitations plainly.",
  mediaPolicy:
    "Publicly acknowledge media enquiries, capture contact details and create a case reference. Do not send or publish a substantive AI-written media answer without official approval. Prepare private evidence-backed response drafts for communications officials to review, edit and approve before release.",
  sensitiveTopicPolicy:
    "Escalate sensitive, personal, legal, political, security, embargoed or potentially harmful requests without substantive AI commentary.",
  escalationPolicy:
    "Escalate judgement, causal, interpretive, complex, official-position, ambiguous, unsupported and low-confidence requests for human review.",
  voiceRules:
    "Warm Cape Town South African English by default; clear, calm, natural and never theatrical.",
  multilingualRules:
    "Follow supported language preferences and natural code-switching. Do not claim fluency where reliable support is unavailable.",
  sensitiveTopics: [],
  complexTopics: [],
  requiredPhrases: [],
  forbiddenPhrases: [],
  prohibitedClaims: [
    "Unsupported causal claims",
    "Unverified statistics",
    "A substantive automated media response",
  ],
};
const box = "w-full rounded-md border border-border bg-surface px-3 py-2 text-sm";
function GuidelinesPage() {
  const { hasPermission } = useStaff(),
    qc = useQueryClient(),
    fetch = useServerFn(listGuidelines),
    create = useServerFn(createGuideline),
    activate = useServerFn(activateGuideline);
  const q = useQuery({ queryKey: ["guidelines-governance"], queryFn: () => fetch() });
  const [draft, setDraft] = useState(initial);
  const [authorOpen, setAuthorOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1),
    [pageSize, setPageSize] = useState(10);
  const active = q.data?.find((g) => g.status === "active");
  const history = (q.data ?? []).filter(
    (g) =>
      g.status !== "active" &&
      (status === "all" || g.status === status) &&
      `${g.title} ${g.change_summary ?? ""}`.toLowerCase().includes(search.toLowerCase()),
  );
  const currentPage = Math.min(page, Math.max(1, Math.ceil(history.length / pageSize)));
  const visibleHistory = history.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const save = useMutation({
    mutationFn: () => create({ data: draft }),
    onSuccess: () => {
      toast.success("Guideline draft created.");
      setDraft(initial);
      setAuthorOpen(false);
      void qc.invalidateQueries({ queryKey: ["guidelines-governance"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const makeActive = useMutation({
    mutationFn: (guidelineId: string) => activate({ data: { guidelineId } }),
    onSuccess: () => {
      toast.success("Guideline activated; the previous version was retired.");
      void qc.invalidateQueries({ queryKey: ["guidelines-governance"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const copyVersion = (g: NonNullable<typeof q.data>[number]) => {
    setAuthorOpen(true);
    setDraft({
      title: `${g.title} — revision`,
      changeSummary: "",
      identityRules: g.identity_rules ?? initial.identityRules,
      evidenceRules: g.evidence_rules ?? initial.evidenceRules,
      styleRules: g.style_rules ?? initial.styleRules,
      numberRules: g.number_rules ?? initial.numberRules,
      brandingRules: g.branding_rules ?? initial.brandingRules,
      messagingRules: g.messaging_rules ?? initial.messagingRules,
      mediaPolicy: g.media_policy ?? initial.mediaPolicy,
      sensitiveTopicPolicy: g.sensitive_topic_policy ?? initial.sensitiveTopicPolicy,
      escalationPolicy: g.escalation_policy ?? initial.escalationPolicy,
      voiceRules: g.voice_rules ?? initial.voiceRules,
      multilingualRules: g.multilingual_rules ?? initial.multilingualRules,
      sensitiveTopics: g.sensitive_topics ?? [],
      complexTopics: g.complex_topics ?? [],
      requiredPhrases: g.required_phrases ?? [],
      forbiddenPhrases: g.forbidden_phrases ?? [],
      prohibitedClaims: g.prohibited_claims ?? [],
    });
    toast.success(
      "Version copied into the form. Describe the change, save and activate it when ready.",
    );
  };
  return (
    <StaffShell title="Guideline governance">
      <div className="space-y-5">
        <p className="max-w-3xl text-sm text-muted-foreground">
          These rules guide answers, private drafts and voice conversations. Save a version, review
          it, then activate it. Changes apply to new questions and new voice sessions.
        </p>
        {hasPermission("guidelines.author") && (
          <Dialog open={authorOpen} onOpenChange={setAuthorOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus aria-hidden />
                Author a new version
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90dvh] max-w-4xl overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Author a new version</DialogTitle>
                <DialogDescription>
                  Save a draft for review. The current policy stays active until an authorised
                  official activates a new version.
                </DialogDescription>
              </DialogHeader>
              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  save.mutate();
                }}
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Version title">
                    <input
                      required
                      className={box}
                      value={draft.title}
                      onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                    />
                  </Field>
                  <Field label="Change summary">
                    <input
                      required
                      className={box}
                      value={draft.changeSummary}
                      onChange={(e) => setDraft({ ...draft, changeSummary: e.target.value })}
                    />
                  </Field>
                </div>
                <div className="grid gap-3 lg:grid-cols-2">
                  {(
                    [
                      ["identityRules", "Identity and authority"],
                      ["evidenceRules", "Evidence and citations"],
                      ["styleRules", "Tone and writing"],
                      ["numberRules", "Numbers and comparability"],
                      ["mediaPolicy", "Media enquiries"],
                      ["sensitiveTopicPolicy", "Sensitive topics"],
                      ["escalationPolicy", "Human escalation"],
                      ["multilingualRules", "Language and code-switching"],
                      ["voiceRules", "Voice delivery"],
                      ["brandingRules", "Branding"],
                      ["messagingRules", "Messaging"],
                    ] as const
                  ).map(([key, label]) => (
                    <Field key={key} label={label}>
                      <textarea
                        required
                        rows={4}
                        className={box}
                        value={draft[key]}
                        onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
                      />
                    </Field>
                  ))}
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <ListField
                    label="Sensitive topics or words"
                    value={draft.sensitiveTopics}
                    set={(v) => setDraft({ ...draft, sensitiveTopics: v })}
                  />
                  <ListField
                    label="Complex topics or words"
                    value={draft.complexTopics}
                    set={(v) => setDraft({ ...draft, complexTopics: v })}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Listed topics are flagged for official review in text, media and voice requests.
                  Add a complete word or phrase per line; the policy also applies to the request's
                  meaning in other languages.
                </p>
                <div className="grid gap-3 md:grid-cols-3">
                  <ListField
                    label="Required phrases"
                    value={draft.requiredPhrases}
                    set={(v) => setDraft({ ...draft, requiredPhrases: v })}
                  />
                  <ListField
                    label="Forbidden phrases"
                    value={draft.forbiddenPhrases}
                    set={(v) => setDraft({ ...draft, forbiddenPhrases: v })}
                  />
                  <ListField
                    label="Prohibited claims"
                    value={draft.prohibitedClaims}
                    set={(v) => setDraft({ ...draft, prohibitedClaims: v })}
                  />
                </div>
                <Button disabled={save.isPending}>Save governed draft</Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
        {active && (
          <Panel
            title="Active policy"
            description="This is the version used for new answers, private drafts and voice sessions."
          >
            <GuidelineCard
              guideline={active}
              canAuthor={hasPermission("guidelines.author")}
              canActivate={false}
              busy={makeActive.isPending}
              copy={copyVersion}
              activate={(id) => makeActive.mutate(id)}
            />
          </Panel>
        )}
        <Panel
          title="Version history"
          description="Draft and retired versions remain available for inspection and revision. They do not change the active policy."
        >
          <div className="space-y-4">
            <CollectionToolbar
              search={search}
              onSearch={(value) => {
                setSearch(value);
                setPage(1);
              }}
              searchLabel="Search guideline versions"
              placeholder="Search version title or change summary"
              onReset={() => {
                setSearch("");
                setStatus("all");
                setPage(1);
              }}
            >
              <label className="flex flex-col gap-1 text-xs font-medium">
                Version status
                <select
                  className={collectionSelectClass}
                  value={status}
                  onChange={(e) => {
                    setStatus(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="all">Draft and retired</option>
                  <option value="draft">Draft</option>
                  <option value="retired">Retired</option>
                </select>
              </label>
            </CollectionToolbar>
            {q.isLoading ? (
              <Loading />
            ) : q.isError ? (
              <p role="alert" className="text-sm text-destructive">
                {q.error.message}
              </p>
            ) : !history.length ? (
              <Empty>No matching draft or retired versions.</Empty>
            ) : (
              <div className="grid gap-3 lg:grid-cols-2">
                {visibleHistory.map((g) => (
                  <GuidelineCard
                    key={g.id}
                    guideline={g}
                    canAuthor={hasPermission("guidelines.author")}
                    canActivate={hasPermission("guidelines.activate")}
                    busy={makeActive.isPending}
                    copy={copyVersion}
                    activate={(id) => makeActive.mutate(id)}
                  />
                ))}
              </div>
            )}
            {!q.isError && (
              <CollectionPagination
                page={currentPage}
                pageSize={pageSize}
                total={history.length}
                onPageChange={setPage}
                onPageSizeChange={(size) => {
                  setPageSize(size);
                  setPage(1);
                }}
                label="guideline versions"
                busy={q.isFetching}
              />
            )}
          </div>
        </Panel>
      </div>
    </StaffShell>
  );
}
type GuidelineVersion = NonNullable<Awaited<ReturnType<typeof listGuidelines>>>[number];
function GuidelineCard({
  guideline: g,
  canAuthor,
  canActivate,
  busy,
  copy,
  activate,
}: {
  guideline: GuidelineVersion;
  canAuthor: boolean;
  canActivate: boolean;
  busy: boolean;
  copy: (g: GuidelineVersion) => void;
  activate: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const isActive = g.status === "active";
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <article
        className={`flex min-w-0 flex-col rounded-lg border p-4 ${isActive ? "border-accent/30 bg-accent/5" : "border-border bg-surface"}`}
      >
        <div className="flex items-start gap-3">
          <div
            className={`rounded-md p-2 ${isActive ? "bg-accent/10 text-accent" : "bg-secondary text-muted-foreground"}`}
          >
            {isActive ? (
              <ShieldCheck aria-hidden className="size-5" />
            ) : (
              <ScrollText aria-hidden className="size-5" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap gap-2">
              <Pill>Version {g.version_number}</Pill>
              <Pill tone={isActive ? "good" : "muted"}>{g.status}</Pill>
              {isActive && <CheckCircle2 aria-hidden className="size-4 text-accent" />}
            </div>
            <h3 className="mt-2 break-words text-sm font-semibold">{g.title}</h3>
            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
              {g.change_summary || "No change summary recorded."}
            </p>
          </div>
        </div>
        <div className="my-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
          <span>{g.sensitive_topics?.length ?? 0} sensitive topics</span>
          <span>{g.complex_topics?.length ?? 0} complex topics</span>
          <span>{g.required_phrases?.length ?? 0} required phrases</span>
        </div>
        <div className="mt-auto flex flex-wrap gap-2">
          <DialogTrigger asChild>
            <Button size="sm" variant="outline">
              View policy rules
            </Button>
          </DialogTrigger>
          {canAuthor && (
            <Button size="sm" variant="ghost" onClick={() => copy(g)}>
              Use as a new version
            </Button>
          )}
        </div>
      </article>
      <DialogContent className="max-h-[90dvh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <div className="mb-2 flex gap-2">
            <Pill>Version {g.version_number}</Pill>
            <Pill tone={isActive ? "good" : "muted"}>{g.status}</Pill>
          </div>
          <DialogTitle className="pr-6 leading-snug">{g.title}</DialogTitle>
          <DialogDescription>
            {g.change_summary || "Policy rules recorded for this version."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <RuleGroup
            title="Identity, evidence and writing"
            description="Authority, citations, tone and use of numbers"
          >
            <Rule label="Identity and authority" value={g.identity_rules} />
            <Rule label="Evidence" value={g.evidence_rules} />
            <Rule label="Tone and writing" value={g.style_rules} />
            <Rule label="Numbers and comparability" value={g.number_rules} />
            <Rule label="Branding" value={g.branding_rules} />
            <Rule label="Messaging" value={g.messaging_rules} />
          </RuleGroup>
          <RuleGroup
            title="Sensitive requests and escalation"
            description={`${g.sensitive_topics?.length ?? 0} sensitive topics · ${g.complex_topics?.length ?? 0} complex topics`}
          >
            <Rule label="Escalation" value={g.escalation_policy} />
            <Rule label="Media enquiries" value={g.media_policy} />
            <Rule label="Sensitive topic policy" value={g.sensitive_topic_policy} />
            <Rule label="Sensitive topics or words" value={(g.sensitive_topics ?? []).join("\n")} />
            <Rule label="Complex topics or words" value={(g.complex_topics ?? []).join("\n")} />
          </RuleGroup>
          <RuleGroup
            title="Voice and language"
            description="Delivery and multilingual conversation"
          >
            <Rule label="Voice" value={g.voice_rules} />
            <Rule label="Multilingual" value={g.multilingual_rules} />
          </RuleGroup>
          <RuleGroup title="Required and restricted wording" description="Phrases and claims">
            <Rule label="Required phrases" value={(g.required_phrases ?? []).join("\n")} />
            <Rule label="Forbidden phrases" value={(g.forbidden_phrases ?? []).join("\n")} />
            <Rule label="Prohibited claims" value={(g.prohibited_claims ?? []).join("\n")} />
          </RuleGroup>
        </div>
        <div className="flex flex-wrap gap-2 border-t border-border pt-4">
          {canAuthor && (
            <Button
              variant="outline"
              onClick={() => {
                setOpen(false);
                copy(g);
              }}
            >
              Use as a new version
            </Button>
          )}
          {canActivate && g.status === "draft" && (
            <Button disabled={busy} onClick={() => activate(g.id)}>
              {busy ? "Activating…" : "Activate this version"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
function RuleGroup({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <details className="group rounded-lg border border-border">
      <summary className="cursor-pointer px-4 py-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <span>{title}</span>
        <span className="mt-1 block text-xs font-normal text-muted-foreground">{description}</span>
      </summary>
      <div className="grid gap-5 border-t border-border p-4 sm:grid-cols-2">{children}</div>
    </details>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      <span className="mb-1 block">{label}</span>
      {children}
    </label>
  );
}
function ListField({
  label,
  value,
  set,
}: {
  label: string;
  value: string[];
  set: (v: string[]) => void;
}) {
  const [text, setText] = useState(value.join("\n"));
  const savedText = value.join("\n");
  useEffect(() => {
    // Preserve a trailing newline while typing, but follow an explicit version copy/reset.
    if (
      text
        .split("\n")
        .map((item) => item.trim())
        .filter(Boolean)
        .join("\n") !== savedText
    )
      setText(savedText);
  }, [savedText, text]);
  return (
    <Field label={label}>
      <textarea
        rows={4}
        className={box}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          set(
            e.target.value
              .split("\n")
              .map((x) => x.trim())
              .filter(Boolean),
          );
        }}
      />
      <span className="mt-1 block normal-case font-normal">One item per line.</span>
    </Field>
  );
}
function Rule({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 whitespace-pre-wrap text-sm">{value || "Not specified"}</p>
    </div>
  );
}
