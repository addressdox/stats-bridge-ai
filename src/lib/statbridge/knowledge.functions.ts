import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

type AuthContext = { userId: string; supabase: { rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }> } };

async function requirePermission(context: AuthContext, permission: string) {
  const { data, error } = await context.supabase.rpc("has_permission", { _uid: context.userId, _permission: permission });
  if (error || data !== true) throw new Error(`Your account does not have ${permission} access.`);
  return context.userId;
}

const sourceType = z.enum(["statistical_release", "media_release", "methodology", "organisational_page", "faq_page", "other"]);
const sourceInput = z.object({
  title: z.string().trim().min(3).max(300),
  publisher: z.string().trim().min(2).max(200).default("Statistics South Africa"),
  sourceType: sourceType.default("other"),
  topic: z.string().trim().max(160).nullish(),
  publishedOn: z.string().trim().max(10).nullish(),
  referencePeriod: z.string().trim().max(120).nullish(),
});

function officialSouthAfricanUrl(value: string) {
  const url = new URL(value);
  if (url.protocol !== "https:") throw new Error("Use an HTTPS address.");
  const host = url.hostname.toLowerCase();
  const allowed = host.endsWith(".gov.za") || host === "gov.za" || host.endsWith(".statssa.gov.za") || host === "statssa.gov.za" || host.endsWith(".resbank.co.za") || host === "resbank.co.za";
  if (!allowed) throw new Error("Only official South African government, Stats SA or Reserve Bank URLs can be ingested.");
  return url.toString();
}

function cleanText(value: string) {
  return value.replace(/\r/g, "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").replace(/[ \t]{2,}/g, " ").trim();
}

function htmlToText(html: string) {
  return cleanText(html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&quot;/gi, '"').replace(/&#39;/gi, "'")
    .replace(/\s+/g, " "));
}

function chunks(text: string, max = 1800) {
  const paragraphs = cleanText(text).split(/\n\s*\n/).filter(Boolean);
  const out: string[] = [];
  let current = "";
  for (const paragraph of paragraphs) {
    if ((current + "\n\n" + paragraph).length > max && current) { out.push(current); current = ""; }
    if (paragraph.length > max) {
      for (let i = 0; i < paragraph.length; i += max) out.push(paragraph.slice(i, i + max));
    } else current = current ? `${current}\n\n${paragraph}` : paragraph;
  }
  if (current) out.push(current);
  return out.slice(0, 500);
}

async function extractFile(bytes: Uint8Array, name: string, mime: string) {
  const lower = name.toLowerCase();
  if (mime === "application/pdf" || lower.endsWith(".pdf")) {
    const { extractText } = await import("unpdf");
    const result = await extractText(bytes, { mergePages: false });
    const pages = Array.isArray(result.text) ? result.text : [result.text];
    return { text: pages.join("\n\n"), pageCount: result.totalPages, pages };
  }
  if (lower.endsWith(".docx") || mime.includes("wordprocessingml")) {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
    return { text: result.value, pageCount: null, pages: null };
  }
  if (lower.endsWith(".xlsx") || lower.endsWith(".xls") || mime.includes("spreadsheet") || mime.includes("excel")) {
    const XLSX = await import("xlsx");
    const workbook = XLSX.read(bytes, { type: "array" });
    const text = workbook.SheetNames.map((sheet) => `## ${sheet}\n${XLSX.utils.sheet_to_csv(workbook.Sheets[sheet]!)}`).join("\n\n");
    return { text, pageCount: workbook.SheetNames.length, pages: null };
  }
  if (lower.endsWith(".csv") || mime === "text/csv") {
    const Papa = await import("papaparse");
    const raw = new TextDecoder().decode(bytes);
    const parsed = Papa.parse<string[]>(raw, { skipEmptyLines: true });
    return { text: parsed.data.map((row) => row.join(" | ")).join("\n"), pageCount: null, pages: null };
  }
  if (lower.endsWith(".md") || lower.endsWith(".txt") || mime.startsWith("text/")) {
    return { text: new TextDecoder().decode(bytes), pageCount: null, pages: null };
  }
  throw new Error("Unsupported file. Use PDF, DOCX, XLS/XLSX, CSV, Markdown or plain text.");
}

async function createRecords(db: any, actor: string, meta: z.infer<typeof sourceInput>, location: { url?: string; path?: string }, file?: { name: string; mime: string; size: number }) {
  const { data: source, error: sourceError } = await db.from("sources").insert({
    title: meta.title, publisher: meta.publisher, source_type: meta.sourceType, topic: meta.topic || null,
    canonical_url: location.url ?? null, created_by: actor,
  }).select("id").single();
  if (sourceError) throw new Error(sourceError.message);
  const { data: version, error: versionError } = await db.from("source_versions").insert({
    source_id: source.id, version_label: meta.publishedOn || `Imported ${new Date().toISOString().slice(0, 10)}`,
    published_on: meta.publishedOn || null, reference_period: meta.referencePeriod || null,
    file_path: location.path ?? null, original_url: location.url ?? null, status: "pending", ingest_state: "waiting", created_by: actor,
  }).select("id").single();
  if (versionError) throw new Error(versionError.message);
  const { data: job, error: jobError } = await db.from("knowledge_ingestion_jobs").insert({
    source_version_id: version.id, kind: location.url ? "url" : "file", state: location.url ? "discovered" : "uploaded",
    file_name: file?.name ?? null, mime_type: file?.mime ?? null, file_size: file?.size ?? null,
    source_url: location.url ?? null, storage_path: location.path ?? null, created_by: actor,
  }).select("id").single();
  if (jobError) throw new Error(jobError.message);
  return { sourceId: source.id, versionId: version.id, jobId: job.id };
}

async function finishIngestion(db: any, actor: string, ids: { versionId: string; jobId: string }, extracted: { text: string; pageCount: number | null; pages: string[] | null }) {
  const text = cleanText(extracted.text).slice(0, 1_500_000);
  if (text.length < 40) throw new Error("No usable text could be extracted from this source.");
  const rows = extracted.pages
    ? extracted.pages.flatMap((page, pageIndex) => chunks(page).map((content, index) => ({ source_version_id: ids.versionId, position: pageIndex * 1000 + index, page_number: pageIndex + 1, section_label: `Page ${pageIndex + 1}`, content })))
    : chunks(text).map((content, position) => ({ source_version_id: ids.versionId, position, page_number: null, section_label: position === 0 ? "Extracted text" : null, content }));
  const { error: passageError } = await db.from("passages").insert(rows);
  if (passageError) throw new Error(passageError.message);
  await db.from("source_versions").update({ ingest_state: "done", ingest_note: `${rows.length} searchable extracts created; human verification and approval required.`, page_count: extracted.pageCount }).eq("id", ids.versionId);
  await db.from("knowledge_ingestion_jobs").update({ state: "needs_verification", progress: 100, completed_at: new Date().toISOString(), detected_metadata: { characters: text.length, passages: rows.length, pageCount: extracted.pageCount } }).eq("id", ids.jobId);
  await db.from("knowledge_ingestion_events").insert({ job_id: ids.jobId, state: "needs_verification", message: "Text extracted. Awaiting human verification and approval.", actor_id: actor, detail: { passages: rows.length } });
  return { ...ids, passages: rows.length, characters: text.length };
}

export const ingestKnowledgeFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => sourceInput.extend({ storagePath: z.string().min(3).max(500), fileName: z.string().min(1).max(255), mimeType: z.string().max(150), fileSize: z.number().int().min(1).max(25_000_000) }).parse(input))
  .handler(async ({ context, data }) => {
    const actor = await requirePermission(context as never, "sources.upload");
    if (!data.storagePath.startsWith(`${actor}/`)) throw new Error("Invalid private file path.");
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const ids = await createRecords(db, actor, data, { path: data.storagePath }, { name: data.fileName, mime: data.mimeType, size: data.fileSize });
    try {
      await db.from("knowledge_ingestion_jobs").update({ state: "extracting", progress: 20, started_at: new Date().toISOString() }).eq("id", ids.jobId);
      const { data: blob, error } = await db.storage.from("knowledge-files").download(data.storagePath);
      if (error || !blob) throw new Error(error?.message ?? "The private file could not be read.");
      return await finishIngestion(db, actor, ids, await extractFile(new Uint8Array(await blob.arrayBuffer()), data.fileName, data.mimeType));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Extraction failed.";
      await db.from("knowledge_ingestion_jobs").update({ state: "failed", error_message: message }).eq("id", ids.jobId);
      await db.from("source_versions").update({ ingest_state: "failed", ingest_note: message }).eq("id", ids.versionId);
      throw new Error(message);
    }
  });

export const ingestKnowledgeUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => sourceInput.extend({ url: z.string().url().max(1000) }).parse(input))
  .handler(async ({ context, data }) => {
    const actor = await requirePermission(context as never, "sources.upload");
    const url = officialSouthAfricanUrl(data.url);
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const ids = await createRecords(db, actor, data, { url });
    try {
      await db.from("knowledge_ingestion_jobs").update({ state: "extracting", progress: 20, started_at: new Date().toISOString() }).eq("id", ids.jobId);
      const response = await fetch(url, { redirect: "follow", headers: { "user-agent": "StatBridge-Knowledge/1.0" }, signal: AbortSignal.timeout(20_000) });
      if (!response.ok) throw new Error(`The official page returned HTTP ${response.status}.`);
      const finalUrl = officialSouthAfricanUrl(response.url);
      if (!finalUrl) throw new Error("Redirected outside the approved South African source boundary.");
      const contentType = response.headers.get("content-type")?.split(";")[0] ?? "text/html";
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.byteLength > 25_000_000) throw new Error("The source is larger than 25 MB.");
      const extracted = contentType === "text/html" ? { text: htmlToText(new TextDecoder().decode(bytes)), pageCount: null, pages: null } : await extractFile(bytes, new URL(finalUrl).pathname, contentType);
      return await finishIngestion(db, actor, ids, extracted);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Extraction failed.";
      await db.from("knowledge_ingestion_jobs").update({ state: "failed", error_message: message }).eq("id", ids.jobId);
      await db.from("source_versions").update({ ingest_state: "failed", ingest_note: message }).eq("id", ids.versionId);
      throw new Error(message);
    }
  });

export const listKnowledgeSources = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requirePermission(context as never, "sources.view");
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const [versions, observations, passages, jobs] = await Promise.all([
      db.from("source_versions").select("id,version_label,status,ingest_state,ingest_note,published_on,reference_period,page_count,original_url,file_path,withdrawal_reason,created_at,sources(title,publisher,source_type,audience,topic)").order("created_at", { ascending: false }).limit(200),
      db.from("observations").select("source_version_id,verified_at").limit(5000),
      db.from("passages").select("source_version_id").limit(10000),
      db.from("knowledge_ingestion_jobs").select("id,source_version_id,state,progress,error_message,file_name,kind,created_at").order("created_at", { ascending: false }).limit(300),
    ]);
    if (versions.error) throw new Error(versions.error.message);
    const counts = new Map<string, { passages: number; figures: number; verified: number }>();
    for (const p of passages.data ?? []) { const c=counts.get(p.source_version_id) ?? {passages:0,figures:0,verified:0}; c.passages++; counts.set(p.source_version_id,c); }
    for (const o of observations.data ?? []) { const c=counts.get(o.source_version_id) ?? {passages:0,figures:0,verified:0}; c.figures++; if(o.verified_at)c.verified++; counts.set(o.source_version_id,c); }
    const jobByVersion = new Map((jobs.data ?? []).map((j) => [j.source_version_id, j]));
    return (versions.data ?? []).map((v) => ({ ...v, counts: counts.get(v.id) ?? { passages: 0, figures: 0, verified: 0 }, job: jobByVersion.get(v.id) ?? null }));
  });

export const decideKnowledgeSource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ versionId: z.string().uuid(), action: z.enum(["approve","reject","withdraw"]), reason: z.string().trim().max(1000).nullish() }).parse(input))
  .handler(async ({ context, data }) => {
    const actor = await requirePermission(context as never, "sources.approve");
    if (data.action !== "approve" && (!data.reason || data.reason.length < 3)) throw new Error("A reason is required.");
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { data: version } = await db.from("source_versions").select("source_id,status,ingest_state").eq("id", data.versionId).maybeSingle();
    if (!version) throw new Error("Source version not found.");
    if (data.action === "approve") {
      if (version.ingest_state !== "done") throw new Error("Complete extraction before approval.");
      const { count } = await db.from("passages").select("id", { count: "exact", head: true }).eq("source_version_id", data.versionId);
      if (!count) throw new Error("This version has no extracted passages to approve.");
      const { count: unverified } = await db.from("observations").select("id", { count: "exact", head: true }).eq("source_version_id", data.versionId).is("verified_at", null);
      if (unverified) throw new Error("Every extracted figure must be verified before this version can be approved.");
      const { error: approvalError } = await db.from("source_versions").update({ status: "approved", approval_basis: "official", approved_by: actor, approved_at: new Date().toISOString() }).eq("id", data.versionId).eq("status", "pending");
      if (approvalError) throw new Error(approvalError.message);
      await db.from("sources").update({ current_version_id: data.versionId }).eq("id", version.source_id);
      await db.from("knowledge_ingestion_jobs").update({ state: "approved" }).eq("source_version_id", data.versionId);
      try {
        const { backfillEmbeddings } = await import("@/lib/statbridge/embeddings.server");
        await backfillEmbeddings(db, 120);
      } catch {
        // Approval remains valid; keyword search is available while vector indexing retries later.
      }
    } else if (data.action === "reject") {
      await db.from("source_versions").update({ status: "rejected", change_note: data.reason! }).eq("id", data.versionId);
    } else {
      await db.from("source_versions").update({ status: "withdrawn", withdrawal_reason: data.reason!, withdrawn_by: actor, withdrawn_at: new Date().toISOString() }).eq("id", data.versionId);
      await db.from("sources").update({ current_version_id: null }).eq("current_version_id", data.versionId);
    }
    await db.from("audit_events").insert({ actor_id: actor, actor_role: "staff", action: `source_${data.action}d`, entity_kind: "source_version", entity_id: data.versionId, detail: { reason: data.reason ?? null }, origin: "screen" });
    return { ok: true };
  });