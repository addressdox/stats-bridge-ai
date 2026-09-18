/** Your own account: name and password. */
import { useMutation } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Panel } from "@/components/statbridge/desk-ui";
import { StaffShell } from "@/components/statbridge/StaffShell";
import { supabase } from "@/integrations/supabase/client";
import { updateMyProfile } from "@/lib/statbridge/admin.functions";
import { ROLE_LABELS, useStaff } from "@/lib/staff/useStaff";

const title = "My account — StatBridge staff";
const description = "Change your name and your password for the Stats SA information desk.";

export const Route = createFileRoute("/staff/account")({
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
  component: AccountPage,
});

const inputClass = "w-full rounded-md border border-border bg-surface px-3 py-1.5 text-sm";

function AccountPage() {
  const { profile } = useStaff();
  const saveProfile = useServerFn(updateMyProfile);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");

  useEffect(() => {
    if (profile) setFullName(profile.full_name);
    void supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ""));
  }, [profile]);

  const nameChange = useMutation({
    mutationFn: () => saveProfile({ data: { fullName } }),
    onSuccess: () => {
      toast.success("Your name has been updated.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const passwordChange = useMutation({
    mutationFn: async () => {
      if (password.length < 10) throw new Error("Use at least 10 characters.");
      if (password !== confirmation) throw new Error("The two passwords do not match.");
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Your password has been changed.");
      setPassword("");
      setConfirmation("");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <StaffShell title="My account">
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Your details">
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              nameChange.mutate();
            }}
          >
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Full name</span>
              <input className={`${inputClass} mt-1`} value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </label>
            <p className="text-sm text-muted-foreground">
              Signed in as <span className="font-medium text-foreground">{email || "—"}</span>
              {profile && <> · {ROLE_LABELS[profile.role]}</>}
            </p>
            <button
              type="submit"
              disabled={nameChange.isPending}
              className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
            >
              {nameChange.isPending ? "Saving…" : "Save name"}
            </button>
          </form>
        </Panel>

        <Panel title="Change your password" description="Choose something long that you do not use anywhere else.">
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              passwordChange.mutate();
            }}
          >
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">New password</span>
              <input
                type="password"
                autoComplete="new-password"
                className={`${inputClass} mt-1`}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Repeat new password
              </span>
              <input
                type="password"
                autoComplete="new-password"
                className={`${inputClass} mt-1`}
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
              />
            </label>
            <button
              type="submit"
              disabled={passwordChange.isPending}
              className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
            >
              {passwordChange.isPending ? "Changing…" : "Change password"}
            </button>
          </form>
        </Panel>
      </div>
    </StaffShell>
  );
}
