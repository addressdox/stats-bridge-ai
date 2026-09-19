import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Loader2, Send } from "lucide-react";
import { getMediaEmailDelivery, sendMediaResponse } from "@/lib/staff/media-email.functions";

export function MediaEmailDelivery({ caseId, canRelease, approved, hasUnsavedChanges, hasGaps, onUpdated }: {
  caseId: string;
  canRelease: boolean;
  approved: boolean;
  hasUnsavedChanges: boolean;
  hasGaps: boolean;
  onUpdated: () => void;
}) {
  const queryClient = useQueryClient();
  const queryKey = ["media-email-delivery", caseId];
  const delivery = useQuery({
    queryKey,
    queryFn: () => getMediaEmailDelivery({ data: { caseId } }),
    refetchInterval: (query) => query.state.data?.state === "queued" ? 3000 : false,
  });
  const send = useMutation({
    mutationFn: () => sendMediaResponse({ data: { caseId } }),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey });
      onUpdated();
    },
  });
  const status = delivery.data;
  const sent = status?.state === "sent";
  // A queued attempt can be retried after a lost request; the database lease
  // refuses concurrent sends and the provider deduplicates the same release.
  const blocked = !canRelease || !status?.configured || !status.validRecipient || sent ||
    (!status.released && (!approved || hasUnsavedChanges || hasGaps));

  return (
    <section className="surface-panel p-4" aria-label="Email delivery">
      <h2 className="text-sm font-semibold">Email response</h2>
      {delivery.isPending && <p className="mt-2 text-xs text-muted-foreground">Loading email delivery…</p>}
      {delivery.isError && <p role="alert" className="mt-2 text-xs text-destructive">Email delivery status could not be loaded.</p>}
      {status && <>
        <p className="mt-2 break-all text-xs text-muted-foreground">To: {status.recipient || "No email address recorded"}</p>
        <p role="status" className={`mt-2 flex items-center gap-1.5 text-sm ${sent ? "text-accent" : status.state === "failed" ? "text-destructive" : "text-muted-foreground"}`}>
          {sent && <CheckCircle2 aria-hidden className="size-4" />}
          {sent ? "Sent" : status.state === "failed" ? "Failed to send" : status.state === "queued" ? "Sending — awaiting confirmation" : "Not sent"}
        </p>
        {status.sentAt && <p className="mt-1 text-xs text-muted-foreground">{new Date(status.sentAt).toLocaleString("en-ZA")}</p>}
        {sent && <p className="mt-2 text-xs text-muted-foreground">Accepted by the email service for delivery.</p>}
        {!status.configured && <p className="mt-2 text-xs text-warn-foreground">Email delivery is not configured. An administrator must connect the approved sender.</p>}
        {!status.validRecipient && <p className="mt-2 text-xs text-warn-foreground">This request needs a valid email address before it can be sent.</p>}
        {!sent && !status.released && <p className="mt-2 text-xs text-muted-foreground">Save your edits, resolve any gaps and approve the response before sending.</p>}
        {status.error && <p role="alert" className="mt-2 text-xs text-destructive">{status.error}</p>}
      </>}
      {send.isError && <p role="alert" className="mt-2 text-xs text-destructive">{send.error.message}</p>}
      {!sent && <button
        type="button"
        disabled={blocked || send.isPending || delivery.isPending || delivery.isError}
        onClick={() => send.mutate()}
        className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
      >
        {send.isPending ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <Send aria-hidden className="size-4" />}
        {send.isPending ? "Sending…" : status?.state === "failed" || status?.state === "queued" ? "Retry send" : "Send approved response"}
      </button>}
      {!canRelease && <p className="mt-2 text-xs text-muted-foreground">Response-release permission is required to send.</p>}
    </section>
  );
}
