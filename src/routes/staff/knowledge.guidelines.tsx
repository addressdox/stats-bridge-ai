import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2, ScrollText } from "lucide-react";
import { useState } from "react";

import { StaffShell } from "@/components/statbridge/StaffShell";
import { supabase } from "@/integrations/supabase/client";
import { useStaff } from "@/lib/staff/useStaff";

const title = "House style — StatBridge knowledge base";
const description = "The wording, tone and number rules every Stats SA draft must follow, with one active version.";

export const Route = createFileRoute("/staff/knowledge/guidelines")({
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
  component: GuidelinesPage,
});

function GuidelinesPage() {
  const { can } = useStaff();
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);

  const query = useQuery({
    queryKey: ["guidelines"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("guidelines")
        .select(
          "id, title, version_number, status, approval_basis, terminology, style_rules, number_rules, branding_rules, messaging_rules, activated_at, retired_at, created_at",
        )
        .order("version_number", { ascending: false });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const activate = useMutation({
    mutationFn: async (guidelineId: string) => {
      const { error } = await supabase.rpc("activate_guidelines", { _guideline_id: guidelineId });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      setNotice({ tone: "ok", text: "This version is active. The previous one was retired in the same step." });
      queryClient.invalidateQueries({ queryKey: ["guidelines"] });
    },
    onError: (e: Error) => setNotice({ tone: "bad", text: e.message }),
  });

  return (
    <StaffShell title="House style">
      <p className="max-w-2xl text-sm text-muted-foreground">
        Exactly one version is active at a time. Every draft records the version it was written under, so a decision
        can always be read against the rules that applied on the day.
      </p>

      {notice && (
        <p
          role="status"
          className={`mt-4 rounded-md border p-3 text-sm ${
            notice.tone === "ok"
              ? "border-accent/40 bg-accent/10 text-foreground"
              : "border-destructive/40 bg-destructive/5 text-destructive"
          }`}
        >
          {notice.text}
        </p>
      )}

      {query.isPending && (
        <p className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 aria-hidden className="size-4 animate-spin" />
          Loading the house style…
        </p>
      )}

      {query.isError && (
        <div className="mt-6 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          The house style could not be loaded. Your account may not have permission to see it.
        </div>
      )}

      {query.isSuccess && query.data.length === 0 && (
        <div className="surface-panel mt-6 grid place-items-center p-12 text-center">
          <ScrollText aria-hidden className="size-8 text-muted-foreground" />
          <p className="mt-3 text-sm font-medium">No house style recorded yet</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Until a version is active, drafting is blocked — there is no agreed wording standard to write against.
          </p>
        </div>
      )}

      <ul className="mt-6 space-y-3">
        {(query.data ?? []).map((g) => (
          <li key={g.id} className="surface-panel p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold">{g.title}</span>
              <span className="font-mono text-xs text-muted-foreground">v{g.version_number}</span>
              <span
                className={`rounded px-2 py-0.5 text-[11px] font-semibold ${
                  g.status === "active" ? "bg-accent/15 text-accent" : "bg-secondary text-muted-foreground"
                }`}
              >
                {g.status}
              </span>
              <span className="rounded bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground">
                {g.approval_basis}
              </span>
            </div>

            <dl className="mt-3 grid gap-3 sm:grid-cols-2">
              <Rule label="Tone and sentence length" value={g.style_rules} />
              <Rule label="Numbers and units" value={g.number_rules} />
              <Rule label="Branding" value={g.branding_rules} />
              <Rule label="Messaging" value={g.messaging_rules} />
            </dl>

            <TerminologyList terminology={g.terminology} />

            <p className="mt-3 text-xs text-muted-foreground">
              {g.activated_at ? `Activated ${new Date(g.activated_at).toLocaleString("en-ZA")}` : "Never activated"}
              {g.retired_at ? ` · retired ${new Date(g.retired_at).toLocaleString("en-ZA")}` : ""}
            </p>

            {can.knowledge && g.status !== "active" && (
              <button
                onClick={() => activate.mutate(g.id)}
                disabled={activate.isPending}
                className="mt-3 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
              >
                Make this the active version
              </button>
            )}
          </li>
        ))}
      </ul>

      {!can.knowledge && (
        <p className="mt-6 text-xs text-muted-foreground">
          Only a knowledge administrator may activate a version. The server refuses the change for other accounts.
        </p>
      )}
    </StaffShell>
  );
}

function Rule({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 whitespace-pre-wrap text-sm">{value?.trim() || "Not set"}</dd>
    </div>
  );
}

function TerminologyList({ terminology }: { terminology: unknown }) {
  if (!terminology || typeof terminology !== "object") return null;
  const entries = Object.entries(terminology as Record<string, unknown>);
  if (entries.length === 0) return null;
  return (
    <div className="mt-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        Terminology and terms to avoid
      </p>
      <ul className="mt-1 space-y-0.5 text-sm">
        {entries.map(([key, value]) => (
          <li key={key}>
            <span className="font-medium">{key}:</span>{" "}
            <span className="text-muted-foreground">
              {Array.isArray(value) ? value.join(", ") : String(value)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
