/** Desk settings: everything an administrator can change without a code change. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Loading, Panel } from "@/components/statbridge/desk-ui";
import { StaffShell } from "@/components/statbridge/StaffShell";
import { getDeskSettings, saveDeskSettings, type DeskSettingsPatch } from "@/lib/statbridge/admin.functions";
import { useStaff } from "@/lib/staff/useStaff";

const title = "Desk settings — StatBridge staff";
const description = "Officer telephone number, handover targets, open channels and data retention for the desk.";

export const Route = createFileRoute("/staff/settings")({
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
  component: SettingsPage,
});

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      <div className="mt-1">{children}</div>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </label>
  );
}

const inputClass = "w-full rounded-md border border-border bg-surface px-3 py-1.5 text-sm";

function Switch({
  label,
  hint,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex items-start gap-3 rounded-md border border-border bg-surface px-3 py-2.5">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 size-4"
      />
      <span>
        <span className="block text-sm font-medium">{label}</span>
        {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
      </span>
    </label>
  );
}

function SettingsPage() {
  const { hasPermission } = useStaff();
  const canEdit = hasPermission("settings.manage");
  const queryClient = useQueryClient();

  const fetchSettings = useServerFn(getDeskSettings);
  const persist = useServerFn(saveDeskSettings);

  const settings = useQuery({ queryKey: ["desk-settings"], queryFn: () => fetchSettings() });
  const [form, setForm] = useState<DeskSettingsPatch>({});

  useEffect(() => {
    if (!settings.data) return;
    const row = settings.data;
    setForm({
      desk_name: row.desk_name,
      support_email: row.support_email ?? "",
      officer_phone: row.officer_phone ?? "",
      officer_phone_label: row.officer_phone_label,
      phone_handover_enabled: row.phone_handover_enabled,
      office_hours: row.office_hours,
      time_zone: row.time_zone,
      notify_email: row.notify_email ?? "",
      handover_response_minutes: row.handover_response_minutes,
      visitor_retention_days: row.visitor_retention_days,
      voice_enabled: row.voice_enabled,
      widget_enabled: row.widget_enabled,
      public_api_enabled: row.public_api_enabled,
      crawler_enabled: row.crawler_enabled,
      media_auto_escalate: row.media_auto_escalate,
    });
  }, [settings.data]);

  const save = useMutation({
    mutationFn: (patch: DeskSettingsPatch) => persist({ data: patch }),
    onSuccess: () => {
      toast.success("Desk settings saved.");
      void queryClient.invalidateQueries({ queryKey: ["desk-settings"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const set = <K extends keyof DeskSettingsPatch>(key: K, value: DeskSettingsPatch[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  return (
    <StaffShell title="Desk settings">
      {settings.isLoading ? (
        <Loading />
      ) : (
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            save.mutate(form);
          }}
        >
          {!canEdit && (
            <p className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-muted-foreground">
              These settings are shown for reference. Only an administrator can change them.
            </p>
          )}

          <Panel title="The desk" description="How the desk names itself and when it is open.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Desk name">
                <input
                  className={inputClass}
                  disabled={!canEdit}
                  value={form.desk_name ?? ""}
                  onChange={(event) => set("desk_name", event.target.value)}
                />
              </Field>
              <Field label="Office hours">
                <input
                  className={inputClass}
                  disabled={!canEdit}
                  value={form.office_hours ?? ""}
                  onChange={(event) => set("office_hours", event.target.value)}
                />
              </Field>
              <Field label="Public contact email">
                <input
                  className={inputClass}
                  disabled={!canEdit}
                  value={form.support_email ?? ""}
                  onChange={(event) => set("support_email", event.target.value)}
                />
              </Field>
              <Field label="Time zone">
                <input
                  className={inputClass}
                  disabled={!canEdit}
                  value={form.time_zone ?? ""}
                  onChange={(event) => set("time_zone", event.target.value)}
                />
              </Field>
            </div>
          </Panel>

          <Panel
            title="Speaking to a person"
            description="What happens when someone on the voice line or in a chat asks for a human."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Officer telephone number"
                hint="Given to callers on the voice line when telephone handover is on. Use the full international form, for example +27 12 310 8911."
              >
                <input
                  className={inputClass}
                  disabled={!canEdit}
                  placeholder="+27 12 310 8911"
                  value={form.officer_phone ?? ""}
                  onChange={(event) => set("officer_phone", event.target.value)}
                />
              </Field>
              <Field label="How the number is described">
                <input
                  className={inputClass}
                  disabled={!canEdit}
                  value={form.officer_phone_label ?? ""}
                  onChange={(event) => set("officer_phone_label", event.target.value)}
                />
              </Field>
              <Field label="Pick-up target (minutes)" hint="A waiting handover is marked late after this.">
                <input
                  type="number"
                  min={1}
                  max={240}
                  className={inputClass}
                  disabled={!canEdit}
                  value={form.handover_response_minutes ?? 5}
                  onChange={(event) => set("handover_response_minutes", Number(event.target.value))}
                />
              </Field>
              <Field label="Alert email for waiting handovers">
                <input
                  className={inputClass}
                  disabled={!canEdit}
                  value={form.notify_email ?? ""}
                  onChange={(event) => set("notify_email", event.target.value)}
                />
              </Field>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Switch
                label="Give callers the officer telephone number"
                hint="When off, callers are told an official has been alerted and will come back to them."
                disabled={!canEdit}
                checked={form.phone_handover_enabled ?? false}
                onChange={(value) => set("phone_handover_enabled", value)}
              />
              <Switch
                label="Always send media enquiries to a person"
                hint="Recommended. Media questions are never answered by the assistant."
                disabled={!canEdit}
                checked={form.media_auto_escalate ?? true}
                onChange={(value) => set("media_auto_escalate", value)}
              />
            </div>
          </Panel>

          <Panel title="Open channels" description="Switch a way in on or off without a code change.">
            <div className="grid gap-3 sm:grid-cols-2">
              <Switch
                label="Voice line"
                disabled={!canEdit}
                checked={form.voice_enabled ?? true}
                onChange={(value) => set("voice_enabled", value)}
              />
              <Switch
                label="Embeddable widget"
                disabled={!canEdit}
                checked={form.widget_enabled ?? true}
                onChange={(value) => set("widget_enabled", value)}
              />
              <Switch
                label="Public API"
                disabled={!canEdit}
                checked={form.public_api_enabled ?? true}
                onChange={(value) => set("public_api_enabled", value)}
              />
              <Switch
                label="Publication crawler"
                hint="Keeps proposing newly published official material for approval."
                disabled={!canEdit}
                checked={form.crawler_enabled ?? true}
                onChange={(value) => set("crawler_enabled", value)}
              />
            </div>
          </Panel>

          <Panel title="Records and privacy" description="How long visitor records are kept.">
            <Field
              label="Keep visitor records for (days)"
              hint="Contact details and conversation history older than this may be removed."
            >
              <input
                type="number"
                min={30}
                max={3650}
                className={`${inputClass} sm:max-w-xs`}
                disabled={!canEdit}
                value={form.visitor_retention_days ?? 365}
                onChange={(event) => set("visitor_retention_days", Number(event.target.value))}
              />
            </Field>
          </Panel>

          {canEdit && (
            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={save.isPending}
                className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
              >
                {save.isPending ? "Saving…" : "Save settings"}
              </button>
              <span className="text-xs text-muted-foreground">Every change is written to the decision record.</span>
            </div>
          )}
        </form>
      )}
    </StaffShell>
  );
}
