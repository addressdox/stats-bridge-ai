import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, ScrollText } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
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
    "Acknowledge media enquiries, capture contact details and create a case reference. Never provide a substantive AI-written media answer.",
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
  const save = useMutation({
    mutationFn: () => create({ data: draft }),
    onSuccess: () => {
      toast.success("Guideline draft created.");
      setDraft(initial);
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
          <Panel
            title="Author a new version"
            description="All safety-critical sections are required."
          >
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
                Listed topics are flagged for official review in text, media and voice requests. Add
                a complete word or phrase per line; the policy also applies to the request's meaning
                in other languages.
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
          </Panel>
        )}
        <Panel
          title="Version history"
          description="The active version is the policy used by the answering and review pipeline."
        >
          {q.isLoading ? (
            <Loading />
          ) : q.isError ? (
            <p role="alert" className="text-sm text-destructive">
              {(q.error as Error).message}
            </p>
          ) : !q.data?.length ? (
            <Empty>No guideline versions.</Empty>
          ) : (
            <div className="space-y-3">
              {q.data.map((g) => (
                <details
                  key={g.id}
                  className="rounded border border-border p-4"
                  open={g.status === "active"}
                >
                  <summary className="cursor-pointer list-none">
                    <div className="flex flex-wrap items-center gap-2">
                      <ScrollText className="size-4" />
                      <b>{g.title}</b>
                      <Pill>v{g.version_number}</Pill>
                      <Pill tone={g.status === "active" ? "good" : "muted"}>{g.status}</Pill>
                      {g.status === "active" && <CheckCircle2 className="size-4 text-accent" />}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {g.change_summary || "No change summary"}
                    </p>
                  </summary>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <Rule label="Identity and authority" value={g.identity_rules} />
                    <Rule label="Evidence" value={g.evidence_rules} />
                    <Rule label="Tone and writing" value={g.style_rules} />
                    <Rule label="Numbers and comparability" value={g.number_rules} />
                    <Rule label="Branding" value={g.branding_rules} />
                    <Rule label="Messaging" value={g.messaging_rules} />
                    <Rule label="Escalation" value={g.escalation_policy} />
                    <Rule label="Media" value={g.media_policy} />
                    <Rule label="Sensitive topic policy" value={g.sensitive_topic_policy} />
                    <Rule
                      label="Sensitive topics or words"
                      value={(g.sensitive_topics ?? []).join("\n")}
                    />
                    <Rule
                      label="Complex topics or words"
                      value={(g.complex_topics ?? []).join("\n")}
                    />
                    <Rule label="Voice" value={g.voice_rules} />
                    <Rule label="Multilingual" value={g.multilingual_rules} />
                    <Rule label="Required phrases" value={(g.required_phrases ?? []).join("\n")} />
                    <Rule
                      label="Forbidden phrases"
                      value={(g.forbidden_phrases ?? []).join("\n")}
                    />
                    <Rule
                      label="Prohibited claims"
                      value={(g.prohibited_claims ?? []).join("\n")}
                    />
                  </div>
                  {hasPermission("guidelines.author") && (
                    <Button className="mt-4 mr-2" variant="outline" onClick={() => copyVersion(g)}>
                      Use as a new version
                    </Button>
                  )}
                  {hasPermission("guidelines.activate") && g.status === "draft" && (
                    <Button
                      className="mt-4"
                      disabled={makeActive.isPending}
                      onClick={() => makeActive.mutate(g.id)}
                    >
                      Activate this version
                    </Button>
                  )}
                </details>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </StaffShell>
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
