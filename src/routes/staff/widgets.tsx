import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Globe, Loader2, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { StaffShell } from "@/components/statbridge/StaffShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { listWidgetSites, saveWidgetSite, type WidgetSite } from "@/lib/statbridge/widgets.functions";

const title = "Websites and widget — StatBridge staff";
const description = "Register the websites allowed to embed the StatBridge assistant and set how it appears there.";

export const Route = createFileRoute("/staff/widgets")({
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
  component: WidgetsPage,
});

type FormState = {
  id: string | null;
  name: string;
  origins: string;
  accentColour: string;
  position: "bottom-right" | "bottom-left";
  defaultLanguage: string;
  openingText: string;
  isActive: boolean;
};

const EMPTY: FormState = {
  id: null,
  name: "",
  origins: "",
  accentColour: "#0f766e",
  position: "bottom-right",
  defaultLanguage: "en",
  openingText: "Howzit — ask me about Stats SA figures.",
  isActive: true,
};

function WidgetsPage() {
  const fetchSites = useServerFn(listWidgetSites);
  const save = useServerFn(saveWidgetSite);
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(EMPTY);

  const query = useQuery({ queryKey: ["widget-sites"], queryFn: () => fetchSites() });

  const mutation = useMutation({
    mutationFn: () =>
      save({
        data: {
          id: form.id,
          name: form.name,
          origins: form.origins,
          accentColour: form.accentColour || null,
          position: form.position,
          defaultLanguage: form.defaultLanguage,
          openingText: form.openingText || null,
          isActive: form.isActive,
        },
      }),
    onSuccess: async () => {
      toast.success(form.id ? "Website updated." : "Website registered.");
      setForm(EMPTY);
      await queryClient.invalidateQueries({ queryKey: ["widget-sites"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  function edit(site: WidgetSite) {
    setForm({
      id: site.id,
      name: site.name,
      origins: site.allowedOrigins.join("\n"),
      accentColour: site.accentColour ?? "#0f766e",
      position: (site.position === "bottom-left" ? "bottom-left" : "bottom-right") as FormState["position"],
      defaultLanguage: site.defaultLanguage ?? "en",
      openingText: site.openingText ?? "",
      isActive: site.isActive,
    });
  }

  return (
    <StaffShell title="Websites and widget">
      <p className="max-w-2xl text-sm text-muted-foreground">
        The assistant only loads on websites registered here. Each website gets its own key, its own colour and its own
        opening line, and can be switched off at any time without touching the website itself.
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <section className="surface-panel p-4">
          <h2 className="text-sm font-semibold">Registered websites</h2>
          {query.isPending && (
            <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 aria-hidden className="size-4 animate-spin" /> Loading…
            </p>
          )}
          {query.isError && (
            <p className="mt-4 text-sm text-destructive">
              The list could not be loaded: {(query.error as Error).message}
            </p>
          )}
          {query.isSuccess && query.data.length === 0 && (
            <div className="mt-4 grid place-items-center rounded-lg border border-dashed border-border p-10 text-center">
              <Globe aria-hidden className="size-7 text-muted-foreground" />
              <p className="mt-3 text-sm font-medium">No website is allowed to embed the assistant yet</p>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                Register the Stats SA website on the right to switch the widget on.
              </p>
            </div>
          )}
          <ul className="mt-4 space-y-3">
            {(query.data ?? []).map((site) => (
              <li key={site.id} className="rounded-lg border border-border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold">{site.name}</p>
                    <p className="text-xs text-muted-foreground">{site.allowedOrigins.join(", ")}</p>
                  </div>
                  <span
                    className={`rounded px-2 py-0.5 text-[11px] font-semibold ${site.isActive ? "bg-accent/15 text-accent" : "bg-muted text-muted-foreground"}`}
                  >
                    {site.isActive ? "Live" : "Switched off"}
                  </span>
                </div>
                <p className="mt-2 break-all rounded bg-muted px-2 py-1 font-mono text-[11px]">
                  {`<script src="${typeof window === "undefined" ? "" : window.location.origin}/widget.js" data-site="${site.siteKey}" async></script>`}
                </p>
                <Button variant="outline" size="sm" className="mt-2" onClick={() => edit(site)}>
                  Edit
                </Button>
              </li>
            ))}
          </ul>
        </section>

        <section className="surface-panel h-fit p-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Plus aria-hidden className="size-4" />
            {form.id ? "Edit website" : "Register a website"}
          </h2>
          <div className="mt-4 space-y-3">
            <div>
              <Label htmlFor="w-name">Website name</Label>
              <Input
                id="w-name"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                placeholder="Statistics South Africa main site"
              />
            </div>
            <div>
              <Label htmlFor="w-origins">Allowed web addresses</Label>
              <Textarea
                id="w-origins"
                rows={3}
                value={form.origins}
                onChange={(event) => setForm({ ...form, origins: event.target.value })}
                placeholder={"https://www.statssa.gov.za\nhttps://statssa.gov.za"}
              />
              <p className="mt-1 text-xs text-muted-foreground">One address per line, without any page path.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="w-colour">Accent colour</Label>
                <Input
                  id="w-colour"
                  value={form.accentColour}
                  onChange={(event) => setForm({ ...form, accentColour: event.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="w-language">Opening language</Label>
                <Input
                  id="w-language"
                  value={form.defaultLanguage}
                  onChange={(event) => setForm({ ...form, defaultLanguage: event.target.value })}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="w-opening">Opening line</Label>
              <Textarea
                id="w-opening"
                rows={2}
                value={form.openingText}
                onChange={(event) => setForm({ ...form, openingText: event.target.value })}
              />
            </div>
            <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
              <Label htmlFor="w-active" className="text-sm font-normal">
                Show the assistant on this website
              </Label>
              <Switch
                id="w-active"
                checked={form.isActive}
                onCheckedChange={(checked) => setForm({ ...form, isActive: checked })}
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || form.name.trim().length < 2}>
                {mutation.isPending && <Loader2 aria-hidden className="mr-2 size-4 animate-spin" />}
                {form.id ? "Save changes" : "Register website"}
              </Button>
              {form.id && (
                <Button variant="ghost" onClick={() => setForm(EMPTY)}>
                  Cancel
                </Button>
              )}
            </div>
          </div>
        </section>
      </div>
    </StaffShell>
  );
}
