import { useMutation } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

import { StatBridgeMark } from "@/components/statbridge/SiteChrome";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useStaff } from "@/lib/staff/useStaff";

const title = "Staff sign in — StatBridge";
const description = "Sign-in for Statistics South Africa communications staff using StatBridge.";

export const Route = createFileRoute("/staff/sign-in")({
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
  component: SignInPage,
});

function SignInPage() {
  const navigate = useNavigate();
  const { profile } = useStaff();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (profile) navigate({ to: "/staff/review", replace: true });
  }, [profile, navigate]);

  const signIn = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => navigate({ to: "/staff/review" }),
  });

  return (
    <div className="grid min-h-screen place-items-center bg-background px-4">
      <div className="w-full max-w-sm">
        <Link to="/" className="inline-block">
          <StatBridgeMark />
        </Link>
        <h1 className="mt-6 text-2xl font-semibold tracking-tight">Staff sign in</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          For Stats SA communications staff. Your role is held on the server and cannot be changed from this page.
        </p>

        <form
          className="mt-6 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            signIn.mutate();
          }}
        >
          <div>
            <label htmlFor="email" className="text-sm font-medium">
              Work email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-surface px-3 py-2 text-sm outline-none focus:border-ring"
            />
          </div>
          <div>
            <label htmlFor="password" className="text-sm font-medium">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-surface px-3 py-2 text-sm outline-none focus:border-ring"
            />
          </div>

          {signIn.isError && (
            <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              That email and password did not match an active staff account.
            </p>
          )}

          <Button type="submit" className="w-full" disabled={signIn.isPending || !email || !password}>
            {signIn.isPending && <Loader2 aria-hidden className="size-4 animate-spin" />}
            Sign in
          </Button>
        </form>

        <p className="mt-6 text-xs text-muted-foreground">
          Demonstration accounts are clearly marked once signed in. Nothing on the public side of StatBridge depends on
          having an account.
        </p>
      </div>
    </div>
  );
}
